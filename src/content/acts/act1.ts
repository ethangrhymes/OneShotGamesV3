/**
 * act1.ts — "Emberfall Keep", Act 1: The Sunken Keep.
 *
 * This file is PURE DATA. The engine (World/Dungeon, Entities, Combat, Renderer)
 * never needs editing to add content — add rooms here, or whole new acts in new
 * files (see CONTENT_GUIDE.md). Room layouts are ASCII; door openings on the
 * wall border are carved automatically from each door's (tx,ty).
 *
 * Layout legend:  '#' wall   '.' floor   ',' floor-variant   '~' hazard
 *                 '=' gargoyle wall (solid decor)   ' ' void
 *
 * Critical path to the boss (always winnable, no key required):
 *   gate -> hall -> well -> descent -> armory -> gaol(miniboss => Seal #2 + edge)
 *        -> shrine -> bossgate(needs 2 seals) -> throne(final boss) -> summit
 *   Seal #1 sits in the gallery, an open branch off the well hub.
 * Locked doors (optional Iron Keys) only gate optional upgrade/treasure rooms.
 */
import type { WorldAct, RoomDef } from "../../game/types";
import { enemyDefinitions } from "../enemies/enemyDefinitions";
import { bossDefinitions } from "../bosses/bossDefinitions";
import { itemDefinitions } from "../items/itemDefinitions";
import { loreEntries } from "../lore/loreEntries";
import { rootwardRoad } from "../regions/rootwardRoad";
import { saltblackReach } from "../regions/saltblackReach";

const rooms: RoomDef[] = [
  // ---------------------------------------------------------------- gate
  {
    id: "gate",
    name: "The Threshold",
    subtitle: "The gate stands open. It should not.",
    gx: 0,
    gy: 2,
    floor: "stone",
    wall: "brick",
    isSafe: true,
    music: "explore",
    layout: [
      "#############",
      "#...........#",
      "#...,,,,,...#",
      "#...,...,...#",
      "#...,...,...#",
      "#...,...,...#",
      "#...........#",
      "#...........#",
      "#############",
    ],
    doors: [{ id: "gate_e", tx: 12, ty: 4, edge: "e", to: "hall", toDoorId: "hall_w", type: "open" }],
    spawns: [
      { kind: "checkpoint", tx: 6, ty: 4, uid: "cp_gate", ref: "Threshold Emberlight" },
      { kind: "lore", tx: 3, ty: 2, ref: "l_threshold", prop: "statue" },
      { kind: "prop", tx: 2, ty: 7, prop: "torch", solid: false },
      { kind: "prop", tx: 10, ty: 7, prop: "torch", solid: false },
      { kind: "prop", tx: 2, ty: 1, prop: "barrel" },
    ],
  },

  // ---------------------------------------------------------------- hall
  {
    id: "hall",
    name: "Collapsed Hall",
    subtitle: "Old banners, older rubble.",
    gx: 1,
    gy: 2,
    floor: "stone",
    wall: "brick",
    music: "explore",
    layout: [
      "#############",
      "#...........#",
      "#..#.....#..#",
      "#...........#",
      "#...........#",
      "#...........#",
      "#..#.....#..#",
      "#...........#",
      "#############",
    ],
    doors: [
      { id: "hall_w", tx: 0, ty: 4, edge: "w", to: "gate", toDoorId: "gate_e", type: "open" },
      { id: "hall_e", tx: 12, ty: 4, edge: "e", to: "well", toDoorId: "well_w", type: "open" },
      { id: "hall_n", tx: 6, ty: 0, edge: "n", to: "overlook", toDoorId: "overlook_s", type: "open" },
    ],
    spawns: [
      { kind: "enemy", tx: 4, ty: 3, ref: "rat" },
      { kind: "enemy", tx: 8, ty: 5, ref: "rat" },
      { kind: "enemy", tx: 6, ty: 4, ref: "ooze" },
      { kind: "prop", tx: 3, ty: 7, prop: "crate" },
      { kind: "prop", tx: 9, ty: 1, prop: "barrel" },
    ],
  },

  // ---------------------------------------------------------------- overlook
  {
    id: "overlook",
    name: "Cracked Overlook",
    subtitle: "A window onto the drowned courtyard.",
    gx: 1,
    gy: 1,
    floor: "dirt",
    wall: "stone",
    music: "explore",
    layout: [
      "###########",
      "#.........#",
      "#..,,,,,..#",
      "#.........#",
      "#..,,,,,..#",
      "#.........#",
      "###########",
    ],
    doors: [{ id: "overlook_s", tx: 5, ty: 6, edge: "s", to: "hall", toDoorId: "hall_n", type: "open" }],
    spawns: [
      { kind: "lore", tx: 5, ty: 2, ref: "l_well", prop: "scroll" },
      { kind: "enemy", tx: 3, ty: 4, ref: "bat" },
      { kind: "pickup", tx: 7, ty: 4, pickup: "heart", uid: "heart_overlook" },
      { kind: "pickup", tx: 2, ty: 2, pickup: "ember", amount: 6, uid: "em_overlook" },
    ],
  },

  // ---------------------------------------------------------------- well (hub)
  {
    id: "well",
    name: "The Echo Well",
    subtitle: "Speak your name; it answers older.",
    gx: 2,
    gy: 2,
    floor: "stone",
    wall: "stone",
    isSafe: true,
    music: "explore",
    layout: [
      "#############",
      "#...........#",
      "#...........#",
      "#...#...#...#",
      "#...........#",
      "#...#...#...#",
      "#...........#",
      "#...........#",
      "#############",
    ],
    doors: [
      { id: "well_w", tx: 0, ty: 4, edge: "w", to: "hall", toDoorId: "hall_e", type: "open" },
      { id: "well_n", tx: 6, ty: 0, edge: "n", to: "cells", toDoorId: "cells_s", type: "open" },
      { id: "well_e", tx: 12, ty: 2, edge: "e", to: "descent", toDoorId: "descent_w", type: "open" },
      {
        id: "well_sc",
        tx: 12,
        ty: 6,
        edge: "e",
        to: "shrine",
        toDoorId: "shrine_sc",
        type: "shortcut",
        flag: "shortcutUnlocked",
        lockedHint: "A portcullis bars the way. Something must raise it from deeper in.",
      },
      { id: "well_s1", tx: 4, ty: 8, edge: "s", to: "cistern", toDoorId: "cistern_n", type: "open" },
      { id: "well_s2", tx: 9, ty: 8, edge: "s", to: "gallery", toDoorId: "gallery_n", type: "open" },
    ],
    spawns: [
      { kind: "checkpoint", tx: 6, ty: 6, uid: "cp_well", ref: "Wellmouth Emberlight" },
      { kind: "lore", tx: 2, ty: 2, ref: "l_well", prop: "scroll" },
      { kind: "prop", tx: 2, ty: 7, prop: "torch", solid: false },
      { kind: "prop", tx: 10, ty: 1, prop: "torch", solid: false },
    ],
  },

  // ---------------------------------------------------------------- cells
  {
    id: "cells",
    name: "Forgotten Cells",
    subtitle: "Locked to keep a fever in.",
    gx: 2,
    gy: 1,
    floor: "dirt",
    wall: "brick",
    music: "explore",
    layout: [
      "#############",
      "#.=.=.=.=.=.#",
      "#...........#",
      "#...........#",
      "#...........#",
      "#...........#",
      "#.=.=...=.=.#",
      "#...........#",
      "#############",
    ],
    doors: [{ id: "cells_s", tx: 6, ty: 8, edge: "s", to: "well", toDoorId: "well_n", type: "open" }],
    spawns: [
      { kind: "enemy", tx: 3, ty: 3, ref: "spider" },
      { kind: "enemy", tx: 9, ty: 4, ref: "spider" },
      { kind: "enemy", tx: 6, ty: 2, ref: "rat" },
      { kind: "lore", tx: 2, ty: 4, ref: "l_cells", prop: "scroll" },
      {
        kind: "chest",
        tx: 10, ty: 2,
        uid: "chest_cells_key",
        contains: { key: 1, embers: 8 },
      },
      { kind: "prop", tx: 6, ty: 4, prop: "bars", solid: false },
    ],
  },

  // ---------------------------------------------------------------- cistern
  {
    id: "cistern",
    name: "Flooded Cistern",
    subtitle: "Black water, and something stirring it.",
    gx: 2,
    gy: 3,
    floor: "tile",
    wall: "stone",
    music: "explore",
    layout: [
      "#############",
      "#...........#",
      "#..,,...,,..#",
      "#..,,...,,..#",
      "#...........#",
      "#..,,...,,..#",
      "#..,,...,,..#",
      "#...........#",
      "#############",
    ],
    doors: [
      { id: "cistern_n", tx: 6, ty: 0, edge: "n", to: "well", toDoorId: "well_s1", type: "open" },
      {
        id: "cistern_s",
        tx: 6, ty: 8,
        edge: "s",
        to: "vault",
        toDoorId: "vault_n",
        type: "locked",
        lockedHint: "An iron lock. You need an Iron Key.",
      },
    ],
    spawns: [
      { kind: "enemy", tx: 3, ty: 4, ref: "ooze" },
      { kind: "enemy", tx: 9, ty: 4, ref: "ooze" },
      { kind: "enemy", tx: 6, ty: 2, ref: "bat" },
      { kind: "pickup", tx: 6, ty: 6, pickup: "potion", uid: "potion_cistern" },
    ],
  },

  // ---------------------------------------------------------------- vault (upgrade)
  {
    id: "vault",
    name: "Warden's Vault",
    subtitle: "What they hoarded, they could not carry.",
    gx: 2,
    gy: 4,
    floor: "stone",
    wall: "brick",
    music: "explore",
    layout: [
      "#############",
      "#...........#",
      "#.,,,,,,,,,.#",
      "#.,.......,.#",
      "#.,.......,.#",
      "#.,.......,.#",
      "#.,,,,,,,,,.#",
      "#...........#",
      "#############",
    ],
    doors: [{ id: "vault_n", tx: 6, ty: 0, edge: "n", to: "cistern", toDoorId: "cistern_s", type: "locked" }],
    spawns: [
      { kind: "lore", tx: 6, ty: 1, ref: "l_vault", prop: "scroll" },
      {
        kind: "upgrade",
        tx: 6, ty: 4,
        ref: "heartVessel",
        uid: "up_heart",
      },
      { kind: "chest", tx: 3, ty: 4, uid: "chest_vault_a", contains: { embers: 14 } },
      { kind: "chest", tx: 9, ty: 4, uid: "chest_vault_b", contains: { embers: 14 } },
      { kind: "prop", tx: 2, ty: 7, prop: "torch", solid: false },
      { kind: "prop", tx: 10, ty: 7, prop: "torch", solid: false },
    ],
  },

  // ---------------------------------------------------------------- gallery (Seal #1)
  {
    id: "gallery",
    name: "Gargoyle Gallery",
    subtitle: "Stone eyes that have watched men starve.",
    gx: 3,
    gy: 3,
    floor: "stone",
    wall: "stone",
    music: "explore",
    layout: [
      "#############",
      "#=.=.=.=.=.=#",
      "#...........#",
      "#...........#",
      "#...........#",
      "#...........#",
      "#...........#",
      "#=.=.=.=.=.=#",
      "#############",
    ],
    doors: [
      { id: "gallery_n", tx: 6, ty: 0, edge: "n", to: "well", toDoorId: "well_s2", type: "open" },
      {
        id: "gallery_e",
        tx: 12, ty: 4,
        edge: "e",
        to: "nook",
        toDoorId: "nook_w",
        type: "locked",
        lockedHint: "Barred and iron-locked. An Iron Key would fit.",
      },
    ],
    spawns: [
      { kind: "enemy", tx: 3, ty: 3, ref: "caster" },
      { kind: "enemy", tx: 9, ty: 5, ref: "wraith" },
      { kind: "lore", tx: 2, ty: 5, ref: "l_gallery", prop: "scroll" },
      {
        kind: "seal",
        tx: 6, ty: 4,
        uid: "seal_gallery",
        ref: "wardenSeal",
      },
    ],
  },

  // ---------------------------------------------------------------- nook (treasure)
  {
    id: "nook",
    name: "Ashfall Nook",
    subtitle: "A hoarder's last secret.",
    gx: 4,
    gy: 3,
    floor: "dirt",
    wall: "brick",
    music: "explore",
    layout: [
      "###########",
      "#.........#",
      "#.........#",
      "#.........#",
      "#.........#",
      "#.........#",
      "###########",
    ],
    doors: [{ id: "nook_w", tx: 0, ty: 3, edge: "w", to: "gallery", toDoorId: "gallery_e", type: "locked" }],
    spawns: [
      { kind: "chest", tx: 3, ty: 3, uid: "chest_nook_a", contains: { embers: 25 } },
      { kind: "chest", tx: 7, ty: 3, uid: "chest_nook_b", contains: { embers: 20, hearts: 1 } },
      { kind: "pickup", tx: 5, ty: 2, pickup: "potion", uid: "potion_nook" },
      { kind: "prop", tx: 5, ty: 4, prop: "anvil" },
    ],
  },

  // ---------------------------------------------------------------- descent (shortcut lever)
  {
    id: "descent",
    name: "The Long Descent",
    subtitle: "Mind the floor it forgot it loved.",
    gx: 3,
    gy: 2,
    floor: "dirt",
    wall: "stone",
    music: "explore",
    layout: [
      "#############",
      "#...........#",
      "#.~.~.~.~.~.#",
      "#...........#",
      "#...........#",
      "#...........#",
      "#.~.~.~.~.~.#",
      "#...........#",
      "#############",
    ],
    doors: [
      { id: "descent_w", tx: 0, ty: 4, edge: "w", to: "well", toDoorId: "well_e", type: "open" },
      { id: "descent_e", tx: 12, ty: 4, edge: "e", to: "armory", toDoorId: "armory_w", type: "open" },
    ],
    spawns: [
      { kind: "enemy", tx: 6, ty: 4, ref: "spider" },
      { kind: "enemy", tx: 3, ty: 5, ref: "rat" },
      { kind: "lore", tx: 10, ty: 1, ref: "l_descent", prop: "scroll" },
      {
        kind: "lever",
        tx: 6, ty: 7,
        uid: "lever_shortcut",
        setsFlag: "shortcutUnlocked",
        ref: "Raise the Wellmouth Portcullis",
      },
    ],
  },

  // ---------------------------------------------------------------- armory (Iron Key #2)
  {
    id: "armory",
    name: "Sunken Armory",
    subtitle: "Rust wears the old steel like skin.",
    gx: 4,
    gy: 2,
    floor: "stone",
    wall: "brick",
    music: "explore",
    layout: [
      "#############",
      "#...........#",
      "#.#.......#.#",
      "#...........#",
      "#...........#",
      "#...........#",
      "#.#.......#.#",
      "#...........#",
      "#############",
    ],
    doors: [
      { id: "armory_w", tx: 0, ty: 4, edge: "w", to: "descent", toDoorId: "descent_e", type: "open" },
      { id: "armory_e", tx: 12, ty: 4, edge: "e", to: "gaol", toDoorId: "gaol_w", type: "open" },
    ],
    spawns: [
      { kind: "enemy", tx: 4, ty: 3, ref: "guard" },
      { kind: "enemy", tx: 8, ty: 5, ref: "guard" },
      { kind: "chest", tx: 6, ty: 2, uid: "chest_armory_key", contains: { key: 1, embers: 10 } },
      { kind: "prop", tx: 2, ty: 7, prop: "anvil" },
      { kind: "prop", tx: 10, ty: 7, prop: "crate" },
    ],
  },

  // ---------------------------------------------------------------- gaol (MINIBOSS)
  {
    id: "gaol",
    name: "Gaoler's Den",
    subtitle: "It has not opened a door in a hundred years.",
    gx: 5,
    gy: 2,
    floor: "stone",
    wall: "stone",
    music: "boss",
    layout: [
      "###############",
      "#=...........=#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#=...........=#",
      "###############",
    ],
    doors: [
      { id: "gaol_w", tx: 0, ty: 5, edge: "w", to: "armory", toDoorId: "armory_e", type: "open" },
      { id: "gaol_e", tx: 14, ty: 5, edge: "e", to: "shrine", toDoorId: "shrine_wg", type: "open" },
    ],
    spawns: [
      { kind: "miniboss", tx: 7, ty: 5, ref: "gaoler", uid: "miniboss_gaoler", blockedByFlag: "minibossDefeated" },
      // a captive freed once the Gaoler falls (flavor)
      { kind: "prop", tx: 2, ty: 2, prop: "bars", solid: false },
      { kind: "prop", tx: 12, ty: 8, prop: "bars", solid: false },
    ],
  },

  // ---------------------------------------------------------------- shrine (checkpoint)
  {
    id: "shrine",
    name: "Shrine of Ash",
    subtitle: "Two seals open the last door.",
    gx: 6,
    gy: 2,
    floor: "stone",
    wall: "brick",
    isSafe: true,
    music: "explore",
    layout: [
      "#############",
      "#...........#",
      "#...,,,,,...#",
      "#...,...,...#",
      "#...,...,...#",
      "#...,...,...#",
      "#...........#",
      "#...........#",
      "#############",
    ],
    doors: [
      { id: "shrine_wg", tx: 0, ty: 3, edge: "w", to: "gaol", toDoorId: "gaol_e", type: "open" },
      {
        id: "shrine_sc",
        tx: 0, ty: 6,
        edge: "w",
        to: "well",
        toDoorId: "well_sc",
        type: "shortcut",
        flag: "shortcutUnlocked",
        lockedHint: "A portcullis. It can only be raised from this side.",
      },
      {
        id: "shrine_e",
        tx: 12, ty: 4,
        edge: "e",
        to: "bossgate",
        toDoorId: "bossgate_w",
        type: "open",
      },
    ],
    spawns: [
      { kind: "checkpoint", tx: 6, ty: 4, uid: "cp_shrine", ref: "Ashen Emberlight" },
      { kind: "lore", tx: 3, ty: 6, ref: "l_shrine", prop: "scroll" },
      { kind: "prop", tx: 2, ty: 1, prop: "torch", solid: false },
      { kind: "prop", tx: 10, ty: 1, prop: "torch", solid: false },
    ],
  },

  // ---------------------------------------------------------------- bossgate
  {
    id: "bossgate",
    name: "The Sealed Door",
    subtitle: "It drinks two seals, and no less.",
    gx: 7,
    gy: 2,
    floor: "stone",
    wall: "stone",
    music: "explore",
    layout: [
      "#############",
      "#=.=.=.=.=.=#",
      "#...........#",
      "#...........#",
      "#...........#",
      "#...........#",
      "#...........#",
      "#=.=.=.=.=.=#",
      "#############",
    ],
    doors: [
      { id: "bossgate_w", tx: 0, ty: 4, edge: "w", to: "shrine", toDoorId: "shrine_e", type: "open" },
      {
        id: "bossgate_e",
        tx: 12, ty: 4,
        edge: "e",
        to: "throne",
        toDoorId: "throne_w",
        type: "bossGate",
        sealsRequired: 2,
        lockedHint: "The sealed door. It needs two Warden Seals.",
      },
    ],
    spawns: [
      { kind: "prop", tx: 6, ty: 2, prop: "statue" },
      { kind: "prop", tx: 3, ty: 5, prop: "torch", solid: false },
      { kind: "prop", tx: 9, ty: 5, prop: "torch", solid: false },
    ],
  },

  // ---------------------------------------------------------------- throne (FINAL BOSS)
  {
    id: "throne",
    name: "The Hollow Throne",
    subtitle: "It set down its name to take up the watch.",
    gx: 8,
    gy: 2,
    floor: "stone",
    wall: "stone",
    music: "boss",
    layout: [
      "###############",
      "#=...........=#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#.............#",
      "#=...........=#",
      "###############",
    ],
    doors: [
      { id: "throne_w", tx: 0, ty: 6, edge: "w", to: "bossgate", toDoorId: "bossgate_e", type: "open" },
      {
        id: "throne_e",
        tx: 14, ty: 6,
        edge: "e",
        to: "summit",
        toDoorId: "summit_w",
        type: "shortcut",
        flag: "actBossDefeated",
        lockedHint: "Sealed by the Warden's will. It will open when the Warden falls.",
      },
    ],
    spawns: [
      { kind: "boss", tx: 7, ty: 5, ref: "warden", uid: "boss_warden", blockedByFlag: "actBossDefeated" },
      { kind: "prop", tx: 7, ty: 1, prop: "statue" },
      { kind: "prop", tx: 2, ty: 10, prop: "torch", solid: false },
      { kind: "prop", tx: 12, ty: 10, prop: "torch", solid: false },
    ],
  },

  // ---------------------------------------------------------------- summit (victory tease)
  {
    id: "summit",
    name: "Ashen Summit",
    subtitle: "The curse recedes like smoke.",
    gx: 9,
    gy: 2,
    floor: "stone",
    wall: "brick",
    isSafe: true,
    music: "explore",
    layout: [
      "#############",
      "#...........#",
      "#...........#",
      "#...........#",
      "#...........#",
      "#...........#",
      "#...........#",
      "#...........#",
      "#############",
    ],
    doors: [
      { id: "summit_w", tx: 0, ty: 4, edge: "w", to: "throne", toDoorId: "throne_e", type: "open" },
      // The world-gate: opens when the Warden falls, leading onward to Round 2's
      // Rootward Road. Entering the Summit triggers the Act I victory screen.
      {
        id: "summit_gate",
        tx: 12, ty: 4,
        edge: "e",
        to: "rr_gate",
        toDoorId: "rr_gate_w",
        type: "shortcut",
        flag: "actBossDefeated",
        lockedHint: "A world-gate, sealed until the Warden falls.",
      },
    ],
    spawns: [
      { kind: "lore", tx: 4, ty: 3, ref: "l_throne", prop: "scroll" },
      // decorative arch framing the world-gate
      { kind: "prop", tx: 10, ty: 4, prop: "arch", solid: false, uid: "world_gate" },
      { kind: "prop", tx: 9, ty: 3, prop: "torch", solid: false },
      { kind: "prop", tx: 9, ty: 5, prop: "torch", solid: false },
    ],
  },
];

export const act1: WorldAct = {
  id: "act1",
  title: "Emberfall Keep",
  description:
    "The light that kept the Keep has gone hollow. Descend the Sunken Keep, take up the watch, and break the curse — Act 1 of a larger interconnected world.",
  startingRegionId: "sunken_keep",
  sealsForBoss: 2,
  enemies: enemyDefinitions,
  bosses: bossDefinitions,
  items: itemDefinitions,
  lore: loreEntries,
  regions: [
    {
      id: "sunken_keep",
      name: "The Sunken Keep",
      theme: "cursed flooded dungeon",
      accent: "#ff9a3c",
      startRoomId: "gate",
      startDoorId: "gate_e",
      rooms,
    },
    // Round 2 expansion region — reached through the summit world-gate.
    rootwardRoad,
    // Phase 3 expansion region — reached east through the Rootward causeway.
    saltblackReach,
  ],
};

export default act1;
