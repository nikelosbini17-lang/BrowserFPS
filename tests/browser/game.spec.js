import { test, expect } from "@playwright/test";
import { isolateLook, setLiveLook } from "../helpers/look.js";

test("Playable range: pointer lock, movement, collision, hits, reload and pause", async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await isolateLook(page);
  await expect(
    page.getByRole("heading", { name: "HOLD YOUR GROUND." }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/menu.png" });
  await page.locator('[data-action="practice"]').click();
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.id))
    .toBe("game");
  await expect(page.locator("#hud")).toBeVisible();
  const start = await page.evaluate(() => window.__game.player.position.z);
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(550);
  await page.keyboard.up("KeyW");
  const moved = await page.evaluate(() => window.__game.player.position.z);
  expect(moved).toBeLessThan(start - 1);
  await page.keyboard.press("Space");
  await page.waitForTimeout(180);
  expect(
    await page.evaluate(() => window.__game.player.position.y),
  ).toBeGreaterThan(0.3);
  await page.waitForTimeout(750);
  expect(await page.evaluate(() => window.__game.player.grounded)).toBe(true);
  await page.keyboard.down("ControlLeft");
  await page.waitForTimeout(250);
  expect(
    await page.evaluate(() => window.__game.player.eyeHeight),
  ).toBeLessThan(1.15);
  await page.keyboard.up("ControlLeft");
  const yaw = await page.evaluate(() => window.__game.player.yaw);
  await setLiveLook(page, true);
  await page.mouse.move(750, 450);
  await page.mouse.move(800, 450);
  await page.waitForTimeout(80);
  expect(await page.evaluate(() => window.__game.player.yaw)).not.toBe(yaw);
  await setLiveLook(page, false);
  // Place at the outer wall, then try to walk through it using real input.
  await page.evaluate(() => {
    const g = window.__game;
    g.player.position.set(25, 0, 23);
    g.player.velocity.set(0, 0, 0);
    g.player.yaw = 0;
    g.player.pitch = 0;
  });
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(650);
  await page.keyboard.up("KeyD");
  expect(
    await page.evaluate(() => window.__game.player.position.x),
  ).toBeLessThanOrEqual(25.69);
  // Clear, close line of sight to a dummy's head; actual mouse click drives firing.
  await page.evaluate(() => {
    const g = window.__game;
    g.player.position.set(-3, 0, 9);
    g.player.velocity.set(0, 0, 0);
    g.player.yaw = 0;
    g.player.pitch = Math.atan2(1.83 - 1.65, 4);
    g.rifle.inaccuracy = 0.0001;
  });
  await page.waitForTimeout(300);
  await page.mouse.down();
  await page.waitForTimeout(45);
  await page.mouse.up();
  await expect
    .poll(() => page.evaluate(() => window.__game.player.kills))
    .toBe(1);
  expect(await page.evaluate(() => window.__game.targets.list[0].alive)).toBe(
    false,
  );
  const ammo = await page.evaluate(() => window.__game.rifle.ammo);
  expect(ammo).toBeLessThan(30);
  await page.keyboard.press("KeyR");
  await expect
    .poll(() => page.evaluate(() => window.__game.rifle.reloadRemaining))
    .toBeGreaterThan(1);
  await page.mouse.down();
  await page.waitForTimeout(100);
  await page.mouse.up();
  expect(await page.evaluate(() => window.__game.rifle.ammo)).toBe(ammo);
  await expect
    .poll(() => page.evaluate(() => window.__game.rifle.ammo), {
      timeout: 4000,
    })
    .toBe(30);
  await expect
    .poll(() => page.evaluate(() => window.__game.targets.list[0].alive), {
      timeout: 5000,
    })
    .toBe(true);
  await page.evaluate(() => {
    const g = window.__game;
    g.player.position.set(0, 0, 19);
    g.player.velocity.set(0, 0, 0);
    g.player.yaw = 0;
    g.player.pitch = 0;
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: "test-results/gameplay.png" });
  await page.keyboard.down("Tab");
  await expect(page.locator("#scoreboard")).toBeVisible();
  await page.keyboard.up("Tab");
  await expect(page.locator("#scoreboard")).toBeHidden();
  await page.evaluate(() => document.exitPointerLock());
  await expect(
    page.getByRole("heading", { name: "TAKE A BREATHER." }),
  ).toBeVisible();
  const pausedTime = await page.evaluate(() => window.__game.elapsed);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__game.elapsed)).toBe(pausedTime);
  await page.getByRole("button", { name: "SETTINGS +", exact: true }).click();
  await page.locator('[data-setting="fov"]').fill("100");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("linebreak-settings")).fov,
    ),
  ).toBe(100);
  await page.getByRole("button", { name: "DONE ✓" }).click();
  await page.getByRole("button", { name: "MAIN MENU ←" }).click();
  await expect(page.locator("#menu")).toBeVisible();
  await testInfo.attach("runtime-metrics", {
    body: JSON.stringify(
      await page.evaluate(() => ({
        fps: window.__game.fps,
        drawCalls: window.__game.renderer.info.render.calls,
        triangles: window.__game.renderer.info.render.triangles,
      })),
    ),
    contentType: "application/json",
  });
  console.log(
    "Render metrics:",
    await page.evaluate(() => ({
      fps: window.__game.fps,
      drawCalls: window.__game.renderer.info.render.calls,
      triangles: window.__game.renderer.info.render.triangles,
    })),
  );
  expect(errors).toEqual([]);
});

test("Cover occludes damage, ramp is traversable, settings survive reload", async ({
  page,
}) => {
  await page.goto("/");
  await isolateLook(page);
  await page.locator('[data-action="practice"]').click();
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.id))
    .toBe("game");
  await page.evaluate(() => {
    const g = window.__game;
    g.player.position.set(18, 0, 10);
    g.player.velocity.set(0, 0, 0);
    // The east partition at z=6 lies between this position and the moved target.
    g.targets.list[5].group.position.set(18, 0, 2);
    g.player.yaw = 0;
    g.player.pitch = 0;
  });
  await page.waitForTimeout(200);
  await page.mouse.down();
  await page.waitForTimeout(350);
  await page.mouse.up();
  expect(await page.evaluate(() => window.__game.targets.list[5].health)).toBe(
    100,
  );
  expect(await page.evaluate(() => window.__game.rifle.ammo)).toBeLessThan(30);
  await page.evaluate(() => {
    const g = window.__game;
    g.player.position.set(-10, 0, 21);
    g.player.velocity.set(0, 0, 0);
    g.player.yaw = 0;
    g.player.pitch = 0;
  });
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1700);
  await page.keyboard.up("KeyW");
  expect(
    await page.evaluate(() => window.__game.player.position.y),
  ).toBeGreaterThan(1.1);
  expect(await page.evaluate(() => window.__game.player.grounded)).toBe(true);
  await page.evaluate(() => document.exitPointerLock());
  await page.getByRole("button", { name: "SETTINGS +", exact: true }).click();
  await page.locator('[data-setting="quality"]').selectOption("low");
  await page.locator('[data-setting="resolution"]').selectOption("0.5");
  expect(
    await page.evaluate(() => window.__game.renderer.shadowMap.enabled),
  ).toBe(false);
  expect(
    await page.evaluate(() => window.__game.renderer.getPixelRatio()),
  ).toBe(0.5);
  await page.reload();
  expect(await page.evaluate(() => window.__game.settings.resolution)).toBe(
    0.5,
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator('[data-action="play"]')).toBeInViewport();
  await expect(page.locator('[data-action="help"]')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    720,
  );
});
