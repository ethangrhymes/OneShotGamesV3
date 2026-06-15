/**
 * rootwardRoad.ts — Round 2 region: "The Rootward Road".
 *
 * The first step beyond the Keep: an overground cursed road built with Kenney
 * Tiny Town (same 16x16 scale as Tiny Dungeon, so collision/combat read the
 * same). Story justifies the visual shift — the Keep's curse "takes root" along
 * an old bell road, swallowing a hamlet and choking a stone causeway. Reached by
 * walking through the summit world-gate after The Hollow Warden falls.
 *
 * Critical path (key-free, validator-checked):
 *   summit -> rr_gate(checkpoint) -> rr_road -> rr_hamlet -> rr_span(checkpoint)
 *          -> rr_causeway (Act II sealed gate = Round 2 endpoint)
 * Optional branches: rr_grove (off the road) and rr_barrow (elite, off hamlet).
 * Shortcut: a winch on the Broken Span raises a gate straight back to rr_gate.
 */
import type { RegionDef } from "../../game/types";

export const rootwardRoad: RegionDef = {
  id: "rootward_road",
  name: "The Rootward Road",
  theme: "cursed overground bell-road",
  accent: "#7fb86a",
  startRoomId: "rr_gate",
  startDoorId: "rr_gate_w",
  rooms: [
    // ----------------------------------------------------------- rr_gate
    {
      id: "rr_gate",
      name: "The Cinder Gate",
      subtitle: "The first link of the chain, broken.",
      gx: 0,
      gy: 1,
      floor: "grass",
      wall: "hedge",
      theme: "outdoor",
      isSafe: true,
      music: "region",
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
        { id: "rr_gate_w", tx: 0, ty: 4, edge: "w", to: "summit", toDoorId: "summit_gate", type: "open" },
        { id: "rr_gate_e", tx: 12, ty: 4, edge: "e", to: "rr_road", toDoorId: "rr_road_w", type: "open" },
        {
          id: "rr_gate_sc",
          tx: 12, ty: 6,
          edge: "e",
          to: "rr_span",
          toDoorId: "rr_span_sc",
          type: "shortcut",
          flag: "road_shortcut",
          lockedHint: "A barred winch-gate. It can only be raised from the far span.",
        },
      ],
      spawns: [
        { kind: "checkpoint", tx: 6, ty: 4, uid: "cp_road_gate", ref: "Cindergate Lantern" },
        { kind: "lore", tx: 3, ty: 2, ref: "l_road_gate", prop: "sign" },
        { kind: "prop", tx: 2, ty: 1, prop: "tree" },
        { kind: "prop", tx: 10, ty: 1, prop: "tree" },
        { kind: "prop", tx: 2, ty: 7, prop: "torch", solid: false },
        { kind: "prop", tx: 10, ty: 7, prop: "mushroom", solid: false },
      ],
    },

    // ----------------------------------------------------------- rr_road
    {
      id: "rr_road",
      name: "The Dead Road",
      subtitle: "The bells went quiet, one by one.",
      gx: 1,
      gy: 1,
      floor: "grass",
      wall: "hedge",
      theme: "outdoor",
      music: "region",
      layout: [
        "#############",
        "#...........#",
        "#..=.....=..#",
        "#...........#",
        "#,,,,,,,,,,,#",
        "#...........#",
        "#..=.....=..#",
        "#...........#",
        "#############",
      ],
      doors: [
        { id: "rr_road_w", tx: 0, ty: 4, edge: "w", to: "rr_gate", toDoorId: "rr_gate_e", type: "open" },
        { id: "rr_road_e", tx: 12, ty: 4, edge: "e", to: "rr_hamlet", toDoorId: "rr_hamlet_w", type: "open" },
        { id: "rr_road_s", tx: 6, ty: 8, edge: "s", to: "rr_grove", toDoorId: "rr_grove_n", type: "open" },
      ],
      spawns: [
        { kind: "enemy", tx: 4, ty: 3, ref: "husk" },
        { kind: "enemy", tx: 8, ty: 5, ref: "roadKnight" },
        { kind: "lore", tx: 3, ty: 1, ref: "l_road_dead", prop: "sign" },
        { kind: "pickup", tx: 10, ty: 1, pickup: "ember", amount: 6, uid: "em_road" },
      ],
    },

    // ----------------------------------------------------------- rr_grove (branch)
    {
      id: "rr_grove",
      name: "Blackroot Grove",
      subtitle: "They remember the shape of sleepers.",
      gx: 1,
      gy: 2,
      floor: "grass",
      wall: "hedge",
      theme: "outdoor",
      music: "region",
      layout: [
        "#############",
        "#...........#",
        "#.=.~.=.~.=.#",
        "#...........#",
        "#.~.=...=.~.#",
        "#...........#",
        "#.=.~.=.~.=.#",
        "#...........#",
        "#############",
      ],
      doors: [{ id: "rr_grove_n", tx: 6, ty: 0, edge: "n", to: "rr_road", toDoorId: "rr_road_s", type: "open" }],
      spawns: [
        { kind: "enemy", tx: 6, ty: 1, ref: "thornCaster" },
        { kind: "enemy", tx: 3, ty: 5, ref: "husk" },
        { kind: "lore", tx: 9, ty: 7, ref: "l_grove", prop: "sign" },
        { kind: "pickup", tx: 6, ty: 5, pickup: "token", uid: "token_grove" },
        { kind: "pickup", tx: 2, ty: 1, pickup: "potion", uid: "potion_grove" },
      ],
    },

    // ----------------------------------------------------------- rr_hamlet
    {
      id: "rr_hamlet",
      name: "Swallowed Hamlet",
      subtitle: "The road grew into our doors.",
      gx: 2,
      gy: 1,
      floor: "grass",
      wall: "townstone",
      theme: "outdoor",
      music: "region",
      layout: [
        "#############",
        "#...........#",
        "#.,,,...,,,.#",
        "#.,.........#",
        "#...........#",
        "#.........,.#",
        "#.,,,...,,,.#",
        "#...........#",
        "#############",
      ],
      doors: [
        { id: "rr_hamlet_w", tx: 0, ty: 4, edge: "w", to: "rr_road", toDoorId: "rr_road_e", type: "open" },
        { id: "rr_hamlet_e", tx: 12, ty: 4, edge: "e", to: "rr_span", toDoorId: "rr_span_w", type: "open" },
        { id: "rr_hamlet_n", tx: 6, ty: 0, edge: "n", to: "rr_barrow", toDoorId: "rr_barrow_s", type: "open" },
      ],
      spawns: [
        { kind: "enemy", tx: 4, ty: 3, ref: "thornCaster" },
        { kind: "enemy", tx: 8, ty: 5, ref: "husk" },
        { kind: "enemy", tx: 9, ty: 3, ref: "huskling" },
        { kind: "lore", tx: 3, ty: 1, ref: "l_hamlet", prop: "sign" },
        { kind: "chest", tx: 10, ty: 2, uid: "chest_hamlet", contains: { embers: 22 } },
        { kind: "pickup", tx: 3, ty: 6, pickup: "token", uid: "token_hamlet" },
        { kind: "prop", tx: 6, ty: 4, prop: "well" },
        { kind: "prop", tx: 2, ty: 4, prop: "stall" },
        { kind: "prop", tx: 10, ty: 6, prop: "barrel" },
      ],
    },

    // ----------------------------------------------------------- rr_barrow (elite branch)
    {
      id: "rr_barrow",
      name: "The Outer Barrow",
      subtitle: "It still guards. It has forgotten why.",
      gx: 2,
      gy: 0,
      floor: "grass",
      wall: "townstone",
      theme: "outdoor",
      music: "region",
      layout: [
        "#############",
        "#.=.......=.#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#.=.......=.#",
        "#############",
      ],
      doors: [{ id: "rr_barrow_s", tx: 6, ty: 8, edge: "s", to: "rr_hamlet", toDoorId: "rr_hamlet_n", type: "open" }],
      spawns: [
        { kind: "enemy", tx: 6, ty: 3, ref: "barrowChampion", uid: "elite_barrow", blockedByFlag: "optionalEliteDefeated" },
        { kind: "lore", tx: 2, ty: 5, ref: "l_barrow", prop: "sign" },
        { kind: "upgrade", tx: 6, ty: 1, ref: "emberHeart", uid: "up_emberheart" },
        { kind: "pickup", tx: 10, ty: 4, pickup: "token", uid: "token_barrow" },
        { kind: "prop", tx: 3, ty: 2, prop: "statue" },
        { kind: "prop", tx: 9, ty: 6, prop: "statue" },
      ],
    },

    // ----------------------------------------------------------- rr_span
    {
      id: "rr_span",
      name: "The Broken Span",
      subtitle: "Black water, and a winch long still.",
      gx: 3,
      gy: 1,
      floor: "path",
      wall: "hedge",
      theme: "outdoor",
      isSafe: true,
      music: "region",
      layout: [
        "#############",
        "#~~~~~~~~~~~#",
        "#...........#",
        "#,,,,,,,,,,,#",
        "#,,,,,,,,,,,#",
        "#...........#",
        "#~~~~~~~~~~~#",
        "#...........#",
        "#############",
      ],
      doors: [
        { id: "rr_span_w", tx: 0, ty: 4, edge: "w", to: "rr_hamlet", toDoorId: "rr_hamlet_e", type: "open" },
        { id: "rr_span_e", tx: 12, ty: 4, edge: "e", to: "rr_causeway", toDoorId: "rr_causeway_w", type: "open" },
        {
          id: "rr_span_sc",
          tx: 0, ty: 7,
          edge: "w",
          to: "rr_gate",
          toDoorId: "rr_gate_sc",
          type: "shortcut",
          flag: "road_shortcut",
          lockedHint: "A winch. Turn it to raise the gate back to the Cinder Gate.",
        },
      ],
      spawns: [
        { kind: "checkpoint", tx: 6, ty: 3, uid: "cp_road_span", ref: "Spanward Lantern" },
        { kind: "enemy", tx: 9, ty: 4, ref: "husk" },
        { kind: "lever", tx: 3, ty: 7, uid: "lever_road", setsFlag: "road_shortcut", ref: "Raise the Cindergate Winch" },
        { kind: "prop", tx: 9, ty: 7, prop: "barrel" },
      ],
    },

    // ----------------------------------------------------------- rr_causeway (endpoint)
    {
      id: "rr_causeway",
      name: "The Sealed Causeway",
      subtitle: "The Keep was one wound. The world has many.",
      gx: 4,
      gy: 1,
      floor: "path",
      wall: "townstone",
      theme: "outdoor",
      music: "region",
      layout: [
        "#############",
        "#.=.......=.#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#############",
      ],
      doors: [{ id: "rr_causeway_w", tx: 0, ty: 4, edge: "w", to: "rr_span", toDoorId: "rr_span_e", type: "open" }],
      spawns: [
        // The sealed Act II gate — interacting with it ends Round 2.
        { kind: "prop", tx: 6, ty: 3, prop: "arch", solid: false, uid: "act2_gate" },
        { kind: "lore", tx: 3, ty: 6, ref: "l_causeway", prop: "sign" },
        { kind: "lore", tx: 9, ty: 6, ref: "l_bell", prop: "sign" },
        { kind: "prop", tx: 3, ty: 2, prop: "tree" },
        { kind: "prop", tx: 9, ty: 2, prop: "tree" },
      ],
    },
  ],
};

export default rootwardRoad;
