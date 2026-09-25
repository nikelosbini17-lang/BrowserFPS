import { test, expect } from "@playwright/test";
test("Invalid settings recover; malformed server data shows a connection error without throwing", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      "linebreak-settings",
      JSON.stringify({ fov: "broken", resolution: null, sensitivity: {} }),
    ),
  );
  await page.routeWebSocket("**/game-socket", (ws) =>
    ws.onMessage(() => ws.send("null")),
  );
  await page.goto("/");
  expect(
    await page.evaluate(() =>
      window.__game.camera.projectionMatrix.elements.every(Number.isFinite),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => window.__game.debugGeometry.root.visible),
  ).toBe(false);
  await page.locator('[data-action="online"]').click();
  await page.locator('[data-action="online-create"]').click();
  await expect(page.locator("#connection-status")).toContainText(
    "invalid response",
  );
  expect(errors).toEqual([]);
});
test("Fatal graphics loss stops the loop and presents a reload action", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    document
      .querySelector("#game")
      .dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
  );
  await expect(page.getByRole("heading", { name: "GAME ERROR" })).toBeVisible();
  expect(await page.evaluate(() => window.__game.fatal)).toBe(true);
});
