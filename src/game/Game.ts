/**
 * Game.ts — the orchestrator. Owns the state machine + main loop and wires
 * every system together: input, world/room transitions, entity spawning,
 * combat resolution (via Combat.ts), interactions, the Soulslike death/recover
 * loop, persistence, and rendering. Implements CombatHooks/CombatCallbacks so
 * enemies & the boss can emit effects without importing Game.
 */
import { AssetManager } from "./AssetManager";
import { AudioManager } from "./AudioManager";
import { Input } from "./Input";
import { Renderer, Particle, Slash, type SceneView } from "./Renderer";
import { UI, type HudInfo, type ModalContent, formatTime } from "./UI";
import { Save } from "./Save";
import { World } from "./World";
import { Room } from "./Dungeon";
import { RunState } from "./Progression";
import {
  Player,
  Enemy,
  Boss,
  Projectile,
  Hazard,
  makeInteractable,
  type Interactable,
  type CombatHooks,
} from "./Entities";
import {
  resolvePlayerAttack,
  resolveContact,
  updateProjectiles,
  updateHazards,
  separateEnemies,
  type CombatCallbacks,
} from "./Combat";
import { restAtCheckpoint } from "./Checkpoints";
import { discoverLore } from "./Lore";
import { Balance, TILE } from "./Balance";
import act1 from "../content/acts/act1";
import type { ChestContents } from "./types";

type State =
  | "loading"
  | "title"
  | "controls"
  | "playing"
  | "transition"
  | "pause"
  | "checkpoint"
  | "reading"
  | "dead"
  | "victory"
  | "credits";

type InteractionTarget =
  | { type: "interactable"; it: Interactable }
  | { type: "door"; doorId: string }
  | null;

export class Game implements CombatHooks, CombatCallbacks {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  assets = new AssetManager();
  audio = new AudioManager();
  input: Input;
  renderer: Renderer;
  ui: UI;
  save = new Save();
  world = new World(act1);

  state: State = "loading";
  loadProgress = 0;

  run!: RunState;
  player!: Player;
  enemies: Enemy[] = [];
  boss: Boss | null = null;
  projectiles: Projectile[] = [];
  hazards: Hazard[] = [];
  interactables: Interactable[] = [];
  particles: Particle[] = [];
  slashes: Slash[] = [];

  time = 0;
  fade = 0;
  hard = false;

  private near: InteractionTarget = null;
  private modal: ModalContent | null = null;
  private modalThen: (() => void) | null = null;
  private helpReturn: State = "title";
  private lastT = 0;
  private raf = 0;

  // transition
  private transTo: { room: string; door: string } | null = null;
  private transPhase: "out" | "in" = "out";

  // boss death sequence
  private bossDeathT = 0;
  private pendingBoss: Boss | null = null;

  constructor(canvas: HTMLCanvasElement, container: HTMLElement) {
    this.canvas = canvas;
    this.container = container;
    this.renderer = new Renderer(canvas, this.assets);
    this.ui = new UI(this.renderer);
    this.input = new Input(canvas, container);
    this.input.onUnlock = () => void this.audio.unlock();

    window.addEventListener("resize", () => {
      this.renderer.resize();
      this.ui.computeScale();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === "playing") this.state = "pause";
    });
    this.ui.computeScale();
  }

  async start() {
    this.ui.muted = this.save.data.muted;
    this.audio.setMuted(this.save.data.muted);
    this.hard = this.save.data.difficultyMode === "hard";

    // render loading frames while assets stream in
    this.loop(performance.now());
    await this.assets.load((l, t) => (this.loadProgress = l / t));
    this.audio.setSources(this.assets.audioSources());
    this.state = "title";
  }

  // =====================================================================
  // Run lifecycle
  // =====================================================================
  private difficultyScales() {
    const d = this.hard ? Balance.difficulty.hard : Balance.difficulty.normal;
    return d;
  }

  newRun() {
    this.save.clearRun();
    this.run = new RunState(this.hard ? "hard" : "normal");
    this.run.stats.startTime = performance.now();
    const startRoom = this.world.startRoomId;
    this.run.checkpointId = "cp_gate";
    this.run.checkpointRoomId = startRoom;
    this.enterRoom(startRoom, this.world.startDoorId, true);
    this.state = "playing";
    this.persist();
  }

  continueRun() {
    const snap = this.save.loadRun();
    if (!snap) {
      this.newRun();
      return;
    }
    this.run = RunState.restore(snap);
    this.run.stats.startTime = performance.now();
    // Continuing always resumes rested at the last Emberlight.
    this.run.fullHeal();
    const roomId = this.run.checkpointRoomId || this.world.startRoomId;
    this.enterRoom(roomId, null, true);
    // place at checkpoint
    this.placeAtCheckpoint(roomId);
    this.state = "playing";
  }

  private placeAtCheckpoint(roomId: string) {
    const cp = this.interactables.find((it) => it.kind === "checkpoint" && it.uid === this.run.checkpointId);
    if (cp) {
      this.player.x = cp.x;
      this.player.y = cp.y + TILE * 0.6;
    }
  }

  private persist() {
    this.run.checkpointId && (this.save.data.checkpointId = this.run.checkpointId);
    this.save.saveRun(this.run.snapshot());
    this.save.flush();
  }

  // =====================================================================
  // Room entry / spawning
  // =====================================================================
  enterRoom(roomId: string, entryDoorId: string | null | undefined, hardPlace: boolean) {
    const room = this.world.enter(roomId, this.run);
    this.enemies = [];
    this.projectiles = [];
    this.hazards = [];
    this.interactables = [];
    this.boss = null;
    this.pendingBoss = null;
    this.bossDeathT = 0;

    const scales = this.difficultyScales();
    const def = room.def;
    for (const s of def.spawns) {
      if (s.blockedByFlag && this.run.getFlag(s.blockedByFlag)) continue;
      if (s.requiresFlag && !this.run.getFlag(s.requiresFlag)) continue;
      if (s.uid && this.run.isTaken(s.uid)) {
        // a taken chest still renders as an opened chest
        if (s.kind === "chest") {
          const it = makeInteractable(s);
          it.opened = true;
          this.interactables.push(it);
          this.markSolidProp(room, it);
        }
        continue;
      }
      const c = Room.tileCenter(s.tx, s.ty);
      if (s.kind === "enemy") {
        const edef = this.world.act.enemies[s.ref!];
        if (edef) this.enemies.push(new Enemy(edef, c.x, c.y, scales.enemyHp, scales.enemyDamage, scales.enemySpeed));
      } else if (s.kind === "miniboss" || s.kind === "boss") {
        const bdef = this.world.act.bosses[s.ref!];
        if (bdef) this.boss = new Boss(bdef, c.x, c.y, scales.bossHp);
      } else {
        const it = makeInteractable(s);
        this.interactables.push(it);
        this.markSolidProp(room, it);
      }
    }

    // inject the death "echo" (recoverable embers) if we died in this room
    if (this.run.lostRoomId === roomId && this.run.lostEmbers > 0) {
      this.interactables.push({
        kind: "pickup",
        x: this.run.lostX,
        y: this.run.lostY,
        tx: Math.floor(this.run.lostX / TILE),
        ty: Math.floor(this.run.lostY / TILE),
        pickup: "ember",
        amount: this.run.lostEmbers,
        uid: "echo_recover",
        solid: false,
        radius: TILE * 0.6,
        bob: 0,
        glow: 0,
      });
    }

    // place player
    if (hardPlace || !entryDoorId) {
      const startDoor = entryDoorId ?? def.doors[0]?.id;
      const pos = startDoor ? this.world.entryPosition(room, startDoor) : { x: room.pxW / 2, y: room.pxH / 2 };
      if (!this.player) this.player = new Player(pos.x, pos.y, this.run);
      else {
        this.player.x = pos.x;
        this.player.y = pos.y;
      }
    } else {
      const pos = this.world.entryPosition(room, entryDoorId);
      this.player.x = pos.x;
      this.player.y = pos.y;
    }
    this.player.run = this.run;

    this.renderer.resetCamera();
    this.updateMusic();
  }

  private markSolidProp(room: Room, it: Interactable) {
    if (it.solid) {
      const cell = room.cellAt(it.tx, it.ty);
      if (cell && cell.kind === "floor" && !cell.doorId) cell.solid = true;
    }
  }

  private refreshDoors() {
    for (const d of this.world.current.doors) d.open = this.world.isDoorOpen(d.def, this.run);
  }

  private updateMusic() {
    const bossActive = !!this.boss && this.boss.alive;
    const bossRoom = this.world.current.def.music === "boss";
    this.audio.startMusic(bossActive && bossRoom ? "boss" : "explore");
  }

  // =====================================================================
  // CombatHooks
  // =====================================================================
  spawnProjectile(x: number, y: number, vx: number, vy: number, fromBoss: boolean, damage: number): void {
    this.projectiles.push(new Projectile(x, y, vx, vy, fromBoss, damage));
  }
  spawnAdd(defId: string, x: number, y: number): void {
    const edef = this.world.act.enemies[defId];
    if (edef && this.enemies.length < 30) {
      const e = new Enemy(edef, x, y);
      e.isAdd = true;
      this.enemies.push(e);
    }
  }
  aoe(x: number, y: number, telegraph: number, radius: number, growFrom: number, damage: number): void {
    this.hazards.push(new Hazard(x, y, telegraph, radius, growFrom, damage));
  }
  shake(amount: number): void {
    this.renderer.shake(amount);
  }
  sfx(name: Parameters<CombatHooks["sfx"]>[0]): void {
    this.audio.play(name);
  }
  burst(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      this.particles.push(new Particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.3 + Math.random() * 0.4, 1.4 + Math.random() * 1.6, color));
    }
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }
  playerPos() {
    return { x: this.player.x, y: this.player.y };
  }

  // =====================================================================
  // CombatCallbacks
  // =====================================================================
  onEnemyKilled(e: Enemy): void {
    this.run.stats.enemiesDefeated++;
    this.run.addEmbers(e.def.embers);
    this.spawnEmberDrops(e.x, e.y, e.def.embers);
    if (Math.random() < (e.def.heartChance ?? 0)) {
      this.interactables.push(this.makeFloatingPickup(e.x, e.y, "heart"));
    }
    this.sfx("coin");
  }
  onBossDamaged(b: Boss): void {
    if (b.justEnraged) {
      this.toast(b.def.phaseLine, "#ff9a3c");
    }
  }
  onBossKilled(b: Boss): void {
    this.shake(10);
    this.burst(b.x, b.y, b.def.fallbackColor, 30);
    this.pendingBoss = b;
    this.bossDeathT = 1.3;
    this.boss = b; // keep for death anim; cleared after
  }
  onPlayerDead(): void {
    if (this.state !== "playing") return;
    this.die();
  }

  // =====================================================================
  // Helpers
  // =====================================================================
  private toast(text: string, color?: string) {
    this.ui.toast(text, color);
  }
  private spawnEmberDrops(x: number, y: number, n: number) {
    const c = Math.min(8, n);
    for (let i = 0; i < c; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 60;
      this.particles.push(new Particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.5 + Math.random() * 0.3, 2, "#ffcf5a"));
    }
  }
  private makeFloatingPickup(x: number, y: number, kind: "heart" | "ember", amount = 1): Interactable {
    return {
      kind: "pickup",
      x,
      y,
      tx: Math.floor(x / TILE),
      ty: Math.floor(y / TILE),
      pickup: kind,
      amount,
      solid: false,
      radius: TILE * 0.6,
      bob: Math.random() * Math.PI * 2,
      glow: 0,
    };
  }

  // =====================================================================
  // Main loop
  // =====================================================================
  private loop = (t: number) => {
    this.raf = requestAnimationFrame(this.loop);
    let dt = (t - this.lastT) / 1000;
    this.lastT = t;
    if (!isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, Balance.loop.maxDeltaMs / 1000);
    this.time += dt;

    this.input.resolveMovement();
    this.update(dt);
    this.render();
    this.input.endFrame();
  };

  private update(dt: number) {
    this.ui.updateToasts(dt);
    // particles/slashes always animate
    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter((p) => p.alive);
    for (const s of this.slashes) s.update(dt);
    this.slashes = this.slashes.filter((s) => s.alive);

    switch (this.state) {
      case "loading":
        return;
      case "title":
        this.input.setTouchVisible(false);
        this.menuInput();
        return;
      case "controls":
      case "credits":
        this.input.setTouchVisible(false);
        this.menuInput();
        return;
      case "pause":
      case "checkpoint":
      case "reading":
      case "dead":
      case "victory":
        this.input.setTouchVisible(false);
        this.menuInput();
        return;
      case "transition":
        this.updateTransition(dt);
        return;
      case "playing":
        this.input.setTouchVisible(true);
        this.updatePlaying(dt);
        return;
    }
  }

  // ----- menu / screen input -----
  private menuInput() {
    let id: string | null = null;
    for (const tap of this.input.taps) {
      const hit = this.ui.hitTest(tap.x, tap.y);
      if (hit) id = hit;
    }
    if (!id && this.input.confirm.pressed) id = this.ui.primaryId();
    // Esc handling
    if (this.input.pause.pressed) {
      if (this.state === "pause") {
        this.state = "playing";
        return;
      }
      if (this.state === "controls" || this.state === "credits") {
        this.state = this.helpReturn;
        return;
      }
    }
    if (!id) return;
    this.audio.play("select");
    this.handleMenuAction(id);
  }

  private handleMenuAction(id: string) {
    switch (this.state) {
      case "title":
        if (id === "start") {
          this.save.hasRun() ? this.continueRun() : this.newRun();
        } else if (id === "newrun") {
          this.save.hasRun() ? this.newRun() : this.openControls("title");
        } else if (id === "hard") {
          this.hard = !this.hard;
          this.save.data.difficultyMode = this.hard ? "hard" : "normal";
          this.save.flush();
        } else if (id === "help") {
          this.openControls("title");
        }
        break;
      case "controls":
        if (id === "back") this.state = this.helpReturn;
        break;
      case "credits":
        if (id === "back") this.state = this.helpReturn;
        break;
      case "pause":
        if (id === "resume") this.state = "playing";
        else if (id === "mute") this.toggleMute();
        else if (id === "help") this.openControls("pause");
        else if (id === "abandon") this.toTitle();
        break;
      case "checkpoint":
        if (id === "resume") this.state = "playing";
        else if (id === "abandon") this.toTitle();
        break;
      case "reading":
        if (id === "close") {
          this.state = "playing";
          const then = this.modalThen;
          this.modal = null;
          this.modalThen = null;
          if (then) then();
        }
        break;
      case "dead":
        if (id === "respawn") this.respawn();
        else if (id === "abandon") this.toTitle();
        break;
      case "victory":
        if (id === "replay") {
          this.hard = this.save.data.difficultyMode === "hard";
          this.newRun();
        } else if (id === "title") this.toTitle();
        else if (id === "credits") this.openCredits("victory");
        break;
    }
  }

  private openControls(ret: State) {
    this.helpReturn = ret;
    this.state = "controls";
  }
  private openCredits(ret: State) {
    this.helpReturn = ret;
    this.state = "credits";
  }
  private toggleMute() {
    const m = !this.audio.isMuted();
    this.audio.setMuted(m);
    this.ui.muted = m;
    this.save.setMuted(m);
  }
  private toTitle() {
    this.audio.stopMusic();
    this.state = "title";
  }
  private showModal(m: ModalContent, then?: () => void) {
    this.modal = m;
    this.modalThen = then ?? null;
    this.state = "reading";
  }

  // ----- gameplay -----
  private updatePlaying(dt: number) {
    this.run.stats.elapsedMs += dt * 1000;

    // HUD pause/mute taps
    for (const tap of this.input.taps) {
      const hit = this.ui.hitTest(tap.x, tap.y);
      if (hit === "pause") {
        this.audio.play("select");
        this.state = "pause";
        return;
      }
      if (hit === "mute") {
        this.toggleMute();
        return;
      }
    }
    if (this.input.pause.pressed) {
      this.state = "pause";
      return;
    }

    const room = this.world.current;

    // boss death sequence freeze
    if (this.bossDeathT > 0 && this.pendingBoss) {
      this.bossDeathT -= dt;
      if (this.time % 0.1 < dt) this.burst(this.pendingBoss.x, this.pendingBoss.y, "#ffcf5a", 4);
      if (this.bossDeathT <= 0) this.finishBossDeath(this.pendingBoss);
      this.renderer.updateCamera(dt, this.player, room);
      return;
    }

    // player
    this.player.update(dt, this.input, room, this);
    if (this.player.attackJustStarted) {
      this.slashes.push(new Slash(this.player.x, this.player.y, Math.atan2(this.player.aimY, this.player.aimX), this.run.attackReach, Balance.player.attackDuration + 0.06));
    }

    // entities
    for (const e of this.enemies) if (e.alive) e.update(dt, this.player, room, this);
    if (this.boss && this.boss.alive) this.boss.update(dt, this.player, room, this);
    separateEnemies(this.enemies);

    // combat
    resolvePlayerAttack(this.player, this.enemies, this.boss, this, this);
    resolveContact(this.player, this.enemies, this.boss, this, this);
    updateProjectiles(dt, this.projectiles, room, this.player, this, this);
    updateHazards(dt, this.hazards, this.player, this, this);
    this.enemies = this.enemies.filter((e) => e.alive);
    this.projectiles = this.projectiles.filter((p) => p.alive);
    this.hazards = this.hazards.filter((h) => h.alive);

    // hazard floor tiles (spikes) damage
    if (!this.player.invulnerable && room.hazardAtPx(this.player.x, this.player.y)) {
      const r = this.player.hurt(1, this.player.x, this.player.y - 1);
      if (r.hit) {
        this.sfx("hurt");
        this.shake(3);
        if (r.dead) this.die();
      }
    }

    // pickups (auto-collect) + interaction proximity
    this.handleAutoPickups();
    this.near = this.findInteraction();
    this.input.showInteract(this.near !== null);
    if (this.near && this.input.interact.pressed) this.doInteract(this.near);

    // funnel the player into nearby open doorways, then check transition
    this.funnelToDoors(dt);
    this.checkDoorTransition();

    // music track switch (boss waking)
    this.maybeBossMusic();

    this.renderer.updateCamera(dt, this.player, room);
    if (this.player.run.hp <= 0 && this.state === "playing") this.die();
  }

  private handleAutoPickups() {
    const p = this.player;
    for (const it of this.interactables) {
      if (it.opened || it.used) continue;
      const auto = it.kind === "pickup" || it.kind === "seal" || it.kind === "upgrade" || it.kind === "key";
      if (!auto) continue;
      if (Math.hypot(p.x - it.x, p.y - it.y) > p.radius + it.radius) continue;
      this.collect(it);
    }
    this.interactables = this.interactables.filter((it) => !it.used || it.kind === "lever" || it.kind === "lore" || it.kind === "chest");
  }

  private collect(it: Interactable) {
    it.used = true;
    this.burst(it.x, it.y, "#ffe9a8", 8);
    switch (it.kind) {
      case "pickup":
        if (it.pickup === "heart") {
          this.run.heal(Balance.economy.heartPickupHeal);
          this.sfx("pickup");
        } else if (it.pickup === "ember") {
          const amt = it.amount ?? 1;
          this.run.addEmbers(amt);
          this.sfx("coin");
          if (it.uid === "echo_recover") {
            this.toast(`Reclaimed ${amt} embers`, "#ffcf5a");
            this.run.lostEmbers = 0;
            this.run.lostRoomId = null;
          }
        } else if (it.pickup === "potion") {
          this.run.heal(Balance.economy.potionHeal);
          this.sfx("pickup");
          this.toast("Ember Draught — vigor restored", "#7fdca0");
        }
        break;
      case "key":
        this.run.addKey(1);
        this.run.takeUid(it.uid);
        this.sfx("coin");
        this.toast("Iron Key acquired", "#e7c558");
        this.persist();
        break;
      case "seal":
        this.run.addSeal(1);
        this.run.takeUid(it.uid);
        this.sfx("unlock");
        this.toast(`Warden Seal  (${this.run.seals}/2)`, "#ff9a3c");
        this.persist();
        break;
      case "upgrade":
        this.grantUpgrade(it.ref!);
        this.run.takeUid(it.uid);
        break;
    }
  }

  private grantUpgrade(ref: string) {
    const item = this.world.act.items[ref];
    const upId = item?.upgrade ?? ref;
    this.run.addUpgrade(upId);
    if (!this.save.data.permanentUpgrades.includes(upId)) this.save.data.permanentUpgrades.push(upId);
    this.sfx("pickup");
    this.persist();
    this.showModal({
      title: item?.name ?? "Upgrade",
      lines: [item?.description ?? "Your power grows."],
      prompt: "Tap to continue",
      accent: "#7fdca0",
    });
  }

  private findInteraction(): InteractionTarget {
    const p = this.player;
    const reach = TILE * 1.1;
    let best: Interactable | null = null;
    let bestD = reach;
    for (const it of this.interactables) {
      const interactable =
        (it.kind === "chest" && !it.opened) ||
        (it.kind === "lever" && !it.used) ||
        (it.kind === "lore" && !it.used) ||
        it.kind === "checkpoint" ||
        (it.kind === "prop" && it.uid === "world_gate");
      if (!interactable) continue;
      const d = Math.hypot(p.x - it.x, p.y - it.y);
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    // closed, player-openable doors
    let bestDoor: string | null = null;
    let bestDoorD = reach;
    for (const dr of this.world.current.doors) {
      if (dr.open) continue;
      if (!(dr.def.type === "locked" || dr.def.type === "bossGate" || dr.def.type === "shortcut")) continue;
      const c = Room.tileCenter(dr.def.tx, dr.def.ty);
      const d = Math.hypot(p.x - c.x, p.y - c.y);
      if (d < bestDoorD) {
        bestDoorD = d;
        bestDoor = dr.def.id;
      }
    }
    if (best && (!bestDoor || bestD <= bestDoorD)) return { type: "interactable", it: best };
    if (bestDoor) return { type: "door", doorId: bestDoor };
    return null;
  }

  private doInteract(target: InteractionTarget) {
    if (!target) return;
    if (target.type === "door") {
      this.tryOpenDoor(target.doorId);
      return;
    }
    const it = target.it;
    switch (it.kind) {
      case "chest":
        this.openChest(it);
        break;
      case "lever":
        this.pullLever(it);
        break;
      case "lore":
        this.readLore(it);
        break;
      case "checkpoint":
        this.useCheckpoint(it);
        break;
      case "prop":
        if (it.uid === "world_gate") this.victory();
        break;
    }
  }

  private openChest(it: Interactable) {
    it.opened = true;
    this.run.takeUid(it.uid);
    this.sfx("unlock");
    this.burst(it.x, it.y, "#ffd27a", 14);
    const c: ChestContents = it.contains ?? {};
    if (c.embers) {
      this.run.addEmbers(c.embers);
      this.spawnEmberDrops(it.x, it.y, c.embers);
    }
    if (c.hearts) this.run.heal(c.hearts * Balance.player.hpPerHeart);
    if (c.key) {
      this.run.addKey(c.key);
      this.toast("Iron Key acquired", "#e7c558");
    }
    if (c.seal) {
      this.run.addSeal(c.seal);
      this.toast(`Warden Seal  (${this.run.seals}/2)`, "#ff9a3c");
    }
    if (c.upgrade) this.grantUpgrade(c.upgrade);
    else if (c.embers) this.toast(`+${c.embers} embers`, "#ffcf5a");
    this.persist();
  }

  private pullLever(it: Interactable) {
    it.used = true;
    if (it.setsFlag) this.run.setFlag(it.setsFlag, true);
    this.refreshDoors();
    this.sfx("gate");
    this.shake(6);
    this.toast("A portcullis grinds open. Shortcut unlocked!", "#7fdca0");
    this.persist();
  }

  private readLore(it: Interactable) {
    it.used = true;
    const { entry } = discoverLore(this.run, this.save, this.world.act, it.ref!);
    this.sfx("lore");
    if (entry) {
      this.showModal({ title: entry.title, lines: [entry.text], prompt: "Tap to continue", accent: "#b48cff" });
    }
    this.persist();
  }

  private useCheckpoint(it: Interactable) {
    restAtCheckpoint(this.run, this.save, it.uid!, this.world.current.def.id, (r) => this.save.saveRun(r.snapshot()));
    // resting resets normal enemies in the current room
    this.respawnRoomEnemies();
    this.sfx("checkpoint");
    this.burst(it.x, it.y, "#ffb43c", 16);
    this.state = "checkpoint";
    this.checkpointName = it.ref ?? "Emberlight";
  }
  checkpointName = "Emberlight";

  private respawnRoomEnemies() {
    // rebuild enemies from spawns (so resting refreshes the area)
    const def = this.world.current.def;
    const scales = this.difficultyScales();
    this.enemies = [];
    for (const s of def.spawns) {
      if (s.kind !== "enemy") continue;
      const edef = this.world.act.enemies[s.ref!];
      if (edef) {
        const c = Room.tileCenter(s.tx, s.ty);
        this.enemies.push(new Enemy(edef, c.x, c.y, scales.enemyHp, scales.enemyDamage, scales.enemySpeed));
      }
    }
  }

  private tryOpenDoor(doorId: string) {
    const dr = this.world.current.doorRuntime(doorId);
    if (!dr) return;
    const d = dr.def;
    if (d.type === "locked" || d.type === "requiresItem") {
      if (this.run.useKey()) {
        this.run.setFlag(World.doorFlag(d.id), true);
        this.run.setFlag(World.doorFlag(d.toDoorId), true);
        this.refreshDoors();
        this.sfx("unlock");
        this.toast("The iron lock turns.", "#e7c558");
        this.persist();
      } else {
        this.sfx("gate");
        this.toast(d.lockedHint ?? "It's locked. You need an Iron Key.", "#e2566a");
      }
    } else if (d.type === "bossGate") {
      const need = d.sealsRequired ?? 2;
      if (this.run.seals >= need) {
        this.run.setFlag(World.doorFlag(d.id), true);
        this.run.setFlag(World.doorFlag(d.toDoorId), true);
        this.refreshDoors();
        this.sfx("gate");
        this.shake(8);
        this.toast("The sealed door drinks the seals and opens.", "#ff9a3c");
        this.persist();
      } else {
        this.sfx("gate");
        this.toast(`The sealed door needs ${need} Warden Seals  (${this.run.seals}/${need}).`, "#e2566a");
      }
    } else if (d.type === "shortcut") {
      this.toast(d.lockedHint ?? "It will only open from the far side.", "#e2566a");
      this.sfx("gate");
    }
  }

  /**
   * Doorways are one tile wide; the player's collider would otherwise clip the
   * flanking walls. When the player approaches the mouth of an open door, gently
   * slide them onto the door's centerline so they pass cleanly (classic
   * Zelda-style funneling).
   */
  private funnelToDoors(dt: number) {
    const room = this.world.current;
    const p = this.player;
    const pull = Math.min(0.35, (1 - Math.pow(0.0015, dt)) * 1.6);
    for (const dr of room.doors) {
      if (!dr.open) continue;
      const dc = Room.tileCenter(dr.def.tx, dr.def.ty);
      const edge = dr.def.edge;
      if (edge === "e" || edge === "w") {
        const nearWall = edge === "e" ? p.x > dc.x - TILE * 2.2 : p.x < dc.x + TILE * 2.2;
        if (nearWall && Math.abs(p.y - dc.y) < TILE * 1.4) p.y += (dc.y - p.y) * pull;
      } else {
        const nearWall = edge === "s" ? p.y > dc.y - TILE * 2.2 : p.y < dc.y + TILE * 2.2;
        if (nearWall && Math.abs(p.x - dc.x) < TILE * 1.4) p.x += (dc.x - p.x) * pull;
      }
    }
  }

  private checkDoorTransition() {
    const room = this.world.current;
    const tx = Math.floor(this.player.x / TILE);
    const ty = Math.floor(this.player.y / TILE);
    const cell = room.cellAt(tx, ty);
    if (!cell || !cell.doorId) return;
    const dr = room.doorRuntime(cell.doorId);
    if (!dr || !dr.open) return;
    // begin transition
    this.transTo = { room: dr.def.to, door: dr.def.toDoorId };
    this.transPhase = "out";
    this.fade = 0;
    this.state = "transition";
    this.sfx("door");
  }

  private updateTransition(dt: number) {
    const speed = 4.5;
    if (this.transPhase === "out") {
      this.fade += dt * speed;
      if (this.fade >= 1) {
        this.fade = 1;
        if (this.transTo) this.enterRoom(this.transTo.room, this.transTo.door, false);
        this.transTo = null;
        this.transPhase = "in";
      }
    } else {
      this.fade -= dt * speed;
      if (this.fade <= 0) {
        this.fade = 0;
        this.state = "playing";
      }
    }
  }

  private maybeBossMusic() {
    const room = this.world.current;
    if (room.def.music === "boss" && this.boss && this.boss.alive) {
      this.audio.startMusic("boss");
    }
  }

  // ----- death / victory -----
  private die() {
    this.run.stats.deaths++;
    this.save.recordDeath();
    // drop recoverable embers at death spot
    this.run.lostEmbers = this.run.embers;
    this.run.lostRoomId = this.world.current.def.id;
    this.run.lostX = this.player.x;
    this.run.lostY = this.player.y;
    this.run.embers = 0;
    this.player.invulnT = 0;
    this.audio.play("gameover");
    this.audio.stopMusic();
    this.shake(8);
    this.burst(this.player.x, this.player.y, "#e2566a", 20);
    this.persist();
    this.state = "dead";
  }

  private respawn() {
    const roomId = this.run.checkpointRoomId || this.world.startRoomId;
    this.run.fullHeal();
    this.enterRoom(roomId, null, true);
    this.placeAtCheckpoint(roomId);
    this.player.invulnT = 1.0;
    this.state = "playing";
  }

  private finishBossDeath(b: Boss) {
    this.boss = null;
    this.pendingBoss = null;
    this.bossDeathT = 0;
    this.run.addEmbers(b.def.embers);
    this.spawnEmberDrops(this.player.x, this.player.y, 8);
    if (b.def.setsFlag) this.run.setFlag(b.def.setsFlag, true);
    // grant reward
    const reward = b.def.reward;
    if (reward) {
      if (reward.seal) {
        this.run.addSeal(reward.seal);
      }
      if (reward.embers) this.run.addEmbers(reward.embers);
    }
    this.refreshDoors();
    this.persist();

    if (b.def.isMiniboss) {
      const lines = [b.def.defeatLine];
      if (reward?.upgrade) {
        const item = this.world.act.items[reward.upgrade];
        if (item) {
          this.grantUpgradeSilent(reward.upgrade);
          lines.push("");
          lines.push(`Gained: ${item.name} — ${item.description}`);
        }
      }
      lines.push("");
      lines.push(`A Warden Seal is yours.  (${this.run.seals}/2)`);
      this.audio.play("victory");
      this.showModal({ title: b.def.name + " falls", lines, prompt: "Tap to continue", accent: "#ff9a3c" }, () => this.updateMusic());
    } else {
      // final boss
      this.run.stats.bossDefeated = true;
      this.audio.play("victory");
      this.audio.stopMusic();
      this.showModal(
        { title: b.def.name + " kneels", lines: [b.def.defeatLine, "", "Beyond the throne, a sealed gate waits."], prompt: "Tap to continue", accent: "#ff9a3c" },
        () => {
          this.refreshDoors();
          this.toast("The way east opens.", "#7fdca0");
          this.updateMusic();
        }
      );
    }
  }

  private grantUpgradeSilent(ref: string) {
    const item = this.world.act.items[ref];
    const upId = item?.upgrade ?? ref;
    this.run.addUpgrade(upId);
    if (!this.save.data.permanentUpgrades.includes(upId)) this.save.data.permanentUpgrades.push(upId);
  }

  private victory() {
    if (this.state === "victory") return;
    const res = this.save.recordWin(this.run.stats.elapsedMs, this.run.stats.embersCollected);
    this.save.clearRun();
    this.lastWinBest = { time: res.newBestTime, embers: res.newBestEmbers };
    this.audio.play("victory");
    this.audio.stopMusic();
    this.state = "victory";
  }
  lastWinBest = { time: false, embers: false };

  // =====================================================================
  // Objective hint
  // =====================================================================
  private objective(): string {
    const r = this.run;
    if (r.getFlag("actBossDefeated")) {
      return this.world.current.def.id === "summit" ? "Approach the sealed world-gate." : "The curse is broken. Climb to the summit.";
    }
    if (this.world.current.def.id === "throne") return "Break the curse — defeat the Hollow Warden.";
    if (r.getFlag(World.doorFlag("bossgate_e"))) return "Enter the Hollow Throne.";
    if (r.seals >= 2) return "Two seals in hand. Open the sealed door east of the Shrine.";
    if (r.getFlag("minibossDefeated")) return `Find the last Warden Seal.  (${r.seals}/2)`;
    if (r.checkpointId === "cp_gate" && r.stats.roomsVisited.size <= 2) return "Descend. Find the Echo Well.";
    return `Find two Warden Seals to open the sealed door.  (${r.seals}/2)`;
  }

  // =====================================================================
  // Render
  // =====================================================================
  private render() {
    this.renderer.beginFrame();

    if (this.state === "loading") {
      this.ui.drawLoading(this.loadProgress);
      return;
    }
    if (this.state === "title") {
      this.drawWorldBackdrop();
      this.ui.drawTitle(this.save.data, this.hard);
      return;
    }

    // draw world for in-world states
    const inWorld = ["playing", "transition", "pause", "checkpoint", "reading", "dead", "victory"].includes(this.state);
    if (inWorld && this.world.current && this.player) {
      const view: SceneView = {
        room: this.world.current,
        player: this.player,
        enemies: this.enemies,
        boss: this.boss,
        projectiles: this.projectiles,
        hazards: this.hazards,
        interactables: this.interactables,
        particles: this.particles,
        slashes: this.slashes,
        run: this.run,
        nearInteractable: this.state === "playing" && this.near?.type === "interactable" ? this.near.it : null,
        time: this.time,
        fade: this.fade,
      };
      this.renderer.drawScene(view);
    }

    switch (this.state) {
      case "playing":
        this.ui.drawHUD(this.run, this.hudInfo());
        break;
      case "transition":
        // scene already faded
        break;
      case "pause":
        this.ui.drawPause();
        break;
      case "checkpoint":
        this.ui.drawCheckpoint(this.checkpointName);
        break;
      case "reading":
        if (this.modal) this.ui.drawModal(this.modal);
        break;
      case "dead":
        this.ui.drawDeath(this.run, this.checkpointDisplayName());
        break;
      case "victory":
        this.ui.drawVictory(this.run, this.save.data, this.lastWinBest);
        break;
      case "controls":
        this.drawWorldBackdrop();
        this.ui.drawControls();
        break;
      case "credits":
        this.drawWorldBackdrop();
        this.ui.drawCredits();
        break;
    }
  }

  private checkpointDisplayName(): string {
    const map: Record<string, string> = {
      cp_gate: "the Threshold",
      cp_well: "the Echo Well",
      cp_shrine: "the Shrine of Ash",
    };
    return map[this.run?.checkpointId ?? ""] ?? "the last Emberlight";
  }

  private hudInfo(): HudInfo {
    const region = this.world.act.regions[0];
    return {
      objective: this.objective(),
      boss:
        this.boss && this.boss.alive
          ? { name: this.boss.def.name, hp: this.boss.hp, maxHp: this.boss.maxHp, enraged: this.boss.enraged }
          : null,
      rooms: region.rooms.map((r) => ({ id: r.id, gx: r.gx, gy: r.gy })),
      currentRoomId: this.world.current.def.id,
      visited: this.run.stats.roomsVisited,
    };
  }

  private drawWorldBackdrop() {
    // subtle animated ember backdrop behind menus
    const ctx = this.renderer.ctx;
    const w = this.renderer.viewW;
    const h = this.renderer.viewH;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#16101e");
    g.addColorStop(1, "#0b0910");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 24; i++) {
      const t = this.time * 0.4 + i;
      const x = ((i * 97.13 + Math.sin(t * 0.7) * 40) % (w + 80)) - 40;
      const y = (h - ((this.time * 18 + i * 53) % (h + 60))) ;
      const a = 0.05 + 0.05 * Math.sin(t * 2);
      ctx.fillStyle = `rgba(255,160,60,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
