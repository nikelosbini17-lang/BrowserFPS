import { test, expect } from "@playwright/test";

test("Space and wheel jumping, configurable bindings, grounded recovery and opt-in debug", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator('[data-action="practice"]').click();
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.id))
    .toBe("game");
  await page.mouse.wheel(0, -100);
  await expect
    .poll(() => page.evaluate(() => window.__game.player.position.y))
    .toBeGreaterThan(0.2);
  await page.waitForTimeout(800);
  await page.mouse.wheel(0, 100);
  await expect
    .poll(() => page.evaluate(() => window.__game.player.position.y))
    .toBeGreaterThan(0.2);
  await page.waitForTimeout(800);
  await expect(page.locator("#movement-debug")).toBeHidden();
  await page.keyboard.press("F3");
  await expect(page.locator("#movement-debug")).toBeVisible();
  await expect(page.locator("#movement-debug")).toContainText("Grounded: YES");
  // Holding Space should jump once, then settle; correct timing is still required.
  await page.keyboard.down("Space");
  await page.waitForTimeout(1400);
  await page.keyboard.up("Space");
  expect(await page.evaluate(() => window.__game.player.grounded)).toBe(true);
  await page.evaluate(() => document.exitPointerLock());
  await page.getByRole("button", { name: "SETTINGS +", exact: true }).click();
  await page.locator('[data-setting="wheelJump"]').selectOption("off");
  await page.getByRole("button", { name: "DONE ✓" }).click();
  await page.getByRole("button", { name: "RESUME →" }).click();
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(180);
  expect(await page.evaluate(() => window.__game.player.position.y)).toBe(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(errors).toEqual([]);
});
