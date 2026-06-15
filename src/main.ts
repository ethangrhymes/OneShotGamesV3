import "./styles.css";
import { Game } from "./game/Game";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const container = document.getElementById("touch-controls") as HTMLElement;

if (!canvas) {
  throw new Error("Game canvas not found");
}

const game = new Game(canvas, container);
void game.start();

// Expose for quick debugging in the console (harmless in production).
(window as unknown as { __game?: Game }).__game = game;
