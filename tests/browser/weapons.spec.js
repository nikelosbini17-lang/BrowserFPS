import { test, expect } from "@playwright/test";
import { isolateLook } from "../helpers/look.js";

test("R45 tap-fire and headshots, Titan scope/bolt/damage, switching and finite reload", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await isolateLook(page);
  await page.locator('[data-action="practice"]').click();
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.id))
    .toBe("game");
  await page.keyboard.press("Digit2");
  await page.waitForTimeout(350);
  await expect(page.locator(".weapon-name")).toHaveText("R45");
  await expect(page.locator("#ammo")).toHaveText("7");
  await page.evaluate(() => {
    const g = window.__game;
    g.player.position.set(-3, 0, 9);
    g.player.velocity.set(0, 0, 0);
    g.player.yaw = 0;
    g.player.pitch = Math.atan2(0.18, 4);
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: "test-results/r45.png" });
  await page.mouse.down();
  await page.waitForTimeout(750);
  await page.mouse.up();
  await expect(page.locator("#ammo")).toHaveText("6");
  expect(await page.evaluate(() => window.__game.targets.list[0].alive)).toBe(
    false,
  );
  await expect(page.locator("#feed")).toContainText("R45");
  await page.keyboard.press("KeyR");
  await page.waitForTimeout(100);
  await page.keyboard.press("Digit3");
  expect(
    await page.evaluate(() => window.__game.weapons.weapons[1].reloadRemaining),
  ).toBe(0);
  await page.waitForTimeout(600);
  await expect(page.locator(".weapon-name")).toHaveText("TITAN");
  await page.evaluate(() => {
    const g = window.__game;
    g.player.position.set(6, 0, 4);
    g.player.velocity.set(0, 0, 0);
    g.player.yaw = 0;
    g.player.pitch = Math.atan2(-0.36, 4);
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: "test-results/titan.png" });
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await expect
    .poll(() => page.evaluate(() => window.__game.camera.fov))
    .toBe(35);
  await expect(page.locator("#scope")).toBeVisible();
  await expect(page.locator("#crosshair")).toBeHidden();
  await page.screenshot({ path: "test-results/scope.png" });
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await expect
    .poll(() => page.evaluate(() => window.__game.camera.fov))
    .toBe(17);
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await expect
    .poll(() => page.evaluate(() => window.__game.camera.fov))
    .toBe(85);
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await page.mouse.down();
  await page.waitForTimeout(40);
  await page.mouse.up();
  await expect(page.locator("#ammo")).toHaveText("4");
  await expect(page.locator("#scope")).toBeHidden();
  expect(await page.evaluate(() => window.__game.targets.list[1].alive)).toBe(
    false,
  );
  await expect(page.locator("#reload-status")).toContainText("CYCLING BOLT");
  await page.mouse.down();
  await page.mouse.up();
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  expect(await page.evaluate(() => window.__game.rifle.ammo)).toBe(4);
  expect(await page.evaluate(() => window.__game.rifle.scoped)).toBe(false);
  await page.waitForTimeout(1600);
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await expect(page.locator("#scope")).toBeVisible();
  await page.keyboard.press("KeyQ");
  await expect(page.locator(".weapon-name")).toHaveText("R45");
  await expect(page.locator("#scope")).toBeHidden();
  await expect(page.locator("#ammo")).toHaveText("6");
  await page.waitForTimeout(350);
  await page.evaluate(() => window.__game.weapons.setInfiniteReserve(false));
  await page.keyboard.press("KeyR");
  await expect
    .poll(() => page.evaluate(() => window.__game.rifle.ammo), {
      timeout: 4000,
    })
    .toBe(7);
  expect(await page.evaluate(() => window.__game.rifle.reserve)).toBe(34);
  expect(errors).toEqual([]);
});
