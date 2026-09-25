import { test, expect } from "@playwright/test";
import { WebSocket } from "ws";
import { GameServer } from "../../server/GameServer.js";
import { isolateLook } from "../helpers/look.js";
for (const latency of [0, 50, 100, 150])
  test(`Two browser clients: authoritative damage, death and scoreboard at ${latency}ms RTT`, async ({
    browser,
  }) => {
    const server = new GameServer({ port: 0 });
    const address = await server.start();
    const contexts = [],
      sockets = [],
      timers = new Set(),
      errors = [];
    const delay = (fn) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, latency / 2);
      timers.add(t);
    };
    try {
      const pages = [];
      for (const name of ["Amber", "Teal"]) {
        const ctx = await browser.newContext();
        contexts.push(ctx);
        await ctx.addInitScript(() =>
          localStorage.setItem(
            "linebreak-settings",
            JSON.stringify({ quality: "low", shadows: false, maxFps: 60 }),
          ),
        );
        const page = await ctx.newPage();
        pages.push(page);
        page.on("pageerror", (e) => errors.push(e.message));
        await page.routeWebSocket("**/game-socket", async (route) => {
          const socket = new WebSocket(
            `ws://127.0.0.1:${address.port}/game-socket`,
            { origin: "http://127.0.0.1:5173" },
          );
          sockets.push(socket);
          const queue = [];
          socket.on("open", () =>
            queue.splice(0).forEach((m) => socket.send(m)),
          );
          socket.on("message", (data) =>
            delay(() => route.send(data.toString())),
          );
          route.onMessage((m) =>
            delay(() =>
              socket.readyState === 1 ? socket.send(m) : queue.push(m),
            ),
          );
          route.onClose(() => socket.close());
          socket.on("close", () => route.close());
          socket.on("error", () => {});
        });
        await page.goto("/");
        await isolateLook(page);
        await page.locator('[data-action="online"]').click();
        await page.locator("#player-name").fill(name);
        if (pages.length === 1)
          await page.locator('[data-action="online-create"]').click();
        else {
          await page
            .locator("#room-code")
            .fill(await pages[0].locator("#connected-room-code").textContent());
          await page.locator('[data-action="online-join"]').click();
        }
        await expect(page.locator("#connected-room-code")).toBeVisible();
      }
      const [a, b] = pages,
        room = [...server.rooms.values()][0],
        players = [...room.players.values()];
      // Deterministic server-owned fixture on the clear south apron; clients cannot teleport.
      Object.assign(players[0].state.position, { x: 0, y: 0, z: 25 });
      Object.assign(players[1].state.position, { x: 0, y: 0, z: 21 });
      await a.bringToFront();
      await a.getByRole("button", { name: "ENTER ROOM →" }).click();
      await a.waitForTimeout(400);
      const aim = () =>
        a.evaluate(() => {
          const g = window.__game,
            target = [...g.remotePlayers.entities.values()][0].group.position,
            dx = target.x - g.player.position.x,
            dz = target.z - g.player.position.z;
          g.player.yaw = Math.atan2(-dx, -dz);
          g.player.pitch = Math.atan2(
            target.y + 1.12 - g.camera.position.y,
            Math.hypot(dx, dz),
          );
        });
      await aim();
      await a.mouse.down();
      await a.waitForTimeout(25);
      await a.mouse.up();
      await expect
        .poll(() => b.evaluate(() => window.__game.player.health))
        .toBeLessThan(100);
      await expect
        .poll(() =>
          a.evaluate(() => window.__game.network.lastCombat?.damage || 0),
        )
        .toBeGreaterThan(0);
      expect(players[0].weapons.current.ammo).toBeLessThan(30);
      // The target now strafes using its normal input stream. Aim at its rendered, interpolated pose.
      await b.evaluate(() => window.__game.input.keys.add("KeyD"));
      await a.waitForTimeout(1800);
      for (let i = 0; i < 5 && players[1].health > 0; i++) {
        await a.waitForTimeout(400);
        await aim();
        await a.mouse.down();
        await a.waitForTimeout(25);
        await a.mouse.up();
      }
      await expect
        .poll(() => b.evaluate(() => window.__game.player.alive))
        .toBe(false);
      expect(players[0].kills).toBe(1);
      expect(players[1].deaths).toBe(1);
      await a.keyboard.down("Tab");
      await expect(a.locator(".online-roster")).toContainText("Amber");
      await expect(a.locator(".online-roster tbody tr").first()).toContainText(
        "1",
      );
      await a.keyboard.up("Tab");
      expect(errors).toEqual([]);
    } finally {
      for (const t of timers) clearTimeout(t);
      for (const s of sockets) s.terminate();
      for (const c of contexts) await c.close();
      await server.stop();
    }
  });
