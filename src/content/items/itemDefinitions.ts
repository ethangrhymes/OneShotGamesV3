/**
 * itemDefinitions.ts — keys, seals, upgrades and consumables.
 * Add new items here and reference their id from chests / spawns.
 */
import type { ItemDef } from "../../game/types";

export const itemDefinitions: Record<string, ItemDef> = {
  ironKey: {
    id: "ironKey",
    name: "Iron Key",
    kind: "key",
    sprite: "_key", // drawn procedurally (no Kenney key tile) — leading _ = synthetic
    description: "A pitted key. Fits the barred doors of the Keep.",
  },
  wardenSeal: {
    id: "wardenSeal",
    name: "Warden Seal",
    kind: "seal",
    sprite: "ring",
    description: "An ember-warm ring. The sealed door drinks two of them.",
  },
  heartVessel: {
    id: "heartVessel",
    name: "Heart Vessel",
    kind: "upgrade",
    sprite: "potion_red",
    description: "Your vigor deepens. Maximum hearts +1.",
    upgrade: "heartVessel",
  },
  wardensEdge: {
    id: "wardensEdge",
    name: "Warden's Edge",
    kind: "upgrade",
    sprite: "sword",
    description: "A keener blade. Your strikes reach farther and bite harder.",
    upgrade: "wardensEdge",
  },
  swiftBoots: {
    id: "swiftBoots",
    name: "Ashstep Boots",
    kind: "upgrade",
    sprite: "potion_blue",
    description: "Soot-light boots. Your roll recovers far sooner.",
    upgrade: "swiftBoots",
  },
  potion: {
    id: "potion",
    name: "Ember Draught",
    kind: "consumable",
    sprite: "potion_green",
    description: "Restores vigor.",
  },
};
