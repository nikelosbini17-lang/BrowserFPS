import { test, expect } from "@playwright/test";

test("Unavailable online service reports failure and retry while practice remains playable", async ({
  page,
}) => {
  // Simulate an unavailable WebSocket endpoint without stopping a user's running backend.
  await page.routeWebSocket("**/game-socket", (socket) =>
    socket.close({ code: 1013, reason: "Service unavailable" }),
  );
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator('[data-action="online"]').click();
  await page.locator('[data-action="online-create"]').click();
  await expect(page.locator("#connection-status")).toContainText(
    "Connection failed",
  );
  await expect(page.locator('[data-action="online-retry"]')).toBeVisible();
  await page.locator('[data-action="online-retry"]').click();
  await expect(page.locator("#connection-status")).toContainText(
    "Connection failed",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.locator('[data-action="practice"]').click();
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.id))
    .toBe("game");
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  expect(await page.evaluate(() => window.__game.rifle.ammo)).toBeLessThan(30);
  expect(errors).toEqual([]);
});
