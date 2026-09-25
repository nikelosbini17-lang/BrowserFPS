import { test, expect } from "@playwright/test";
import { WebSocket } from "ws";
import { GameServer } from "../../server/GameServer.js";
import { isolateLook } from "../helpers/look.js";
test("Three-client public Deathmatch: drop-in, skins, weapons, death, respawn, cleanup and final standings", async ({
  browser,
}) => {
  const server = new GameServer({ port: 0 }),
    address = await server.start(),
    contexts = [],
    sockets = [],
    errors = [];
  try {
    const pages = [];
    let end;
    for (const name of ["Alpha", "Bravo", "Charlie"]) {
      const context = await browser.newContext();
      contexts.push(context);
      await context.addInitScript(() =>
        localStorage.setItem(
          "linebreak-settings",
          JSON.stringify({ quality: "low", shadows: false, maxFps: 60 }),
        ),
      );
      const page = await context.newPage();
      pages.push(page);
      page.on("pageerror", (e) => errors.push(e.message));
      await page.routeWebSocket("**/game-socket", (route) => {
        const socket = new WebSocket(
          `ws://127.0.0.1:${address.port}/game-socket`,
          { origin: "http://127.0.0.1:5173" },
        );
        sockets.push(socket);
        const queue = [];
        socket.on("open", () => queue.splice(0).forEach((m) => socket.send(m)));
        socket.on("message", (data) => route.send(data.toString()));
        route.onMessage((m) =>
          socket.readyState === 1 ? socket.send(m) : queue.push(m),
        );
        route.onClose(() => socket.close());
        page.on("close", () => socket.close());
        socket.on("close", () => route.close());
        socket.on("error", () => {});
      });
      await page.goto("/");
      await isolateLook(page);
      await page.locator('[data-action="play"]').click();
      await page.locator('[data-action="deathmatch"]').click();
      await page.locator("#dm-name").fill(name);
      await page.locator('[data-action="dm-quick"]').click();
      await expect(page.locator("#connected-room-code")).toBeVisible();
      expect(await page.evaluate(() => window.__game.world.id)).toBe(
        "district",
      );
      const ends = await page.evaluate(
        () => window.__game.network.match.endsAt,
      );
      if (end) expect(ends).toBe(end);
      else end = ends;
    }
    const [a, b, c] = pages,
      room = [...server.rooms.values()][0];
    expect(server.rooms.size).toBe(1);
    expect(room.public).toBe(true);
    expect(room.players.size).toBe(3);
    for (const page of pages)
      await expect
        .poll(() =>
          page.evaluate(() => window.__game.remotePlayers.entities.size),
        )
        .toBe(2);
    const players = [...room.players.values()];
    Object.assign(players[0].state.position, { x: 0, y: 0, z: 30 });
    Object.assign(players[1].state.position, { x: 0, y: 0, z: 26 });
    players[0].protectedUntil = players[1].protectedUntil = 0;
    await a.bringToFront();
    await a.getByRole("button", { name: "ENTER ROOM →" }).click();
    await a.waitForTimeout(400);
    await a.keyboard.press("Digit2");
    await expect
      .poll(() =>
        b.evaluate(() =>
          [...window.__game.remotePlayers.entities.values()].some(
            (e) => e.weapons[1].visible,
          ),
        ),
      )
      .toBe(true);
    await a.keyboard.press("Digit1");
    await a.waitForTimeout(500);
    for (let i = 0; i < 5 && players[1].health > 0; i++) {
      await a.evaluate(() => {
        window.__game.player.yaw = 0;
        window.__game.player.pitch = Math.atan2(1.12 - 1.65, 4);
      });
      await a.mouse.down();
      await a.waitForTimeout(25);
      await a.mouse.up();
      await a.waitForTimeout(200);
    }
    await expect(b.locator("#death-feedback")).toContainText("RESPAWNING");
    expect(players[0].kills).toBe(1);
    await expect
      .poll(() => b.evaluate(() => window.__game.player.health))
      .toBe(100);
    expect(players[1].weapons.current.ammo).toBe(30);
    expect(players[1].weapons.weapons[1].ammo).toBe(7);
    await a.screenshot({ path: "test-results/district-gameplay.png" });
    await c.close();
    await expect
      .poll(() => a.evaluate(() => window.__game.remotePlayers.entities.size))
      .toBe(1);
    await a.evaluate(() => document.exitPointerLock());
    await expect
      .poll(() => a.evaluate(() => document.pointerLockElement))
      .toBe(null);
    await a.locator('#overlay [data-action="loadout"]').click();
    await a.locator("#skin-select").selectOption("neon");
    await a.locator("#equip-skin").click();
    await expect
      .poll(() =>
        b.evaluate(() =>
          [...window.__game.remotePlayers.entities.values()].some(
            (e) => e.weapons[0].userData.skin === "neon",
          ),
        ),
      )
      .toBe(true);
    expect(players[0].weapons.current.config.damage).toBe(34);
    await a.locator("#loadout-primary").selectOption("2");
    await a.locator("#equip-skin").click();
    await expect.poll(() => players[0].nextLoadout.primary).toBe(2);
    expect(players[0].slot).toBe(0);
    expect(
      await a.evaluate(
        () => JSON.parse(localStorage.getItem("linebreak-skins")).ar4,
      ),
    ).toBe("neon");
    await a.screenshot({ path: "test-results/loadout.png" });
    room.endsAt = performance.now() - 1;
    await expect(a.getByRole("heading", { name: "MATCH OVER" })).toBeVisible();
    await expect(a.locator("#overlay .online-roster")).toContainText("Alpha");
    await a.locator('#overlay [data-action="home"]').click();
    expect(await a.evaluate(() => window.__game.world.id)).toBe("kestrel");
    const memory = [];
    for (let i = 0; i < 6; i++) {
      await a.evaluate(() => {
        const g = window.__game;
        g.setMap("district");
        g.render(0);
        g.setMap("kestrel");
        g.render(0);
      });
      memory.push(
        await a.evaluate(() => ({
          ...window.__game.renderer.info.memory,
          children: window.__game.scene.children.length,
        })),
      );
    }
    expect(memory[5]).toEqual(memory[1]);
    expect(errors).toEqual([]);
    console.log("Map-cycle GPU resource counts:", memory);
  } finally {
    for (const socket of sockets) socket.terminate();
    for (const context of contexts) await context.close();
    await server.stop();
  }
});
