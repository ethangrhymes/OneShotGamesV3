/**
 * bossDefinitions.ts — Act 1 miniboss + final boss.
 *
 * To add a boss: add an entry, give it patterns (each with telegraph/recovery/
 * cooldown/kind/damage), and place it with a SpawnDef of kind "miniboss" or
 * "boss" referencing the id. Combat.ts interprets the pattern `kind`s.
 */
import type { BossDef } from "../../game/types";

export const bossDefinitions: Record<string, BossDef> = {
  // ----- Miniboss: guards a Warden Seal + the Warden's Edge upgrade -----
  gaoler: {
    id: "gaoler",
    name: "The Gaoler",
    title: "Warden of the Deep Cells",
    sprite: "miniboss",
    hp: 34,
    contactDamage: 2,
    speed: 58,
    radius: 12,
    scale: 1.9,
    fallbackColor: "#d98a44",
    embers: 40,
    isMiniboss: true,
    introLine: "The Gaoler has not unlocked a door in a hundred years.",
    phaseLine: "Its chains rattle louder — it will not yield the key gently.",
    defeatLine: "The Gaoler crumbles. A Warden Seal clatters from its belt.",
    setsFlag: "minibossDefeated",
    reward: { seal: 1, upgrade: "wardensEdge" },
    patterns: [
      { id: "lunge", kind: "charge", telegraph: 0.55, recovery: 0.5, cooldown: 2.6, damage: 2 },
      { id: "slam", kind: "slam", telegraph: 0.7, recovery: 0.6, cooldown: 3.4, damage: 2 },
      { id: "quake", kind: "shockwave", telegraph: 0.8, recovery: 0.7, cooldown: 5.0, damage: 2 },
    ],
  },

  // ----- Phase 3 miniboss: guards the Drowned Toll-Gate; drops the Brine Heart -----
  drownedGear: {
    id: "drownedGear",
    name: "The Drowned Gear",
    title: "Engine of the Toll",
    sprite: "miniboss",
    hp: 40,
    contactDamage: 2,
    speed: 50,
    radius: 12,
    scale: 2.0,
    fallbackColor: "#5a8a9a",
    embers: 60,
    isMiniboss: true,
    introLine: "The toll-engine grinds awake in the shallows. It still means to collect.",
    phaseLine: "Salt-water screams through its gears — it spins faster, sloppier, hungrier.",
    defeatLine: "The Drowned Gear seizes and sinks. A brine-pickled heart rolls free of its housing.",
    setsFlag: "tollGearDefeated",
    reward: { upgrade: "brineHeart", embers: 30 },
    patterns: [
      // gear-spray: a wide telegraphed volley of cog-shot
      { id: "grind", kind: "volley", telegraph: 0.7, recovery: 0.6, cooldown: 3.2, damage: 1 },
      // tide-slam: a big expanding ring as it stamps the shallows
      { id: "tideslam", kind: "shockwave", telegraph: 0.85, recovery: 0.7, cooldown: 4.6, damage: 2 },
      // ram: a short telegraphed charge down its rail
      { id: "ram", kind: "charge", telegraph: 0.55, recovery: 0.55, cooldown: 3.0, damage: 2 },
    ],
  },

  // ----- Final boss: The Hollow Warden -----
  warden: {
    id: "warden",
    name: "The Hollow Warden",
    title: "Last Keeper of Emberfall",
    sprite: "boss",
    hp: 70,
    contactDamage: 2,
    speed: 52,
    radius: 13,
    scale: 2.3,
    fallbackColor: "#c8531f",
    embers: 120,
    introLine: "It kept the Keep when the kings forgot it. Now it keeps only ash.",
    phaseLine: "Embers burst from its visor — the Warden burns its last light.",
    defeatLine: "The Hollow Warden kneels. The curse over Emberfall lifts like smoke.",
    setsFlag: "actBossDefeated",
    reward: { embers: 80 },
    patterns: [
      { id: "cleave", kind: "slam", telegraph: 0.6, recovery: 0.45, cooldown: 2.2, damage: 2 },
      { id: "ringfire", kind: "shockwave", telegraph: 0.85, recovery: 0.7, cooldown: 4.2, damage: 2 },
      { id: "embervolley", kind: "volley", telegraph: 0.7, recovery: 0.6, cooldown: 3.6, damage: 1 },
      { id: "charge", kind: "charge", telegraph: 0.5, recovery: 0.55, cooldown: 3.0, damage: 2 },
      // unlocked below half HP (phase 2): calls wraiths to its side
      { id: "summon", kind: "summon", telegraph: 1.0, recovery: 0.8, cooldown: 9.0, damage: 0 },
    ],
  },
};
