# Emberfall Keep

A complete, mobile-friendly **top-down Zelda-like / light Soulslike** built with
TypeScript + Vite + HTML5 Canvas. Two cursed, interconnected regions:

1. **Act I — The Sunken Keep** (Kenney *Tiny Dungeon*): a 16-room dungeon with
   Emberlight checkpoints, a recoverable death drop, a boss gate sealed behind
   Warden Seals, a miniboss, and the final boss — The Hollow Warden.
2. **The Rootward Road** (Kenney *Tiny Town*): a 7-area cursed overground bell-road
   beyond the broken gate — a swallowed hamlet, a blackroot grove, an elite Barrow
   Champion, a broken span, and the sealed causeway to **Act II**.

> The light that kept the Keep has gone hollow. Break the curse, then walk the road
> beyond — the Keep was only the first opened wound in a much larger cursed world.

The engine is fully data-driven, so future acts/regions/bosses are added as content
files, not engine rewrites (see [`CONTENT_GUIDE.md`](CONTENT_GUIDE.md)).

## Round 2 expansion (what's new)

- **A whole new playable region** — The Rootward Road — reached by walking through
  the summit world-gate after the Warden falls. Act I still ends cleanly with its
  own victory screen; "Walk the Rootward Road →" continues onward.
- **Creative multi-pack asset use** — a second cohesive Kenney pack (*Tiny Town*,
  same 16×16 scale) gives the outer world a distinct identity (grass, dying autumn
  trees, cobble roads, houses, a stone causeway), justified in the lore as the
  Keep's curse "taking root" along an old bell-road.
- **A traversal/winnability validator** (dev-time) that proves every room is
  reachable and the critical path never depends on a consumable key — plus an **F2
  debug overlay** (collision, doors + lock labels, spawns, enemy behaviors).
- **Darker, adaptive audio** — a scene-based music engine (safe / explore / combat /
  boss / region) with low drones, sparse unresolved bells, and a combat-tension
  layer that fades in during fights.
- **More combat variety** — new enemy behaviors (stationary **turret** caster,
  long-windup **charger**, on-death **splitter**) and an **elite champion**, plus
  boss intro banners, boss-arena door locks, and clearer heavy-attack telegraphs.
- **More world & story** — region banners, region-colored minimap, 7 new lore
  fragments, optional **Bell Tokens**, a new **Ember Heart** upgrade, and a shortcut
  winch on the span.
- **Save migration** — old Act I saves keep working (new fields auto-initialize); a
  saved checkpoint in a room that no longer exists falls back to the nearest valid
  start instead of loading into the void.

---

## Play

- **Title → Act I → Victory** is fully playable, roughly **10–20 minutes**.
- Find **two Warden Seals** (one in the Gargoyle Gallery, one held by the Gaoler
  miniboss) to open the sealed door to the **Hollow Warden**, the final boss.

### Controls

**Desktop / keyboard**

| Action | Keys |
| --- | --- |
| Move | `WASD` / Arrow keys |
| Attack | `Space` / `J` / `Z` |
| Roll / dodge (brief i-frames) | `Shift` / `K` / `X` |
| Interact (chests, levers, lore, doors, rest) | `E` / `F` |
| Pause | `Esc` / `P` |
| Mute | `M` |
| Debug overlay (dev) | `F2` |
| Confirm menus | `Enter` / `Space` / tap |

**Mobile / touch**

- **Left thumb:** drag anywhere on the left half of the screen — a floating
  virtual stick appears under your finger and steers the hero.
- **ATK / DASH** buttons sit at the bottom-right.
- **USE** appears near chests, levers, lore tablets, sealed doors, and Emberlights.
- Pause and mute are the icons at the top-right.
- The page never scrolls while playing (touch-action is disabled), the canvas
  scales responsively, and the UI is readable down to ~390px width.

---

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
```

Build a static production bundle:

```bash
npm run build    # type-checks, then emits dist/
npm run preview  # serve the built dist/ locally
```

The build output directory is **`dist`** and is fully static — no server runtime,
no backend, no database, no Node required in production.

---

## Cloudflare Pages deployment

```txt
Build command:           npm run build
Build output directory:  dist
```

No environment variables or functions are required. All asset URLs are relative
(Vite `base: "./"`), so the site works from any path. The deployed build depends
**only** on files inside this repository — never on the parent-folder Kenney bundle.

---

## Assets & the parent-folder Kenney bundle

During **local development**, the full **Kenney Game Assets All-in-1** bundle is
expected to live **one folder above this repo**:

```txt
parent-folder/
  Kenney Game Assets All-in-1 .../
    2D assets/Tiny Dungeon/...
    Audio/...
  OneShotGamesV3/            <- this repo
    public/assets/kenney/selected/
```

A small, re-runnable script copies only the assets Act I needs into the repo:

```bash
node scripts/prepare-assets.mjs
```

It:

1. Locates the Kenney bundle in the parent directory (tolerant of the exact name).
2. Copies a cohesive, curated selection of **Tiny Dungeon** tiles + a handful of
   Kenney SFX/music into `public/assets/kenney/selected/{tiles,audio}/`.
3. Writes `public/assets/kenney/selected/manifest.json` documenting every
   source → destination mapping, and lists anything it couldn't find.

The selected assets are committed into the repo, so the deployed Cloudflare Pages
build **does not** need the parent folder. The parent bundle is only used during
local asset-prep.

### Art direction (two cohesive 16×16 packs, used as distinct regions)

Both packs are Kenney, CC0, 16×16, and ship as individual per-tile PNGs (no
spritesheet slicing) — so they share the player's scale and never break collision
or combat readability:

- **Tiny Dungeon** → Act I (The Sunken Keep): the green-hooded hero, monsters
  (rat, ooze, spider, moth, wraith, cultist, sentinel), the Gaoler brute, the
  horned Hollow Warden, chests, potions, doors, gates, braziers, scrolls, seal ring.
- **Tiny Town** → The Rootward Road (`tt_*` keys): grass, cobble roads, dying
  autumn trees, houses, fences, a stone causeway arch, signs, a well, a market
  stall, and the gold Bell-Token relic.

Mixing is deliberate, not random: the visual shift is the curse spreading from the
Keep onto the old bell-road. The art-prep script keeps both packs documented in the
manifest with their source pack + tile index.

### Fallback behavior

The game **never breaks on a missing asset**:

- Hearts, embers (currency), and Iron Keys have no Tiny Dungeon tile, so they are
  **always drawn procedurally** in a matching chunky-pixel style.
- Every sprite category also has a procedural fallback shape — if a PNG fails to
  load, the renderer draws a clean readable stand-in instead of crashing.
- Audio uses an adaptive **Web Audio synth engine** for all sound effects and the
  music bed, which works on every browser (including older iOS Safari that can't
  decode `.ogg`). Decoded Kenney clips (low-passed/slowed to stay dark) are preferred
  when the browser supports them; otherwise the synth fallback is seamless. Music is
  scene-based — **safe / explore / combat / boss / region** — with low drones, sparse
  bells, and a combat-tension layer that fades in during fights. Audio only starts
  after a user gesture; mute persists in `localStorage`.

If asset discovery fails entirely, the game still runs fully with procedural art
and synth audio.

---

## What's in the game

**Act I — The Sunken Keep**

- 16 connected rooms in one region, with a region-colored minimap.
- A safe start, 3 **Emberlight** checkpoints, 2 optional locked doors (Iron Keys),
  a one-way-style **shortcut** you raise via a lever deep in the Keep.
- 6 enemy types + behaviors (chaser, swarm, patroller, shooter, tank), a
  **miniboss** (The Gaoler) and a **final boss** (The Hollow Warden) with telegraphed
  attacks and a phase change below half health.
- Pickups (hearts, embers, potions), chests, **3 permanent upgrades**
  (+1 max heart, longer/stronger blade, faster roll), and 8 lore fragments.
- Soulslike death loop: respawn at the last Emberlight, your dropped embers wait
  where you fell — reclaim them (lose them only if you die again first). Keys,
  seals, upgrades and progress are never lost on death.
- Full screen flow: title, how-to-play, pause, checkpoint rest, death, **Act I
  victory with stats**, and a credits/asset-notice screen.
- A **Hard Mode** toggle on the title screen.

**The Rootward Road** (Round 2)

- 7 outdoor areas (Cinder Gate, Dead Road, Blackroot Grove, Swallowed Hamlet,
  Outer Barrow, Broken Span, Sealed Causeway) with their own checkpoints, lore,
  and minimap group.
- New enemy behaviors (turret / charger / splitter) and an optional **elite**
  (the Barrow Champion) guarding an **Ember Heart** upgrade.
- Optional **Bell Tokens**, a shortcut winch back to the gate, and a sealed Act II
  causeway gate that ends Round 2 with a "world has many wounds" teaser screen.

---

## Persistence

Everything is `localStorage`, no accounts/servers/cookies:

- Settings (mute, difficulty) and lifetime stats (best time, most embers, wins,
  deaths).
- An in-progress **run snapshot** (resources incl. Bell Tokens, opened chests,
  world flags, discovered lore, current checkpoint) so closing the tab resumes from
  your last rest via **Continue Descent**.
- Round 2 hooks (`unlockedRegions`, `discoveredRegions`, `completedMiniRegion`,
  `optionalEliteDefeated`, …) auto-initialize on older saves. If a saved checkpoint
  room no longer exists, the game falls back to the nearest valid start.

---

## Project layout

```txt
index.html
vite.config.ts        # base "./", outDir "dist"
scripts/prepare-assets.mjs   # parent-bundle -> repo asset copy + manifest
public/assets/kenney/selected/{tiles,audio,manifest.json}
src/
  main.ts
  styles.css
  game/                # engine: Game, Renderer, Input, AssetManager, AudioManager,
                       #         Save, World, Dungeon, Entities, Combat, Progression,
                       #         Checkpoints, Lore, UI, Balance, Validator, types
  content/             # DATA-DRIVEN content (add new acts/regions here)
    acts/act1.ts
    regions/rootwardRoad.ts
    enemies/enemyDefinitions.ts
    bosses/bossDefinitions.ts
    items/itemDefinitions.ts
    lore/loreEntries.ts
```

See [`CONTENT_GUIDE.md`](CONTENT_GUIDE.md) for how to add Act 2+, regions, rooms,
enemies, bosses, items, lore, and asset mappings.

---

## Credits

- Art & audio: **Kenney** (kenney.nl) — *Tiny Dungeon*, *Tiny Town*, and
  RPG/Impact/Interface/Music packs, all **CC0**. Crediting is voluntary and gladly
  given.
- Engine, design, content, and the procedurally-drawn HUD icons were built for
  this project in TypeScript + Vite + Canvas.
