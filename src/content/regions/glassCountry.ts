/**
 * glassCountry.ts — Phase 4 region: "The Glass Country".
 *
 * Past the Drowned Toll-Gate the road climbs out of black water into blinding
 * light: a fractured country of crystal, mirrored gates and a buried sun, where
 * the curse stops rotting the world and starts refracting it. Bright Tiny Ski
 * terrain (sk_* — snow/ice as glass ground) with crystals, crystal gates, mirror
 * portals, a buried sun and shard-floor hazards drawn procedurally on top.
 *
 * NEW MECHANIC — Crystal switches + Mirror gates:
 *   - A crystal SWITCH is a `lever` whose `setsFlag` is `crystal_<colour>_lit`;
 *     it renders as a faceted gem and, when pulled, opens every `crystalGate`
 *     door sharing that flag (World.isDoorOpen). The RED gate is on the critical
 *     path (taught in the Prism Road); the GOLD gate guards optional loot.
 *   - A MIRROR gate (`type: "mirror"`) is a teleport door that wakes only once
 *     the Crystal Shard is held (World.isDoorOpen → run.crystalShard). One mirror
 *     gates the run forward to the Buried Sun; another is a shortcut back to the
 *     hub; a third hides a secret reflection room.
 *   - Shard Floor: `~` tiles render as cracked glass in the glass theme and bite
 *     on a telegraphed pulse (the region hazard).
 *
 * Critical path (validator-checked):
 *   sr_drowngate -> gc_threshold(checkpoint) -> gc_prismroad -[red crystalGate]->
 *   gc_sundial(hub) -> gc_lensworks(CRYSTAL SHARD, ford/​mirror-free) -> back to
 *   gc_sundial -> gc_mirrorfield -> gc_refraction_hall -[mirror]-> gc_buriedsun
 *   (checkpoint) -> gc_glasswarden(miniboss: The Glass Warden => Glass Heart) ->
 *   gc_sungate(endpoint).
 * The Crystal Shard is reachable using only open/crystalGate doors (never a
 * mirror), so it is never gated behind itself. Off-path: gc_shardmarket,
 * gc_splintervault (gold crystalGate) and gc_hidden_reflection (secret mirror).
 */
import type { RegionDef } from "../../game/types";

export const glassCountry: RegionDef = {
  id: "glass_country",
  name: "The Glass Country",
  theme: "a bright refracted crystal land",
  accent: "#7fd6ff",
  startRoomId: "gc_threshold",
  startDoorId: "gc_threshold_w",
  rooms: [
    // ----------------------------------------------------------- gc_threshold
    {
      id: "gc_threshold",
      name: "The White Threshold",
      subtitle: "Here the curse stops rotting, and starts refracting.",
      gx: 0,
      gy: 1,
      floor: "glass",
      wall: "glass",
      theme: "glass",
      isSafe: true,
      music: "glass",
      layout: [
        "#############",
        "#...........#",
        "#...,,,,,...#",
        "#...,,,,,...#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#############",
      ],
      doors: [
        { id: "gc_threshold_w", tx: 0, ty: 4, edge: "w", to: "sr_drowngate", toDoorId: "sr_drowngate_e", type: "open" },
        { id: "gc_threshold_e", tx: 12, ty: 4, edge: "e", to: "gc_prismroad", toDoorId: "gc_prismroad_w", type: "open" },
      ],
      spawns: [
        { kind: "checkpoint", tx: 6, ty: 3, uid: "cp_gc_threshold", ref: "Prism Lantern" },
        { kind: "lore", tx: 3, ty: 2, ref: "l_gc_threshold", prop: "sign" },
        { kind: "prop", tx: 2, ty: 6, prop: "crystal" },
        { kind: "prop", tx: 10, ty: 6, prop: "crystal" },
        { kind: "prop", tx: 10, ty: 2, prop: "pylon" },
      ],
    },

    // ----------------------------------------------------------- gc_prismroad
    {
      id: "gc_prismroad",
      name: "The Prism Road",
      subtitle: "Strike a sleeping crystal; what it wakes, it opens.",
      gx: 1,
      gy: 1,
      floor: "glass",
      wall: "glass",
      theme: "glass",
      music: "glass",
      layout: [
        "#############",
        "#...........#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#...........#",
        "######.######",
      ],
      doors: [
        { id: "gc_prismroad_w", tx: 0, ty: 4, edge: "w", to: "gc_threshold", toDoorId: "gc_threshold_e", type: "open" },
        {
          id: "gc_prismroad_e",
          tx: 12, ty: 4,
          edge: "e",
          to: "gc_sundial",
          toDoorId: "gc_sundial_w",
          type: "crystalGate",
          flag: "crystal_red_lit",
          lockedHint: "A red crystal gate. Light a red crystal to open it.",
        },
        { id: "gc_prismroad_s", tx: 6, ty: 8, edge: "s", to: "gc_shardmarket", toDoorId: "gc_shardmarket_n", type: "open" },
      ],
      spawns: [
        { kind: "enemy", tx: 4, ty: 4, ref: "glassMite" },
        { kind: "enemy", tx: 9, ty: 3, ref: "prismCaster" },
        { kind: "lever", tx: 3, ty: 2, uid: "lever_gc_red", setsFlag: "crystal_red_lit", ref: "Red Crystal" },
        { kind: "lore", tx: 9, ty: 6, ref: "l_gc_prismroad", prop: "sign" },
        { kind: "pickup", tx: 6, ty: 5, pickup: "ember", amount: 8, uid: "em_gc_prism" },
      ],
    },

    // ----------------------------------------------------------- gc_sundial (hub)
    {
      id: "gc_sundial",
      name: "Sundial Court",
      subtitle: "Trust the gates. Do not trust the mirrors. Not yet.",
      gx: 2,
      gy: 1,
      floor: "glass",
      wall: "glass",
      theme: "glass",
      music: "glass",
      layout: [
        "######.######",
        "#...........#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#...........#",
        "######.######",
      ],
      doors: [
        {
          id: "gc_sundial_w",
          tx: 0, ty: 4,
          edge: "w",
          to: "gc_prismroad",
          toDoorId: "gc_prismroad_e",
          type: "crystalGate",
          flag: "crystal_red_lit",
          lockedHint: "A red crystal gate.",
        },
        { id: "gc_sundial_mir", tx: 0, ty: 6, edge: "w", to: "gc_refraction_hall", toDoorId: "gc_refraction_hall_mir2", type: "mirror", lockedHint: "A dormant mirror. The Crystal Shard would wake it." },
        { id: "gc_sundial_n", tx: 6, ty: 0, edge: "n", to: "gc_lensworks", toDoorId: "gc_lensworks_s", type: "open" },
        { id: "gc_sundial_e", tx: 12, ty: 4, edge: "e", to: "gc_mirrorfield", toDoorId: "gc_mirrorfield_w", type: "open" },
        {
          id: "gc_sundial_s",
          tx: 6, ty: 8,
          edge: "s",
          to: "gc_splintervault",
          toDoorId: "gc_splintervault_n",
          type: "crystalGate",
          flag: "crystal_gold_lit",
          lockedHint: "A gold crystal gate. Light a gold crystal to open it.",
        },
      ],
      spawns: [
        { kind: "enemy", tx: 9, ty: 5, ref: "prismCaster" },
        { kind: "lever", tx: 3, ty: 4, uid: "lever_gc_gold", setsFlag: "crystal_gold_lit", ref: "Gold Crystal" },
        { kind: "lore", tx: 9, ty: 2, ref: "l_gc_sundial", prop: "sign" },
        { kind: "prop", tx: 6, ty: 4, prop: "pylon" },
      ],
    },

    // ----------------------------------------------------------- gc_lensworks (Crystal Shard)
    {
      id: "gc_lensworks",
      name: "The Lensworks",
      subtitle: "A fragment of the buried sun, cold enough to hold.",
      gx: 2,
      gy: 0,
      floor: "glass",
      wall: "glass",
      theme: "glass",
      music: "glass",
      layout: [
        "#############",
        "#...........#",
        "#..~..~..~..#",
        "#...........#",
        "#...........#",
        "#..~..~..~..#",
        "#...........#",
        "#...........#",
        "######.######",
      ],
      doors: [{ id: "gc_lensworks_s", tx: 6, ty: 8, edge: "s", to: "gc_sundial", toDoorId: "gc_sundial_n", type: "open" }],
      spawns: [
        // The Crystal Shard — reachable via open/crystalGate doors only (no mirror),
        // so the mirror mechanic is never gated behind itself.
        { kind: "upgrade", tx: 6, ty: 4, ref: "crystalShard", uid: "up_crystal_shard" },
        { kind: "enemy", tx: 3, ty: 3, ref: "prismCaster" },
        { kind: "enemy", tx: 9, ty: 6, ref: "glassMite" },
        { kind: "lore", tx: 9, ty: 1, ref: "l_gc_shard", prop: "sign" },
        { kind: "prop", tx: 2, ty: 7, prop: "crystal" },
        { kind: "prop", tx: 10, ty: 7, prop: "crystal" },
      ],
    },

    // ----------------------------------------------------------- gc_shardmarket (optional)
    {
      id: "gc_shardmarket",
      name: "The Shard Market",
      subtitle: "They traded in light here, and lost.",
      gx: 1,
      gy: 2,
      floor: "glass",
      wall: "glass",
      theme: "glass",
      music: "glass",
      layout: [
        "######.######",
        "#...........#",
        "#...........#",
        "#...........#",
        "#....,,,....#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#############",
      ],
      doors: [{ id: "gc_shardmarket_n", tx: 6, ty: 0, edge: "n", to: "gc_prismroad", toDoorId: "gc_prismroad_s", type: "open" }],
      spawns: [
        { kind: "enemy", tx: 9, ty: 6, ref: "echoHound" },
        { kind: "chest", tx: 6, ty: 4, uid: "chest_gc_market", contains: { embers: 28 } },
        { kind: "pickup", tx: 3, ty: 4, pickup: "token", uid: "token_gc_market" },
        { kind: "pickup", tx: 9, ty: 4, pickup: "potion", uid: "potion_gc_market" },
        { kind: "lore", tx: 3, ty: 6, ref: "l_gc_mirror", prop: "sign" },
        { kind: "prop", tx: 2, ty: 2, prop: "crystal" },
      ],
    },

    // ----------------------------------------------------------- gc_mirrorfield
    {
      id: "gc_mirrorfield",
      name: "The Mirrorfield",
      subtitle: "A door that lies about where it leads.",
      gx: 3,
      gy: 1,
      floor: "glass",
      wall: "glass",
      theme: "glass",
      music: "glass",
      layout: [
        "######.######",
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
        { id: "gc_mirrorfield_w", tx: 0, ty: 4, edge: "w", to: "gc_sundial", toDoorId: "gc_sundial_e", type: "open" },
        { id: "gc_mirrorfield_e", tx: 12, ty: 4, edge: "e", to: "gc_refraction_hall", toDoorId: "gc_refraction_hall_w", type: "open" },
        { id: "gc_mirrorfield_mir", tx: 6, ty: 0, edge: "n", to: "gc_hidden_reflection", toDoorId: "gc_hidden_reflection_mir", type: "mirror", lockedHint: "A dormant mirror. The Crystal Shard would wake it." },
      ],
      spawns: [
        { kind: "enemy", tx: 4, ty: 3, ref: "echoHound" },
        { kind: "enemy", tx: 8, ty: 5, ref: "glassMite" },
        { kind: "enemy", tx: 8, ty: 3, ref: "glassMite" },
        { kind: "lore", tx: 2, ty: 6, ref: "l_gc_mirror", prop: "sign" },
        { kind: "prop", tx: 10, ty: 7, prop: "pylon" },
      ],
    },

    // ----------------------------------------------------------- gc_refraction_hall
    {
      id: "gc_refraction_hall",
      name: "Hall of Refraction",
      subtitle: "The way forward is through the glass. There is no other.",
      gx: 4,
      gy: 1,
      floor: "glass",
      wall: "glass",
      theme: "glass",
      music: "glass",
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
        { id: "gc_refraction_hall_w", tx: 0, ty: 4, edge: "w", to: "gc_mirrorfield", toDoorId: "gc_mirrorfield_e", type: "open" },
        { id: "gc_refraction_hall_mir", tx: 12, ty: 4, edge: "e", to: "gc_buriedsun", toDoorId: "gc_buriedsun_mir", type: "mirror", lockedHint: "A dormant mirror. Only the Crystal Shard can wake the true way forward." },
        { id: "gc_refraction_hall_mir2", tx: 0, ty: 6, edge: "w", to: "gc_sundial", toDoorId: "gc_sundial_mir", type: "mirror", lockedHint: "A dormant mirror — a way back to the court." },
      ],
      spawns: [
        { kind: "enemy", tx: 6, ty: 4, ref: "shardSentinel" },
        { kind: "enemy", tx: 9, ty: 2, ref: "prismCaster" },
        { kind: "lore", tx: 3, ty: 2, ref: "l_gc_refraction", prop: "sign" },
        { kind: "prop", tx: 6, ty: 7, prop: "crystal" },
      ],
    },

    // ----------------------------------------------------------- gc_hidden_reflection (secret)
    {
      id: "gc_hidden_reflection",
      name: "The Hidden Reflection",
      subtitle: "A room that was never built — only reflected.",
      gx: 3,
      gy: 0,
      floor: "glass",
      wall: "glass",
      theme: "glass",
      music: "glass",
      layout: [
        "#############",
        "#...........#",
        "#...........#",
        "#....,,,....#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#...........#",
        "######.######",
      ],
      doors: [{ id: "gc_hidden_reflection_mir", tx: 6, ty: 8, edge: "s", to: "gc_mirrorfield", toDoorId: "gc_mirrorfield_mir", type: "mirror" }],
      spawns: [
        { kind: "chest", tx: 6, ty: 3, uid: "chest_gc_hidden", contains: { embers: 40, hearts: 1 } },
        { kind: "pickup", tx: 3, ty: 3, pickup: "token", uid: "token_gc_hidden" },
        { kind: "prop", tx: 2, ty: 6, prop: "crystal" },
        { kind: "prop", tx: 10, ty: 6, prop: "crystal" },
        { kind: "prop", tx: 6, ty: 5, prop: "sunstone" },
      ],
    },

    // ----------------------------------------------------------- gc_splintervault (optional, gold gate)
    {
      id: "gc_splintervault",
      name: "The Splinter Vault",
      subtitle: "Behind gold glass, a hoard of cold light.",
      gx: 2,
      gy: 2,
      floor: "glass",
      wall: "glass",
      theme: "glass",
      music: "glass",
      layout: [
        "######.######",
        "#...........#",
        "#...........#",
        "#....,,,....#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#############",
      ],
      doors: [
        {
          id: "gc_splintervault_n",
          tx: 6, ty: 0,
          edge: "n",
          to: "gc_sundial",
          toDoorId: "gc_sundial_s",
          type: "crystalGate",
          flag: "crystal_gold_lit",
          lockedHint: "A gold crystal gate.",
        },
      ],
      spawns: [
        { kind: "enemy", tx: 9, ty: 6, ref: "shardSentinel" },
        { kind: "chest", tx: 6, ty: 3, uid: "chest_gc_vault", contains: { embers: 30, hearts: 1 } },
        { kind: "pickup", tx: 3, ty: 5, pickup: "potion", uid: "potion_gc_vault" },
        { kind: "lore", tx: 9, ty: 2, ref: "l_glass_warden", prop: "sign" },
        { kind: "prop", tx: 2, ty: 2, prop: "crystal" },
      ],
    },

    // ----------------------------------------------------------- gc_buriedsun (checkpoint, via mirror)
    {
      id: "gc_buriedsun",
      name: "The Buried Sun",
      subtitle: "They buried a sun here, to keep the country lit.",
      gx: 5,
      gy: 1,
      floor: "glass",
      wall: "glass",
      theme: "glass",
      isSafe: true,
      music: "glass",
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
        { id: "gc_buriedsun_mir", tx: 0, ty: 4, edge: "w", to: "gc_refraction_hall", toDoorId: "gc_refraction_hall_mir", type: "mirror", lockedHint: "A mirror back into the hall." },
        { id: "gc_buriedsun_e", tx: 12, ty: 4, edge: "e", to: "gc_glasswarden", toDoorId: "gc_glasswarden_w", type: "open" },
      ],
      spawns: [
        { kind: "checkpoint", tx: 6, ty: 5, uid: "cp_gc_buriedsun", ref: "Sunward Lantern" },
        { kind: "prop", tx: 6, ty: 2, prop: "sunstone" },
        { kind: "lore", tx: 3, ty: 6, ref: "l_gc_buriedsun", prop: "sign" },
        { kind: "prop", tx: 2, ty: 3, prop: "crystal" },
        { kind: "prop", tx: 10, ty: 3, prop: "crystal" },
      ],
    },

    // ----------------------------------------------------------- gc_glasswarden (MINIBOSS)
    {
      id: "gc_glasswarden",
      name: "The Glass Warden's Chapel",
      subtitle: "It will wear your shape, and your reflection's.",
      gx: 6,
      gy: 1,
      floor: "glass",
      wall: "glass",
      theme: "glass",
      music: "glass",
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
        { id: "gc_glasswarden_w", tx: 0, ty: 5, edge: "w", to: "gc_buriedsun", toDoorId: "gc_buriedsun_e", type: "open" },
        { id: "gc_glasswarden_e", tx: 14, ty: 5, edge: "e", to: "gc_sungate", toDoorId: "gc_sungate_w", type: "open" },
      ],
      spawns: [
        { kind: "miniboss", tx: 7, ty: 5, ref: "glassWarden", uid: "miniboss_glass_warden", blockedByFlag: "glassWardenDefeated" },
        { kind: "prop", tx: 2, ty: 2, prop: "pylon" },
        { kind: "prop", tx: 12, ty: 2, prop: "pylon" },
        { kind: "prop", tx: 2, ty: 9, prop: "crystal" },
        { kind: "prop", tx: 12, ty: 9, prop: "crystal" },
      ],
    },

    // ----------------------------------------------------------- gc_sungate (endpoint)
    {
      id: "gc_sungate",
      name: "The Sun-Gate",
      subtitle: "The buried sun lights the gate, and the gate opens onward.",
      gx: 7,
      gy: 1,
      floor: "glass",
      wall: "glass",
      theme: "glass",
      music: "glass",
      layout: [
        "#############",
        "#...........#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#...........#",
        "#....,,,....#",
        "#...........#",
        "#############",
      ],
      doors: [{ id: "gc_sungate_w", tx: 0, ty: 4, edge: "w", to: "gc_glasswarden", toDoorId: "gc_glasswarden_e", type: "open" }],
      spawns: [
        // The Sun-Gate — interacting completes Phase 4 and teases the next segment.
        { kind: "prop", tx: 6, ty: 4, prop: "arch", solid: false, uid: "sun_gate" },
        { kind: "prop", tx: 6, ty: 2, prop: "sunstone" },
        { kind: "lore", tx: 3, ty: 6, ref: "l_gc_sungate", prop: "sign" },
        { kind: "prop", tx: 2, ty: 2, prop: "pylon" },
        { kind: "prop", tx: 10, ty: 2, prop: "pylon" },
      ],
    },
  ],
};

export default glassCountry;
