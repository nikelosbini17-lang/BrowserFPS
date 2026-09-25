import { GameServer } from "./GameServer.js";
const options = {
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 3001),
  maxRooms: Number(process.env.MAX_ROOMS || 32),
  maxPlayers: Number(process.env.MAX_PLAYERS || 20),
};
if (
  !Number.isInteger(options.port) ||
  options.port < 1 ||
  options.port > 65535 ||
  !Number.isInteger(options.maxPlayers) ||
  options.maxPlayers < 2 ||
  options.maxPlayers > 32 ||
  !Number.isInteger(options.maxRooms) ||
  options.maxRooms < 1 ||
  options.maxRooms > 128
)
  throw new Error("Invalid server configuration");
if (process.env.ALLOWED_ORIGINS)
  options.origins = process.env.ALLOWED_ORIGINS.split(",").map((value) =>
    value.trim(),
  );
const server = new GameServer(options);
try {
  const address = await server.start();
  console.log(
    `LINEBREAK combat server listening on http://${address.address}:${address.port}`,
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, async () => {
      await server.stop();
      process.exit(0);
    });
} catch (error) {
  console.error("Unable to start LINEBREAK server:", error.message);
  process.exitCode = 1;
}
