# Content Guide — Expanding Emberfall Keep

Everything in `src/content/` is **pure data**. The engine in `src/game/` reads that
data and never needs editing to add content. This guide is specific to how the code
actually works, so a future AI or human can add Act 2+, regions, rooms, enemies,
bosses, items, and lore by writing data files.

The expansion arc is intentionally open:

- **Act 2:** ruined village / cursed forest / sunken keep
- **Act 3:** underground city / ancient machine / dead kingdom
- **Act 4:** final realm / cosmic prison / world root

None of those are implemented — but the path below is everything you need.

---

## Mental model

```txt
WorldAct ─┬─ regions: RegionDef[] ─┬─ rooms: RoomDef[] ─┬─ layout: ASCII tile grid
          │                        │                    ├─ doors: DoorDef[]  (room graph edges)
          │                        │                    └─ spawns: SpawnDef[] (enemies/props/items/...)
          ├─ enemies: Record<id, EnemyDef>
          ├─ bosses:  Record<id, BossDef>
          ├─ items:   Record<id, ItemDef>
          └─ lore:    Record<id, LoreEntry>
```

All these types live in [`src/game/types.ts`](src/game/types.ts) — read it once; it's
the contract. Tunables live in [`src/game/Balance.ts`](src/game/Balance.ts).

---

## Rooms

A `RoomDef` (see examples in [`src/content/acts/act1.ts`](src/content/acts/act1.ts)):

```ts
{
  id: "myroom",
  name: "Display Name",
  subtitle: "shown briefly on entry",       // optional flavor
  gx: 3, gy: 2,                               // grid coords for the minimap
  floor: "stone" | "dirt" | "tile",
  wall: "brick" | "stone",
  music: "explore" | "boss",
  isSafe: true,                               // optional (checkpoints/safe rooms)
  layout: [                                   // rows; every row same length
    "#############",
    "#...........#",
    "#####.#####.#",
    ...
  ],
  doors: [ /* DoorDef[] */ ],
  spawns: [ /* SpawnDef[] */ ],
}
```

**Layout legend**

| Char | Meaning |
| --- | --- |
| `#` | wall (solid) |
| `.` | floor |
| `,` | floor variant (decorative inlay) |
| `~` | hazard tile (spikes — damages on contact, passable) |
| `=` | gargoyle wall (solid decor) |
| (space) | void / outside the room |

Door openings on the wall border are **carved automatically** from each door's
`(tx, ty)` — don't punch holes in the border yourself; just place the door.

Keep rooms compact (≈11–15 wide, 7–13 tall) so they read on a phone. Bigger rooms
scroll; the camera follows the player and clamps to the room.

---

## Connecting rooms (the room graph)

Doors are placed on a room's wall border and **paired** with a partner door in the
target room via `to` / `toDoorId`:

```ts
// in room A:
{ id: "A_e", tx: 12, ty: 4, edge: "e", to: "B", toDoorId: "B_w", type: "open" }
// in room B:
{ id: "B_w", tx: 0,  ty: 4, edge: "w", to: "A", toDoorId: "A_e", type: "open" }
```

Walking onto an **open** door cell transitions you to the partner door (you arrive
one tile inside it). `edge` is the wall the door sits on (`n/s/e/w`) and decides which
way the player is nudged inward on arrival.

### Door / connection `type`s

| type | behavior |
| --- | --- |
| `open` | always passable |
| `locked` | consumes one **Iron Key** when the player interacts (`E`) in front of it; both paired ids are then permanently unlocked |
| `bossGate` | opens when the player interacts and `run.seals >= sealsRequired` (default 2) |
| `shortcut` | sealed until a world `flag` is set (e.g. a lever). Opens on **both** sides at once |
| `oneWay` | treated as open (use for drops); add real one-way logic if you need it |
| `requiresItem` | reserved hook; currently behaves like `locked` |

Add `lockedHint: "..."` to show the player why a door won't open.

---

## Locked paths

1. Add a `locked` door between two rooms.
2. Place a key somewhere reachable — either a standalone `{ kind: "key" }` spawn or a
   chest with `contains: { key: 1 }`.

Keys are a **counted** resource (`run.keys`). Keep locked doors off the critical path
(use them for optional upgrade/treasure rooms) so a mismanaged key can never softlock
the run. The critical path should rely on **seals/flags**, which are guaranteed.

---

## Shortcuts

1. Add a `shortcut` door on both rooms, sharing a `flag` (e.g. `"shortcutUnlocked"`).
2. Place a `{ kind: "lever", setsFlag: "shortcutUnlocked" }` spawn somewhere the player
   reaches *before* they'd want the shortcut. Pulling it sets the flag, which opens the
   door (the engine calls `refreshDoors()` for you).

A good shortcut reconnects a deep area back to a checkpoint hub so the runback after a
death/boss attempt is shorter — Act 1's lever in the Long Descent opens the
Well↔Shrine portcullis.

---

## Checkpoints (Emberlights)

Add `{ kind: "checkpoint", uid: "cp_unique", ref: "Display Name" }`. Resting:

- sets the respawn point (`run.checkpointId` / `checkpointRoomId`),
- fully heals,
- resets the normal enemies in that room,
- snapshots the run to `localStorage`.

Defeated bosses do **not** respawn (their spawns are gated by defeat flags). Give each
checkpoint a unique `uid`.

---

## Enemies

Add an `EnemyDef` to [`src/content/enemies/enemyDefinitions.ts`](src/content/enemies/enemyDefinitions.ts)
(or a new file you merge into the act's `enemies` map):

```ts
myEnemy: {
  id: "myEnemy", name: "Display Name",
  sprite: "enemy_spider",          // AssetManager key (a copied tile) — or any key
  behavior: "chaser" | "swarm" | "patroller" | "shooter" | "tank",
  hp: 4, damage: 1, speed: 60, radius: 7,
  embers: 4, fallbackColor: "#cccccc",
  aggroRange: 160,                 // 0 = always active
  heartChance: 0.1,                // chance to drop a heart on death
  // shooter only:
  fireInterval: 1.8, projectileSpeed: 130,
  // elites:
  scale: 1.4,
}
```

Place it with `{ kind: "enemy", tx, ty, ref: "myEnemy" }`. Behaviors are interpreted in
[`src/game/Entities.ts`](src/game/Entities.ts) (`Enemy.update`). To add a *new*
behavior, extend the `EnemyBehavior` union in `types.ts` and add a `case` there.

`Balance.difficulty` scales enemy hp/damage/speed by difficulty mode at spawn time.

---

## Bosses

Add a `BossDef` to [`src/content/bosses/bossDefinitions.ts`](src/content/bosses/bossDefinitions.ts):

```ts
myBoss: {
  id: "myBoss", name: "The Name", title: "Its Epithet",
  sprite: "boss", hp: 70, contactDamage: 2, speed: 52, radius: 13, scale: 2.3,
  fallbackColor: "#c8531f", embers: 120,
  isMiniboss: false,               // true => placed via kind:"miniboss"
  introLine: "...", phaseLine: "... (shown when it enrages below 50% hp)",
  defeatLine: "...",
  setsFlag: "actBossDefeated",     // world flag set on defeat
  reward: { seal: 1, upgrade: "wardensEdge", embers: 80 },
  patterns: [
    { id: "cleave", kind: "slam",      telegraph: 0.6, recovery: 0.45, cooldown: 2.2, damage: 2 },
    { id: "ring",   kind: "shockwave", telegraph: 0.85, recovery: 0.7, cooldown: 4.2, damage: 2 },
    { id: "volley", kind: "volley",    telegraph: 0.7, recovery: 0.6, cooldown: 3.6, damage: 1 },
    { id: "rush",   kind: "charge",    telegraph: 0.5, recovery: 0.55, cooldown: 3.0, damage: 2 },
    { id: "call",   kind: "summon",    telegraph: 1.0, recovery: 0.8, cooldown: 9.0, damage: 0 },
  ],
}
```

Pattern `kind`s are implemented in `Boss.executePattern` (Entities.ts):

- `slam` / `shockwave` → a telegraphed AoE ring (warning, then impact),
- `volley` → a fan of projectiles aimed at the player,
- `charge` → a fast dash in the aimed direction,
- `summon` → spawns adds (only used after the boss enrages below half hp).

Place with `{ kind: "miniboss" | "boss", tx, ty, ref: "myBoss", uid, blockedByFlag: "<defeatFlag>" }`
so it won't respawn after defeat. The HUD boss bar appears automatically. To add a new
attack kind, extend `BossAttackPattern["kind"]` in `types.ts` and add a `case`.

---

## Items & upgrades

Add to [`src/content/items/itemDefinitions.ts`](src/content/items/itemDefinitions.ts).
Upgrades reference an `UpgradeId`; the effect is read in
[`src/game/Progression.ts`](src/game/Progression.ts) (derived getters like
`attackReach`, `dashCooldown`, `maxHearts`). To add a new upgrade:

1. Add the `UpgradeId` to the union in `types.ts`.
2. Add an `ItemDef` with `kind: "upgrade", upgrade: "<id>"`.
3. Apply its effect in `Progression.ts` (a new derived getter or in `addUpgrade`).
4. Place it as `{ kind: "upgrade", ref: "<itemId>", uid }` or in a chest
   (`contains: { upgrade: "<itemId>" }`).

Pickups (`{ kind: "pickup", pickup: "heart" | "ember" | "potion", amount }`) are
auto-collected on touch. Seals (`{ kind: "seal" }`) and keys are also auto-collected;
chests are opened with `E`.

---

## Lore fragments

Add a `LoreEntry` to [`src/content/lore/loreEntries.ts`](src/content/lore/loreEntries.ts),
then place `{ kind: "lore", ref: "<loreId>", prop: "scroll" }` (a scroll/tablet the
player reads with `E`). Discovery is tracked in the run and persisted; the victory
screen counts `loreFound / <total>`. Keep entries short and atmospheric. You can also
grant lore from a chest via `contains: { loreId: "..." }`.

---

## Asset mappings

Sprites are referenced by **semantic key** (e.g. `"player"`, `"enemy_wraith"`,
`"door_closed"`). Those keys are the filenames (minus `.png`) under
`public/assets/kenney/selected/tiles/`.

To add a new sprite:

1. Edit `tileSelection` (or `audioSelection`) in
   [`scripts/prepare-assets.mjs`](scripts/prepare-assets.mjs) — map a new
   `"semantic_name.png"` to a Tiny Dungeon tile index (the indices are documented in
   that file; the pack is a 12×11 grid, indices 0–131).
2. Run `node scripts/prepare-assets.mjs` to copy it and regenerate `manifest.json`.
3. Reference `"semantic_name"` from a def's `sprite` field, and add a procedural
   fallback in `Renderer.ts` if it's a brand-new category.

Anything without a tile (hearts, embers, keys) is drawn procedurally in `Renderer.ts`.

---

## Adding a whole new Act

1. Create `src/content/acts/act2.ts` exporting a `WorldAct` (copy `act1.ts`'s shape).
   You can import the shared `enemyDefinitions` etc., or add `act2`-specific defs in
   new files and spread them into the act's `enemies`/`bosses`/`items`/`lore` maps.
2. Wire it in: in [`src/game/Game.ts`](src/game/Game.ts), the world is constructed from
   `act1`. To support multiple acts, build a registry (`{ act1, act2 }`) and select by
   `save.data.availableActs` / a chosen act id. The `Save` data already has
   `availableActs` / `completedActs` hooks for this.
3. Have the previous act's ending set a flag / unlock that adds the next act to
   `availableActs`.

You usually **don't** touch `World.ts`, `Dungeon.ts`, `Entities.ts`, `Combat.ts`, or
`Renderer.ts` to add content — only when introducing a genuinely new mechanic.

---

## Testing that an act is winnable

A run must never softlock. Checklist when authoring rooms:

1. **Critical path uses only `open`/`bossGate`/`shortcut` doors and guaranteed seals**
   — never an Iron Key. Iron Keys gate optional rooms only, and there must be at least
   as many obtainable keys as locked doors you intend to be openable.
2. **Both boss-gate seals are on reachable, open paths.** In Act 1: Seal 1 is in the
   Gallery (open off the Well hub); Seal 2 is the Gaoler miniboss reward.
3. **Every door is paired** (`toDoorId` exists in the target room, and vice-versa).
4. **Spawns sit on floor tiles** (not on `#`/`=`), and solid props don't block the only
   route through a room.
5. Playtest the full path: title → start → reach each checkpoint → both seals → boss
   gate → final boss → summit world-gate → Act victory.

Quick manual verification: `npm run dev`, then in the browser console the game is
exposed as `window.__game`. You can inspect `__game.run`, `__game.world.current`, or
call `__game.enterRoom("roomId", null, true)` to jump to a room while testing.

---

## Keeping Cloudflare Pages compatibility

- Keep `vite.config.ts` `base: "./"` and `outDir: "dist"`.
- Don't fetch anything from outside the repo at runtime. New assets must be copied into
  `public/assets/kenney/selected/` (via the prepare script) and committed.
- No backend, no Node-only APIs at runtime, no environment variables.
- `npm run build` must succeed (it type-checks first). The output in `dist/` must be a
  self-contained static site.
