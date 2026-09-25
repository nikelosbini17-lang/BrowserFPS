import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";
export default defineConfig({
  ...base,
  testDir: "./tests/online",
  timeout: 45000,
  webServer: [
    base.webServer,
    {
      command: "npm run server",
      url: "http://127.0.0.1:3001/health",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
