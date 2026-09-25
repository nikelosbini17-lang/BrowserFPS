export const GAME_NAME = "LINEBREAK";
export const GAME_VERSION = "0.3.0-alpha";
export const DEV_MODE = Boolean(
  import.meta.env?.DEV || import.meta.env?.VITE_DEV_MODE === "true",
);
