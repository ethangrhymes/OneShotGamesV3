/**
 * UI.ts — HUD + all full-screen menus + toasts + blocking modals (lore, item
 * get, objective). Everything is drawn on the same canvas ctx in CSS-pixel
 * space. Each screen registers tappable buttons; Game hit-tests taps against
 * them and also maps the keyboard "confirm" key to the primary button.
 */
import type { Renderer } from "./Renderer";
import type { RunState } from "./Progression";
import type { SaveData } from "./types";
import type { DifficultyMode } from "./Balance";

const C = {
  ink: "#f3e9d2",
  dim: "rgba(243,233,210,0.62)",
  panel: "rgba(16,12,22,0.9)",
  panelSoft: "rgba(16,12,22,0.74)",
  border: "rgba(243,233,210,0.22)",
  ember: "#ff9a3c",
  arcane: "#b48cff",
  good: "#7fdca0",
  bad: "#e2566a",
  gold: "#e7c558",
};

export interface UiButton {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  primary?: boolean;
  accent?: string;
  small?: boolean;
}

export interface Toast {
  text: string;
  color: string;
  t: number;
  life: number;
}

export interface HudInfo {
  objective: string;
  boss: { name: string; hp: number; maxHp: number; enraged: boolean } | null;
  rooms: { id: string; gx: number; gy: number }[];
  currentRoomId: string;
  visited: Set<string>;
  regionName: string;
  accent: string;
}

export interface ModalContent {
  title: string;
  lines: string[];
  prompt: string;
  accent?: string;
}

interface Banner {
  title: string;
  subtitle?: string;
  accent: string;
  t: number;
  life: number;
}

export class UI {
  r: Renderer;
  buttons: UiButton[] = [];
  toasts: Toast[] = [];
  uiScale = 1;
  private bannerState: Banner | null = null;

  constructor(r: Renderer) {
    this.r = r;
  }

  private get ctx() {
    return this.r.ctx;
  }
  private get W() {
    return this.r.viewW;
  }
  private get H() {
    return this.r.viewH;
  }

  computeScale() {
    this.uiScale = Math.max(0.85, Math.min(1.5, Math.min(this.W, this.H) / 460));
  }

  // ---- input helpers ----
  hitTest(x: number, y: number): string | null {
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
    }
    return null;
  }
  primaryId(): string | null {
    const p = this.buttons.find((b) => b.primary);
    return p ? p.id : null;
  }

  // ---- toasts ----
  toast(text: string, color = C.ink) {
    this.toasts.push({ text, color, t: 0, life: 2.8 });
    if (this.toasts.length > 4) this.toasts.shift();
  }
  updateToasts(dt: number) {
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < t.life);
    if (this.bannerState) {
      this.bannerState.t += dt;
      if (this.bannerState.t >= this.bannerState.life) this.bannerState = null;
    }
  }

  /** A large transient announcement (region entered, area discovered, boss intro). */
  banner(title: string, subtitle?: string, accent = C.ember, life = 3.2) {
    this.bannerState = { title, subtitle, accent, t: 0, life };
  }

  drawBanner() {
    const b = this.bannerState;
    if (!b) return;
    const ctx = this.ctx;
    const s = this.uiScale;
    const fadeIn = Math.min(1, b.t / 0.4);
    const fadeOut = Math.min(1, (b.life - b.t) / 0.6);
    const a = Math.max(0, Math.min(fadeIn, fadeOut));
    const y = this.H * 0.3;
    ctx.save();
    ctx.globalAlpha = a;
    // thin rule lines above/below for a "title card" feel
    ctx.strokeStyle = b.accent;
    ctx.lineWidth = 2;
    const halfW = Math.min(this.W * 0.4, 240 * s);
    ctx.beginPath();
    ctx.moveTo(this.W / 2 - halfW, y + 14 * s);
    ctx.lineTo(this.W / 2 + halfW, y + 14 * s);
    ctx.stroke();
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 8 * s;
    this.serif(30);
    this.text(b.title, this.W / 2, y, b.accent, "center");
    if (b.subtitle) {
      this.font(14, "normal", "Georgia, serif");
      this.text(b.subtitle, this.W / 2, y + 34 * s, C.ink, "center");
    }
    ctx.restore();
  }

  // ---- primitive drawing ----
  private font(size: number, weight = "bold", family = "Trebuchet MS, system-ui, sans-serif") {
    this.ctx.font = `${weight} ${Math.round(size * this.uiScale)}px ${family}`;
  }
  private serif(size: number) {
    this.ctx.font = `bold ${Math.round(size * this.uiScale)}px Georgia, 'Times New Roman', serif`;
  }
  private text(s: string, x: number, y: number, color = C.ink, align: CanvasTextAlign = "left") {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(s, x, y);
  }
  private panel(x: number, y: number, w: number, h: number, soft = false) {
    const ctx = this.ctx;
    ctx.fillStyle = soft ? C.panelSoft : C.panel;
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 2;
    const r = 12;
    this.roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.stroke();
  }
  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  private button(b: UiButton) {
    const ctx = this.ctx;
    this.buttons.push(b);
    const accent = b.accent ?? (b.primary ? C.ember : C.border);
    ctx.fillStyle = b.primary ? "rgba(255,154,60,0.16)" : "rgba(40,32,52,0.7)";
    ctx.strokeStyle = accent;
    ctx.lineWidth = b.primary ? 2.5 : 2;
    this.roundRect(b.x, b.y, b.w, b.h, 10);
    ctx.fill();
    ctx.stroke();
    this.font(b.small ? 14 : 17);
    this.text(b.label, b.x + b.w / 2, b.y + b.h / 2 + 6 * this.uiScale, b.primary ? C.ember : C.ink, "center");
  }
  private dimScreen(a = 0.55) {
    this.ctx.fillStyle = `rgba(6,5,9,${a})`;
    this.ctx.fillRect(0, 0, this.W, this.H);
  }

  /** word-wrap helper */
  private wrap(s: string, maxW: number): string[] {
    const ctx = this.ctx;
    const words = s.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (ctx.measureText(test).width > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // =====================================================================
  // HUD
  // =====================================================================
  drawHUD(run: RunState, info: HudInfo) {
    this.buttons = [];
    const ctx = this.ctx;
    const s = this.uiScale;
    const pad = 12 * s;

    // hearts (each heart = 2 hp pips)
    const heartS = 9 * s;
    const hearts = run.maxHearts;
    const gap = heartS * 2.4;
    for (let i = 0; i < hearts; i++) {
      const cx = pad + heartS + i * gap;
      const cy = pad + heartS;
      const full = run.hp >= (i + 1) * 2;
      const half = !full && run.hp >= i * 2 + 1;
      if (full) this.r.fallbackHeart(cx, cy, heartS);
      else if (half) this.r.fallbackHeartHalf(cx, cy, heartS);
      else this.r.fallbackHeartEmpty(cx, cy, heartS);
    }

    // resources row (keys / seals / embers)
    let rx = pad + heartS;
    const ry = pad + heartS * 3.6;
    this.font(15);
    ctx.textAlign = "left";
    // key
    this.r.drawKeyIcon(rx + 8 * s, ry, 8 * s);
    this.text("x" + run.keys, rx + 20 * s, ry + 5 * s, C.gold);
    rx += 58 * s;
    // seals
    this.r.drawSealIcon(rx + 8 * s, ry, 8 * s);
    this.text(`${run.seals}/2`, rx + 20 * s, ry + 5 * s, C.ember);
    rx += 62 * s;
    // embers
    this.r.fallbackEmber(rx + 8 * s, ry, 5 * s);
    this.text("" + run.embers, rx + 20 * s, ry + 5 * s, C.gold);

    // pause + mute icons (top-right)
    const btn = 30 * s;
    const pauseBtn: UiButton = { id: "pause", x: this.W - pad - btn, y: pad, w: btn, h: btn, label: "" };
    const muteBtn: UiButton = { id: "mute", x: this.W - pad - btn * 2 - 6 * s, y: pad, w: btn, h: btn, label: "" };
    this.iconButton(pauseBtn, "pause");
    this.iconButton(muteBtn, this.r.assets ? "mute" : "mute");

    // minimap (below pause/mute)
    this.drawMinimap(info, this.W - pad, pad + btn + 8 * s);

    // objective hint — bottom-center, clear of the corner touch controls.
    // Hidden during boss fights (the boss bar takes that spot; objective is
    // implicit then).
    if (info.objective && !info.boss) {
      this.font(13);
      const maxW = this.W * 0.82;
      let label = info.objective;
      while (ctx.measureText(label).width > maxW - 24 * s && label.length > 8) {
        label = label.slice(0, -2);
      }
      if (label !== info.objective) label = label.trimEnd() + "…";
      const w = ctx.measureText(label).width + 24 * s;
      const ox = this.W / 2 - w / 2;
      const oy = this.H - 30 * s;
      this.panel(ox, oy, w, 24 * s, true);
      this.text(label, this.W / 2, oy + 16 * s, C.dim, "center");
    }

    // boss bar
    if (info.boss) {
      const bw = Math.min(this.W * 0.7, 420 * s);
      const bx = this.W / 2 - bw / 2;
      const by = this.H - 28 * s;
      this.font(13);
      this.text(info.boss.name, this.W / 2, by - 6 * s, info.boss.enraged ? C.ember : C.ink, "center");
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      this.roundRect(bx, by, bw, 12 * s, 6);
      ctx.fill();
      const frac = Math.max(0, info.boss.hp / info.boss.maxHp);
      ctx.fillStyle = info.boss.enraged ? C.ember : C.bad;
      this.roundRect(bx + 2, by + 2, (bw - 4) * frac, 8 * s, 4);
      ctx.fill();
      ctx.strokeStyle = C.border;
      ctx.lineWidth = 1.5;
      this.roundRect(bx, by, bw, 12 * s, 6);
      ctx.stroke();
    }

    // toasts (bottom center, above touch zone-ish)
    this.drawToasts();
  }

  private iconButton(b: UiButton, icon: "pause" | "mute") {
    const ctx = this.ctx;
    this.buttons.push(b);
    ctx.fillStyle = "rgba(20,16,28,0.7)";
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 2;
    this.roundRect(b.x, b.y, b.w, b.h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.ink;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const s = this.uiScale;
    if (icon === "pause") {
      ctx.fillRect(cx - 5 * s, cy - 6 * s, 3.5 * s, 12 * s);
      ctx.fillRect(cx + 1.5 * s, cy - 6 * s, 3.5 * s, 12 * s);
    } else {
      ctx.fillRect(cx - 6 * s, cy - 3 * s, 5 * s, 6 * s);
      ctx.beginPath();
      ctx.moveTo(cx - 1 * s, cy - 6 * s);
      ctx.lineTo(cx + 4 * s, cy - 9 * s);
      ctx.lineTo(cx + 4 * s, cy + 9 * s);
      ctx.lineTo(cx - 1 * s, cy + 6 * s);
      ctx.closePath();
      ctx.fill();
      if (this.muted) {
        ctx.strokeStyle = C.bad;
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(cx - 7 * s, cy - 8 * s);
        ctx.lineTo(cx + 8 * s, cy + 8 * s);
        ctx.stroke();
      }
    }
  }
  muted = false;

  private drawMinimap(info: HudInfo, right: number, top: number) {
    const ctx = this.ctx;
    const s = this.uiScale;
    const visible = info.rooms.filter((r) => info.visited.has(r.id) || r.id === info.currentRoomId);
    if (visible.length === 0) return;
    const minX = Math.min(...visible.map((r) => r.gx));
    const maxX = Math.max(...visible.map((r) => r.gx));
    const minY = Math.min(...visible.map((r) => r.gy));
    const maxY = Math.max(...visible.map((r) => r.gy));
    const cw = 9 * s;
    const gap = 2 * s;
    const gridW = (maxX - minX + 1) * (cw + gap);
    const gridH = (maxY - minY + 1) * (cw + gap);
    const labelH = 14 * s;
    const x0 = right - gridW;
    const y0 = top + labelH;
    this.panel(x0 - 6 * s, top - 6 * s, gridW + 12 * s, gridH + 12 * s + labelH, true);
    this.font(10);
    this.text(info.regionName, right - gridW / 2, top + 6 * s, info.accent, "center");
    for (const r of visible) {
      const x = x0 + (r.gx - minX) * (cw + gap);
      const y = y0 + (r.gy - minY) * (cw + gap);
      const cur = r.id === info.currentRoomId;
      ctx.fillStyle = cur ? info.accent : "rgba(243,233,210,0.4)";
      ctx.fillRect(x, y, cw, cw);
    }
  }

  private drawToasts() {
    const ctx = this.ctx;
    const s = this.uiScale;
    let y = this.H * 0.42;
    this.font(15);
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      const a = t.t < 0.25 ? t.t / 0.25 : t.t > t.life - 0.6 ? (t.life - t.t) / 0.6 : 1;
      ctx.globalAlpha = Math.max(0, a);
      const w = ctx.measureText(t.text).width + 28 * s;
      const x = this.W / 2 - w / 2;
      this.panel(x, y, w, 26 * s, true);
      this.text(t.text, this.W / 2, y + 17 * s, t.color, "center");
      ctx.globalAlpha = 1;
      y -= 32 * s;
    }
  }

  // =====================================================================
  // Modal (lore / item-get / generic)
  // =====================================================================
  drawModal(m: ModalContent) {
    this.buttons = [];
    const ctx = this.ctx;
    const s = this.uiScale;
    this.dimScreen(0.6);
    const w = Math.min(this.W * 0.88, 460 * s);
    this.serif(22);
    const titleLines = this.wrap(m.title, w - 48 * s);
    this.font(15);
    const bodyLines: string[] = [];
    for (const ln of m.lines) bodyLines.push(...this.wrap(ln, w - 48 * s), "");
    const lineH = 22 * s;
    const h = (40 + titleLines.length * 26 + bodyLines.length * 22 + 40) * s;
    const x = this.W / 2 - w / 2;
    const y = this.H / 2 - h / 2;
    this.panel(x, y, w, h);
    // accent bar
    ctx.fillStyle = m.accent ?? C.ember;
    ctx.fillRect(x + 18 * s, y + 18 * s, 4 * s, titleLines.length * 26 * s);
    let ty = y + 38 * s;
    this.serif(22);
    for (const ln of titleLines) {
      this.text(ln, x + 32 * s, ty, m.accent ?? C.ember, "left");
      ty += 26 * s;
    }
    ty += 8 * s;
    this.font(15, "normal", "Georgia, serif");
    for (const ln of bodyLines) {
      this.text(ln, x + 32 * s, ty, C.ink, "left");
      ty += 22 * s;
    }
    this.font(13);
    this.text(m.prompt, this.W / 2, y + h - 16 * s, C.dim, "center");
    // whole-screen acts as a close button
    this.buttons.push({ id: "close", x: 0, y: 0, w: this.W, h: this.H, label: "", primary: true });
  }

  // =====================================================================
  // Title
  // =====================================================================
  drawTitle(save: SaveData, difficulty: DifficultyMode) {
    this.buttons = [];
    const ctx = this.ctx;
    const s = this.uiScale;
    this.dimScreen(0.35);

    // title
    this.serif(46);
    ctx.save();
    ctx.shadowColor = "rgba(255,154,60,0.5)";
    ctx.shadowBlur = 20 * s;
    this.text("EMBERFALL", this.W / 2, this.H * 0.24, C.ember, "center");
    ctx.restore();
    this.serif(30);
    this.text("KEEP", this.W / 2, this.H * 0.24 + 38 * s, C.ink, "center");
    this.font(14, "normal", "Georgia, serif");
    this.text("Act I — The Sunken Keep", this.W / 2, this.H * 0.24 + 64 * s, C.dim, "center");

    // buttons
    const hasRun = !!save.checkpointId;
    const bw = Math.min(this.W * 0.7, 280 * s);
    const bh = 46 * s;
    const bx = this.W / 2 - bw / 2;
    let by = this.H * 0.46;
    this.button({ id: "start", x: bx, y: by, w: bw, h: bh, label: hasRun ? "Continue Descent" : "Begin the Descent", primary: true });
    by += bh + 12 * s;
    if (hasRun) {
      this.button({ id: "newrun", x: bx, y: by, w: bw, h: bh * 0.8, label: "New Run", small: true, accent: C.bad });
      by += bh * 0.8 + 10 * s;
    }
    const diffLabel = difficulty === "easy" ? "Mode: Easy" : difficulty === "hard" ? "Mode: Hard" : "Mode: Normal";
    const diffAccent = difficulty === "easy" ? C.good : difficulty === "hard" ? C.bad : C.border;
    this.button({ id: "difficulty", x: bx, y: by, w: bw / 2 - 5 * s, h: bh * 0.8, label: diffLabel, small: true, accent: diffAccent });
    this.button({ id: "help", x: bx + bw / 2 + 5 * s, y: by, w: bw / 2 - 5 * s, h: bh * 0.8, label: "How to Play", small: true });

    // stats footer
    this.font(12, "normal");
    const stats: string[] = [];
    if (save.bestTimeMs != null) stats.push("Best: " + formatTime(save.bestTimeMs));
    if (save.totalWins) stats.push("Wins: " + save.totalWins);
    if (save.totalDeaths) stats.push("Deaths: " + save.totalDeaths);
    if (save.bestEmbers) stats.push("Most Embers: " + save.bestEmbers);
    this.text(stats.join("    "), this.W / 2, this.H - 56 * s, C.dim, "center");

    this.font(11, "normal");
    this.text("Art: Kenney Tiny Dungeon · Tiny Town · Tiny Battle · Audio: Kenney + synth (CC0)", this.W / 2, this.H - 34 * s, C.dim, "center");
    this.text("WASD/Arrows move · Space attack · Shift roll · E interact", this.W / 2, this.H - 18 * s, C.dim, "center");
  }

  // =====================================================================
  // Controls / Help
  // =====================================================================
  drawControls() {
    this.buttons = [];
    const s = this.uiScale;
    this.dimScreen(0.6);
    const w = Math.min(this.W * 0.9, 480 * s);
    const h = Math.min(this.H * 0.86, 520 * s);
    const x = this.W / 2 - w / 2;
    const y = this.H / 2 - h / 2;
    this.panel(x, y, w, h);
    this.serif(26);
    this.text("How to Play", this.W / 2, y + 40 * s, C.ember, "center");
    this.font(15, "normal", "Georgia, serif");
    const lines = [
      "DESKTOP",
      "  Move — WASD / Arrow keys",
      "  Attack — Space / J / Z",
      "  Roll (dodge, brief i-frames) — Shift / K / X",
      "  Interact — E / F      Pause — Esc / P      Mute — M",
      "",
      "MOBILE",
      "  Left thumb — drag anywhere to move (floating stick)",
      "  ATK — swing your blade      DASH — roll/dodge",
      "  USE — appears near chests, levers, lore & doors",
      "",
      "THE WORLD",
      "  Rest at Emberlights & Lanterns to save & heal.",
      "  Roll through attacks — you're briefly invulnerable.",
      "  Two Warden Seals open the sealed door to the boss.",
      "  Fall and you respawn at the last rest; your dropped",
      "  embers wait where you died — reclaim them.",
      "  Beyond the Keep: the Rootward Road, then the drowned",
      "  Saltblack Reach. Find the Tide Relic to ford the",
      "  shallow tide; cross deep water only on bridges.",
      "  Easy mode = a forgiving QA/practice scale.",
      "  (Dev: F2 collision · F3 state · F4 warp checkpoints.)",
    ];
    let ty = y + 70 * s;
    for (const ln of lines) {
      const head = ln === ln.toUpperCase() && ln.trim().length > 0 && !ln.startsWith(" ");
      if (head) this.font(15, "bold");
      else this.font(14, "normal", "Georgia, serif");
      this.text(ln, x + 28 * s, ty, head ? C.arcane : C.ink, "left");
      ty += 21 * s;
    }
    const bw = 160 * s;
    this.button({ id: "back", x: this.W / 2 - bw / 2, y: y + h - 56 * s, w: bw, h: 42 * s, label: "Back", primary: true });
  }

  // =====================================================================
  // Pause
  // =====================================================================
  drawPause() {
    this.buttons = [];
    const s = this.uiScale;
    this.dimScreen(0.66);
    this.serif(36);
    this.text("Paused", this.W / 2, this.H * 0.3, C.ink, "center");
    const bw = Math.min(this.W * 0.7, 260 * s);
    const bh = 44 * s;
    const bx = this.W / 2 - bw / 2;
    let by = this.H * 0.4;
    this.button({ id: "resume", x: bx, y: by, w: bw, h: bh, label: "Resume", primary: true });
    by += bh + 10 * s;
    this.button({ id: "mute", x: bx, y: by, w: bw, h: bh * 0.85, label: this.muted ? "Sound: Off" : "Sound: On", small: true, accent: this.muted ? C.bad : C.good });
    by += bh * 0.85 + 10 * s;
    this.button({ id: "help", x: bx, y: by, w: bw, h: bh * 0.85, label: "How to Play", small: true });
    by += bh * 0.85 + 10 * s;
    this.button({ id: "abandon", x: bx, y: by, w: bw, h: bh * 0.85, label: "Abandon to Title", small: true, accent: C.bad });
  }

  // =====================================================================
  // Checkpoint rest
  // =====================================================================
  drawCheckpoint(name: string) {
    this.buttons = [];
    const s = this.uiScale;
    this.dimScreen(0.6);
    this.r.fallbackEmber(this.W / 2, this.H * 0.3, 10 * s);
    this.serif(28);
    this.text(name, this.W / 2, this.H * 0.3 + 50 * s, C.ember, "center");
    this.font(15, "normal", "Georgia, serif");
    this.text("You rest. Vigor restored. The Keep holds its breath.", this.W / 2, this.H * 0.3 + 78 * s, C.dim, "center");
    const bw = Math.min(this.W * 0.7, 260 * s);
    const bh = 44 * s;
    const bx = this.W / 2 - bw / 2;
    let by = this.H * 0.55;
    this.button({ id: "resume", x: bx, y: by, w: bw, h: bh, label: "Press On", primary: true });
    by += bh + 10 * s;
    this.button({ id: "abandon", x: bx, y: by, w: bw, h: bh * 0.82, label: "Abandon to Title", small: true, accent: C.bad });
  }

  // =====================================================================
  // Death
  // =====================================================================
  drawDeath(run: RunState, checkpointName: string) {
    this.buttons = [];
    const s = this.uiScale;
    this.dimScreen(0.72);
    this.serif(44);
    this.text("You Fell", this.W / 2, this.H * 0.3, C.bad, "center");
    this.font(15, "normal", "Georgia, serif");
    const msg =
      run.lostEmbers > 0
        ? `Your embers (${run.lostEmbers}) scattered where you fell. Reclaim them.`
        : "The Keep takes what it is owed.";
    this.text(msg, this.W / 2, this.H * 0.3 + 36 * s, C.dim, "center");
    this.text(`Deaths: ${run.stats.deaths}`, this.W / 2, this.H * 0.3 + 60 * s, C.dim, "center");
    const bw = Math.min(this.W * 0.7, 280 * s);
    const bh = 46 * s;
    const bx = this.W / 2 - bw / 2;
    let by = this.H * 0.52;
    this.button({ id: "respawn", x: bx, y: by, w: bw, h: bh, label: "Rise at " + checkpointName, primary: true });
    by += bh + 10 * s;
    this.button({ id: "abandon", x: bx, y: by, w: bw, h: bh * 0.82, label: "Abandon to Title", small: true, accent: C.bad });
  }

  // =====================================================================
  // Victory
  // =====================================================================
  drawVictory(run: RunState, save: SaveData, newBest: { time: boolean; embers: boolean }) {
    this.buttons = [];
    const ctx = this.ctx;
    const s = this.uiScale;
    this.dimScreen(0.55);
    ctx.save();
    ctx.shadowColor = "rgba(255,154,60,0.6)";
    ctx.shadowBlur = 22 * s;
    this.serif(40);
    this.text("Act I Complete", this.W / 2, this.H * 0.18, C.ember, "center");
    ctx.restore();
    this.font(14, "normal", "Georgia, serif");
    const tease = "The curse over Emberfall lifts like smoke. The summit gate grinds open — beyond it an old bell-road waits, already taking root. The journey is only beginning.";
    let ty = this.H * 0.18 + 30 * s;
    for (const ln of this.wrap(tease, Math.min(this.W * 0.8, 520 * s))) {
      this.text(ln, this.W / 2, ty, C.dim, "center");
      ty += 20 * s;
    }

    const rows: [string, string, boolean][] = [
      ["Time", formatTime(run.stats.elapsedMs), newBest.time],
      ["Rooms cleared", `${run.stats.roomsVisited.size}`, false],
      ["Enemies defeated", `${run.stats.enemiesDefeated}`, false],
      ["Embers collected", `${run.stats.embersCollected}`, newBest.embers],
      ["Lore found", `${run.stats.loreFound}`, false],
      ["Deaths", `${run.stats.deaths}`, false],
    ];
    const w = Math.min(this.W * 0.8, 420 * s);
    const x = this.W / 2 - w / 2;
    const py = ty + 10 * s;
    const rh = 23 * s;
    this.statRows(x, py, w, rh, rows);

    const bw = Math.min(this.W * 0.74, 300 * s);
    const bh = 46 * s;
    const bx = this.W / 2 - bw / 2;
    let by = py + rows.length * rh + 30 * s;
    this.button({ id: "onward", x: bx, y: by, w: bw, h: bh, label: "Walk the Rootward Road  →", primary: true });
    by += bh + 9 * s;
    this.button({ id: "replay", x: bx, y: by, w: bw / 3 - 6 * s, h: bh * 0.78, label: "Replay", small: true });
    this.button({ id: "credits", x: bx + bw / 3, y: by, w: bw / 3 - 6 * s, h: bh * 0.78, label: "Credits", small: true });
    this.button({ id: "title", x: bx + (bw / 3) * 2 + 6 * s, y: by, w: bw / 3 - 6 * s, h: bh * 0.78, label: "Title", small: true });
  }

  private statRows(x: number, py: number, w: number, rh: number, rows: [string, string, boolean][]) {
    this.panel(x, py, w, rows.length * rh + 16 * this.uiScale);
    this.font(15);
    let ry = py + 24 * this.uiScale;
    for (const [k, v, best] of rows) {
      this.text(k, x + 18 * this.uiScale, ry, C.dim, "left");
      this.text(v + (best ? "  ★" : ""), x + w - 18 * this.uiScale, ry, best ? C.gold : C.ink, "right");
      ry += rh;
    }
  }

  // =====================================================================
  // Region complete (Phase 3 endpoint — the Drowned Toll-Gate)
  // =====================================================================
  drawRegionComplete(run: RunState, save: SaveData) {
    this.buttons = [];
    const ctx = this.ctx;
    const s = this.uiScale;
    this.dimScreen(0.64);
    ctx.save();
    ctx.shadowColor = "rgba(70,180,200,0.6)";
    ctx.shadowBlur = 22 * s;
    this.serif(33);
    this.text("The Saltblack Reach", this.W / 2, this.H * 0.14, "#46b4c8", "center");
    ctx.restore();
    this.serif(19);
    this.text("The Road Goes On", this.W / 2, this.H * 0.14 + 28 * s, C.ember, "center");
    this.font(13.5, "normal", "Georgia, serif");
    const tease =
      "The Drowned Gear is broken; the toll is paid. Past the sealed gate the road climbs into a country of glass and buried suns, where the curse wears a brighter face. Seals are made to be broken.";
    let ty = this.H * 0.14 + 52 * s;
    for (const ln of this.wrap(tease, Math.min(this.W * 0.82, 520 * s))) {
      this.text(ln, this.W / 2, ty, C.dim, "center");
      ty += 19 * s;
    }

    // The journey-so-far ledger: which world segments are cleared / pending.
    const journey: [string, boolean][] = [
      ["Emberfall Keep — broken", true],
      ["The Rootward Road — walked", true],
      ["The Saltblack Reach — drowned & crossed", true],
      ["The Glass Country — sealed", false],
    ];
    const jw = Math.min(this.W * 0.82, 440 * s);
    const jx = this.W / 2 - jw / 2;
    let jy = ty + 8 * s;
    this.panel(jx, jy, jw, journey.length * 21 * s + 14 * s, true);
    this.font(13);
    let ly = jy + 22 * s;
    for (const [label, done] of journey) {
      this.text(done ? "✓" : "◇", jx + 16 * s, ly, done ? C.good : C.dim, "left");
      this.text(label, jx + 34 * s, ly, done ? C.ink : C.dim, "left");
      ly += 21 * s;
    }

    const rows: [string, string, boolean][] = [
      ["Total time", formatTime(run.stats.elapsedMs), false],
      ["Rooms explored", `${run.stats.roomsVisited.size}`, false],
      ["Enemies defeated", `${run.stats.enemiesDefeated}`, false],
      ["Bell Tokens", `${run.bellTokens} / 5`, run.bellTokens >= 5],
      ["Tide forded", run.tideUnlocked ? "yes" : "no", run.tideUnlocked],
      ["Lore found", `${run.stats.loreFound}`, false],
    ];
    const w = Math.min(this.W * 0.82, 440 * s);
    const x = this.W / 2 - w / 2;
    const py = ly + 8 * s;
    const rh = 22 * s;
    this.statRows(x, py, w, rh, rows);

    const bw = Math.min(this.W * 0.74, 300 * s);
    const bh = 44 * s;
    const bx = this.W / 2 - bw / 2;
    let by = py + rows.length * rh + 26 * s;
    this.button({ id: "replay", x: bx, y: by, w: bw, h: bh, label: "Begin a New Journey", primary: true });
    by += bh + 9 * s;
    this.button({ id: "credits", x: bx, y: by, w: bw / 2 - 5 * s, h: bh * 0.78, label: "Credits", small: true });
    this.button({ id: "title", x: bx + bw / 2 + 5 * s, y: by, w: bw / 2 - 5 * s, h: bh * 0.78, label: "Title", small: true });
  }

  // =====================================================================
  // Credits
  // =====================================================================
  drawCredits() {
    this.buttons = [];
    const s = this.uiScale;
    this.dimScreen(0.7);
    const w = Math.min(this.W * 0.9, 480 * s);
    const h = Math.min(this.H * 0.82, 460 * s);
    const x = this.W / 2 - w / 2;
    const y = this.H / 2 - h / 2;
    this.panel(x, y, w, h);
    this.serif(26);
    this.text("Credits & Notices", this.W / 2, y + 40 * s, C.ember, "center");
    this.font(14, "normal", "Georgia, serif");
    const lines = [
      "EMBERFALL KEEP — Act I",
      "A complete first adventure in an expandable world.",
      "",
      "ART",
      "  Kenney “Tiny Dungeon” (16×16) — kenney.nl",
      "  Hearts, keys, embers & effects drawn procedurally",
      "  to match the pack.",
      "",
      "AUDIO",
      "  Kenney RPG / Impact / Interface / Music (when",
      "  supported) with a Web Audio synth fallback.",
      "",
      "All Kenney assets are CC0. Crediting is voluntary —",
      "and gratefully given. Engine, design & code built",
      "for this one-shot in TypeScript + Vite + Canvas.",
    ];
    let ty = y + 70 * s;
    for (const ln of lines) {
      const head = ln === ln.toUpperCase() && ln.trim().length > 0 && !ln.startsWith(" ");
      this.font(head ? 15 : 13.5, head ? "bold" : "normal", "Georgia, serif");
      this.text(ln, x + 26 * s, ty, head ? C.arcane : C.ink, "left");
      ty += 20 * s;
    }
    const bw = 160 * s;
    this.button({ id: "back", x: this.W / 2 - bw / 2, y: y + h - 54 * s, w: bw, h: 40 * s, label: "Back", primary: true });
  }

  // =====================================================================
  // Loading
  // =====================================================================
  drawLoading(progress: number) {
    this.buttons = [];
    const s = this.uiScale;
    this.dimScreen(1);
    this.serif(30);
    this.text("EMBERFALL KEEP", this.W / 2, this.H / 2 - 20 * s, C.ember, "center");
    const bw = Math.min(this.W * 0.6, 260 * s);
    const bx = this.W / 2 - bw / 2;
    const by = this.H / 2 + 10 * s;
    this.ctx.strokeStyle = C.border;
    this.ctx.lineWidth = 2;
    this.roundRect(bx, by, bw, 10 * s, 5);
    this.ctx.stroke();
    this.ctx.fillStyle = C.ember;
    this.roundRect(bx + 2, by + 2, (bw - 4) * Math.max(0.05, progress), 6 * s, 3);
    this.ctx.fill();
    this.font(12, "normal");
    this.text("Lighting the Emberlights…", this.W / 2, by + 32 * s, C.dim, "center");
  }
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
