import { DEV_MODE } from "../config/GameConfig.js";
export function installErrorReporter(getGame) {
  let failed = false;
  const fail = (error) => {
    if (failed) return;
    failed = true;
    const game = getGame();
    const connected = game?.network?.connected;
    if (game) {
      game.fatal = true;
      cancelAnimationFrame(game.raf);
      game.network?.disconnect();
      game.input?.clear();
    }
    document.exitPointerLock?.();
    console.error("LINEBREAK fatal error", error);
    if (DEV_MODE && game)
      console.error("Game diagnostics", {
        message: error?.message,
        stack: error?.stack,
        mode: game.mode,
        map: game.world?.name || "Kestrel",
        alive: game.player?.alive,
        health: game.player?.health,
        weapon: game.rifle?.config.id,
        position: game.player?.position.toArray(),
        velocity: game.player?.velocity.toArray(),
        connected,
      });
    document.querySelector("#loading")?.remove();
    document.querySelector("#app").innerHTML =
      '<div class="error-panel" role="alert"><h1>GAME ERROR</h1><p>Something went wrong.</p><button id="reload-game" class="solid-button">RELOAD GAME</button></div>';
    document.querySelector("#reload-game").onclick = () => location.reload();
  };
  window.addEventListener("error", (e) =>
    fail(e.error || new Error(e.message)),
  );
  window.addEventListener("unhandledrejection", (e) => fail(e.reason));
  return fail;
}
