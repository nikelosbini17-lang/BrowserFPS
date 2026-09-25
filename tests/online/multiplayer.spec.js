import { test, expect } from "@playwright/test";
import { isolateLook } from "../helpers/look.js";

test("Two browser clients join, see interpolated players, move independently, reconnect and leave cleanly", async ({
  browser,
}) => {
  const aContext = await browser.newContext(),
    bContext = await browser.newContext();
  for (const context of [aContext, bContext])
    await context.addInitScript(() =>
      localStorage.setItem(
        "linebreak-settings",
        JSON.stringify({
          quality: "low",
          shadows: false,
          resolution: 0.75,
          maxFps: 60,
        }),
      ),
    );
  const a = await aContext.newPage(),
    b = await bContext.newPage(),
    errors = [];
  for (const page of [a, b]) {
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
  }
  try {
    await a.goto("http://127.0.0.1:5173");
    await isolateLook(a);
    await a.locator('[data-action="online"]').click();
    await a.locator("#player-name").fill("Amber One");
    await a.locator('[data-action="online-create"]').click();
    await expect(a.locator("#connected-room-code")).toBeVisible();
    const code = await a.locator("#connected-room-code").textContent();
    await b.goto("http://127.0.0.1:5173");
    await isolateLook(b);
    await b.locator('[data-action="online"]').click();
    await b.locator("#player-name").fill("Teal Two");
    await b.locator("#room-code").fill(code);
    await b.locator('[data-action="online-join"]').click();
    await expect(b.locator("#connected-room-code")).toHaveText(code);
    await expect
      .poll(() => a.evaluate(() => window.__game.remotePlayers.entities.size))
      .toBe(1);
    await expect
      .poll(() => b.evaluate(() => window.__game.remotePlayers.entities.size))
      .toBe(1);
    await a.bringToFront();
    await a.getByRole("button", { name: "ENTER ROOM →" }).click();
    await expect
      .poll(() => a.evaluate(() => document.pointerLockElement?.id))
      .toBe("game");
    const aStart = await a.evaluate(() => window.__game.player.position.z);
    await a.keyboard.down("KeyW");
    await a.waitForTimeout(1700);
    await a.keyboard.up("KeyW");
    await expect
      .poll(() =>
        b.evaluate(
          () =>
            [...window.__game.remotePlayers.entities.values()][0].group.position
              .z,
        ),
      )
      .toBeLessThan(aStart - 1);
    const remoteVisible = await b.evaluate(
      () => [...window.__game.remotePlayers.entities.values()][0].group.visible,
    );
    expect(remoteVisible).toBe(true);
    await a.keyboard.down("Tab");
    await expect(a.locator(".online-roster")).toContainText("Teal Two");
    await a.keyboard.up("Tab");
    // Input messages cannot supply positions: a local tamper is corrected by server snapshots.
    await a.evaluate(() => (window.__game.player.position.x = 400));
    await expect
      .poll(() => a.evaluate(() => window.__game.player.position.x))
      .toBeLessThan(27);
    await b.bringToFront();
    await b.getByRole("button", { name: "ENTER ROOM →" }).click();
    const bStart = await b.evaluate(() => window.__game.player.position.z);
    await b.keyboard.down("KeyW");
    await b.waitForTimeout(2300);
    await b.keyboard.up("KeyW");
    await expect
      .poll(() =>
        a.evaluate(
          () =>
            [...window.__game.remotePlayers.entities.values()][0].group.position
              .z,
        ),
      )
      .toBeGreaterThan(bStart + 1);
    await b.keyboard.press("F3");
    await b.screenshot({ path: "test-results/online-lab.png" });
    await b.reload();
    await expect
      .poll(() => a.evaluate(() => window.__game.remotePlayers.entities.size))
      .toBe(0);
    await b.locator('[data-action="online"]').click();
    await b.locator("#room-code").fill(code);
    await b.locator('[data-action="online-join"]').click();
    await expect(b.locator("#connected-room-code")).toHaveText(code);
    await expect
      .poll(() => a.evaluate(() => window.__game.remotePlayers.entities.size))
      .toBe(1);
    await b.getByRole("button", { name: "LEAVE ROOM ←" }).click();
    await expect
      .poll(() => a.evaluate(() => window.__game.remotePlayers.entities.size))
      .toBe(0);
    await b.locator('[data-action="practice"]').click();
    await expect(b.locator("#hud")).toBeVisible();
    expect(await b.evaluate(() => window.__game.mode)).toBe("practice");
    expect(errors).toEqual([]);
  } finally {
    await aContext.close();
    await bContext.close();
  }
});
