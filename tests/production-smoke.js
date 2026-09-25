import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const url = "http://127.0.0.1:4173";
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "4173",
    "--strictPort",
  ],
  { windowsHide: true, stdio: "pipe" },
);
let browser;
let serverError = "";
server.stderr.on("data", (data) => {
  serverError += data;
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (server.exitCode !== null)
      throw new Error(`Preview server stopped: ${serverError}`);
    try {
      const response = await fetch(url);
      ready = response.ok;
    } catch {
      /* Wait for startup. */
    }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, "Production preview starts");
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(url);
  await page.locator('[data-action="practice"]').waitFor();
  assert.equal(
    await page.evaluate(() => typeof window.__game),
    "undefined",
    "No debug hook in production",
  );
  await page.locator('[data-action="practice"]').click();
  await page.waitForFunction(() => document.pointerLockElement?.id === "game");
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.mouse.up();
  const ammo = Number(await page.locator("#ammo").textContent());
  assert.ok(ammo < 30 && ammo > 0, "Production bundle handles real fire input");
  await page.keyboard.press("KeyR");
  await page.waitForFunction(
    () => document.querySelector("#ammo").textContent === "30",
    { timeout: 4000 },
  );
  assert.deepEqual(errors, [], "No production console or runtime errors");
  console.log(
    "Production smoke passed: static assets, pointer lock, shooting, reload, no debug hook, no browser errors.",
  );
} finally {
  await browser?.close();
  server.kill();
}
