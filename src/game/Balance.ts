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
    knockbackTaken: 120,
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
  // enemySpeed/aggroMult curb the "heat-seeking swarm"; heartsBonus + iframeMult +
  // knockbackMult are the survivability levers. bossDamage scales how hard boss
  // hits land (HP alone left bosses brutal on Easy).
  //
  // EASY is meant to be a *moderate, achievable* challenge — encounters still
  // bite, but an engaged player who keeps moving and rolling can always advance.
  // Incoming damage is the biggest lever, so Easy mainly softens what hits you
  // (enemy + boss damage, knockback) and grants generous mercy i-frames + hearts,
  // while keeping enemies alive long enough to feel like real fights.
  difficulty: {
    easy: {
      enemyHp: 0.5,
      enemyDamage: 0.6,
      enemySpeed: 0.58,
      bossHp: 0.5,
      bossDamage: 0.6,
      heartsBonus: 5, // 10 hearts
      iframeMult: 1.9,
      aggroMult: 0.5,
      knockbackMult: 0.35,
    },
    normal: {
      enemyHp: 0.9,
      enemyDamage: 1.0,
      enemySpeed: 0.82,
      bossHp: 0.85,
      bossDamage: 1.0,
      heartsBonus: 1, // 6 hearts
      iframeMult: 1.15,
      aggroMult: 0.82,
      knockbackMult: 0.7,
    },
    hard: {
      enemyHp: 1.3,
      enemyDamage: 1.5,
      enemySpeed: 1.02,
      bossHp: 1.3,
      bossDamage: 1.4,
      heartsBonus: 0,
      iframeMult: 1.0,
      aggroMult: 1.0,
      knockbackMult: 1.0,
    },
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

export type DifficultyMode = "easy" | "normal" | "hard";
