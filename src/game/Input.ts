/**
 * Input — unifies keyboard and touch into a single action state.
 *
 * Movement is a continuous vector (-1..1 each axis). Action buttons expose both
 * a held state (`down`) and an edge-triggered `pressed` (cleared each frame via
 * endFrame()). Menus are driven by canvas taps reported in CSS-pixel logical
 * coordinates (the same space the Renderer draws UI in).
 */

interface Button {
  down: boolean;
  pressed: boolean;
}

function mkBtn(): Button {
  return { down: false, pressed: false };
}

export type ActionName = "attack" | "dash" | "interact" | "pause";

export class Input {
  moveX = 0;
  moveY = 0;
  /** true when movement came from the analog stick (lets the player aim attacks). */
  usingStick = false;

  attack = mkBtn();
  dash = mkBtn();
  interact = mkBtn();
  pause = mkBtn();
  /** generic "confirm / advance" edge (Enter/Space/tap). */
  confirm = mkBtn();

  /** taps that menus can consume this frame: {x,y} in CSS px relative to canvas. */
  taps: { x: number; y: number }[] = [];

  isTouch = false;

  private keys = new Set<string>();
  private canvas: HTMLCanvasElement;
  private container: HTMLElement;

  // touch control elements
  private joyZone!: HTMLElement;
  private joyBase!: HTMLElement;
  private joyStick!: HTMLElement;
  private btnAttack!: HTMLElement;
  private btnDash!: HTMLElement;
  private btnInteract!: HTMLElement;
  private joyId: number | null = null;
  private joyOX = 0;
  private joyOY = 0;
  private joyRadius = 46;

  onUnlock?: () => void; // first gesture (for audio)

  constructor(canvas: HTMLCanvasElement, container: HTMLElement) {
    this.canvas = canvas;
    this.container = container;
    this.isTouch =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia?.("(pointer: coarse)").matches;

    this.bindKeyboard();
    this.bindTaps();
    this.buildTouchControls();
  }

  // -------------------------------------------------------------------
  private fireUnlock() {
    this.onUnlock?.();
  }

  private bindKeyboard() {
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "spacebar"].includes(k)
      ) {
        e.preventDefault();
      }
      if (this.keys.has(k)) return; // ignore auto-repeat for edges
      this.keys.add(k);
      this.fireUnlock();

      if (k === " " || k === "j" || k === "z") this.press(this.attack);
      if (k === "shift" || k === "k" || k === "x") this.press(this.dash);
      if (k === "e" || k === "f") this.press(this.interact);
      if (k === "escape" || k === "p") this.press(this.pause);
      if (k === "enter" || k === " " || k === "e" || k === "j" || k === "z")
        this.press(this.confirm);
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    window.addEventListener("blur", () => this.keys.clear());
  }

  private press(b: Button) {
    b.down = true;
    b.pressed = true;
  }

  private bindTaps() {
    this.canvas.addEventListener(
      "pointerdown",
      (e) => {
        this.fireUnlock();
        const rect = this.canvas.getBoundingClientRect();
        this.taps.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        this.press(this.confirm);
      },
      { passive: true }
    );
  }

  // -------------------------------------------------------------------
  private buildTouchControls() {
    const c = this.container;

    this.joyZone = document.createElement("div");
    this.joyZone.className = "touch-zone";
    this.joyZone.style.left = "0";
    this.joyZone.style.top = "0";
    this.joyZone.style.width = "45%";
    this.joyZone.style.height = "100%";

    this.joyBase = document.createElement("div");
    this.joyBase.id = "joy-base";
    this.joyStick = document.createElement("div");
    this.joyStick.id = "joy-stick";

    this.btnAttack = this.makeButton("btn-attack", "ATK");
    this.btnDash = this.makeButton("btn-dash", "DASH");
    this.btnInteract = this.makeButton("btn-interact", "USE");
    this.btnInteract.classList.add("hidden");

    c.append(this.joyZone, this.joyBase, this.joyStick, this.btnAttack, this.btnDash, this.btnInteract);
    this.layoutTouchControls();
    window.addEventListener("resize", () => this.layoutTouchControls());

    // joystick
    this.joyZone.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.fireUnlock();
      this.joyId = e.pointerId;
      this.joyOX = e.clientX;
      this.joyOY = e.clientY;
      this.usingStick = true;
      const sz = this.joyRadius * 2;
      this.joyBase.style.width = this.joyStick.style.width = `${sz}px`;
      this.joyBase.style.height = `${sz}px`;
      this.joyStick.style.width = this.joyStick.style.height = `${this.joyRadius}px`;
      this.placeJoy(e.clientX, e.clientY, e.clientX, e.clientY);
      this.joyBase.style.display = this.joyStick.style.display = "block";
      (this.joyZone as Element).setPointerCapture(e.pointerId);
    });
    this.joyZone.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.joyId) return;
      e.preventDefault();
      let dx = e.clientX - this.joyOX;
      let dy = e.clientY - this.joyOY;
      const d = Math.hypot(dx, dy);
      const max = this.joyRadius;
      if (d > max) {
        dx = (dx / d) * max;
        dy = (dy / d) * max;
      }
      this.moveX = dx / max;
      this.moveY = dy / max;
      // small deadzone
      if (Math.hypot(this.moveX, this.moveY) < 0.18) {
        this.moveX = 0;
        this.moveY = 0;
      }
      this.placeJoy(this.joyOX, this.joyOY, this.joyOX + dx, this.joyOY + dy);
    });
    const endJoy = (e: PointerEvent) => {
      if (e.pointerId !== this.joyId) return;
      this.joyId = null;
      this.moveX = 0;
      this.moveY = 0;
      this.usingStick = false;
      this.joyBase.style.display = this.joyStick.style.display = "none";
    };
    this.joyZone.addEventListener("pointerup", endJoy);
    this.joyZone.addEventListener("pointercancel", endJoy);

    this.bindHoldButton(this.btnAttack, this.attack);
    this.bindHoldButton(this.btnDash, this.dash);
    this.bindHoldButton(this.btnInteract, this.interact);
  }

  private makeButton(id: string, label: string): HTMLElement {
    const b = document.createElement("div");
    b.className = "touch-btn";
    b.id = id;
    b.textContent = label;
    return b;
  }

  private placeJoy(bx: number, by: number, sx: number, sy: number) {
    const r = this.joyRadius;
    const rect = this.container.getBoundingClientRect();
    this.joyBase.style.left = `${bx - rect.left - r}px`;
    this.joyBase.style.top = `${by - rect.top - r}px`;
    this.joyStick.style.left = `${sx - rect.left - r / 2}px`;
    this.joyStick.style.top = `${sy - rect.top - r / 2}px`;
  }

  private bindHoldButton(el: HTMLElement, btn: Button) {
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.fireUnlock();
      this.press(btn);
      el.classList.add("pressed");
      (el as Element).setPointerCapture(e.pointerId);
    });
    const up = (e: PointerEvent) => {
      e.preventDefault();
      btn.down = false;
      el.classList.remove("pressed");
    };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }

  private layoutTouchControls() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const small = Math.min(w, h) < 520;
    const big = small ? 64 : 76;
    const mid = small ? 52 : 60;
    const m = small ? 18 : 26;
    // bottom-right cluster
    this.btnAttack.style.width = this.btnAttack.style.height = `${big}px`;
    this.btnAttack.style.right = `${m}px`;
    this.btnAttack.style.bottom = `${m + 6}px`;
    this.btnAttack.style.fontSize = small ? "12px" : "14px";

    this.btnDash.style.width = this.btnDash.style.height = `${mid}px`;
    this.btnDash.style.right = `${m + big + 8}px`;
    this.btnDash.style.bottom = `${m}px`;
    this.btnDash.style.fontSize = small ? "11px" : "12px";

    this.btnInteract.style.width = this.btnInteract.style.height = `${mid}px`;
    this.btnInteract.style.right = `${m + 4}px`;
    this.btnInteract.style.bottom = `${m + big + 14}px`;
    this.btnInteract.style.fontSize = small ? "11px" : "12px";
  }

  setTouchVisible(v: boolean) {
    this.container.classList.toggle("active", v && this.isTouch);
  }

  showInteract(v: boolean) {
    this.btnInteract.classList.toggle("hidden", !v);
  }

  /** Resolve final movement vector (keyboard overrides if no stick). */
  resolveMovement() {
    if (this.joyId == null) {
      let x = 0;
      let y = 0;
      if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
      if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
      if (this.keys.has("w") || this.keys.has("arrowup")) y -= 1;
      if (this.keys.has("s") || this.keys.has("arrowdown")) y += 1;
      const m = Math.hypot(x, y);
      if (m > 0) {
        x /= m;
        y /= m;
      }
      this.moveX = x;
      this.moveY = y;
      this.usingStick = false;
    }
  }

  endFrame() {
    this.attack.pressed = false;
    this.dash.pressed = false;
    this.interact.pressed = false;
    this.pause.pressed = false;
    this.confirm.pressed = false;
    this.taps.length = 0;
  }
}
