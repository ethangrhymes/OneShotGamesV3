/**
 * Combat.ts — resolves interactions between the player, enemies, boss,
 * projectiles and hazards. Pure functions; Game supplies the entity arrays,
 * the CombatHooks (for fx/sound) and a CombatCallbacks bundle for consequences
 * (embers, kills, game over).
 */
import type { Boss, CombatHooks, Enemy, Hazard, Player, Projectile } from "./Entities";

export interface CombatCallbacks {
  onEnemyKilled(e: Enemy): void;
  onBossDamaged(b: Boss): void;
  onBossKilled(b: Boss): void;
  onPlayerDead(): void;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** Player melee swing against enemies + boss (one hit per target per swing). */
export function resolvePlayerAttack(
  player: Player,
  enemies: Enemy[],
  boss: Boss | null,
  hooks: CombatHooks,
  cb: CombatCallbacks
): void {
  if (!player.attacking) return;
  // Ranged Vessels (staff/bow) deal damage only through their projectiles.
  if (player.run.isRanged) return;
  const dmg = player.run.attackDamage;
  const kb = player.run.enemyKnockback;

  for (const e of enemies) {
    if (!e.alive || player.swingHits.has(e)) continue;
    if (player.swingHitsPoint(e.x, e.y, e.radius)) {
      player.swingHits.add(e);
      const killed = e.hurt(dmg, player.x, player.y, kb);
      hooks.sfx("hit");
      hooks.burst(e.x, e.y, e.def.fallbackColor, killed ? 12 : 5);
      if (killed) cb.onEnemyKilled(e);
    }
  }

  if (boss && boss.alive && !player.swingHits.has(boss)) {
    if (player.swingHitsPoint(boss.x, boss.y, boss.radius * 1.15)) {
      player.swingHits.add(boss);
      const killed = boss.hurt(dmg, player.x, player.y);
      hooks.sfx("bosshit");
      hooks.burst(boss.x, boss.y, boss.def.fallbackColor, killed ? 22 : 6);
      cb.onBossDamaged(boss);
      if (killed) cb.onBossKilled(boss);
    }
  }
}

/** Contact damage from enemies and the boss body. */
export function resolveContact(
  player: Player,
  enemies: Enemy[],
  boss: Boss | null,
  hooks: CombatHooks,
  cb: CombatCallbacks
): void {
  if (player.invulnerable) return;
  for (const e of enemies) {
    if (!e.alive) continue;
    if (dist(player.x, player.y, e.x, e.y) < player.radius + e.radius) {
      const r = player.hurt(e.damage, e.x, e.y);
      if (r.hit) {
        hooks.sfx("hurt");
        hooks.shake(4);
        if (r.dead) cb.onPlayerDead();
      }
      return;
    }
  }
  if (boss && boss.alive && boss.phase !== "intro") {
    if (dist(player.x, player.y, boss.x, boss.y) < player.radius + boss.radius) {
      const r = player.hurt(boss.contactDamage, boss.x, boss.y);
      if (r.hit) {
        hooks.sfx("hurt");
        hooks.shake(5);
        if (r.dead) cb.onPlayerDead();
      }
    }
  }
}

export function updateProjectiles(
  dt: number,
  projectiles: Projectile[],
  room: import("./Dungeon").Room,
  player: Player,
  enemies: Enemy[],
  boss: Boss | null,
  hooks: CombatHooks,
  cb: CombatCallbacks
): void {
  for (const p of projectiles) {
    p.update(dt, room);
    if (!p.alive) continue;

    if (p.friendly) {
      // player-owned shot (Embermage bolt / Wayfarer arrow): hits enemies + boss,
      // passing through up to `pierce` of them. Knockback pushes along travel.
      const kbX = p.x - p.vx;
      const kbY = p.y - p.vy;
      const kb = player.run.enemyKnockback * 0.6;
      for (const e of enemies) {
        if (!e.alive || p.hits.has(e)) continue;
        if (dist(p.x, p.y, e.x, e.y) < p.radius + e.radius) {
          p.hits.add(e);
          const killed = e.hurt(p.damage, kbX, kbY, kb);
          hooks.sfx("hit");
          hooks.burst(e.x, e.y, e.def.fallbackColor, killed ? 12 : 5);
          if (killed) cb.onEnemyKilled(e);
          if (p.pierce > 0) p.pierce--;
          else {
            p.alive = false;
            break;
          }
        }
      }
      if (p.alive && boss && boss.alive && boss.phase !== "intro" && !p.hits.has(boss)) {
        if (dist(p.x, p.y, boss.x, boss.y) < p.radius + boss.radius * 1.1) {
          p.hits.add(boss);
          const killed = boss.hurt(p.damage, p.x, p.y);
          hooks.sfx("bosshit");
          hooks.burst(boss.x, boss.y, boss.def.fallbackColor, killed ? 22 : 6);
          cb.onBossDamaged(boss);
          if (killed) cb.onBossKilled(boss);
          if (p.pierce > 0) p.pierce--;
          else p.alive = false;
        }
      }
      continue;
    }

    // enemy projectile → damages the player
    if (!player.invulnerable && dist(player.x, player.y, p.x, p.y) < player.radius + p.radius) {
      const r = player.hurt(p.damage, p.x, p.y);
      p.alive = false;
      if (r.hit) {
        hooks.sfx("hurt");
        hooks.shake(3);
        if (r.dead) cb.onPlayerDead();
      }
    }
  }
}

export function updateHazards(
  dt: number,
  hazards: Hazard[],
  player: Player,
  hooks: CombatHooks,
  cb: CombatCallbacks
): void {
  for (const h of hazards) {
    h.update(dt);
    if (h.armed && !h.impacted) {
      h.impacted = true;
      hooks.shake(7);
      hooks.sfx("bosshit");
      hooks.burst(h.x, h.y, "#ff9a3c", 14);
    }
    if (h.armed && !h.hasHit && !player.invulnerable) {
      if (dist(player.x, player.y, h.x, h.y) < h.radius + player.radius) {
        h.hasHit = true;
        const r = player.hurt(h.damage, h.x, h.y);
        if (r.hit) {
          hooks.sfx("hurt");
          hooks.shake(4);
          if (r.dead) cb.onPlayerDead();
        }
      }
    }
  }
}

/** Light anti-stacking so enemies don't perfectly overlap. */
export function separateEnemies(enemies: Enemy[]): void {
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j];
      if (!b.alive) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const min = a.radius + b.radius;
      if (d < min) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}
