/**
 * Entities.ts — the player, enemies, boss, projectiles, transient hazards, and
 * room interactables. Entities never import Game; instead they receive a small
 * `CombatHooks` context so they can emit projectiles/effects without a circular
 * dependency. Game owns the arrays and orchestrates interactions (see Combat.ts).
 */
import { Balance, TILE } from "./Balance";
import { Room } from "./Dungeon";
import type { RunState } from "./Progression";
import type { Input } from "./Input";
import type {
  BossDef,
  EnemyDef,
  SpawnDef,
  SpawnKind,
  PickupKind,
  PropKind,
  ChestContents,
  GameFlag,
} from "./types";
import type { Sfx } from "./AudioManager";

export interface CombatHooks {
  spawnProjectile(x: number, y: number, vx: number, vy: number, fromBoss: boolean, damage: number): void;
  spawnAdd(defId: string, x: number, y: number): void;
  aoe(x: number, y: number, telegraph: number, radius: number, growFrom: number, damage: number): void;
  shake(amount: number): void;
  sfx(name: Sfx): void;
  burst(x: number, y: number, color: string, count: number): void;
  playerPos(): { x: number; y: number };
}

function len(x: number, y: number): number {
  return Math.hypot(x, y) || 1;
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
export class Player {
  x: number;
  y: number;
  radius = Balance.player.radius;
  run: RunState;

  aimX = 0;
  aimY = 1;
  facingX = 1;

  // timers
  attackT = 0; // remaining active attack window
  attackCdT = 0;
  dashT = 0;
  dashCdT = 0;
  invulnT = 0;
  hurtFlashT = 0;
  bob = 0;

  dashVX = 0;
  dashVY = 0;
  kbX = 0;
  kbY = 0;

  /** enemies already struck by the current swing (so each swing hits once). */
  swingHits = new Set<unknown>();
  attackJustStarted = false;

  constructor(x: number, y: number, run: RunState) {
    this.x = x;
    this.y = y;
    this.run = run;
  }

  get attacking(): boolean {
    return this.attackT > 0;
  }
  get dashing(): boolean {
    return this.dashT > 0;
  }
  get invulnerable(): boolean {
    return this.invulnT > 0;
  }

  update(dt: number, input: Input, room: Room, hooks: CombatHooks) {
    this.attackJustStarted = false;
    const B = Balance.player;

    // timers
    this.attackT = Math.max(0, this.attackT - dt);
    this.attackCdT = Math.max(0, this.attackCdT - dt);
    this.dashT = Math.max(0, this.dashT - dt);
    this.dashCdT = Math.max(0, this.dashCdT - dt);
    this.invulnT = Math.max(0, this.invulnT - dt);
    this.hurtFlashT = Math.max(0, this.hurtFlashT - dt);

    // movement intent
    let mx = input.moveX;
    let my = input.moveY;
    const moving = Math.hypot(mx, my) > 0.05;
    if (moving) {
      const m = len(mx, my);
      mx /= m;
      my /= m;
      // aim follows movement
      this.aimX = mx;
      this.aimY = my;
      if (Math.abs(mx) > 0.2) this.facingX = mx > 0 ? 1 : -1;
      this.bob += dt * 10;
    } else {
      this.bob *= 0.9;
    }

    // dash
    if (input.dash.pressed && this.dashCdT <= 0 && !this.dashing) {
      const dx = moving ? mx : this.aimX;
      const dy = moving ? my : this.aimY;
      this.dashVX = dx * B.dashSpeed;
      this.dashVY = dy * B.dashSpeed;
      this.dashT = B.dashDuration;
      this.dashCdT = this.run.dashCooldown;
      this.invulnT = Math.max(this.invulnT, B.dashIFrames);
      hooks.sfx("attack");
      hooks.burst(this.x, this.y, "#cdbdf0", 6);
    }

    // attack
    if (input.attack.pressed && this.attackCdT <= 0 && !this.dashing) {
      this.attackT = B.attackDuration;
      this.attackCdT = B.attackCooldown;
      this.swingHits.clear();
      this.attackJustStarted = true;
      if (moving) {
        this.aimX = mx;
        this.aimY = my;
      }
      hooks.sfx("attack");
    }

    // velocity
    let vx = 0;
    let vy = 0;
    if (this.dashing) {
      vx = this.dashVX;
      vy = this.dashVY;
    } else {
      vx = mx * B.speed * (moving ? 1 : 0);
      vy = my * B.speed * (moving ? 1 : 0);
    }
    // knockback (decays)
    vx += this.kbX;
    vy += this.kbY;
    this.kbX *= Math.pow(0.0001, dt);
    this.kbY *= Math.pow(0.0001, dt);
    if (Math.abs(this.kbX) < 3) this.kbX = 0;
    if (Math.abs(this.kbY) < 3) this.kbY = 0;

    const res = room.moveBox(this.x, this.y, this.radius, vx * dt, vy * dt);
    this.x = res.x;
    this.y = res.y;
  }

  applyKnockback(fromX: number, fromY: number, force: number) {
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const m = len(dx, dy);
    this.kbX = (dx / m) * force;
    this.kbY = (dy / m) * force;
  }

  hurt(damage: number, fromX: number, fromY: number): { hit: boolean; dead: boolean } {
    if (this.invulnerable) return { hit: false, dead: false };
    const dead = this.run.damage(damage);
    this.invulnT = Balance.player.hurtIFrames;
    this.hurtFlashT = Balance.combat.hitFlashTime;
    this.applyKnockback(fromX, fromY, Balance.player.knockbackTaken);
    return { hit: true, dead };
  }

  /** Hitbox query: is `tx,ty` within the current swing arc? */
  swingHitsPoint(px: number, py: number, targetR: number): boolean {
    if (!this.attacking) return false;
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.hypot(dx, dy);
    const reach = this.run.attackReach + targetR;
    if (dist > reach) return false;
    const aimAng = Math.atan2(this.aimY, this.aimX);
    const tAng = Math.atan2(dy, dx);
    let diff = Math.abs(aimAng - tAng);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    return diff <= Balance.player.attackArc / 2;
  }
}

// ---------------------------------------------------------------------------
// Enemy
// ---------------------------------------------------------------------------
export class Enemy {
  def: EnemyDef;
  x: number;
  y: number;
  hp: number;
  radius: number;
  alive = true;
  hitFlashT = 0;
  kbX = 0;
  kbY = 0;
  fireT = 0;
  // patroller state
  patrolX = 0;
  patrolY = 0;
  // tank lunge state
  lungeT = 0;
  lungeCdT = 1.5;
  lungeVX = 0;
  lungeVY = 0;
  wobble: number;
  isAdd = false;
  // charger state
  chargeState: "idle" | "windup" | "charge" | "recover" = "idle";
  chargeT = 0;
  chargeCdT = 1.4;
  chargeVX = 0;
  chargeVY = 0;
  /** set while telegraphing a heavy attack — the renderer flashes a warning. */
  telegraphing = false;

  constructor(def: EnemyDef, x: number, y: number, hpScale = 1, dmgScale = 1, speedScale = 1) {
    this.def = { ...def, hp: Math.round(def.hp * hpScale), damage: Math.max(1, Math.round(def.damage * dmgScale)), speed: def.speed * speedScale };
    this.x = x;
    this.y = y;
    this.hp = this.def.hp;
    this.radius = def.radius;
    this.fireT = (def.fireInterval ?? 2) * (0.4 + ((x * 13 + y * 7) % 100) / 200);
    this.wobble = ((x * 7 + y * 5) % 100) / 100 * Math.PI * 2;
    // random patrol direction
    const a = ((x * 31 + y * 17) % 360) * (Math.PI / 180);
    this.patrolX = Math.cos(a);
    this.patrolY = Math.sin(a);
  }

  get damage(): number {
    return this.def.damage;
  }

  update(dt: number, player: Player, room: Room, hooks: CombatHooks) {
    this.hitFlashT = Math.max(0, this.hitFlashT - dt);
    this.wobble += dt * 6;

    const pp = { x: player.x, y: player.y };
    const dx = pp.x - this.x;
    const dy = pp.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const aggro = this.def.aggroRange ?? 0;
    const active = aggro === 0 || dist <= aggro;

    let vx = 0;
    let vy = 0;
    const sp = this.def.speed;

    switch (this.def.behavior) {
      case "chaser":
        if (active) {
          vx = (dx / dist) * sp;
          vy = (dy / dist) * sp;
        }
        break;
      case "swarm":
        if (active) {
          const wob = 0.5;
          vx = (dx / dist) * sp + Math.cos(this.wobble) * sp * wob;
          vy = (dy / dist) * sp + Math.sin(this.wobble * 1.3) * sp * wob;
        }
        break;
      case "patroller":
        if (active && dist < aggro * 0.85) {
          // charge the player
          vx = (dx / dist) * sp * 1.25;
          vy = (dy / dist) * sp * 1.25;
        } else {
          vx = this.patrolX * sp * 0.5;
          vy = this.patrolY * sp * 0.5;
        }
        break;
      case "shooter":
        if (active) {
          const want = 110; // preferred distance
          if (dist < want - 18) {
            vx = -(dx / dist) * sp;
            vy = -(dy / dist) * sp;
          } else if (dist > want + 24) {
            vx = (dx / dist) * sp;
            vy = (dy / dist) * sp;
          } else {
            // strafe a little
            vx = -(dy / dist) * sp * 0.6;
            vy = (dx / dist) * sp * 0.6;
          }
          this.fireT -= dt;
          if (this.fireT <= 0) {
            this.fireT = this.def.fireInterval ?? 2;
            const ps = this.def.projectileSpeed ?? 120;
            hooks.spawnProjectile(this.x, this.y, (dx / dist) * ps, (dy / dist) * ps, false, this.def.damage);
            hooks.sfx("attack");
          }
        }
        break;
      case "tank":
        this.lungeCdT -= dt;
        if (this.lungeT > 0) {
          this.lungeT -= dt;
          vx = this.lungeVX;
          vy = this.lungeVY;
        } else if (active) {
          if (this.lungeCdT <= 0 && dist < 140) {
            this.lungeT = 0.32;
            this.lungeCdT = 2.4;
            this.lungeVX = (dx / dist) * sp * 3.2;
            this.lungeVY = (dy / dist) * sp * 3.2;
          } else {
            vx = (dx / dist) * sp;
            vy = (dy / dist) * sp;
          }
        }
        break;

      case "turret":
        // stationary caster — fires a telegraphed spread
        if (active) {
          this.fireT -= dt;
          this.telegraphing = this.fireT < 0.4 && this.fireT > 0;
          if (this.fireT <= 0) {
            this.fireT = this.def.fireInterval ?? 2.2;
            const ps = this.def.projectileSpeed ?? 120;
            const base = Math.atan2(dy, dx);
            for (let i = -1; i <= 1; i++) {
              const a = base + i * 0.25;
              hooks.spawnProjectile(this.x, this.y, Math.cos(a) * ps, Math.sin(a) * ps, false, this.def.damage);
            }
            hooks.sfx("attack");
          }
        }
        break;

      case "charger": {
        this.telegraphing = this.chargeState === "windup";
        if (this.chargeState === "idle") {
          this.chargeCdT -= dt;
          if (active && dist > 22) {
            vx = (dx / dist) * sp * 0.7;
            vy = (dy / dist) * sp * 0.7;
          }
          if (active && this.chargeCdT <= 0 && dist < (aggro || 220) * 0.9) {
            this.chargeState = "windup";
            this.chargeT = 0.7;
            this.chargeVX = (dx / dist) * sp * 4.4;
            this.chargeVY = (dy / dist) * sp * 4.4;
          }
        } else if (this.chargeState === "windup") {
          this.chargeT -= dt;
          if (this.chargeT <= 0) {
            this.chargeState = "charge";
            this.chargeT = 0.55;
            hooks.sfx("bosshit");
          }
        } else if (this.chargeState === "charge") {
          this.chargeT -= dt;
          vx = this.chargeVX;
          vy = this.chargeVY;
          if (this.chargeT <= 0) {
            this.chargeState = "recover";
            this.chargeT = 0.5;
          }
        } else {
          this.chargeT -= dt;
          if (this.chargeT <= 0) {
            this.chargeState = "idle";
            this.chargeCdT = 2.2;
          }
        }
        break;
      }

      case "splitter":
        // behaves like a chaser; the split happens on death (see Game.onEnemyKilled)
        if (active) {
          vx = (dx / dist) * sp;
          vy = (dy / dist) * sp;
        }
        break;
    }

    // knockback
    vx += this.kbX;
    vy += this.kbY;
    this.kbX *= Math.pow(0.0001, dt);
    this.kbY *= Math.pow(0.0001, dt);

    // patrollers bounce off walls
    const res = room.moveBox(this.x, this.y, this.radius, vx * dt, vy * dt);
    if (this.def.behavior === "patroller") {
      if (res.hitX) this.patrolX *= -1;
      if (res.hitY) this.patrolY *= -1;
    }
    // a charging charger stops when it slams a wall
    if (this.def.behavior === "charger" && this.chargeState === "charge" && (res.hitX || res.hitY)) {
      this.chargeState = "recover";
      this.chargeT = 0.45;
    }
    this.x = res.x;
    this.y = res.y;
  }

  hurt(damage: number, fromX: number, fromY: number, kb: number): boolean {
    this.hp -= damage;
    this.hitFlashT = Balance.combat.hitFlashTime;
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const m = len(dx, dy);
    this.kbX = (dx / m) * kb;
    this.kbY = (dy / m) * kb;
    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Boss (miniboss + final)
// ---------------------------------------------------------------------------
type BossPhase = "intro" | "idle" | "telegraph" | "active" | "recover" | "dead";

export class Boss {
  def: BossDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  alive = true;
  hitFlashT = 0;
  phase: BossPhase = "intro";
  introT = 1.6;
  phaseTimer = 0;
  cooldowns: Record<string, number> = {};
  currentPattern: BossDef["patterns"][number] | null = null;
  enraged = false;
  // charge state
  chargeVX = 0;
  chargeVY = 0;
  kbX = 0;
  kbY = 0;
  facingX = 1;
  bob = 0;
  /** signals to Game */
  justEnraged = false;

  constructor(def: BossDef, x: number, y: number, hpScale = 1) {
    this.def = def;
    this.x = x;
    this.y = y;
    this.maxHp = Math.round(def.hp * hpScale);
    this.hp = this.maxHp;
    this.radius = def.radius;
    for (const p of def.patterns) this.cooldowns[p.id] = p.cooldown * 0.4;
  }

  get contactDamage(): number {
    return this.def.contactDamage;
  }

  update(dt: number, player: Player, room: Room, hooks: CombatHooks) {
    this.justEnraged = false;
    this.hitFlashT = Math.max(0, this.hitFlashT - dt);
    this.bob += dt * 4;
    for (const k in this.cooldowns) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (Math.abs(dx) > 4) this.facingX = dx > 0 ? 1 : -1;

    // phase 2 trigger
    if (!this.enraged && this.hp <= this.maxHp / 2) {
      this.enraged = true;
      this.justEnraged = true;
      hooks.shake(8);
    }
    const speedMul = this.enraged ? 1.25 : 1;

    let vx = 0;
    let vy = 0;

    switch (this.phase) {
      case "intro":
        this.introT -= dt;
        if (this.introT <= 0) this.phase = "idle";
        break;

      case "idle": {
        // drift toward a comfortable range
        const want = 70;
        if (dist > want) {
          vx = (dx / dist) * this.def.speed * speedMul;
          vy = (dy / dist) * this.def.speed * speedMul;
        } else {
          vx = -(dy / dist) * this.def.speed * 0.5;
          vy = (dx / dist) * this.def.speed * 0.5;
        }
        // choose a pattern
        const ready = this.def.patterns.filter((p) => {
          if (this.cooldowns[p.id] > 0) return false;
          if (p.kind === "summon" && !this.enraged) return false;
          return true;
        });
        if (ready.length) {
          this.phaseTimer += dt;
          if (this.phaseTimer > 0.5) {
            this.phaseTimer = 0;
            const p = ready[Math.floor((this.bob * 10) % ready.length)];
            this.currentPattern = p;
            this.cooldowns[p.id] = p.cooldown;
            this.phase = "telegraph";
            this.phaseTimer = p.telegraph / speedMul;
            // aim charge now
            if (p.kind === "charge") {
              this.chargeVX = (dx / dist) * this.def.speed * 4.2;
              this.chargeVY = (dy / dist) * this.def.speed * 4.2;
            }
          }
        }
        break;
      }

      case "telegraph": {
        this.phaseTimer -= dt;
        const p = this.currentPattern!;
        // small approach during slam/volley telegraph
        if (p.kind === "slam" || p.kind === "volley") {
          vx = (dx / dist) * this.def.speed * 0.4;
          vy = (dy / dist) * this.def.speed * 0.4;
        }
        if (this.phaseTimer <= 0) {
          this.executePattern(p, player, hooks, speedMul);
          this.phase = p.kind === "charge" ? "active" : "recover";
          this.phaseTimer = (p.kind === "charge" ? 0.45 : p.recovery) / speedMul;
        }
        break;
      }

      case "active": {
        // only used by charge: move fast
        this.phaseTimer -= dt;
        vx = this.chargeVX;
        vy = this.chargeVY;
        if (this.phaseTimer <= 0) {
          this.phase = "recover";
          this.phaseTimer = (this.currentPattern?.recovery ?? 0.4) / speedMul;
        }
        break;
      }

      case "recover":
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) this.phase = "idle";
        break;

      case "dead":
        return;
    }

    vx += this.kbX;
    vy += this.kbY;
    this.kbX *= Math.pow(0.0001, dt);
    this.kbY *= Math.pow(0.0001, dt);

    const res = room.moveBox(this.x, this.y, this.radius, vx * dt, vy * dt);
    if ((res.hitX || res.hitY) && this.phase === "active") {
      this.chargeVX = 0;
      this.chargeVY = 0;
    }
    this.x = res.x;
    this.y = res.y;
  }

  private executePattern(p: BossDef["patterns"][number], player: Player, hooks: CombatHooks, speedMul: number) {
    switch (p.kind) {
      case "slam":
        // warning ring, then the slam lands
        hooks.aoe(this.x, this.y, 0.32, this.radius + 30, this.radius, p.damage);
        hooks.sfx("attack");
        break;
      case "shockwave":
        hooks.aoe(this.x, this.y, 0.45, this.radius + 70, this.radius + 10, p.damage);
        hooks.sfx("attack");
        break;
      case "volley": {
        const n = this.enraged ? 7 : 5;
        const base = Math.atan2(player.y - this.y, player.x - this.x);
        const ps = 130 * speedMul;
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.22;
          hooks.spawnProjectile(this.x, this.y, Math.cos(a) * ps, Math.sin(a) * ps, true, p.damage);
        }
        hooks.sfx("attack");
        break;
      }
      case "charge":
        hooks.sfx("bosshit");
        hooks.shake(4);
        break;
      case "summon":
        hooks.spawnAdd("wraith", this.x - 28, this.y);
        hooks.spawnAdd("wraith", this.x + 28, this.y);
        hooks.sfx("gate");
        hooks.burst(this.x, this.y, "#b48cff", 16);
        break;
    }
  }

  hurt(damage: number, fromX: number, fromY: number): boolean {
    if (this.phase === "intro" || this.phase === "dead") return false;
    this.hp -= damage;
    this.hitFlashT = Balance.combat.hitFlashTime;
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const m = len(dx, dy);
    this.kbX = (dx / m) * 18;
    this.kbY = (dy / m) * 18;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      this.phase = "dead";
      return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Projectiles & hazards
// ---------------------------------------------------------------------------
export class Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius = Balance.combat.projectileRadius;
  fromBoss: boolean;
  damage: number;
  life = 4;
  alive = true;
  spin = 0;

  constructor(x: number, y: number, vx: number, vy: number, fromBoss: boolean, damage: number) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.fromBoss = fromBoss;
    this.damage = damage;
  }

  update(dt: number, room: Room) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    this.spin += dt * 12;
    if (this.life <= 0 || room.solidAtPx(this.x, this.y)) this.alive = false;
  }
}

export class Hazard {
  x: number;
  y: number;
  telegraph: number;
  radius: number; // current
  targetR: number;
  growFrom: number;
  damage: number;
  t = 0;
  activeDur = 0.22;
  alive = true;
  hasHit = false;
  impacted = false;

  constructor(x: number, y: number, telegraph: number, targetR: number, growFrom: number, damage: number) {
    this.x = x;
    this.y = y;
    this.telegraph = telegraph;
    this.targetR = targetR;
    this.growFrom = growFrom;
    this.radius = targetR; // collision uses the full danger size
    this.damage = damage;
    this.activeDur = 0.26;
  }

  get armed(): boolean {
    return this.t >= this.telegraph && this.t < this.telegraph + this.activeDur;
  }
  /** 0..1 progress through the warning window (for drawing the telegraph). */
  get telegraphProgress(): number {
    return this.telegraph > 0 ? Math.min(1, this.t / this.telegraph) : 1;
  }

  update(dt: number) {
    this.t += dt;
    if (this.t > this.telegraph + this.activeDur + 0.18) this.alive = false;
  }
}

// ---------------------------------------------------------------------------
// Interactables (non-combat room objects)
// ---------------------------------------------------------------------------
export interface Interactable {
  kind: SpawnKind;
  x: number;
  y: number;
  tx: number;
  ty: number;
  uid?: string;
  ref?: string;
  pickup?: PickupKind;
  amount?: number;
  prop?: PropKind;
  contains?: ChestContents;
  setsFlag?: GameFlag;
  solid: boolean;
  radius: number;
  // runtime visual state
  opened?: boolean;
  used?: boolean;
  bob: number;
  glow: number;
}

export function makeInteractable(s: SpawnDef): Interactable {
  const c = Room.tileCenter(s.tx, s.ty);
  const solid =
    s.solid ??
    (s.kind === "prop"
      ? s.prop === "barrel" || s.prop === "crate" || s.prop === "statue" || s.prop === "anvil"
      : false);
  return {
    kind: s.kind,
    x: c.x,
    y: c.y,
    tx: s.tx,
    ty: s.ty,
    uid: s.uid,
    ref: s.ref,
    pickup: s.pickup,
    amount: s.amount,
    prop: s.prop,
    contains: s.contains,
    setsFlag: s.setsFlag,
    solid,
    radius: TILE * 0.5,
    bob: ((s.tx * 7 + s.ty * 11) % 100) / 100 * Math.PI * 2,
    glow: 0,
  };
}
