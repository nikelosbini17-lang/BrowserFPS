import "./style.css";
import { Game } from "./game/Game.js";
import { installErrorReporter } from "./utils/ErrorReporter.js";
let game;
const fail = installErrorReporter(() => game);

try {
  game = new Game(document.querySelector("#game"));
  game.reportFatal = fail;
  // Development-only inspection for browser integration tests. No production debug API.
  if (import.meta.env.DEV) window.__game = game;
} catch (error) {
  fail(error);
}
