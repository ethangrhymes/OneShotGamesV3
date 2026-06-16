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
  emberHeart: {
    id: "emberHeart",
    name: "Ember Heart",
    kind: "upgrade",
    sprite: "tt_relic",
    description: "A still-warm heart of the road. Maximum hearts +1.",
    upgrade: "emberHeart",
  },
  tideRelic: {
    id: "tideRelic",
    name: "Tide Relic",
    kind: "upgrade",
    sprite: "ring",
    description: "The drowned king's signet. The shallow tide parts for you — wade the shallows you could not before.",
    upgrade: "tideRelic",
  },
  brineHeart: {
    id: "brineHeart",
    name: "Brine Heart",
    kind: "upgrade",
    sprite: "potion_red",
    description: "A heart pickled in salt and sorrow, torn from the toll-engine. Maximum hearts +1.",
    upgrade: "brineHeart",
  },
  crystalShard: {
    id: "crystalShard",
    name: "Crystal Shard",
    kind: "upgrade",
    sprite: "ring",
    description: "A bright fragment of the buried sun, cold enough to hold. Dormant mirror gates wake at your touch — step through the glass.",
    upgrade: "crystalShard",
  },
  glassHeart: {
    id: "glassHeart",
    name: "Glass Heart",
    kind: "upgrade",
    sprite: "potion_red",
    description: "A heart of cut glass, taken from the Warden. It rings when you breathe. Maximum hearts +1.",
    upgrade: "glassHeart",
  },
  potion: {
    id: "potion",
    name: "Ember Draught",
    kind: "consumable",
    sprite: "potion_green",
    description: "Restores vigor.",
  },
};
