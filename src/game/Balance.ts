/**
 * Balance.ts — every gameplay tunable lives here so the game can be retuned in
 * one place. Difficulty mode scales a handful of enemy values at load time.
 */

export const TILE = 16; // source tile size (px). World units == source px.

export const Balance = {
  // ---- player ----
  player: {
    maxHeartsStart: 5, // each heart = 2 hp pips
    hpPerHeart: 2,
    speed: 92, // px/sec
    radius: 6,
    // attack
    attackDamage: 1,
    attackReach: 18, // px in front (extended by Warden's Edge)
    attackArc: Math.PI * 0.95, // swing arc width
    attackDuration: 0.18, // active hitbox seconds
    attackCooldown: 0.32,
    attackKnockback: 120,
    // dash / roll
    dashSpeed: 250,
    dashDuration: 0.16,
    dashCooldown: 0.62,
    dashIFrames: 0.2, // invulnerable while rolling
    // damage response
    hurtIFrames: 0.9,
    knockbackTaken: 150,
  },

  upgrades: {
    heartVesselBonus: 1, // +1 max heart
    wardensEdgeReach: 9, // +px reach
    wardensEdgeDamage: 1, // +damage
    swiftBootsCooldownMult: 0.6, // dash cooldown multiplier
  },

  combat: {
    hitFlashTime: 0.12,
    enemyKnockback: 130,
    projectileRadius: 4,
    projectileDamage: 1,
  },

  // ---- economy ----
  economy: {
    emberPerHeartDrop: 0, // hearts are separate
    potionHeal: 4, // hp pips restored by a potion
    heartPickupHeal: 2,
    deathDropFraction: 1.0, // fraction of embers dropped on death (recoverable)
  },

  // ---- difficulty multipliers ----
  difficulty: {
    normal: { enemyHp: 1.0, enemyDamage: 1.0, enemySpeed: 1.0, bossHp: 1.0 },
    hard: { enemyHp: 1.35, enemyDamage: 1.5, enemySpeed: 1.12, bossHp: 1.4 },
  },

  // ---- timing / loop ----
  loop: {
    maxDeltaMs: 50, // cap dt so background tabs don't fling entities
  },

  // ---- camera / render ----
  camera: {
    // Target visible width in tiles. The renderer clamps so a whole room edge
    // is never cut awkwardly; smaller value = more zoomed in (good on phones).
    targetTilesWide: 15,
    minTilesWide: 11,
    maxTilesWide: 19,
    lerp: 0.16, // camera follow smoothing
    shakeDecay: 6,
  },
} as const;

export type DifficultyMode = "normal" | "hard";
