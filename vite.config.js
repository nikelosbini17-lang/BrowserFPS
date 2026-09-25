import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  server: {
    proxy: { "/game-socket": { target: "ws://127.0.0.1:3001", ws: true } },
  },
  build: { chunkSizeWarningLimit: 700 },
});
