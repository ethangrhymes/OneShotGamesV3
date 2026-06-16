/**
 * Renderer.ts — high-DPI responsive canvas, a follow-and-clamp camera, world
 * tile/entity/effect drawing (Kenney sprites with procedural fallbacks for every
 * category), and the small particle/slash effect classes. UI.ts draws the HUD
 * and screens on top using the same ctx in CSS-pixel space.
 */
import { Balance, TILE } from "./Balance";
import type { AssetManager } from "./AssetManager";
import { Room, type Cell } from "./Dungeon";
import type { Boss, Enemy, Hazard, Interactable, Player, Projectile } from "./Entities";
import type { RunState } from "./Progression";

// ---- effects ---------------------------------------------------------------
export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  drag: number;
  constructor(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, drag = 2.5) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.color = color;
    this.drag = drag;
  }
  get alive() {
    return this.life > 0;
  }
  update(dt: number) {
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const d = Math.pow(0.5, dt * this.drag);
    this.vx *= d;
    this.vy *= d;
  }
}

export class Slash {
  x: number;
  y: number;
  angle: number;
  reach: number;
  t = 0;
  dur: number;
  color: string;
  constructor(x: number, y: number, angle: number, reach: number, dur: number, color = "#fff4d6") {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.reach = reach;
    this.dur = dur;
    this.color = color;
  }
  get alive() {
    return this.t < this.dur;
  }
  update(dt: number) {
    this.t += dt;
  }
}

export interface SceneView {
  room: Room;
  player: Player;
  enemies: Enemy[];
  boss: Boss | null;
  projectiles: Projectile[];
  hazards: Hazard[];
  interactables: Interactable[];
  particles: Particle[];
  slashes: Slash[];
  run: RunState;
  nearInteractable: Interactable | null;
  time: number;
  fade: number; // 0 transparent .. 1 black (room transitions)
  debug?: boolean;
}

const FLOOR_KEYS: Record<number, string> = { 0: "floor", 1: "floor_b", 2: "floor_c", 3: "floor_tile" };

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  assets: AssetManager;
  dpr = 1;
  viewW = 800;
  viewH = 600;
  scale = 3;

  camX = 0;
  camY = 0;
  private shakeAmt = 0;
  private shakeX = 0;
  private shakeY = 0;
  private camInit = false;

  constructor(canvas: HTMLCanvasElement, assets: AssetManager) {
    this.canvas = canvas;
    this.assets = assets;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas not supported");
    this.ctx = ctx;
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    // Use the visual viewport (the actually-visible area) when available so the
    // canvas fills the screen correctly as the iOS URL bar shows/hides, without
    // chasing a pinch-zoom (zoom is prevented globally in main.ts).
    const vp = window.visualViewport;
    const w = Math.round(vp ? vp.width : window.innerWidth);
    const h = Math.round(vp ? vp.height : window.innerHeight);
    this.viewW = w;
    this.viewH = h;
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    // Zoom: show a readable tile count. Base it on the SHORT axis but clamp the
    // tile-count so the URL bar hiding/showing can't noticeably re-zoom the view.
    const short = Math.min(w, h);
    let s = short / (9.5 * TILE);
    s = Math.max(2.2, Math.min(4.5, s));
    this.scale = Math.round(s * 2) / 2;
  }

  shake(amount: number) {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
  }

  updateCamera(dt: number, player: Player, room: Room) {
    const viewWUnits = this.viewW / this.scale;
    const viewHUnits = this.viewH / this.scale;
    let tx: number;
    let ty: number;
    if (room.pxW <= viewWUnits) tx = (room.pxW - viewWUnits) / 2;
    else tx = Math.max(0, Math.min(player.x - viewWUnits / 2, room.pxW - viewWUnits));
    if (room.pxH <= viewHUnits) ty = (room.pxH - viewHUnits) / 2;
    else ty = Math.max(0, Math.min(player.y - viewHUnits / 2, room.pxH - viewHUnits));

    if (!this.camInit) {
      this.camX = tx;
      this.camY = ty;
      this.camInit = true;
    } else {
      const k = 1 - Math.pow(1 - Balance.camera.lerp, dt * 60);
      this.camX += (tx - this.camX) * k;
      this.camY += (ty - this.camY) * k;
    }
    // shake
    if (this.shakeAmt > 0.05) {
      this.shakeX = (Math.random() * 2 - 1) * this.shakeAmt;
      this.shakeY = (Math.random() * 2 - 1) * this.shakeAmt;
      this.shakeAmt -= dt * Balance.camera.shakeDecay * (1 + this.shakeAmt * 0.1);
      if (this.shakeAmt < 0) this.shakeAmt = 0;
    } else {
      this.shakeX = this.shakeY = 0;
    }
  }

  resetCamera() {
    this.camInit = false;
  }

  private sx(wx: number): number {
    return (wx - this.camX) * this.scale + this.shakeX;
  }
  private sy(wy: number): number {
    return (wy - this.camY) * this.scale + this.shakeY;
  }

  // ----- frame -----
  beginFrame() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    // dark ambient background (so out-of-room area reads as surrounding dark)
    ctx.fillStyle = "#0b0910";
    ctx.fillRect(0, 0, this.viewW, this.viewH);
  }

  drawScene(view: SceneView) {
    this.timeAcc = view.time;
    this.drawTiles(view.room, view.time);
    this.drawHazardTiles(view.room, view.time);
    // shadows pass for entities (cheap depth)
    this.drawInteractables(view, "under");
    this.drawDoors(view.room);

    // sort drawables by y for simple depth
    this.drawInteractables(view, "over");

    // hazards (boss AoE)
    for (const h of view.hazards) this.drawHazard(h);

    // entities
    const drawables: { y: number; fn: () => void }[] = [];
    for (const e of view.enemies) if (e.alive) drawables.push({ y: e.y, fn: () => this.drawEnemy(e) });
    if (view.boss && view.boss.alive) {
      const b = view.boss;
      drawables.push({ y: b.y, fn: () => this.drawBoss(b) });
    }
    drawables.push({ y: view.player.y, fn: () => this.drawPlayer(view.player, view.time) });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();

    for (const p of view.projectiles) if (p.alive) this.drawProjectile(p);
    for (const s of view.slashes) this.drawSlash(s, view.player);
    for (const p of view.particles) if (p.alive) this.drawParticle(p);

    // near-interactable prompt ring
    if (view.nearInteractable) this.drawPrompt(view.nearInteractable);

    // low-health vignette
    const hpFrac = view.run.hp / view.run.maxHp;
    if (hpFrac <= 0.34) {
      const pulse = 0.18 + 0.12 * Math.sin(view.time * 6);
      this.vignette(`rgba(150,20,20,${(0.34 - hpFrac) / 0.34 * pulse})`);
    } else {
      this.vignette("rgba(0,0,0,0.28)");
    }

    if (view.debug) this.drawDebug(view);

    if (view.fade > 0) {
      this.ctx.fillStyle = `rgba(6,5,9,${view.fade})`;
      this.ctx.fillRect(0, 0, this.viewW, this.viewH);
    }
  }

  /** F2 debug overlay: collision, doors+lock labels, spawns, enemies. */
  private drawDebug(view: SceneView) {
    const ctx = this.ctx;
    const room = view.room;
    const ts = TILE * this.scale;
    // collision / hazard tiles
    for (let ty = 0; ty < room.h; ty++) {
      for (let tx = 0; tx < room.w; tx++) {
        const c = room.cellAt(tx, ty)!;
        const px = this.sx(tx * TILE);
        const py = this.sy(ty * TILE);
        if (px < -ts || py < -ts || px > this.viewW || py > this.viewH) continue;
        if (room.tileSolid(tx, ty)) {
          ctx.fillStyle = "rgba(255,40,40,0.28)";
          ctx.fillRect(px, py, ts, ts);
        } else if (c.kind === "hazard") {
          ctx.fillStyle = "rgba(255,210,40,0.3)";
          ctx.fillRect(px, py, ts, ts);
        }
      }
    }
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // doors with lock labels
    for (const d of room.doors) {
      const cx = this.sx(d.def.tx * TILE + TILE / 2);
      const cy = this.sy(d.def.ty * TILE + TILE / 2);
      let label = d.def.type.toUpperCase();
      if (d.def.type === "bossGate") label = `GATE(${d.def.sealsRequired ?? 2})`;
      else if (d.def.type === "locked") label = "LOCK(key)";
      else if (d.def.type === "shortcut") label = `SHORT(${d.def.flag ?? "?"})`;
      ctx.fillStyle = d.open ? "rgba(120,255,140,0.9)" : "rgba(255,160,60,0.95)";
      ctx.fillRect(cx - 3, cy - 3, 6, 6);
      ctx.fillStyle = "#fff";
      ctx.fillText(`${label}->${d.def.to}`, cx, cy - 10);
    }
    // interactables
    for (const it of view.interactables) {
      const cx = this.sx(it.x);
      const cy = this.sy(it.y);
      ctx.fillStyle = "rgba(120,180,255,0.95)";
      ctx.fillRect(cx - 2, cy - 2, 4, 4);
      const tag = it.kind === "prop" ? it.prop : it.kind === "pickup" ? it.pickup : it.ref ?? it.kind;
      ctx.fillStyle = "#bfe0ff";
      ctx.fillText(String(tag ?? it.kind), cx, cy + 10);
    }
    // enemies + boss
    for (const e of view.enemies) {
      if (!e.alive) continue;
      ctx.fillStyle = "#ff5a6a";
      ctx.fillText(e.def.behavior, this.sx(e.x), this.sy(e.y) - 12);
    }
    if (view.boss && view.boss.alive) {
      ctx.fillStyle = "#ffd27a";
      ctx.fillText(view.boss.phase, this.sx(view.boss.x), this.sy(view.boss.y) - 16);
    }
    // player position
    ctx.fillStyle = "rgba(120,255,140,1)";
    ctx.fillRect(this.sx(view.player.x) - 2, this.sy(view.player.y) - 2, 4, 4);
    // header
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, this.viewH - 18, this.viewW, 18);
    ctx.fillStyle = "#9effa0";
    ctx.textAlign = "left";
    ctx.fillText(`DEBUG  room=${room.def.id}  enemies=${view.enemies.length}  (F2 to hide)`, 6, this.viewH - 9);
  }

  private vignette(color: string) {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(
      this.viewW / 2,
      this.viewH / 2,
      Math.min(this.viewW, this.viewH) * 0.32,
      this.viewW / 2,
      this.viewH / 2,
      Math.max(this.viewW, this.viewH) * 0.7
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
  }

  // ----- tiles -----
  private drawTiles(room: Room, time: number) {
    const ctx = this.ctx;
    const ts = TILE * this.scale;
    const startTx = Math.max(0, Math.floor(this.camX / TILE));
    const endTx = Math.min(room.w - 1, Math.ceil((this.camX + this.viewW / this.scale) / TILE));
    const startTy = Math.max(0, Math.floor(this.camY / TILE));
    const endTy = Math.min(room.h - 1, Math.ceil((this.camY + this.viewH / this.scale) / TILE));

    for (let ty = startTy; ty <= endTy; ty++) {
      for (let tx = startTx; tx <= endTx; tx++) {
        const cell = room.cellAt(tx, ty)!;
        if (cell.kind === "void") continue;
        const px = Math.round(this.sx(tx * TILE));
        const py = Math.round(this.sy(ty * TILE));
        const sz = Math.ceil(ts) + 1;
        this.drawCell(cell, room, px, py, sz, tx, ty, time);
      }
    }
  }

  private floorKey(floor: string, variant: number): string {
    switch (floor) {
      case "grass":
        return variant === 1 ? "tt_grass_b" : variant === 2 ? "tt_grass_flower" : variant === 3 ? "tt_path" : "tt_grass";
      case "saltgrass":
        // war-coast verge (Tiny Battle grass); variant 3 = stone causeway
        return variant === 1 ? "tb_grass_b" : variant === 2 ? "tb_grass_flower" : variant === 3 ? "tb_road" : "tb_grass";
      case "glass":
        // bright glass-country ground (Tiny Ski snow/ice)
        return variant === 1 ? "sk_ice" : variant === 2 ? "sk_snow_b" : variant === 3 ? "sk_ice_b" : "sk_snow";
      case "path":
        return "tt_path";
      case "dirt":
        return variant === 1 ? "floor_dirt_b" : variant === 2 ? "floor_dirt_c" : variant === 3 ? "floor_tile" : "floor_dirt";
      case "tile":
        return "floor_tile";
      default:
        return FLOOR_KEYS[variant] ?? "floor";
    }
  }
  private wallKey(wall: string, variant: number): string {
    switch (wall) {
      case "stone":
        return "wall_stone";
      case "townstone":
        return "tt_wall_stone";
      case "redbrick":
        return "tt_wall_red";
      case "wood":
        return "tt_wall_wood";
      case "hedge":
        return "tt_tree";
      default:
        return variant === 1 ? "wall_cracked" : "wall";
    }
  }

  private drawCell(cell: Cell, room: Room, px: number, py: number, sz: number, tx: number, ty: number, time: number) {
    const ctx = this.ctx;
    const outdoor = room.def.theme === "outdoor";
    if (cell.kind === "water") {
      this.drawWater(cell.variant === 1, px, py, sz, tx, ty, time);
      return;
    }
    if (cell.kind === "bridge") {
      // water glints beneath, then the planks on top
      this.drawWater(true, px, py, sz, tx, ty, time);
      this.blit("tb_bridge", px, py, sz, sz) || this.fallbackBridge(px, py, sz);
      return;
    }
    if (cell.kind === "floor") {
      this.blit(this.floorKey(room.def.floor, cell.variant), px, py, sz, sz) || this.fallbackFloor(px, py, sz, room.def.floor);
    } else if (cell.kind === "wall") {
      // glass-country walls are procedural bright crystal blocks
      if (room.def.wall === "glass") {
        this.fallbackGlassWall(px, py, sz, cell.variant);
        return;
      }
      // outdoor "hedge" walls: lay grass beneath the tree so edges read cleanly
      if (room.def.wall === "hedge") this.blit("tt_grass", px, py, sz, sz);
      this.blit(this.wallKey(room.def.wall, cell.variant), px, py, sz, sz) ||
        (outdoor ? this.fallbackHedge(px, py, sz) : this.fallbackWall(px, py, sz));
    } else if (cell.kind === "gargoyle") {
      if (outdoor) {
        this.blit("tt_grass", px, py, sz, sz) || this.fallbackFloor(px, py, sz, "grass");
        this.blit("tt_tree", px, py, sz, sz) || this.fallbackHedge(px, py, sz);
      } else {
        this.blit("wall_stone", px, py, sz, sz) || this.fallbackWall(px, py, sz);
        this.blit("gargoyle", px, py, sz, sz) ||
          (() => {
            ctx.fillStyle = "#3a4048";
            ctx.fillRect(px + sz * 0.2, py + sz * 0.2, sz * 0.6, sz * 0.6);
          })();
      }
    }
  }

  private drawHazardTiles(room: Room, time: number) {
    const ctx = this.ctx;
    const ts = Math.ceil(TILE * this.scale) + 1;
    for (let ty = 0; ty < room.h; ty++) {
      for (let tx = 0; tx < room.w; tx++) {
        const c = room.cellAt(tx, ty)!;
        if (c.kind !== "hazard") continue;
        const px = Math.round(this.sx(tx * TILE));
        const py = Math.round(this.sy(ty * TILE));
        const pulse = 0.5 + 0.5 * Math.sin(time * 3 + tx + ty);
        if (room.def.theme === "glass") {
          // Shard Floor: cracked glass that pulses before it bites
          this.blit(this.floorKey("glass", 0), px, py, ts, ts) || this.fallbackFloor(px, py, ts, "glass");
          ctx.save();
          ctx.globalAlpha = 0.5 + 0.45 * pulse;
          ctx.strokeStyle = "rgba(120,200,255,0.9)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px + ts * 0.2, py + ts * 0.15);
          ctx.lineTo(px + ts * 0.5, py + ts * 0.55);
          ctx.lineTo(px + ts * 0.3, py + ts * 0.85);
          ctx.moveTo(px + ts * 0.5, py + ts * 0.55);
          ctx.lineTo(px + ts * 0.82, py + ts * 0.7);
          ctx.moveTo(px + ts * 0.5, py + ts * 0.55);
          ctx.lineTo(px + ts * 0.7, py + ts * 0.2);
          ctx.stroke();
          ctx.restore();
          continue;
        }
        // floor under
        this.blit(room.def.floor === "dirt" ? "floor_dirt" : "floor", px, py, ts, ts) || this.fallbackFloor(px, py, ts, room.def.floor);
        // spikes (use trap sprite; pulse to telegraph)
        ctx.globalAlpha = 0.55 + 0.45 * pulse;
        this.blit("trap", px, py, ts, ts) ||
          (() => {
            ctx.fillStyle = "#caa14a";
            ctx.fillRect(px + ts * 0.15, py + ts * 0.15, ts * 0.7, ts * 0.7);
          })();
        ctx.globalAlpha = 1;
      }
    }
  }

  /**
   * Tide-water. Deep water (deep=true) is a dark, slow, always-solid border/moat;
   * shallow water is brighter with stepping-stone dapples that read as fordable
   * (passable only with the Tide Relic). Kenney Tiny Battle tiles with a procedural
   * animated fallback so it always renders.
   */
  private drawWater(deep: boolean, px: number, py: number, sz: number, tx: number, ty: number, time: number) {
    const ctx = this.ctx;
    if (!this.blit(deep ? "tb_water" : "tb_shallow", px, py, sz, sz)) {
      ctx.fillStyle = deep ? "#1f4f6b" : "#3f93b0";
      ctx.fillRect(px, py, sz, sz);
    }
    if (deep) {
      ctx.fillStyle = "rgba(8,20,34,0.34)"; // depth darkening
      ctx.fillRect(px, py, sz, sz);
    }
    // animated caustic band
    const ph = time * (deep ? 1.1 : 1.8) + tx * 0.7 + ty * 0.9;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(180,225,245,${0.05 + 0.05 * Math.sin(ph)})`;
    const yy = py + (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(ph))) * sz;
    ctx.fillRect(px, Math.round(yy), sz, Math.max(1, sz * 0.07));
    ctx.restore();
    if (!deep) {
      // fordable dapples
      ctx.fillStyle = "rgba(225,242,250,0.16)";
      const d = Math.max(1, sz * 0.13);
      ctx.fillRect(px + sz * 0.28, py + sz * 0.32, d, d);
      ctx.fillRect(px + sz * 0.58, py + sz * 0.6, d, d);
    }
  }

  private fallbackBridge(px: number, py: number, sz: number) {
    const ctx = this.ctx;
    ctx.fillStyle = "#7a5a36";
    ctx.fillRect(px, py, sz, sz);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    for (let i = 0; i < 4; i++) ctx.fillRect(px, py + Math.round(i * sz * 0.28), sz, 1.5);
    ctx.fillStyle = "rgba(255,235,200,0.12)";
    ctx.fillRect(px, py, sz, 2);
  }

  private drawDoors(room: Room) {
    const ctx = this.ctx;
    const ts = Math.ceil(TILE * this.scale) + 1;
    const outdoor = room.def.theme === "outdoor";
    const glass = room.def.theme === "glass";
    for (const d of room.doors) {
      const px = Math.round(this.sx(d.def.tx * TILE));
      const py = Math.round(this.sy(d.def.ty * TILE));
      // --- Phase 4 mechanic doors (procedural light) ---
      if (d.def.type === "mirror") {
        this.drawMirrorGate(d.def.tx, d.def.ty, d.open);
        continue;
      }
      if (d.def.type === "crystalGate") {
        if (!d.open) this.drawCrystalGate(px, py, ts, this.crystalColor(d.def.flag));
        continue; // open crystal gate = a gap (floor shows through)
      }
      if (d.open) {
        // outdoor/glass open passages are just a gap (floor shows through)
        if (!outdoor && !glass) this.blit("door_open", px, py, ts, ts);
      } else if (glass) {
        // a frozen-shut glass gate (non-mechanic): a pale ice barrier
        this.drawCrystalGate(px, py, ts, "#bfe6ff");
      } else {
        const gate = d.def.type === "bossGate" || d.def.type === "shortcut";
        if (outdoor) {
          // a barred fence/gate across the path
          if (!this.blit(gate ? "tt_arch" : "tt_fence", px, py, ts, ts)) {
            ctx.fillStyle = "#7a5a3a";
            ctx.fillRect(px, py, ts, ts);
          }
        } else {
          const key = gate ? (d.def.edge === "n" || d.def.edge === "s" ? "gate" : "gate_v") : "door_closed";
          if (!this.blit(key, px, py, ts, ts)) {
            ctx.fillStyle = gate ? "#6b7178" : "#5a3a22";
            ctx.fillRect(px, py, ts, ts);
          }
        }
      }
    }
  }

  /** Map a crystal flag (crystal_red_lit, …) to its glow colour. */
  private crystalColor(flag?: string): string {
    if (!flag) return "#7fe0ff";
    if (flag.includes("red")) return "#ff6a7a";
    if (flag.includes("blue")) return "#5aa6ff";
    if (flag.includes("gold")) return "#ffce5a";
    if (flag.includes("green")) return "#7fe0a0";
    return "#7fe0ff";
  }

  /** A closed crystal gate: glowing faceted bars in the gate's colour. */
  private drawCrystalGate(px: number, py: number, ts: number, color: string) {
    const ctx = this.ctx;
    const cx = px + ts / 2;
    const cy = py + ts / 2;
    this.softGlowPx(cx, cy, ts * 0.85, color, 0.3);
    const pulse = 0.6 + 0.4 * Math.sin(this.timeAcc * 4);
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.55 + 0.35 * pulse;
    for (let i = 0; i < 3; i++) {
      const bx = px + ts * (0.22 + i * 0.28);
      ctx.beginPath();
      ctx.moveTo(bx, py + 2);
      ctx.lineTo(bx + ts * 0.11, py + ts * 0.5);
      ctx.lineTo(bx, py + ts - 2);
      ctx.lineTo(bx - ts * 0.11, py + ts * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /** A mirror gate: a swirling portal (active = Shard held) or a dormant cracked mirror. */
  private drawMirrorGate(tx: number, ty: number, active: boolean) {
    const ctx = this.ctx;
    const ts = TILE * this.scale;
    const cx = this.sx(tx * TILE + TILE / 2);
    const cy = this.sy(ty * TILE + TILE / 2);
    const t = this.timeAcc;
    ctx.save();
    if (active) {
      this.softGlowPx(cx, cy, ts * 0.8, "#bfe6ff", 0.4);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 4; i++) {
        const k = (i + 1) / 4;
        ctx.strokeStyle = `rgba(150,220,255,${0.3 - i * 0.05 + 0.08 * Math.sin(t * 3 + i)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, ts * 0.4 * k, ts * 0.58 * k, t * 0.9 + i, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = "rgba(40,50,72,0.7)";
      ctx.beginPath();
      ctx.ellipse(cx, cy, ts * 0.38, ts * 0.56, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(160,180,210,0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - ts * 0.18, cy - ts * 0.4);
      ctx.lineTo(cx + ts * 0.1, cy + ts * 0.5);
      ctx.stroke();
    }
    ctx.strokeStyle = active ? "rgba(200,240,255,0.95)" : "rgba(120,140,170,0.6)";
    ctx.lineWidth = 2.5;
    ctx.globalCompositeOperation = "source-over";
    ctx.beginPath();
    ctx.ellipse(cx, cy, ts * 0.42, ts * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** A soft additive glow at a screen-space point (px,py already screen coords). */
  private softGlowPx(x: number, y: number, r: number, color: string, alpha = 0.4) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ----- interactables -----
  private drawInteractables(view: SceneView, layer: "under" | "over") {
    for (const it of view.interactables) {
      const under = it.kind === "prop" && (it.prop === "torch" || it.prop === "fence" || it.prop === "bars");
      if (layer === "under" && !under) continue;
      if (layer === "over" && under) continue;
      this.drawInteractable(it, view.time);
    }
  }

  private drawInteractable(it: Interactable, time: number) {
    const ctx = this.ctx;
    const ts = Math.ceil(TILE * this.scale) + 1;
    const px = Math.round(this.sx(it.x - TILE / 2));
    const py = Math.round(this.sy(it.y - TILE / 2));
    const bob = Math.sin(time * 3 + it.bob) * 1.5 * this.scale * 0.3;

    switch (it.kind) {
      case "checkpoint": {
        // torch/brazier with glow
        const glow = 0.5 + 0.5 * Math.sin(time * 5 + it.bob);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `rgba(255,150,40,${0.12 + glow * 0.12})`;
        ctx.beginPath();
        ctx.arc(this.sx(it.x), this.sy(it.y), ts * (1.5 + glow * 0.25), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        this.blit("torch", px, py, ts, ts) || this.fallbackTorch(px, py, ts);
        break;
      }
      case "lore":
      case "prop": {
        // procedural glass-country props (light)
        if (it.prop === "crystal") {
          this.drawCrystal(this.sx(it.x), this.sy(it.y), ts * 0.42, "#9fe8ff", time, false);
          break;
        }
        if (it.prop === "sunstone") {
          this.drawSunstone(this.sx(it.x), this.sy(it.y), ts * 0.5, time);
          break;
        }
        // the sealed world-gate (arch) glows to draw the eye — gold for the Sun-Gate
        if (it.prop === "arch") {
          const g = 0.5 + 0.5 * Math.sin(time * 2 + it.bob);
          const gold = it.uid === "sun_gate";
          this.softGlow(it.x, it.y, ts * (1.6 + g * 0.3), gold ? "rgba(255,210,90,0.3)" : "rgba(150,90,255,0.22)");
        }
        const key = this.propKey(it);
        if (key) this.blit(key, px, py, ts, ts) || this.fallbackProp(it, px, py, ts);
        if (it.kind === "lore" && !it.used) {
          this.softGlow(it.x, it.y, ts * 0.9, `rgba(120,180,255,0.18)`);
        }
        break;
      }
      case "chest": {
        const key = it.opened ? "chest_open" : "chest_closed";
        this.blit(key, px, py, ts, ts) || this.fallbackChest(px, py, ts, it.opened);
        if (!it.opened) this.softGlow(it.x, it.y, ts * 0.8, "rgba(255,210,90,0.16)");
        break;
      }
      case "lever": {
        // a crystal switch (setsFlag "crystal_*") renders as a faceted gem that
        // glows brighter once lit; ordinary levers stay anvils.
        if (it.setsFlag && String(it.setsFlag).startsWith("crystal_")) {
          this.drawCrystal(this.sx(it.x), this.sy(it.y), ts * 0.42, this.crystalColor(it.setsFlag), time, !!it.used);
        } else {
          this.blit("anvil", px, py, ts, ts) || this.fallbackProp(it, px, py, ts);
          if (!it.used) this.softGlow(it.x, it.y, ts * 0.8, "rgba(120,220,160,0.2)");
        }
        break;
      }
      case "seal": {
        const yy = py + bob;
        this.softGlow(it.x, it.y, ts, "rgba(255,170,60,0.25)");
        this.blit("ring", px, Math.round(yy), ts, ts) || this.fallbackRing(px, Math.round(yy), ts);
        break;
      }
      case "upgrade": {
        const yy = py + bob;
        if (it.ref === "crystalShard") {
          this.drawCrystalShard(this.sx(it.x), this.sy(it.y) + bob, ts * 0.4, time);
          break;
        }
        this.softGlow(it.x, it.y, ts * 1.1, "rgba(120,200,255,0.25)");
        const key = this.upgradeKey(it.ref);
        this.blit(key, px, Math.round(yy), ts, ts) || this.fallbackRing(px, Math.round(yy), ts);
        break;
      }
      case "key": {
        const yy = py + bob;
        this.fallbackKey(px, Math.round(yy), ts);
        break;
      }
      case "pickup": {
        const yy = py + bob;
        if (it.pickup === "heart") this.fallbackHeart(this.sx(it.x), this.sy(it.y) + bob, ts * 0.42, true);
        else if (it.pickup === "ember") this.fallbackEmber(this.sx(it.x), this.sy(it.y) + bob, ts * 0.3);
        else if (it.pickup === "token") {
          this.softGlow(it.x, it.y, ts, "rgba(255,200,80,0.3)");
          this.blit("tt_relic", px, Math.round(yy), ts, ts) || this.fallbackRing(px, Math.round(yy), ts);
        } else if (it.pickup === "potion") {
          this.blit("potion_green", px, Math.round(yy), ts, ts) || this.fallbackPotion(px, Math.round(yy), ts);
        }
        break;
      }
    }
  }

  private propKey(it: Interactable): string {
    if (it.kind === "lore") return it.prop === "sign" ? "tt_sign" : "scroll";
    switch (it.prop) {
      case "barrel":
        return "barrel";
      case "crate":
        return "crate";
      case "statue":
        return "statue";
      case "anvil":
        return "anvil";
      case "fence":
        return "fence";
      case "gargoyle":
        return "gargoyle";
      case "bars":
        return "bars";
      case "torch":
        return "torch";
      // outdoor (Tiny Town) props
      case "tree":
        return "tt_tree";
      case "bush":
        return "tt_tree_green";
      case "mushroom":
        return "tt_mushroom";
      case "sign":
        return "tt_sign";
      case "well":
        return "tt_well";
      case "stall":
        return "tt_stall";
      case "arch":
        return "tt_arch";
      // war-coast (Tiny Battle) props
      case "ship":
        return "tb_ship";
      case "flag":
        return "tb_flag";
      case "tower":
        return "tb_keep";
      case "dune":
        return "tb_dune";
      case "warcross":
        return "tb_cross";
      // glass-country props (pylon/shrine = Tiny Ski; crystal/sunstone = procedural)
      case "pylon":
        return "sk_pylon";
      case "shrine":
        return "sk_lodge";
      default:
        return "barrel";
    }
  }
  private upgradeKey(ref?: string): string {
    if (ref === "heartVessel" || ref === "brineHeart" || ref === "glassHeart") return "potion_red";
    if (ref === "wardensEdge") return "sword";
    if (ref === "swiftBoots") return "potion_blue";
    if (ref === "emberHeart") return "tt_relic";
    if (ref === "tideRelic") return "ring"; // the drowned king's signet
    return "ring";
  }

  /** A bright multi-point crystal shard (procedural — the Crystal Shard upgrade). */
  private drawCrystalShard(cx: number, cy: number, r: number, time: number) {
    const ctx = this.ctx;
    this.softGlowPx(cx, cy, r * 2.2, "#a8ecff", 0.5);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(time * 1.5) * 0.15);
    ctx.fillStyle = "#dffaff";
    ctx.strokeStyle = "#6fc8f0";
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.5, -r * 0.1);
    ctx.lineTo(r * 0.3, r);
    ctx.lineTo(-r * 0.3, r);
    ctx.lineTo(-r * 0.5, -r * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(120,200,240,0.7)";
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.moveTo(-r * 0.5, -r * 0.1);
    ctx.lineTo(r * 0.5, -r * 0.1);
    ctx.stroke();
    ctx.restore();
  }

  /** A faceted glowing crystal (decor prop, or a crystal switch when `lit`/colored). */
  private drawCrystal(cx: number, cy: number, r: number, color: string, time: number, lit: boolean) {
    const ctx = this.ctx;
    const pulse = lit ? 0.7 + 0.3 * Math.sin(time * 5) : 0.35 + 0.15 * Math.sin(time * 2);
    this.softGlowPx(cx, cy, r * (lit ? 2.4 : 1.6), color, lit ? 0.5 : 0.28);
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.6, cy - r * 0.2);
    ctx.lineTo(cx + r * 0.35, cy + r * 0.9);
    ctx.lineTo(cx - r * 0.35, cy + r * 0.9);
    ctx.lineTo(cx - r * 0.6, cy - r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.35 * pulse})`;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.6, cy - r * 0.2);
    ctx.lineTo(cx, cy + r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** The buried sun: a large slow radial glow with a bright core. */
  private drawSunstone(cx: number, cy: number, r: number, time: number) {
    const ctx = this.ctx;
    const pulse = 0.8 + 0.2 * Math.sin(time * 1.5);
    this.softGlowPx(cx, cy, r * 3.2 * pulse, "#ffe08a", 0.5);
    this.softGlowPx(cx, cy, r * 1.6, "#fff4d0", 0.6);
    ctx.save();
    ctx.fillStyle = "#fff4cf";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private softGlow(wx: number, wy: number, r: number, color: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(this.sx(wx), this.sy(wy), 0, this.sx(wx), this.sy(wy), r);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.sx(wx), this.sy(wy), r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawPrompt(it: Interactable) {
    const ctx = this.ctx;
    const x = this.sx(it.x);
    const y = this.sy(it.y) - TILE * this.scale * 0.9;
    ctx.save();
    ctx.fillStyle = "rgba(20,16,28,0.85)";
    ctx.strokeStyle = "rgba(243,233,210,0.6)";
    ctx.lineWidth = 2;
    const r = 9;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f3e9d2";
    ctx.font = "bold 11px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("E", x, y + 0.5);
    ctx.restore();
  }

  // ----- entities -----
  private entityShadow(wx: number, wy: number, r: number) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(this.sx(wx), this.sy(wy) + r * 0.5, r * 0.9, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawPlayer(p: Player, time: number) {
    const ctx = this.ctx;
    const size = TILE * this.scale;
    const r = size * 0.5;
    this.entityShadow(p.x, p.y, r * 0.8);
    let squashY = 1;
    let squashX = 1;
    if (p.dashing) {
      squashX = 1.18;
      squashY = 0.86;
    } else {
      const b = Math.sin(p.bob) * 0.06;
      squashY = 1 + b;
      squashX = 1 - b;
    }
    const drawW = size * squashX;
    const drawH = size * squashY;
    const cx = this.sx(p.x);
    const cy = this.sy(p.y);
    ctx.save();
    if (p.invulnerable && Math.floor(time * 20) % 2 === 0) ctx.globalAlpha = 0.5;
    this.blitCentered("player", cx, cy - (drawH - size) / 2, drawW, drawH, p.facingX < 0) ||
      this.fallbackPlayer(cx, cy, r);
    ctx.restore();
    if (p.hurtFlashT > 0) this.flashBlob(cx, cy, r, "rgba(255,80,80,0.5)");
  }

  private drawEnemy(e: Enemy) {
    const ctx = this.ctx;
    const size = TILE * this.scale * (e.def.scale ?? 1);
    const r = size * 0.5;
    this.entityShadow(e.x, e.y, r * 0.8);
    const cx = this.sx(e.x);
    const cy = this.sy(e.y);
    // elites get a colored aura + a small crown marker
    if (e.def.elite) this.flashBlob(cx, cy, r * 1.25, "rgba(255,170,60,0.18)");
    // heavy-attack telegraph (charger windup / turret pre-fire): red warning pulse
    if (e.telegraphing) {
      const p = 0.5 + 0.5 * Math.sin(this.timeAcc * 28);
      this.flashBlob(cx, cy, r * (1.1 + p * 0.3), `rgba(255,70,40,${0.25 + p * 0.25})`);
    }
    ctx.save();
    this.blitCentered(e.def.sprite, cx, cy, size, size, false) || this.fallbackEnemy(e, cx, cy, r);
    ctx.restore();
    if (e.def.elite) {
      ctx.fillStyle = "#ffd45a";
      const cw = r * 0.5;
      ctx.fillRect(cx - cw / 2, cy - r - cw * 0.7, cw, cw * 0.4);
    }
    if (e.hitFlashT > 0) this.flashBlob(cx, cy, r, "rgba(255,255,255,0.6)");
  }

  private drawBoss(b: Boss) {
    const ctx = this.ctx;
    const size = TILE * this.scale * b.def.scale;
    const r = size * 0.5;
    this.entityShadow(b.x, b.y, r * 0.9);
    const cx = this.sx(b.x);
    let cy = this.sy(b.y);
    // intro rise + telegraph shiver
    if (b.phase === "telegraph") cy += Math.sin(b.bob * 30) * 1.5;
    ctx.save();
    if (b.enraged) this.flashBlob(cx, cy, r * 1.1, "rgba(255,120,30,0.18)");
    // heavy-attack telegraph: pulse red during the windup so the player can read it
    if (b.phase === "telegraph") {
      const p = 0.5 + 0.5 * Math.sin(this.timeAcc * 26);
      this.flashBlob(cx, cy, r * (1.0 + p * 0.35), `rgba(255,60,40,${0.2 + p * 0.3})`);
    }
    this.blitCentered(b.def.sprite, cx, cy, size, size, b.facingX < 0) || this.fallbackBoss(b, cx, cy, r);
    ctx.restore();
    if (b.hitFlashT > 0) this.flashBlob(cx, cy, r, "rgba(255,255,255,0.55)");
  }

  private drawProjectile(p: Projectile) {
    const ctx = this.ctx;
    const x = this.sx(p.x);
    const y = this.sy(p.y);
    const r = p.radius * this.scale;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const col = p.fromBoss ? "#ff9a3c" : "#b48cff";
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
    g.addColorStop(0, col);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHazard(h: Hazard) {
    const ctx = this.ctx;
    const x = this.sx(h.x);
    const y = this.sy(h.y);
    const r = h.radius * this.scale;
    if (h.t < h.telegraph) {
      // warning: pulsing dashed ring at the exact danger size, filling up
      const p = h.telegraphProgress;
      ctx.save();
      ctx.fillStyle = `rgba(255,80,40,${0.06 + p * 0.18})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,120,50,${0.5 + 0.4 * Math.sin(this.timeAcc * 22)})`;
      ctx.lineWidth = 2 + p * 2;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.arc(x, y, r * (0.4 + 0.6 * p), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else {
      // impact flash
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r);
      g.addColorStop(0, "rgba(255,200,90,0.55)");
      g.addColorStop(0.7, "rgba(255,90,30,0.3)");
      g.addColorStop(1, "rgba(255,60,20,0.02)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  private timeAcc = 0;

  private drawSlash(s: Slash, p: Player) {
    const ctx = this.ctx;
    const prog = s.t / s.dur;
    const x = this.sx(p.x);
    const y = this.sy(p.y);
    const reach = s.reach * this.scale;
    const arc = Balance.player.attackArc;
    const sweep = s.angle - arc / 2 + arc * prog;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(255,244,214,${(1 - prog) * 0.9})`;
    ctx.lineWidth = 3 + (1 - prog) * 3;
    ctx.beginPath();
    ctx.arc(x, y, reach, sweep - 0.5, sweep + 0.5);
    ctx.stroke();
    ctx.restore();
  }

  private drawParticle(p: Particle) {
    const ctx = this.ctx;
    const a = Math.max(0, p.life / p.maxLife);
    const x = this.sx(p.x);
    const y = this.sy(p.y);
    const sz = p.size * this.scale * (0.4 + a * 0.6);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    ctx.globalAlpha = 1;
  }

  private flashBlob(x: number, y: number, r: number, color: string) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ----- blit helpers -----
  /** draw a sprite at top-left (px,py). returns false if asset missing. */
  private blit(key: string, px: number, py: number, w: number, h: number): boolean {
    const img = this.assets.img(key);
    if (!img) return false;
    this.ctx.drawImage(img, px, py, w, h);
    return true;
  }

  private blitCentered(key: string, cx: number, cy: number, w: number, h: number, flipX: boolean): boolean {
    const img = this.assets.img(key);
    if (!img) return false;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(Math.round(cx), Math.round(cy));
    if (flipX) ctx.scale(-1, 1);
    ctx.drawImage(img, Math.round(-w / 2), Math.round(-h / 2), Math.ceil(w), Math.ceil(h));
    ctx.restore();
    return true;
  }

  // ----- procedural fallbacks -----
  private fallbackFloor(px: number, py: number, sz: number, style: string) {
    const ctx = this.ctx;
    const col =
      style === "dirt"
        ? "#5b4a3a"
        : style === "tile"
        ? "#3a4452"
        : style === "grass"
        ? "#4a6b3a"
        : style === "saltgrass"
        ? "#3f5a44"
        : style === "glass"
        ? "#d4e6f6"
        : style === "path"
        ? "#6a6458"
        : "#3b3b46";
    ctx.fillStyle = col;
    ctx.fillRect(px, py, sz, sz);
    ctx.fillStyle = style === "glass" ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)";
    ctx.fillRect(px, py, sz, 1);
  }

  /** Bright crystalline wall block for the Glass Country (procedural — no tile). */
  private fallbackGlassWall(px: number, py: number, sz: number, variant: number) {
    const ctx = this.ctx;
    ctx.fillStyle = variant === 1 ? "#9fc4e8" : "#b7d8f0";
    ctx.fillRect(px, py, sz, sz);
    // facet highlight + shadow for a cut-glass read
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + sz, py);
    ctx.lineTo(px, py + sz);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(70,110,160,0.4)";
    ctx.fillRect(px, py + sz - 2, sz, 2);
    ctx.fillRect(px + sz - 2, py, 2, sz);
  }
  private fallbackHedge(px: number, py: number, sz: number) {
    const ctx = this.ctx;
    ctx.fillStyle = "#4a6b3a";
    ctx.fillRect(px, py, sz, sz);
    ctx.fillStyle = "#2f5a2a";
    ctx.beginPath();
    ctx.arc(px + sz / 2, py + sz * 0.45, sz * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6a4a2a";
    ctx.fillRect(px + sz * 0.44, py + sz * 0.7, sz * 0.12, sz * 0.3);
  }
  private fallbackWall(px: number, py: number, sz: number) {
    const ctx = this.ctx;
    ctx.fillStyle = "#6a4a36";
    ctx.fillRect(px, py, sz, sz);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(px, py + sz - 2, sz, 2);
  }
  private fallbackTorch(px: number, py: number, sz: number) {
    const ctx = this.ctx;
    ctx.fillStyle = "#6a4a36";
    ctx.fillRect(px + sz * 0.42, py + sz * 0.4, sz * 0.16, sz * 0.5);
    ctx.fillStyle = "#ff8a2c";
    ctx.beginPath();
    ctx.arc(px + sz * 0.5, py + sz * 0.32, sz * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }
  private fallbackProp(it: Interactable, px: number, py: number, sz: number) {
    const ctx = this.ctx;
    ctx.fillStyle = it.kind === "lore" ? "#d8c38a" : "#7a5a3a";
    ctx.fillRect(px + sz * 0.18, py + sz * 0.18, sz * 0.64, sz * 0.64);
  }
  private fallbackChest(px: number, py: number, sz: number, opened?: boolean) {
    const ctx = this.ctx;
    ctx.fillStyle = "#7a4a22";
    ctx.fillRect(px + sz * 0.16, py + sz * 0.3, sz * 0.68, sz * 0.5);
    ctx.fillStyle = opened ? "#2a1a0e" : "#caa14a";
    ctx.fillRect(px + sz * 0.16, py + sz * 0.3, sz * 0.68, sz * 0.14);
  }
  private fallbackRing(px: number, py: number, sz: number) {
    const ctx = this.ctx;
    ctx.strokeStyle = "#d8d2c0";
    ctx.lineWidth = sz * 0.12;
    ctx.beginPath();
    ctx.arc(px + sz / 2, py + sz / 2, sz * 0.28, 0, Math.PI * 2);
    ctx.stroke();
  }
  private fallbackPotion(px: number, py: number, sz: number) {
    const ctx = this.ctx;
    ctx.fillStyle = "#5fd08a";
    ctx.fillRect(px + sz * 0.34, py + sz * 0.28, sz * 0.32, sz * 0.46);
  }
  private fallbackPlayer(cx: number, cy: number, r: number) {
    const ctx = this.ctx;
    ctx.fillStyle = "#3f9b54";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f0d8b0";
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.2, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }
  private fallbackEnemy(e: Enemy, cx: number, cy: number, r: number) {
    const ctx = this.ctx;
    ctx.fillStyle = e.def.fallbackColor;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a1118";
    ctx.fillRect(cx - r * 0.28, cy - r * 0.15, r * 0.18, r * 0.18);
    ctx.fillRect(cx + r * 0.1, cy - r * 0.15, r * 0.18, r * 0.18);
  }
  private fallbackBoss(b: Boss, cx: number, cy: number, r: number) {
    const ctx = this.ctx;
    ctx.fillStyle = b.def.fallbackColor;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd27a";
    ctx.fillRect(cx - r * 0.3, cy - r * 0.2, r * 0.2, r * 0.2);
    ctx.fillRect(cx + r * 0.1, cy - r * 0.2, r * 0.2, r * 0.2);
  }

  // --- always-procedural HUD-style icons (no Kenney tile exists) ---
  fallbackHeart(cx: number, cy: number, s: number, glow = false) {
    const ctx = this.ctx;
    if (glow) this.flashBlob(cx, cy, s * 1.6, "rgba(255,80,90,0.2)");
    ctx.fillStyle = "#e23b4e";
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.7);
    ctx.bezierCurveTo(cx - s * 1.3, cy - s * 0.4, cx - s * 0.4, cy - s * 1.1, cx, cy - s * 0.35);
    ctx.bezierCurveTo(cx + s * 0.4, cy - s * 1.1, cx + s * 1.3, cy - s * 0.4, cx, cy + s * 0.7);
    ctx.fill();
  }
  fallbackHeartEmpty(cx: number, cy: number, s: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = "rgba(226,59,78,0.55)";
    ctx.lineWidth = 1.5;
    ctx.fillStyle = "rgba(40,20,28,0.5)";
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.7);
    ctx.bezierCurveTo(cx - s * 1.3, cy - s * 0.4, cx - s * 0.4, cy - s * 1.1, cx, cy - s * 0.35);
    ctx.bezierCurveTo(cx + s * 0.4, cy - s * 1.1, cx + s * 1.3, cy - s * 0.4, cx, cy + s * 0.7);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  fallbackHeartHalf(cx: number, cy: number, s: number) {
    const ctx = this.ctx;
    this.fallbackHeartEmpty(cx, cy, s);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - s * 1.4, cy - s * 1.4, s * 1.4, s * 2.8);
    ctx.clip();
    this.fallbackHeart(cx, cy, s);
    ctx.restore();
  }
  fallbackEmber(cx: number, cy: number, s: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "rgba(255,170,60,0.4)";
    ctx.beginPath();
    ctx.arc(cx, cy, s * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#ffcf5a";
    ctx.beginPath();
    ctx.arc(cx, cy, s, 0, Math.PI * 2);
    ctx.fill();
  }
  fallbackKey(px: number, py: number, sz: number) {
    const ctx = this.ctx;
    const cx = px + sz / 2;
    const cy = py + sz / 2;
    ctx.save();
    this.flashBlob(cx, cy, sz * 0.5, "rgba(255,210,90,0.18)");
    ctx.fillStyle = "#e7c558";
    ctx.strokeStyle = "#9c7a26";
    ctx.lineWidth = Math.max(1, sz * 0.05);
    // bow (ring)
    ctx.beginPath();
    ctx.arc(cx - sz * 0.18, cy - sz * 0.12, sz * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // shaft
    ctx.fillRect(cx - sz * 0.05, cy - sz * 0.12, sz * 0.34, sz * 0.08);
    // teeth
    ctx.fillRect(cx + sz * 0.22, cy - sz * 0.02, sz * 0.05, sz * 0.12);
    ctx.fillRect(cx + sz * 0.12, cy - sz * 0.02, sz * 0.05, sz * 0.1);
    ctx.restore();
  }
  drawKeyIcon(cx: number, cy: number, s: number) {
    this.fallbackKey(cx - s, cy - s, s * 2);
  }
  drawSealIcon(cx: number, cy: number, s: number) {
    const img = this.assets.img("ring");
    if (img) {
      this.ctx.drawImage(img, cx - s, cy - s, s * 2, s * 2);
    } else {
      this.fallbackRing(cx - s, cy - s, s * 2);
    }
  }
}
