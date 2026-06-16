# Emberfall Keep

A complete, mobile-friendly **top-down Zelda-like / light Soulslike** built with
TypeScript + Vite + HTML5 Canvas. Four cursed, interconnected regions (45 rooms),
each its own cohesive Kenney 16×16 pack — stitched into one road by a spreading curse:

1. **Act I — The Sunken Keep** (Kenney *Tiny Dungeon*): a 16-room dungeon with
   Emberlight checkpoints, a recoverable death drop, a boss gate sealed behind
   Warden Seals, a miniboss, and the final boss — The Hollow Warden.
2. **The Rootward Road** (Kenney *Tiny Town*): a 7-area cursed overground bell-road
   beyond the broken gate — a swallowed hamlet, a blackroot grove, an elite Barrow
   Champion, a broken span, and the once-sealed causeway.
3. **The Saltblack Reach** (Kenney *Tiny Battle*): a 10-area **drowned war-coast** past
   the causeway, where an ancient war sank mid-stride. Ford the shallow **tide** with
   the **Tide Relic**, cross deep water on bridges, and break **The Drowned Gear**.
4. **The Glass Country** (Kenney *Tiny Ski* + procedural light): a 12-area **bright,
   refracted crystal land** past the toll-gate. **Light crystals** to open their gates,
   take the **Crystal Shard** to wake **mirror gates** (teleport doors), dodge the
   **shard floor**, and break **The Glass Warden** at the Sun-Gate — beyond it, a
   country of iron and orchard-rows waits, sealed.

> The light that kept the Keep has gone hollow. Break the curse, then walk the road
> beyond — the Keep was only the first opened wound in a much larger cursed world.

The engine is fully data-driven, so future acts/regions/bosses are added as content
files, not engine rewrites (see [`CONTENT_GUIDE.md`](CONTENT_GUIDE.md)). For how the
Kenney bundle is mined and mixed across regions, see [`ASSET_GUIDE.md`](ASSET_GUIDE.md).

## Character update — Choose your Vessel (what's new)

- **A character-select screen on every new run.** The Ember now wears the shape of a
  fallen champion — pick from **10 distinct playable "Vessels"**, each a front-facing
  Kenney *Tiny Dungeon* figure (`pc_*`). The screen shows a **live preview** with the
  hero's weapon, its perk, and at-a-glance stats; the Warden is flagged as the
  recommended first descent.
- **Every Vessel has a visible weapon that animates on attack.** Weapons are drawn
  **procedurally** over the sprite and move with the swing — a sword/cutlass/axe/hammer
  arc, a long **spear** thrust, a 360° **quarterstaff** whirl, a fast **dagger** jab, or
  a raised **staff/bow** that looses a shot. Even at rest the weapon is held and breathes.
- **Distinct attacks + perks that change how rooms play.** Melee Vessels cleave every
  foe in their arc; the **Lancer** spears a whole line; the **Embermage** and **Wayfarer**
  are **ranged** (ember-bolts / piercing arrows — no melee); the **Sentinel** is a +2-heart
  bulwark; the **Reaver** double-hits and hurls foes; the **Revenant** heals on kills; the
  **Duelist** trades reach for speed. Some trivialize shooter rooms, others crush tanks.
- **Swap forms at any Emberlight.** Resting now offers **Change Hero** — take up a
  different Vessel mid-run (e.g. a ranged form for a turret room, a tank for a boss). The
  choice is saved and resumes with your run.
- **Easy mode retuned to "challenging but achievable."** Incoming enemy *and boss* damage,
  swarm aggro and knockback are softened and you get extra mercy i-frames + hearts — so an
  engaged player always has a path forward — while enemies still live long enough to be
  real fights. Normal and Hard are unchanged (Hard's boss hits even harder now).

## Phase 4 expansion — The Glass Country (what's new)

- **A whole new region** past the Drowned Toll-Gate: **The Glass Country**, a bright
  refracted crystal land of **12 areas** built from a fourth Kenney pack, **Tiny Ski**
  (`sk_*` — snow/ice as glass ground), with crystals, mirror portals, a buried sun and
  shard floors drawn **procedurally** (additive light) on top. The toll-gate that
  ended Phase 3 now opens east onto it.
- **A new mechanic — Crystal switches + Mirror gates.** Two new door types: a
  **`crystalGate`** opens when its colour-matched **crystal switch** is lit (the RED
  gate teaches it on the critical path; a GOLD gate guards loot); a **`mirror`** gate
  is a teleport door that wakes only once the **Crystal Shard** is held — one gates the
  run forward to the Buried Sun, one is a shortcut back to the hub, one hides a secret
  reflection room. Plus a new **shard-floor** hazard (cracked glass that bites on a
  pulse).
- **Two new permanent upgrades** — the **Crystal Shard** (wakes mirror gates) and the
  **Glass Heart** (+1 max heart, dropped by the new miniboss).
- **A new miniboss — The Glass Warden** (prism volley / mirror-step charge / glass-ring
  pulse / summons Glass Mites below half), plus **4 new enemies**: Glass Mite (swift
  swarmer), Prism Caster (turret), Echo Hound (charger), Shard Sentinel (gate-guard tank).
- **A bright "glass" ambience**, crystal-chime + mirror-whoosh stings, a **5-region
  journey ledger** that teases the next sealed segment (the Iron Orchard), new objective
  hints, and a validator extended to prove the Crystal Shard is never gated behind a
  mirror (no soft-lock).

## Phase 3 expansion — The Saltblack Reach (what's new)

- **A whole new region** beyond the Rootward causeway: **The Saltblack Reach**, a
  drowned war-coast of **10 areas** built from a third Kenney pack, **Tiny Battle**
  (`tb_*` keys — water, coasts, bridges, ruined keeps, drowned banners, beached
  ships). The causeway that used to dead-end Round 2 now opens east onto it.
- **A new traversal mechanic — the Tide.** Three new tile kinds: deep water
  (`W`, always solid — borders & moats), **shallow tide** (`w`, fordable **only**
  once you hold the **Tide Relic**), and **bridges** (`B`, always walkable). Shallow
  fords gate optional loot and shortcuts; the critical path always crosses on bridges,
  so the relic is never required to progress and is never gated behind itself.
- **Two new permanent upgrades** — the **Tide Relic** (ford the shallows) and the
  **Brine Heart** (+1 max heart, dropped by the new miniboss).
- **A new miniboss — The Drowned Gear** (volley / tide-slam / ram), plus **4 new
  enemies**: the Drowned Knight (heavy lunger), Brine Archer (retreating shooter),
  Tollworks Turret (stationary spread), and the splitting Mire Crawler.
- **A new tide-gate shortcut loop**, two optional ford-branches (a beached hulk and
  a reef), two new checkpoints, **8 new lore fragments**, a distinct **drowned
  "reach" ambience**, and a richer **journey-progress endpoint screen** that teases
  the next sealed world segment.
- **Validator made tide-aware** — it now proves *both* that every spawn is reachable
  *with* fording **and** that no ford can ever gate room-to-room traversal (so you can
  never soft-lock before finding the relic). Dev overlays added: **F3** (region/room/
  flags) and **F4** (warp between discovered checkpoints).

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

- **Title → Choose your Vessel → Act I → Victory** is fully playable, roughly
  **10–20 minutes**. Pick one of **10 heroes** to begin; swap forms at any Emberlight.
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
| Debug overlays (dev) | `F2` collision · `F3` region/room/flags · `F4` warp checkpoints |
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
- **Tiny Battle** → The Saltblack Reach (`tb_*` keys): deep & shallow water, coasts,
  plank bridges, fords, ruined keeps/bastions, drowned banners, a crossed-blade
  grave marker, a sand cairn, and a beached warship hull.
- **Tiny Ski** → The Glass Country (`sk_*` keys): bright white/ice terrain (glass
  ground), frost trees, lift pylons, gate arches, prism banners, and red-eyed
  wolves + a yeti as enemy sprites. The crystals, crystal gates, mirror portals, the
  Crystal Shard, the buried sun and shard floors are drawn **procedurally** (additive
  light) on top — Kenney terrain, engine-rendered magic.

Mixing is deliberate, not random: the curse spreads from the Keep onto the bell-road,
drowns the war-coast, then *refracts* the glass country beyond. The art-prep script
keeps all four packs documented in the manifest with their source pack + tile index.
See [`ASSET_GUIDE.md`](ASSET_GUIDE.md) for how packs are chosen, namespaced, and
justified in-fiction.

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

**Playable Vessels (the roster)**

- **10 heroes** chosen on a character-select screen and swappable at any Emberlight,
  each a Kenney *Tiny Dungeon* figure with its own **procedurally-drawn, animated weapon**
  and a signature perk: Warden (sword, +1 heart), Sentinel (hammer, +2 hearts/sturdy),
  Reaver (axe, heavy + knockback), Lancer (spear, long cleaving thrust), Duelist (daggers,
  fast/fragile), Embermage (staff, ranged fire), Wayfarer (bow, piercing arrows), Revenant
  (scythe, lifesteal), Adept (quarterstaff, 360° whirl), Saltblade (cutlass, fast combo).
- Ranged Vessels fight only through projectiles; melee Vessels cleave everything in their
  arc. Stats flow through one `RunState` seam so perks/weapons stay fully data-driven.

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
- Optional **Bell Tokens**, a shortcut winch back to the gate, and the causeway —
  once Round 2's dead-end, now the door east into Phase 3.

**The Saltblack Reach** (Phase 3)

- 10 areas (Saltstair, Black Strand, Tide Shrine, Beached Hulk, Broken Spans,
  Lowtide Muster, Saltblack Reef, Tideward Lantern, Tollworks, Drowned Toll-Gate)
  with two checkpoints and their own teal-accented minimap group.
- The **Tide** mechanic: deep water blocks, bridges cross it, and the **Tide Relic**
  (found ford-free at the Tide Shrine) lets you wade shallow fords to optional loot.
- 4 new enemies, the **Drowned Gear** miniboss (drops the **Brine Heart**), a
  tide-gate shortcut winch, two optional ford-branches, 8 lore fragments, and a
  journey-progress endpoint that teases the **Glass Country** beyond.

**The Glass Country** (Phase 4)

- 12 areas (White Threshold, Prism Road, Sundial Court, Lensworks, Shard Market,
  Mirrorfield, Hall of Refraction, Hidden Reflection, Splinter Vault, Buried Sun,
  Glass Warden's Chapel, Sun-Gate) with two checkpoints and a teal minimap group.
- **Crystal switches + crystal gates** (taught on the critical path), **mirror gates**
  woken by the **Crystal Shard**, a secret reflection room, a **shard-floor** hazard,
  4 new enemies, **The Glass Warden** miniboss (drops the **Glass Heart**), 9 lore
  fragments, a bright glass ambience, and the Sun-Gate endpoint teasing the **Iron
  Orchard**.

---

## Persistence

Everything is `localStorage`, no accounts/servers/cookies:

- Settings (mute, difficulty, last-chosen Vessel) and lifetime stats (best time,
  most embers, wins, deaths).
- An in-progress **run snapshot** (resources incl. Bell Tokens, opened chests,
  world flags, discovered lore, current checkpoint, and the active **Vessel**) so
  closing the tab resumes from your last rest, as the same hero, via **Continue Descent**.
- Expansion hooks (`unlockedRegions`, `discoveredRegions`, `completedMiniRegion`,
  `optionalEliteDefeated`, `completedReach`, `completedGlassCountry`, the
  `tideRelic` / `brineHeart` / `crystalShard` / `glassHeart` upgrades, and run flags
  like `crystal_red_lit` / `glassWardenDefeated`) auto-initialize on older saves. If a
  saved checkpoint room no longer exists, the game falls back to the nearest valid start.

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
    regions/saltblackReach.ts
    regions/glassCountry.ts
    characters/characterDefinitions.ts   # the 10 playable Vessels
    enemies/enemyDefinitions.ts
    bosses/bossDefinitions.ts
    items/itemDefinitions.ts
    lore/loreEntries.ts
```

See [`CONTENT_GUIDE.md`](CONTENT_GUIDE.md) for how to add Act 2+, regions, rooms,
enemies, bosses, items, lore, and asset mappings.

---

## Credits

- Art & audio: **Kenney** (kenney.nl) — *Tiny Dungeon*, *Tiny Town*, *Tiny Battle*,
  *Tiny Ski*, and RPG/Impact/Interface/Music packs, all **CC0**. Crediting is
  voluntary and gladly given.
- Engine, design, content, and the procedurally-drawn HUD icons were built for
  this project in TypeScript + Vite + Canvas.
