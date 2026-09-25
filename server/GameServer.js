import { createServer } from "node:http";
import { randomInt } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { KestrelMap } from "../src/maps/KestrelMap.js";
import { DistrictMap } from "../src/maps/DistrictMap.js";
import {
  NETWORK,
  sanitizeName,
  validCommand,
  packState,
} from "../src/network/Protocol.js";
import { Room } from "./Room.js";
import { RateLimiter } from "./RateLimiter.js";
import { validAction } from "./Combat.js";
import { sanitizeSkins } from "../src/weapons/Skins.js";

export class GameServer {
  constructor(options = {}) {
    this.options = {
      host: "127.0.0.1",
      port: 3001,
      maxRooms: 32,
      maxPlayers: 20,
      origins: [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:4173",
        "http://localhost:4173",
      ],
      ...options,
    };
    this.rooms = new Map();
    this.world = new KestrelMap(null, { collisionOnly: true });
    this.district = new DistrictMap(null, { collisionOnly: true });
    this.connections = new RateLimiter(20, 0.2);
    this.creations = new RateLimiter(6, 0.05);
    this.activeIPs = new Map();
    this.http = createServer((req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      if (req.url === "/health" && req.method === "GET") {
        res.end(
          JSON.stringify({
            ok: true,
            mode: "combat",
            rooms: this.rooms.size,
            protocol: NETWORK.protocol,
          }),
        );
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ error: "Not found" }));
    });
    this.wss = new WebSocketServer({
      noServer: true,
      maxPayload: NETWORK.maxPacketBytes,
      perMessageDeflate: false,
    });
    this.http.on("upgrade", (req, socket, head) => {
      const ip = req.socket.remoteAddress;
      if (
        req.url !== "/game-socket" ||
        !this.options.origins.includes(req.headers.origin) ||
        !this.connections.allow(ip) ||
        (this.activeIPs.get(ip) || 0) >= 12
      ) {
        socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.activeIPs.set(ip, (this.activeIPs.get(ip) || 0) + 1);
        this.accept(ws, ip);
      });
    });
  }
  send(ws, message) {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 128 * 1024) {
      ws.close(1008, "Slow connection");
      return;
    }
    ws.send(JSON.stringify(message));
  }
  broadcast(room, message) {
    for (const p of room.players.values()) this.send(p.socket, message);
  }
  accept(ws, ip) {
    const messages = new RateLimiter(120, 80),
      commands = new RateLimiter(180, 140);
    let room = null,
      player = null,
      alive = true;
    const joinTimeout = setTimeout(() => ws.close(1008, "Join timeout"), 10000);
    const heartbeat = setInterval(() => {
      if (!alive) {
        ws.terminate();
        return;
      }
      alive = false;
      if (player) player.pingSent = performance.now();
      ws.ping();
    }, 15000);
    ws.on("pong", () => {
      alive = true;
      if (player?.pingSent)
        player.ping = Math.round(performance.now() - player.pingSent);
    });
    ws.on("error", () => {});
    ws.on("message", (buffer, isBinary) => {
      if (isBinary || !messages.allow("socket")) {
        ws.close(1008, "Invalid traffic");
        return;
      }
      let m;
      try {
        m = JSON.parse(buffer.toString());
      } catch {
        ws.close(1008, "Malformed packet");
        return;
      }
      if (!m || typeof m !== "object" || Array.isArray(m)) {
        ws.close(1008, "Invalid packet");
        return;
      }
      if (m.t === "join" && !player) {
        const gameMode = m.gameMode || "tactical";
        if (
          m.protocol !== NETWORK.protocol ||
          typeof m.name !== "string" ||
          m.name.length > 128 ||
          !["create", "join", "quick"].includes(m.mode) ||
          !["tactical", "deathmatch"].includes(gameMode)
        ) {
          ws.close(1008, "Invalid join");
          return;
        }
        if (m.mode === "join") {
          if (typeof m.code !== "string" || !/^[A-Z2-9]{5}$/.test(m.code)) {
            this.send(ws, {
              t: "error",
              message: "Enter a valid five-character room code.",
            });
            return;
          }
          room = this.rooms.get(m.code);
          if (!room) {
            this.send(ws, {
              t: "error",
              message: "Room not found. Check the code or create a room.",
            });
            return;
          }
        } else {
          if (m.mode === "quick")
            room = [...this.rooms.values()].find(
              (r) =>
                r.public &&
                r.mode.id === gameMode &&
                !r.ended &&
                r.players.size < r.capacity,
            );
          if (!room) {
            if (
              !this.creations.allow(ip) ||
              this.rooms.size >= this.options.maxRooms
            ) {
              this.send(ws, {
                t: "error",
                message: "Room creation limit reached. Try again shortly.",
              });
              return;
            }
            const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
            let code;
            do {
              code = Array.from(
                { length: 5 },
                () => alphabet[randomInt(alphabet.length)],
              ).join("");
            } while (this.rooms.has(code));
            room = new Room(
              code,
              gameMode === "deathmatch" ? this.district : this.world,
              gameMode === "deathmatch"
                ? this.options.maxPlayers
                : Math.min(10, this.options.maxPlayers),
              gameMode,
              m.mode === "quick",
            );
            this.rooms.set(code, room);
          }
        }
        player = room.add(ws, sanitizeName(m.name));
        if (!player) {
          this.send(ws, { t: "error", message: "This room is full." });
          return;
        }
        clearTimeout(joinTimeout);
        player.skins = sanitizeSkins(m.skins);
        player.pingSent = performance.now();
        ws.ping();
        if ([0, 2].includes(m.primary)) {
          player.nextLoadout.primary = m.primary;
          room.spawn(player);
        }
        this.send(ws, {
          t: "welcome",
          protocol: NETWORK.protocol,
          id: player.id,
          code: room.code,
          roster: room.roster(),
          state: packState(player),
          snapshotHz: NETWORK.snapshotHz,
          match: room.match(),
        });
        this.broadcast(room, { t: "roster", players: room.roster() });
        return;
      }
      if (m.t === "ping" && Number.isFinite(m.at)) {
        this.send(ws, { t: "pong", at: m.at });
        if (player && !player.challengeAt) {
          player.challengeAt = performance.now();
          this.send(ws, { t: "probe", at: player.challengeAt });
        }
        return;
      }
      if (m.t === "probe" && player && m.at === player.challengeAt) {
        player.ping = Math.min(
          2000,
          Math.round(performance.now() - player.challengeAt),
        );
        player.challengeAt = 0;
        return;
      }
      if (m.t === "input" && player) {
        if (
          !Array.isArray(m.commands) ||
          m.commands.length < 1 ||
          m.commands.length > 12 ||
          !commands.allow("commands", m.commands.length) ||
          player.queue.length + m.commands.length > 60
        ) {
          ws.close(1008, "Input limit");
          return;
        }
        let seq = player.lastSequence;
        for (const c of m.commands) {
          if (!validCommand(c) || c[0] <= seq || c[0] > seq + 240) {
            ws.close(1008, "Invalid input");
            return;
          }
          seq = c[0];
        }
        player.lastSequence = seq;
        player.lastInput = performance.now();
        player.queue.push(...m.commands);
        return;
      }
      if (m.t === "action" && player) {
        if (
          !validAction(m) ||
          m.seq > player.lastSequence ||
          player.actions.length >= 32
        ) {
          ws.close(1008, "Invalid action");
          return;
        }
        if (m.action === "fire" && m.shotId <= (player.lastShotId || 0)) return;
        if (m.action === "fire") player.lastShotId = m.shotId;
        player.actions.push(m);
        return;
      }
      if (
        m.t === "loadout" &&
        player &&
        [0, 2].includes(m.primary) &&
        m.secondary === 1
      ) {
        player.nextLoadout = { primary: m.primary, secondary: 1 };
        player.skins = sanitizeSkins(m.skins);
        return;
      }
      // No client position, damage, health, ammo or result messages are accepted.
      ws.close(1008, "Unsupported command");
    });
    ws.on("close", () => {
      clearTimeout(joinTimeout);
      clearInterval(heartbeat);
      const active = (this.activeIPs.get(ip) || 1) - 1;
      if (active) this.activeIPs.set(ip, active);
      else this.activeIPs.delete(ip);
      if (room && player) {
        room.players.delete(player.id);
        if (room.players.size === 0) this.rooms.delete(room.code);
        else this.broadcast(room, { t: "roster", players: room.roster() });
      }
    });
  }
  async start() {
    await new Promise((resolve, reject) => {
      this.http.once("error", reject);
      this.http.listen(this.options.port, this.options.host, resolve);
    });
    let last = performance.now(),
      accumulator = 0,
      snapshotAccumulator = 0;
    this.timer = setInterval(() => {
      const now = performance.now(),
        elapsed = Math.min((now - last) / 1000, 0.1);
      last = now;
      accumulator += elapsed;
      snapshotAccumulator += elapsed;
      while (accumulator >= 1 / NETWORK.simulationHz) {
        for (const room of this.rooms.values()) room.step(now);
        for (const room of this.rooms.values())
          for (const event of room.events.splice(0))
            this.broadcast(room, event);
        accumulator -= 1 / NETWORK.simulationHz;
      }
      if (snapshotAccumulator >= 1 / NETWORK.snapshotHz) {
        snapshotAccumulator %= 1 / NETWORK.snapshotHz;
        for (const room of this.rooms.values()) {
          room.record(now);
          this.broadcast(room, {
            t: "snapshot",
            at: now,
            players: room.snapshot(),
            match: room.match(),
          });
        }
      }
    }, 1000 / 60);
    this.cleanup = setInterval(() => {
      this.connections.prune();
      this.creations.prune();
    }, 60000);
    return this.http.address();
  }
  async stop() {
    clearInterval(this.timer);
    clearInterval(this.cleanup);
    for (const ws of this.wss.clients) ws.terminate();
    await new Promise((resolve) => this.wss.close(resolve));
    await new Promise((resolve) => this.http.close(resolve));
  }
}
