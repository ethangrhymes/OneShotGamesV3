/**
 * saltblackReach.ts — Phase 3 region: "The Saltblack Reach".
 *
 * Beyond the Rootward Road's sealed causeway the cursed road drowns: a coast
 * where an ancient war sank mid-stride and never finished falling. Built with
 * Kenney Tiny Battle (same 16x16 scale as Tiny Dungeon/Town, so collision and
 * combat read identically) — water, coasts, bridges, ruined keeps, drowned
 * banners and beached ships give a distinct tidal-battlefield identity. Reached
 * by walking east through the causeway after the Rootward Road.
 *
 * NEW MECHANIC — the Tide:
 *   'W' deep water  = always solid (borders / moats / gulfs).
 *   'w' shallow tide = solid UNTIL the player holds the Tide Relic, then it
 *                      becomes fordable. (See Dungeon.makeCell / Room.unlockTide.)
 *   'B' bridge       = always walkable planks spanning water.
 * Every shallow ford gates ONLY optional dead-ends or a redundant alt-route —
 * never the critical path, which crosses on bridges/open doors. The Tide Relic
 * itself is reachable WITHOUT any ford (the Tide Shrine, north off the strand),
 * so the mechanic is never gated behind itself. The Validator proves both:
 *  (A) every spawn is reachable WITH fording, and
 *  (B) every door is reachable WITHOUT it (no soft-lock).
 *
 * Critical path (key-free, ford-free, validator-checked):
 *   causeway -> sr_landing(checkpoint) -> sr_strand -> sr_spans(bridge)
 *            -> sr_lowtide -> sr_lantern(checkpoint) -> sr_tollworks(miniboss:
 *               The Drowned Gear => Brine Heart) -> sr_drowngate (endpoint).
 * Off-path: sr_tideshrine (Tide Relic, north of strand, ford-free),
 *           sr_wreck (ford branch off strand) and sr_reef (ford branch off the
 *           muster). Shortcut: a tide-gate winch in the muster raises a gate
 *           straight back to the Saltstair.
 */
import type { RegionDef } from "../../game/types";

export const saltblackReach: RegionDef = {
  id: "saltblack_reach",
  name: "The Saltblack Reach",
  theme: "a drowned war-coast",
  accent: "#46b4c8",
  startRoomId: "sr_landing",
  startDoorId: "sr_landing_w",
  rooms: [
    // ----------------------------------------------------------- sr_landing
    {
      id: "sr_landing",
      name: "The Saltstair",
      subtitle: "The road did not end. It drowned.",
      gx: 0,
      gy: 1,
      floor: "stone",
      wall: "stone",
      theme: "outdoor",
      isSafe: true,
      music: "reach",
      layout: [
        "#############",
        "#...........#",
        "#....,,,....#",
        "#....,,,....#",
        "#...........#",
        "#...........#",
        "#..WWWWWWW..#",
        "#...........#",
        "#############",
      ],
      doors: [
        { id: "sr_landing_w", tx: 0, ty: 4, edge: "w", to: "rr_causeway", toDoorId: "rr_causeway_e", type: "open" },
        { id: "sr_landing_e", tx: 12, ty: 4, edge: "e", to: "sr_strand", toDoorId: "sr_strand_w", type: "open" },
        {
          id: "sr_landing_sc",
          tx: 12, ty: 6,
          edge: "e",
          to: "sr_lowtide",
          toDoorId: "sr_lowtide_sc",
          type: "shortcut",
          flag: "reach_shortcut",
          lockedHint: "A barred tide-gate winch. It raises only from the muster beyond.",
        },
      ],
      spawns: [
        { kind: "checkpoint", tx: 6, ty: 4, uid: "cp_reach_landing", ref: "Saltstair Lantern" },
        { kind: "lore", tx: 3, ty: 2, ref: "l_reach_landing", prop: "sign" },
        { kind: "prop", tx: 2, ty: 2, prop: "flag", solid: false },
        { kind: "prop", tx: 10, ty: 2, prop: "dune" },
        { kind: "prop", tx: 2, ty: 7, prop: "warcross", solid: false },
      ],
    },

    // ----------------------------------------------------------- sr_strand
    {
      id: "sr_strand",
      name: "The Black Strand",
      subtitle: "Two banners, on poles no living hand has held.",
      gx: 1,
      gy: 1,
      floor: "saltgrass",
      wall: "stone",
      theme: "outdoor",
      music: "reach",
      layout: [
        "######.######",
        "#W.........W#",
        "#...........#",
        "#..,.....,..#",
        "#...........#",
        "#..,.....,..#",
        "#...........#",
        "#W.........W#",
        "######.######",
      ],
      doors: [
        { id: "sr_strand_w", tx: 0, ty: 4, edge: "w", to: "sr_landing", toDoorId: "sr_landing_e", type: "open" },
        { id: "sr_strand_e", tx: 12, ty: 4, edge: "e", to: "sr_spans", toDoorId: "sr_spans_w", type: "open" },
        { id: "sr_strand_n", tx: 6, ty: 0, edge: "n", to: "sr_tideshrine", toDoorId: "sr_tideshrine_s", type: "open" },
        { id: "sr_strand_s", tx: 6, ty: 8, edge: "s", to: "sr_wreck", toDoorId: "sr_wreck_n", type: "open" },
      ],
      spawns: [
        { kind: "enemy", tx: 4, ty: 4, ref: "drownedKnight" },
        { kind: "enemy", tx: 9, ty: 2, ref: "tideArcher" },
        { kind: "enemy", tx: 3, ty: 6, ref: "mireCrawler" },
        { kind: "lore", tx: 2, ty: 2, ref: "l_strand", prop: "sign" },
        { kind: "pickup", tx: 9, ty: 6, pickup: "ember", amount: 8, uid: "em_strand" },
        { kind: "prop", tx: 6, ty: 3, prop: "flag", solid: false },
      ],
    },

    // ----------------------------------------------------------- sr_tideshrine (Tide Relic)
    {
      id: "sr_tideshrine",
      name: "The Tide Shrine",
      subtitle: "The drowned king's signet. The shallows part.",
      gx: 1,
      gy: 0,
      floor: "stone",
      wall: "stone",
      theme: "outdoor",
      music: "reach",
      layout: [
        "#############",
        "#W.........W#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#W.........W#",
        "######.######",
      ],
      doors: [{ id: "sr_tideshrine_s", tx: 6, ty: 8, edge: "s", to: "sr_strand", toDoorId: "sr_strand_n", type: "open" }],
      spawns: [
        // The Tide Relic — reachable WITHOUT any ford, so the mechanic is never gated behind itself.
        { kind: "upgrade", tx: 6, ty: 4, ref: "tideRelic", uid: "up_tide_relic" },
        { kind: "lore", tx: 3, ty: 6, ref: "l_tideshrine", prop: "sign" },
        { kind: "prop", tx: 6, ty: 2, prop: "tower" },
        { kind: "prop", tx: 3, ty: 2, prop: "flag", solid: false },
        { kind: "prop", tx: 9, ty: 2, prop: "flag", solid: false },
      ],
    },

    // ----------------------------------------------------------- sr_wreck (ford branch)
    {
      id: "sr_wreck",
      name: "The Beached Hulk",
      subtitle: "They ran her aground to make a wall of her.",
      gx: 1,
      gy: 2,
      floor: "saltgrass",
      wall: "stone",
      theme: "outdoor",
      music: "reach",
      layout: [
        "######.######",
        "#...........#",
        "#...........#",
        "#wwwwwwwwwww#",
        "#...........#",
        "#....,,,....#",
        "#...........#",
        "#...........#",
        "#############",
      ],
      doors: [{ id: "sr_wreck_n", tx: 6, ty: 0, edge: "n", to: "sr_strand", toDoorId: "sr_strand_s", type: "open" }],
      spawns: [
        // Loot is across a shallow ford — fordable only once the Tide Relic is held.
        { kind: "enemy", tx: 9, ty: 5, ref: "drownedKnight" },
        { kind: "chest", tx: 6, ty: 5, uid: "chest_wreck", contains: { embers: 30 } },
        { kind: "pickup", tx: 6, ty: 7, pickup: "token", uid: "token_wreck" },
        { kind: "lore", tx: 9, ty: 6, ref: "l_wreck", prop: "sign" },
        { kind: "prop", tx: 3, ty: 6, prop: "ship" },
      ],
    },

    // ----------------------------------------------------------- sr_spans (bridge crossing)
    {
      id: "sr_spans",
      name: "The Broken Spans",
      subtitle: "Cross high, or ford low. Either way, cross fast.",
      gx: 2,
      gy: 1,
      floor: "stone",
      wall: "stone",
      theme: "outdoor",
      music: "reach",
      layout: [
        "#############",
        "#....WWW....#",
        "#....WWW....#",
        "#....WWW....#",
        "#....BBB....#",
        "#....WWW....#",
        "#....www....#",
        "#....WWW....#",
        "#############",
      ],
      doors: [
        { id: "sr_spans_w", tx: 0, ty: 4, edge: "w", to: "sr_strand", toDoorId: "sr_strand_e", type: "open" },
        { id: "sr_spans_e", tx: 12, ty: 4, edge: "e", to: "sr_lowtide", toDoorId: "sr_lowtide_w", type: "open" },
      ],
      spawns: [
        // The bridge (row 4) is the always-open critical crossing; the shallow ford
        // (row 6) is a relic-only alternate. Turret fires across the gulf.
        { kind: "enemy", tx: 9, ty: 2, ref: "gearTurret" },
        { kind: "enemy", tx: 3, ty: 6, ref: "tideArcher" },
        { kind: "lore", tx: 2, ty: 2, ref: "l_spans", prop: "sign" },
        { kind: "pickup", tx: 10, ty: 6, pickup: "ember", amount: 6, uid: "em_spans" },
      ],
    },

    // ----------------------------------------------------------- sr_lowtide (hub + shortcut lever)
    {
      id: "sr_lowtide",
      name: "Lowtide Muster",
      subtitle: "Read the muster in the rust: who never stood again.",
      gx: 3,
      gy: 1,
      floor: "saltgrass",
      wall: "stone",
      theme: "outdoor",
      music: "reach",
      layout: [
        "#############",
        "#...........#",
        "#..,,...,,..#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#..,,...,,..#",
        "#...........#",
        "######.######",
      ],
      doors: [
        { id: "sr_lowtide_w", tx: 0, ty: 4, edge: "w", to: "sr_spans", toDoorId: "sr_spans_e", type: "open" },
        { id: "sr_lowtide_e", tx: 12, ty: 4, edge: "e", to: "sr_lantern", toDoorId: "sr_lantern_w", type: "open" },
        { id: "sr_lowtide_s", tx: 6, ty: 8, edge: "s", to: "sr_reef", toDoorId: "sr_reef_n", type: "open" },
        {
          id: "sr_lowtide_sc",
          tx: 0, ty: 6,
          edge: "w",
          to: "sr_landing",
          toDoorId: "sr_landing_sc",
          type: "shortcut",
          flag: "reach_shortcut",
          lockedHint: "A winch for the tide-gate. Turn it to raise the gate back to the Saltstair.",
        },
      ],
      spawns: [
        { kind: "enemy", tx: 4, ty: 4, ref: "drownedKnight" },
        { kind: "enemy", tx: 9, ty: 2, ref: "gearTurret" },
        { kind: "enemy", tx: 3, ty: 6, ref: "mireCrawler" },
        { kind: "lever", tx: 6, ty: 4, uid: "lever_reach", setsFlag: "reach_shortcut", ref: "Raise the Tide-Gate Winch" },
        { kind: "lore", tx: 2, ty: 2, ref: "l_lowtide", prop: "sign" },
        { kind: "prop", tx: 10, ty: 7, prop: "tower" },
      ],
    },

    // ----------------------------------------------------------- sr_reef (ford branch)
    {
      id: "sr_reef",
      name: "The Saltblack Reef",
      subtitle: "The tide makes neighbors of enemies.",
      gx: 3,
      gy: 2,
      floor: "saltgrass",
      wall: "stone",
      theme: "outdoor",
      music: "reach",
      layout: [
        "######.######",
        "#...........#",
        "#...........#",
        "#wwwwwwwwwww#",
        "#...........#",
        "#....,,,....#",
        "#...........#",
        "#...........#",
        "#############",
      ],
      doors: [{ id: "sr_reef_n", tx: 6, ty: 0, edge: "n", to: "sr_lowtide", toDoorId: "sr_lowtide_s", type: "open" }],
      spawns: [
        { kind: "enemy", tx: 3, ty: 5, ref: "tideArcher" },
        { kind: "chest", tx: 6, ty: 5, uid: "chest_reef", contains: { embers: 24 } },
        { kind: "pickup", tx: 9, ty: 6, pickup: "token", uid: "token_reef" },
        { kind: "pickup", tx: 3, ty: 6, pickup: "potion", uid: "potion_reef" },
        { kind: "prop", tx: 6, ty: 7, prop: "warcross", solid: false },
        { kind: "prop", tx: 9, ty: 4, prop: "dune" },
      ],
    },

    // ----------------------------------------------------------- sr_lantern (checkpoint)
    {
      id: "sr_lantern",
      name: "The Tideward Lantern",
      subtitle: "A kindness the war never offered.",
      gx: 4,
      gy: 1,
      floor: "stone",
      wall: "stone",
      theme: "outdoor",
      isSafe: true,
      music: "reach",
      layout: [
        "#############",
        "#...........#",
        "#...,,,,,...#",
        "#...,...,...#",
        "#...,...,...#",
        "#...,...,...#",
        "#...........#",
        "#..WWWWWWW..#",
        "#############",
      ],
      doors: [
        { id: "sr_lantern_w", tx: 0, ty: 4, edge: "w", to: "sr_lowtide", toDoorId: "sr_lowtide_e", type: "open" },
        { id: "sr_lantern_e", tx: 12, ty: 4, edge: "e", to: "sr_tollworks", toDoorId: "sr_tollworks_w", type: "open" },
      ],
      spawns: [
        { kind: "checkpoint", tx: 6, ty: 4, uid: "cp_reach_lantern", ref: "Tideward Lantern" },
        { kind: "lore", tx: 3, ty: 6, ref: "l_drowned_gear", prop: "sign" },
        { kind: "prop", tx: 2, ty: 2, prop: "flag", solid: false },
        { kind: "prop", tx: 10, ty: 2, prop: "tower" },
      ],
    },

    // ----------------------------------------------------------- sr_tollworks (MINIBOSS)
    {
      id: "sr_tollworks",
      name: "The Tollworks",
      subtitle: "The toll was never coin.",
      gx: 5,
      gy: 1,
      floor: "stone",
      wall: "stone",
      theme: "outdoor",
      music: "reach",
      layout: [
        "###############",
        "#.............#",
        "#.............#",
        "#.............#",
        "#.............#",
        "#.............#",
        "#.............#",
        "#.............#",
        "#.............#",
        "#.............#",
        "###############",
      ],
      doors: [
        { id: "sr_tollworks_w", tx: 0, ty: 5, edge: "w", to: "sr_lantern", toDoorId: "sr_lantern_e", type: "open" },
        { id: "sr_tollworks_e", tx: 14, ty: 5, edge: "e", to: "sr_drowngate", toDoorId: "sr_drowngate_w", type: "open" },
      ],
      spawns: [
        { kind: "miniboss", tx: 7, ty: 5, ref: "drownedGear", uid: "miniboss_drowned_gear", blockedByFlag: "tollGearDefeated" },
        { kind: "prop", tx: 2, ty: 1, prop: "tower" },
        { kind: "prop", tx: 12, ty: 9, prop: "tower" },
        { kind: "prop", tx: 12, ty: 1, prop: "warcross", solid: false },
        { kind: "prop", tx: 2, ty: 9, prop: "warcross", solid: false },
      ],
    },

    // ----------------------------------------------------------- sr_drowngate (endpoint)
    {
      id: "sr_drowngate",
      name: "The Drowned Toll-Gate",
      subtitle: "The toll is paid. The road goes on.",
      gx: 6,
      gy: 1,
      floor: "stone",
      wall: "stone",
      theme: "outdoor",
      music: "reach",
      layout: [
        "#############",
        "#...........#",
        "#....WWW....#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#....,,,....#",
        "#...........#",
        "#############",
      ],
      doors: [
        { id: "sr_drowngate_w", tx: 0, ty: 4, edge: "w", to: "sr_tollworks", toDoorId: "sr_tollworks_e", type: "open" },
        // Phase 4: the toll-gate now opens east, climbing into the Glass Country.
        { id: "sr_drowngate_e", tx: 12, ty: 4, edge: "e", to: "gc_threshold", toDoorId: "gc_threshold_w", type: "open" },
      ],
      spawns: [
        // The deep-gate — its seal is broken; it now frames the way onward (decorative).
        { kind: "prop", tx: 6, ty: 3, prop: "arch", solid: false, uid: "world_gate5" },
        { kind: "lore", tx: 3, ty: 6, ref: "l_drowngate", prop: "sign" },
        { kind: "prop", tx: 3, ty: 2, prop: "tower" },
        { kind: "prop", tx: 9, ty: 2, prop: "tower" },
      ],
    },
  ],
};

export default saltblackReach;
