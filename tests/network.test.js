import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { GameServer } from "../server/GameServer.js";
import {
  validCommand,
  NETWORK,
  sanitizeName,
} from "../src/network/Protocol.js";
import { RateLimiter } from "../server/RateLimiter.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function harness(run, options = {}) {
  const server = new GameServer({ port: 0, ...options });
  const address = await server.start();
  const clients = [];
  async function client(
    mode = "create",
    code = "",
    name = "Ranger",
    gameMode = "tactical",
  ) {
    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/game-socket`, {
      origin: "http://127.0.0.1:5173",
    });
    clients.push(ws);
    const messages = [];
    ws.on("message", (data) => messages.push(JSON.parse(data.toString())));
    ws.on("error", () => {});
    await once(ws, "open");
    const wait = async (predicate) => {
      for (let i = 0; i < 150; i++) {
        const found = messages.find(predicate);
        if (found) return found;
        await sleep(10);
      }
      throw new Error("Timed out waiting for packet");
    };
    ws.send(
      JSON.stringify({
        t: "join",
        protocol: NETWORK.protocol,
        mode,
        code,
        name,
        gameMode,
      }),
    );
    const welcome = await wait((m) => m.t === "welcome");
    return { ws, messages, wait, welcome };
  }
  try {
    await run({ server, client, address });
  } finally {
    clients.forEach((ws) => ws.terminate());
    await server.stop();
  }
}
test("Input protocol rejects impossible movement, malformed numbers, invented weapons and unsafe names", () => {
  const c = [1, 0, -1, 0, 0, 0, 0, 0, 0];
  assert.equal(validCommand(c), true);
  for (const [index, value] of [
    [1, 100],
    [3, NaN],
    [4, 10],
    [5, 2],
    [8, 9],
    [0, -1],
  ]) {
    const bad = [...c];
    bad[index] = value;
    assert.equal(validCommand(bad), false);
  }
  assert.equal(sanitizeName("<script>alert(1)</script>").includes("<"), false);
  assert.ok(sanitizeName("x".repeat(40)).length <= 18);
  const limiter = new RateLimiter(2, 1);
  assert.equal(limiter.allow("a", 1, 0), true);
  assert.equal(limiter.allow("a", 1, 0), true);
  assert.equal(limiter.allow("a", 1, 0), false);
  assert.equal(limiter.allow("a", 1, 1000), true);
});
test("Two real WebSocket clients share a room, move under server authority, and disconnect without ghosts", async () =>
  harness(async ({ server, client }) => {
    const a = await client("create", "", "<img onerror=alert(1)>");
    const b = await client("join", a.welcome.code, "Teammate");
    assert.equal(b.welcome.code, a.welcome.code);
    assert.notEqual(a.welcome.id, b.welcome.id);
    assert.equal(b.welcome.roster.length, 2);
    assert.equal(b.welcome.roster[0].name.includes("<"), false);
    const room = server.rooms.get(a.welcome.code),
      player = room.players.get(a.welcome.id),
      start = player.state.position.z;
    let seq = 0;
    for (let i = 0; i < 15; i++) {
      a.ws.send(
        JSON.stringify({
          t: "input",
          commands: Array.from({ length: 4 }, () => [
            ++seq,
            0,
            -1,
            0,
            0,
            0,
            0,
            0,
            0,
          ]),
        }),
      );
      await sleep(34);
    }
    assert.ok(player.state.position.z < start - 1);
    assert.ok(player.state.position.z > start - 4);
    await b.wait(
      (m) =>
        m.t === "snapshot" &&
        m.players.some((p) => p[0] === player.id && p[3] < start - 1),
    );
    assert.ok(room.history.length <= 10);
    assert.ok(room.history.length > 0);
    const closed = once(a.ws, "close");
    a.ws.send(
      JSON.stringify({
        t: "damage",
        target: b.welcome.id,
        damage: 1000,
        position: [500, 0, 500],
      }),
    );
    const [code] = await closed;
    assert.equal(code, 1008);
    await b.wait((m) => m.t === "roster" && m.players.length === 1);
    assert.equal(room.players.size, 1);
    const bClosed = once(b.ws, "close");
    b.ws.close();
    await bClosed;
    await sleep(20);
    assert.equal(server.rooms.size, 0);
  }));
test("Server rejects oversized packets and impossible input without stopping other clients", async () =>
  harness(async ({ client }) => {
    const a = await client(),
      b = await client("join", a.welcome.code);
    const aClose = once(a.ws, "close");
    a.ws.send(
      JSON.stringify({ t: "input", commands: [[1, 500, 0, 0, 0, 0, 0, 0, 0]] }),
    );
    assert.equal((await aClose)[0], 1008);
    b.ws.send(JSON.stringify({ t: "ping", at: 12 }));
    await b.wait((m) => m.t === "pong" && m.at === 12);
    const bClose = once(b.ws, "close");
    b.ws.send("x".repeat(5000));
    assert.equal((await bClose)[0], 1009);
  }));
test("Quick Play excludes private and full rooms and separates requested modes", async () =>
  harness(
    async ({ client }) => {
      const privateRoom = await client("create");
      const publicA = await client("quick");
      assert.notEqual(publicA.welcome.code, privateRoom.welcome.code);
      const publicB = await client("quick");
      assert.equal(publicB.welcome.code, publicA.welcome.code);
      const overflow = await client("quick");
      assert.notEqual(overflow.welcome.code, publicA.welcome.code);
      const dm = await client("quick", "", "DM", "deathmatch");
      assert.equal(dm.welcome.match.map, "district");
      assert.notEqual(dm.welcome.code, overflow.welcome.code);
    },
    { maxPlayers: 2 },
  ));
