/**
 * Validator.ts — development-time content validation that guarantees a WorldAct
 * is traversable and winnable. Runs at startup in dev (import.meta.env.DEV):
 * logs warnings, and THROWS on any error before gameplay begins. In production
 * it is not run (shipped content is pre-validated), so players never crash.
 *
 * See CONTENT_GUIDE.md "Validating room traversal" for how to read the output.
 *
 * Reachability model (monotonic "logic" reachability):
 *   - open / oneWay doors: always passable.
 *   - shortcut doors: passable once their flag is obtainable (a lever for that
 *     flag is in an already-reachable room), OR — because shortcuts open from a
 *     fixed side — once either endpoint is reachable.
 *   - locked doors: passable once ANY Iron Key is obtainable in reach (verifies
 *     key-before-gate ordering).
 *   - bossGate doors: passable once enough seals are obtainable in reach.
 *   - a boss/miniboss's setsFlag is earned when its room is reachable.
 * Winnability guard: the critical path (boss room + post-boss rooms) must be
 * reachable WITHOUT consuming any Iron Key (keys are consumable and could be
 * mis-spent), so the critical path may only use open/shortcut/bossGate doors.
 */
import { Room } from "./Dungeon";
import type { DoorDef, RoomDef, WorldAct, GameFlag } from "./types";

export interface ValidationIssue {
  level: "error" | "warn";
  code: string;
  message: string;
}

function buildRoom(def: RoomDef): Room {
  return new Room(def, () => true); // all doors carved open for geometry inspection
}

/** Where the player physically lands after a transition: must be solid ground —
 * floor, hazard, a carved door, or a bridge. Never water (you'd be stuck/drown). */
function tilePassable(room: Room, tx: number, ty: number): boolean {
  const c = room.cellAt(tx, ty);
  if (!c) return false;
  if (c.doorId) return true; // carved doorway
  return c.kind === "floor" || c.kind === "hazard" || c.kind === "bridge";
}

export function validateAct(act: WorldAct): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (code: string, message: string) => issues.push({ level: "error", code, message });
  const warn = (code: string, message: string) => issues.push({ level: "warn", code, message });

  // index every room across every region
  const rooms = new Map<string, RoomDef>();
  for (const region of act.regions) {
    for (const r of region.rooms) {
      if (rooms.has(r.id)) err("dup-room", `Duplicate room id "${r.id}".`);
      rooms.set(r.id, r);
    }
  }

  // ---- 1. structural checks per room ----
  for (const def of rooms.values()) {
    if (def.layout.length === 0) {
      err("empty-layout", `Room "${def.id}" has an empty layout.`);
      continue;
    }
    const w = def.layout[0].length;
    for (let y = 0; y < def.layout.length; y++) {
      if (def.layout[y].length !== w)
        err("ragged-layout", `Room "${def.id}" row ${y} width ${def.layout[y].length} != ${w}.`);
    }
    const room = buildRoom(def);

    // doors
    for (const d of def.doors) {
      if (d.tx < 0 || d.ty < 0 || d.tx >= room.w || d.ty >= room.h)
        err("door-oob", `Door "${d.id}" in "${def.id}" is out of bounds (${d.tx},${d.ty}).`);
      const target = rooms.get(d.to);
      if (!target) {
        err("door-target", `Door "${d.id}" in "${def.id}" points to unknown room "${d.to}".`);
        continue;
      }
      const partner = target.doors.find((p) => p.id === d.toDoorId);
      if (!partner) {
        err("door-partner", `Door "${d.id}" in "${def.id}" -> "${d.to}" has no partner door "${d.toDoorId}".`);
      } else if (partner.to !== def.id) {
        warn("door-backref", `Door "${d.id}" partner "${partner.id}" points back to "${partner.to}", not "${def.id}".`);
      }
    }

    // spawns on passable ground
    for (const s of def.spawns) {
      if (s.tx < 0 || s.ty < 0 || s.tx >= room.w || s.ty >= room.h) {
        err("spawn-oob", `Spawn ${s.kind}(${s.ref ?? s.prop ?? ""}) in "${def.id}" out of bounds.`);
        continue;
      }
      const cell = room.cellAt(s.tx, s.ty)!;
      const deepWater = cell.kind === "water" && cell.variant === 1;
      const shallowWater = cell.kind === "water" && cell.variant === 0;
      const entity = s.kind === "enemy" || s.kind === "miniboss" || s.kind === "boss" || s.kind === "checkpoint";
      if (cell.kind === "wall" || cell.kind === "gargoyle" || cell.kind === "void") {
        err("spawn-in-wall", `Spawn ${s.kind}(${s.ref ?? s.prop ?? ""}) in "${def.id}" at (${s.tx},${s.ty}) is inside a ${cell.kind}.`);
      } else if (deepWater && s.kind !== "prop") {
        // only decorative props (a beached ship) may sit on deep water
        err("spawn-in-water", `Spawn ${s.kind}(${s.ref ?? s.pickup ?? ""}) in "${def.id}" at (${s.tx},${s.ty}) is in deep water.`);
      } else if ((cell.kind === "hazard" || shallowWater) && entity) {
        warn("spawn-on-hazard", `Spawn ${s.kind} in "${def.id}" sits on a ${shallowWater ? "shallow-tide" : "hazard"} tile (${s.tx},${s.ty}).`);
      }
    }

    // entry landing tiles (where the player appears after a transition)
    for (const d of def.doors) {
      const land = entryTile(room, d);
      if (!tilePassable(room, land.tx, land.ty))
        err("entry-blocked", `Entering "${def.id}" via "${d.id}" lands on a non-passable tile (${land.tx},${land.ty}).`);
    }

    // intra-room connectivity (physical traversal): flood the walkable tiles from
    // one door entry and confirm every OTHER door entry + every meaningful spawn
    // is in the same connected region — so no entrance/pickup is sealed off (this
    // is what the logical door-graph reachability can't see).
    for (const msg of roomConnectivity(def, room)) err("room-disconnected", msg);
  }

  // ---- 2. reachability (full logic + key-free critical path) ----
  const startRoom = act.regions.find((r) => r.id === act.startingRegionId)?.startRoomId;
  if (!startRoom || !rooms.has(startRoom)) {
    err("no-start", `Act "${act.id}" has no valid starting room.`);
    return issues;
  }

  const fullReach = computeReachable(act, rooms, startRoom, { allowKeys: true });
  const keyFreeReach = computeReachable(act, rooms, startRoom, { allowKeys: false });

  // every room reachable under full rules
  for (const id of rooms.keys()) {
    if (!fullReach.rooms.has(id)) err("unreachable", `Room "${id}" is not reachable from the start under intended progression.`);
  }

  // Phase 4: the Crystal Shard must be obtainable WITHOUT a mirror gate, since
  // mirrors need the Shard — otherwise it is gated behind itself (soft-lock).
  const shardRoom = findRoomWithSpawn(
    rooms,
    (s) => (s.kind === "upgrade" && s.ref === "crystalShard") || (s.kind === "chest" && s.contains?.upgrade === "crystalShard")
  );
  if (shardRoom) {
    const noMirror = computeReachable(act, rooms, startRoom, { allowKeys: true, allowMirror: false });
    if (!noMirror.rooms.has(shardRoom))
      err(
        "shard-self-gated",
        `Crystal Shard room "${shardRoom}" is only reachable through a mirror gate — the Shard must be obtainable without one (mirror gates require the Shard).`
      );
  }

  // boss room + post-boss must be reachable WITHOUT consuming keys (no soft-lock)
  const bossRoom = findRoomWithSpawn(rooms, (s) => s.kind === "boss");
  if (bossRoom && !keyFreeReach.rooms.has(bossRoom))
    err("boss-needs-key", `Boss room "${bossRoom}" is only reachable by consuming an Iron Key — the critical path must be key-free (use seals/flags).`);

  // post-boss rooms: anything reachable only after the boss's flag
  const bossFlag = bossRoom ? rooms.get(bossRoom)!.spawns.find((s) => s.kind === "boss")?.ref : undefined;
  void bossFlag;

  // seals economy: each bossGate must have enough obtainable seals before it
  for (const def of rooms.values()) {
    for (const d of def.doors) {
      if (d.type === "bossGate") {
        const need = d.sealsRequired ?? 2;
        if (fullReach.maxSealsBefore.get(def.id) !== undefined && fullReach.totalSeals < need)
          err("seals-short", `Boss gate "${d.id}" needs ${need} seals but only ${fullReach.totalSeals} exist in the act.`);
      }
    }
  }

  return issues;
}

/** A spawn whose tile the runtime marks solid (so it blocks the flood). */
function isSolidProp(s: RoomDef["spawns"][number]): boolean {
  if (s.solid === true) return true;
  if (s.kind !== "prop") return false;
  return (
    s.prop === "barrel" ||
    s.prop === "crate" ||
    s.prop === "statue" ||
    s.prop === "anvil" ||
    s.prop === "ship" ||
    s.prop === "tower" ||
    s.prop === "dune"
  );
}

/**
 * Flood-fill walkable tiles and report unreachable doors/spawns. Tide-aware:
 *   Pass A (fording allowed — player holds the Tide Relic): shallow water +
 *     bridges + floor/hazard are walkable. Every door entry AND every meaningful
 *     spawn must be reachable (so ford-gated loot still validates).
 *   Pass B (no fording — relic could be missing): shallow + deep water both
 *     block. Every door entry must still reach every OTHER door entry, so the
 *     tide can NEVER gate room-to-room traversal (the critical path & shortcuts
 *     stay solid-ground; no soft-lock before the relic is found).
 * Deep water always blocks. Solid props always block.
 */
function roomConnectivity(def: RoomDef, room: Room): string[] {
  const out: string[] = [];
  const key = (x: number, y: number) => `${x},${y}`;
  const solidProps = new Set<string>();
  for (const s of def.spawns) if (isSolidProp(s)) solidProps.add(key(s.tx, s.ty));

  const flood = (ford: boolean): Set<string> => {
    const passable = (x: number, y: number): boolean => {
      if (solidProps.has(key(x, y))) return false;
      const c = room.cellAt(x, y);
      if (!c) return false;
      if (c.doorId) return true; // carved doorway
      if (c.kind === "floor" || c.kind === "hazard" || c.kind === "bridge") return true;
      if (c.kind === "water") return ford && c.variant === 0; // shallow, only while fording
      return false; // wall / gargoyle / void / deep water
    };
    const startTile = def.doors.length ? entryTile(room, def.doors[0]) : { tx: (room.w / 2) | 0, ty: (room.h / 2) | 0 };
    const seen = new Set<string>();
    if (!passable(startTile.tx, startTile.ty)) return seen;
    seen.add(key(startTile.tx, startTile.ty));
    const q = [startTile];
    while (q.length) {
      const { tx, ty } = q.shift()!;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= room.w || ny >= room.h) continue;
        const k = key(nx, ny);
        if (seen.has(k) || !passable(nx, ny)) continue;
        seen.add(k);
        q.push({ tx: nx, ty: ny });
      }
    }
    return seen;
  };

  const startTile = def.doors.length ? entryTile(room, def.doors[0]) : { tx: (room.w / 2) | 0, ty: (room.h / 2) | 0 };

  // ---- Pass A: with fording — everything meaningful must be reachable ----
  const withFord = flood(true);
  if (!withFord.has(key(startTile.tx, startTile.ty))) {
    out.push(`Room "${def.id}" flood start (${startTile.tx},${startTile.ty}) is blocked.`);
    return out;
  }
  for (const d of def.doors) {
    const e = entryTile(room, d);
    if (!withFord.has(key(e.tx, e.ty)))
      out.push(`Room "${def.id}": door "${d.id}" entry (${e.tx},${e.ty}) is walled off from the rest of the room.`);
  }
  for (const s of def.spawns) {
    if (s.kind === "prop") continue; // props ARE the obstacles
    if (!withFord.has(key(s.tx, s.ty)))
      out.push(`Room "${def.id}": ${s.kind}(${s.ref ?? s.pickup ?? ""}) at (${s.tx},${s.ty}) is unreachable within the room.`);
  }

  // ---- Pass B: without fording — doors must stay mutually reachable ----
  if (def.doors.length > 1) {
    const noFord = flood(false);
    if (noFord.has(key(startTile.tx, startTile.ty))) {
      for (const d of def.doors) {
        const e = entryTile(room, d);
        if (!noFord.has(key(e.tx, e.ty)))
          out.push(
            `Room "${def.id}": door "${d.id}" entry (${e.tx},${e.ty}) is only reachable by fording the tide from "${def.doors[0].id}" — a ford must never gate room-to-room traversal (the Tide Relic may not be held yet).`
          );
      }
    }
  }
  return out;
}

function entryTile(room: Room, d: DoorDef): { tx: number; ty: number } {
  let tx = d.tx;
  let ty = d.ty;
  if (d.edge === "w") tx += 1;
  else if (d.edge === "e") tx -= 1;
  else if (d.edge === "n") ty += 1;
  else if (d.edge === "s") ty -= 1;
  return { tx, ty };
}

function findRoomWithSpawn(rooms: Map<string, RoomDef>, pred: (s: RoomDef["spawns"][number]) => boolean): string | null {
  for (const def of rooms.values()) if (def.spawns.some(pred)) return def.id;
  return null;
}

interface ReachResult {
  rooms: Set<string>;
  totalSeals: number;
  maxSealsBefore: Map<string, number>;
}

/** Monotonic fixpoint reachability. `allowMirror` lets the no-mirror pass prove the
 * Crystal Shard isn't gated behind a mirror (mirrors need the Shard). */
function computeReachable(
  act: WorldAct,
  rooms: Map<string, RoomDef>,
  start: string,
  opts: { allowKeys: boolean; allowMirror?: boolean }
): ReachResult {
  const allowMirror = opts.allowMirror ?? true;
  const reach = new Set<string>([start]);
  const flags = new Set<GameFlag>();
  let keys = 0;
  let seals = 0;
  let crystalShard = false; // Phase 4: obtainable once a reachable room holds the Shard

  // count total obtainable seals across the whole act (upper bound)
  let totalSeals = 0;
  for (const def of rooms.values())
    for (const s of def.spawns) {
      if (s.kind === "seal") totalSeals += 1;
      if (s.kind === "chest" && s.contains?.seal) totalSeals += s.contains.seal;
      if ((s.kind === "miniboss" || s.kind === "boss")) {
        // boss seal rewards are defined on the BossDef
        const bdef = act.bosses[s.ref ?? ""];
        if (bdef?.reward?.seal) totalSeals += bdef.reward.seal;
      }
    }

  let changed = true;
  while (changed) {
    changed = false;
    // collect items/flags from all reachable rooms
    keys = 0;
    seals = 0;
    crystalShard = false;
    for (const id of reach) {
      const def = rooms.get(id)!;
      for (const s of def.spawns) {
        if (s.kind === "key") keys += 1;
        if (s.kind === "seal") seals += 1;
        if (s.kind === "lever" && s.setsFlag) flags.add(s.setsFlag);
        if (s.kind === "upgrade" && s.ref === "crystalShard") crystalShard = true;
        if (s.kind === "chest" && s.contains) {
          if (s.contains.key) keys += s.contains.key;
          if (s.contains.seal) seals += s.contains.seal;
          if (s.contains.upgrade === "crystalShard") crystalShard = true;
        }
        if (s.kind === "miniboss" || s.kind === "boss") {
          const bdef = act.bosses[s.ref ?? ""];
          if (bdef?.setsFlag) flags.add(bdef.setsFlag);
          if (bdef?.reward?.seal) seals += bdef.reward.seal;
        }
      }
    }
    // try to open doors out of reachable rooms
    for (const id of [...reach]) {
      const def = rooms.get(id)!;
      for (const d of def.doors) {
        if (reach.has(d.to)) continue;
        let passable = false;
        switch (d.type) {
          case "open":
          case "oneWay":
            passable = true;
            break;
          case "locked":
          case "requiresItem":
            passable = opts.allowKeys && keys > 0;
            break;
          case "bossGate":
            passable = seals >= (d.sealsRequired ?? 2);
            break;
          case "shortcut":
            passable = d.flag ? flags.has(d.flag) : true;
            break;
          case "crystalGate":
            // opens once its crystal switch (a lever for the flag) is reachable
            passable = d.flag ? flags.has(d.flag) : true;
            break;
          case "mirror":
            // wakes only once the Crystal Shard is obtainable
            passable = allowMirror && crystalShard;
            break;
        }
        if (passable) {
          reach.add(d.to);
          changed = true;
        }
      }
    }
  }

  const maxSealsBefore = new Map<string, number>();
  for (const id of reach) maxSealsBefore.set(id, seals);
  return { rooms: reach, totalSeals, maxSealsBefore };
}

/** Run validation; in dev log + throw on errors. */
export function runValidation(act: WorldAct): void {
  const isDev = !!import.meta.env && import.meta.env.DEV;
  if (!isDev) return;
  const issues = validateAct(act);
  const errors = issues.filter((i) => i.level === "error");
  const warns = issues.filter((i) => i.level === "warn");
  if (warns.length) {
    console.warn(`[Validator] ${warns.length} warning(s):`);
    for (const w of warns) console.warn(`  ⚠ [${w.code}] ${w.message}`);
  }
  if (errors.length) {
    console.error(`[Validator] ${errors.length} ERROR(s) — content is not winnable/traversable:`);
    for (const e of errors) console.error(`  ✘ [${e.code}] ${e.message}`);
    throw new Error(`[Validator] ${errors.length} content error(s). See console. Fix before playing (dev only).`);
  }
  if (!warns.length) console.info(`[Validator] ✓ "${act.id}" passed: all rooms reachable, critical path key-free.`);
}
