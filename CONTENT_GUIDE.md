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
| `W` | **deep water** — always solid (a border / moat / gulf) |
| `w` | **shallow tide** — solid until the player holds the **Tide Relic**, then fordable |
| `B` | **bridge** planks — always walkable, spans water |
| (space) | void / outside the room |

`floor` styles: `stone` / `dirt` / `tile` / `grass` / `path` / `saltgrass` (war-coast
verge) / `glass` (bright ice-glass ground). `wall` styles: `brick` / `stone` /
`townstone` / `redbrick` / `wood` / `hedge` / `glass` (procedural cut-glass). `theme`:
`dungeon` / `outdoor` / `glass` (a glass theme makes `~` render as a cracked **shard
floor** and doors render as ice gaps). `music`: `explore` / `boss` / `region` /
`reach` / `glass`.

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
| `crystalGate` | Phase 4: opens when its `flag` (a `crystal_<colour>_lit`) is set by a matching crystal switch; renders as colour-coded crystal bars |
| `mirror` | Phase 4: a teleport door that wakes only once the **Crystal Shard** upgrade is held (`run.crystalShard`); renders as a swirling portal. `to`/`toDoorId` may target a non-adjacent room |

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

## The Tide — a mechanic-gated traversal example (Phase 3)

The Saltblack Reach adds **terrain that an upgrade unlocks**, a self-contained pattern
you can copy for future mechanics (lava + a charm, root-walls + an ember, etc.):

1. **Three water/bridge tiles** in the layout (see the legend): `W` deep (always
   solid), `w` shallow (solid until the relic), `B` bridge (always walkable). These
   are real `CellKind`s in [`Dungeon.ts`](src/game/Dungeon.ts); `Room.makeCell`
   reads `Room.tideUnlocked` (threaded in by `World.enter` from `run.tideUnlocked`)
   to decide whether `w` is solid this build. `Room.unlockTide()` flips shallow cells
   walkable mid-room the instant the relic is picked up (no re-enter needed).
2. **The unlocking upgrade** is just an `UpgradeId` (`tideRelic`) with a derived
   getter (`RunState.tideUnlocked`). `Game.grantUpgrade` special-cases it to call
   `world.current.unlockTide()`. Add a new mechanic the same way: a new `UpgradeId`,
   a new tile char + `CellKind`, and the gate check.
3. **Design rules that keep it fair & validator-safe:**
   - The unlocking upgrade must be reachable **without** using the mechanic (the Tide
     Relic sits at the Tide Shrine, reachable over land — never behind a ford).
   - Fords may gate **only optional dead-ends or redundant alt-routes** — never the
     critical path or a shortcut. The critical path crosses on **bridges**.
   - Door **entry tiles** must be solid ground (floor/bridge), never water.
4. **The validator proves both halves automatically** (see "Validating room
   traversal"): a *with-fording* flood (shallow walkable) confirms every spawn is
   reachable, and a *without-fording* flood (shallow + deep blocked) confirms every
   door still reaches every other door — so a missing relic can never soft-lock you.

---

## Crystal switches + Mirror gates (Phase 4 — gates by flag and by upgrade)

The Glass Country shows two reusable patterns for content-only mechanic gates:

1. **Crystal switch → crystal gate** (a coloured, flag-driven gate):
   - A switch is just a `lever` whose `setsFlag` is `crystal_<colour>_lit`
     (`crystal_red_lit`, `crystal_gold_lit`, …). It renders as a faceted gem (the
     renderer detects the `crystal_` prefix) and lights when pulled.
   - A gate is a door of `type: "crystalGate"` sharing that `flag`. `World.isDoorOpen`
     opens it once the flag is set; pulling the switch calls `refreshDoors()` for you.
   - Put the switch in a room reachable **before** the gate it opens. Teach it on the
     critical path with one colour (the RED gate), and reuse other colours for optional
     loot. The validator treats a `crystalGate` exactly like a flag-gated `shortcut`.

2. **Mirror gate → Crystal Shard** (an upgrade-gated teleport door):
   - A `type: "mirror"` door teleports to its `to`/`toDoorId` partner (which may be a
     **non-adjacent** room), but only once `run.crystalShard` is true. It renders as a
     swirling portal (dormant cracked mirror without the Shard). Grant the Shard and
     `Game.grantUpgrade` calls `refreshDoors()` so nearby mirrors wake instantly.
   - **Never place the Crystal Shard behind a mirror gate.** The validator's
     `shard-self-gated` check floods reachability *with mirrors disabled* and errors if
     the Shard's room isn't reachable that way. Mirrors may gate the run forward, a
     shortcut home, or a secret room — the Shard itself must be Shard-free to reach.

Both are pure data: a `lever`, a couple of door `type`s, and an `UpgradeId` with a
`crystalShard` getter in `Progression.ts`. No new engine systems.

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

## Playable characters (Vessels)

The 10 heroes live in
[`src/content/characters/characterDefinitions.ts`](src/content/characters/characterDefinitions.ts)
as a `CharacterDef[]`. The Ember chooses one on the character-select screen and may swap at
any Emberlight; the engine never hard-codes a hero. To add or retune one, edit that array —
nothing else needs to change.

```ts
{
  id: "myhero", name: "The Whatever", role: "Bruiser · Maul",
  sprite: "pc_myhero",        // an AssetManager key (add it to prepare-assets.mjs)
  weapon: "hammer",           // shape drawn procedurally (see Renderer.drawWeaponShape)
  style: "swing",             // motion: "swing" | "thrust" | "spin" | "cast"
  color: "#ffcf5a",           // weapon glow + UI accent
  blurb: "One line of flavour for the select screen.",
  perkName: "Signature", perkDesc: "What the perk does, in one line.",
  // combat profile — × multipliers on Balance.player unless noted; `damage` is absolute pips
  damage: 2, reachMult: 1.0, arcMult: 1.1, cooldownMult: 1.3, speedMult: 0.9,
  enemyKnockbackMult: 1.8,
  // ranged Vessels set style:"cast" + a `ranged` block (then they have NO melee):
  // ranged: { projectileSpeed: 240, pierce: 1, shots: 1, spread: 0.16 },
  // passive perks (all optional):
  heartsBonus: 1, dashCooldownMult: 0.8, iframeBonus: 0.2, knockbackResist: 0.6,
  lifestealChance: 0.3,
}
```

How it threads through the engine:

- **`RunState` is the single seam.** `run.character` drives `moveSpeed`, `attackReach`,
  `attackArc`, `attackDuration`, `attackCooldown`, `attackDamage`, `enemyKnockback`,
  `maxHearts`, `iframeMult`, `knockbackMult`, `dashCooldown`, `isRanged` and
  `lifestealChance`. Add a new stat there if a perk needs one.
- **Weapon look + motion** are procedural in `Renderer` (`drawWeaponShape` for the shape,
  `drawWeaponPosed` for swing/thrust/spin/cast). A new `weapon` value just needs a `case`
  in `drawWeaponShape`; a new `style` needs a branch in `drawWeaponPosed`. No sprites needed.
- **Ranged** Vessels (`style: "cast"`) loose friendly `Projectile`s via `Game.playerShot`;
  `Combat.updateProjectiles` resolves them against enemies/boss (with `pierce`). Melee
  resolution is skipped for them.
- **Sprites** are the only new asset: add a `pc_*` entry in `prepare-assets.mjs` (Tiny
  Dungeon has many front-facing figures — **ground-check the index** with a contact sheet),
  re-run it, then point `sprite` at the key. The procedural weapon needs no art.
- Keep one Vessel beginner-friendly and list it first (the select screen flags index 0 as
  "Recommended"). Save/restore is automatic — `characterId` is in the run snapshot + save.

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

1. Edit `tileSelection` / `townSelection` / `battleSelection` (or `audioSelection`)
   in [`scripts/prepare-assets.mjs`](scripts/prepare-assets.mjs) — map a new
   `"semantic_name.png"` to a tile index in its pack. Tiny Dungeon and Tiny Town are
   12-column grids (132 tiles, 0–131); **Tiny Battle is an 18-column grid (198 tiles,
   0–197)** — `index = row * columns + col`. Indices are documented inline.
2. Run `node scripts/prepare-assets.mjs` to copy it and regenerate `manifest.json`.
3. Reference `"semantic_name"` from a def's `sprite` field, and add a procedural
   fallback in `Renderer.ts` if it's a brand-new category.

Anything without a tile (hearts, embers, keys) is drawn procedurally in `Renderer.ts`.

### Using more Kenney packs creatively (mixed styles by region)

The bundle is a toolbox — you are NOT limited to one pack. Round 2 adds Kenney
**Tiny Town** (`tt_*` keys) alongside Tiny Dungeon for the outdoor region. Guidelines
that keep mixing intentional instead of noisy:

- **Match scale.** Prefer packs that are also 16×16 (Tiny Town, Tiny Dungeon, etc.)
  so the player/enemy colliders and combat reach stay correct. If you must use a
  different scale, normalize it when copying or via the sprite draw size.
- **Namespace keys** by pack (`tt_*`) so they never clash, and record the source
  pack + index in the manifest (the prepare script does this automatically).
- **Justify it in the lore.** Forest/roots = the curse taking root; machines = old
  warding engines; water = drowned halls; desert/ash = the road beyond the gate.
  Put the explanation in a `LoreEntry` near the visual shift.
- **Keep it readable & light.** Copy only the tiles a region needs (don't bulk-copy
  a pack), keep procedural fallbacks, and watch the deployed asset size.

To theme a region's tiles, give its rooms a `theme: "outdoor"` plus a `floor`/`wall`
style; `Renderer.floorKey`/`wallKey`/`propKey` map those styles to the `tt_*` sprites.
Add new styles there if you introduce another pack.

---

## Adding a new region (the Round 2 pattern)

A region is a `RegionDef` (id, name, theme, `accent` minimap color, `startRoomId`,
`rooms[]`). See [`src/content/regions/rootwardRoad.ts`](src/content/regions/rootwardRoad.ts).

1. Create `src/content/regions/myRegion.ts` exporting a `RegionDef`. Give each room a
   `theme` and themed `floor`/`wall` (see the asset section for the style → sprite map).
2. Add it to an act's `regions` array (e.g. in `act1.ts`). `World` indexes rooms across
   **all** regions, so cross-region doors "just work".
3. **Connect it with a real door**, not just code, so the validator can prove it's
   reachable. The summit links to the Rootward Road via a `shortcut` door gated by the
   `actBossDefeated` flag (`summit_gate` ↔ `rr_gate_w`). Walking through it triggers the
   region banner; `Game.enterRoom` records discovery in `save.discoveredRegions`.
4. **Region banner & minimap** are automatic: `World.regionOf(roomId)` drives the
   region-grouped, `accent`-colored minimap and the "New region discovered" banner.
5. **Endpoint:** to end a region with a teaser screen, place a `prop` with a known
   `uid` (the Reach uses `deep_gate`; the renderer glows `prop: "arch"`) and handle it
   in `Game.doInteract` → the `regionComplete` state + `UI.drawRegionComplete`, the
   journey-progress card that ticks off cleared world segments and names the next
   sealed one. Copy that pattern for the next region.

Three `RegionDef` examples to crib from:
[`rootwardRoad.ts`](src/content/regions/rootwardRoad.ts) (a linear outdoor road),
[`saltblackReach.ts`](src/content/regions/saltblackReach.ts) (a spine with N/S branches
plus the tide mechanic), and [`glassCountry.ts`](src/content/regions/glassCountry.ts)
(a hub-and-branch layout with crystal gates, mirror teleports and a secret room). Each
region is reached by an **open** door east out of the previous region's endpoint
(`rr_causeway → sr_landing`, `sr_drowngate → gc_threshold`) — reaching the endpoint
already gates it, so no extra flag is needed.

### Adding post-boss / future-gate content

- A boss's `setsFlag` (e.g. `actBossDefeated`) opens any `shortcut` door whose `flag`
  matches — that's how the world-gate to the next region appears after victory.
- A **visibly locked future gate** is just a door/prop the player can see but not pass
  (the sealed causeway). It implies Act II without needing Act II to exist.

---

## Validating room traversal (don't ship unreachable rooms)

[`src/game/Validator.ts`](src/game/Validator.ts) runs automatically at startup **in
dev** (`import.meta.env.DEV`). It:

- logs warnings, and **throws before gameplay** on any error;
- checks door pairing, door/spawn bounds, spawns-not-in-walls, and that every door's
  **entry tile is passable**;
- runs a monotonic reachability fixpoint (keys/seals/flags/levers/boss-flags) and
  errors if **any room is unreachable**, if the **boss room needs a consumable key**
  (critical path must be key-free), or if **seals are short** for a boss gate;
- is **tide-aware**: per room it floods twice — *with fording* (shallow `w` walkable)
  to prove every door/spawn is reachable, and *without fording* (shallow + deep both
  block) to prove every door still reaches every other door. So ford-gated loot
  validates, **and** a missing Tide Relic can never seal off the critical path. It
  also errors on a non-prop spawn sitting in **deep water**.
- is **crystal/mirror-aware**: a `crystalGate` is passable once its `flag` is
  obtainable (a crystal switch in a reachable room); a `mirror` is passable once the
  Crystal Shard is obtainable. It re-runs reachability *with mirrors disabled* and
  errors (`shard-self-gated`) if the Crystal Shard's room is only reachable through a
  mirror — guaranteeing the Shard is never gated behind itself.

In production it does not run (shipped content is pre-validated), so players never
crash on it. To read the output, open the browser console after `npm run dev` — a
clean act logs `✓ "<act>" passed`.

**Debug overlays (dev, key-only — never shown in the mobile UI):** **F2** toggles a
collision overlay with spawn markers, enemy behavior labels, and door lock/target
labels — invaluable for spotting a spawn in a wall or a door that won't open. **F3**
shows a region/room/flags/upgrades text panel. **F4** warps between already-visited
checkpoints for fast testing.

Defining room entrances/exits safely:

- Put doors on the wall **border** at `(tx,ty)`; openings are carved automatically.
- The player lands one tile **inward** of the partner door — keep that tile floor.
- Don't place solid props on the only route through a room; the validator warns on odd
  spawns but you should still walk it (or F2 it).

---

## Adding darker / adaptive music states

Music is scene-based. `Game.updateMusic()` (called on room entry and every frame)
picks a **biome** (`explore` / `boss` / `region` / `reach` from `room.music`; a live
boss always forces `boss`), marks **safe** rooms (`room.isSafe`), and computes a
**combat** intensity (nearby aggroed enemies / boss phase). It calls
`audio.setMusicScene(biome, safe, combat)`.

- To add a region's ambience, set its rooms' `music` to a biome and (optionally) add a
  matching clip candidate in `prepare-assets.mjs` (`music_region2.ogg`,
  `music_reach.ogg`, `music_glass.ogg`, …). With no clip, the synth drone in
  `AudioManager.startDrone` plays — give the biome its own root/intervals/bells. The
  Reach uses a deep E1 root with a beating minor-second (drowned, tidal); the Glass
  Country uses a higher C2 root with a high shimmer and bright bells (refracted). New
  one-shot stings (e.g. `crystal`, `mirror`) are added to the `Sfx` union + `play()`.
- The **combat layer** (`AudioManager.startCombatLayer`) is a dark pulse gated by
  `combatGain`; it fades in via `combatTarget`. Keep new layers quiet — "darker, not
  louder." Everything is synth-backed, so it never crashes if `.ogg` won't decode.

---

## Migrating saves when room ids change

`Save` merges loaded data over fresh defaults, so **new fields auto-initialize** on old
saves — just add them to `defaults()` in [`src/game/Save.ts`](src/game/Save.ts). For an
in-progress run, `Game.continueRun` validates `checkpointRoomId` against `World.hasRoom`
and falls back to the act start if a saved room was removed/renamed, so a player is
never loaded into a void. If you rename room ids, prefer keeping the old id as an alias
or bump a save version and clear stale runs.

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

A run must never softlock. **The validator above enforces most of this automatically**
— but when authoring rooms, keep these in mind:

1. **Critical path uses only `open`/`bossGate`/`shortcut` doors and guaranteed seals**
   — never an Iron Key. The validator errors (`boss-needs-key`) if the boss room is
   only reachable by consuming a key.
2. **Boss-gate seals are on reachable, open paths.** In Act I, Seal 1 is in the Gallery
   (open off the Well hub); Seal 2 is the Gaoler miniboss reward.
3. **Every door is paired** (`toDoorId` exists in the target, and points back).
4. **Spawns sit on floor tiles** (not on `#`/`=`), and solid props don't block the only
   route through a room.
5. Playtest the full path on desktop AND a 375–390px mobile viewport: title → start →
   each checkpoint → seals → boss gate → final boss → summit victory → Walk the Rootward
   Road → causeway → region complete.

Quick manual verification: `npm run dev`, then in the browser console the game is
exposed as `window.__game`. You can inspect `__game.run`, `__game.world.current`, or
call `__game.enterRoom("roomId", null, true)` to jump to a room while testing. Press
**F2** for the collision/spawn/door overlay.

---

## Keeping Cloudflare Pages compatibility

- Keep `vite.config.ts` `base: "./"` and `outDir: "dist"`.
- Don't fetch anything from outside the repo at runtime. New assets must be copied into
  `public/assets/kenney/selected/` (via the prepare script) and committed.
- No backend, no Node-only APIs at runtime, no environment variables.
- `npm run build` must succeed (it type-checks first). The output in `dist/` must be a
  self-contained static site.
