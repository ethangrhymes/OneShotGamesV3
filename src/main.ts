import "./styles.css";
import { Game } from "./game/Game";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const container = document.getElementById("touch-controls") as HTMLElement;

if (!canvas) {
  throw new Error("Game canvas not found");
}

/**
 * Block all browser zoom gestures. On iOS Safari two thumbs on the controls
 * (joystick + a button) read as a pinch, and double-tapping a button zooms the
 * page — and it stays zoomed until reload. These listeners keep the viewport at
 * 1:1 so the game never "zooms in" during play.
 */
function preventMobileZoom() {
  const stop = (e: Event) => e.preventDefault();
  for (const evt of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(evt, stop, { passive: false });
  }
  // pinch (multi-touch move)
  document.addEventListener(
    "touchmove",
    (e) => {
      if ((e as TouchEvent).touches.length > 1) e.preventDefault();
    },
    { passive: false }
  );
  // double-tap zoom
  let lastTouchEnd = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      const now = performance.now();
      if (now - lastTouchEnd <= 320) e.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false }
  );
  document.addEventListener("dblclick", stop, { passive: false });
}
preventMobileZoom();

const game = new Game(canvas, container);
void game.start();

// Expose for quick debugging in the console (harmless in production).
(window as unknown as { __game?: Game }).__game = game;
