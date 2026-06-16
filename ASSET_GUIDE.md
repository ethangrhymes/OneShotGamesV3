# Asset Guide — Mining the Kenney bundle for Emberfall Keep

This game treats the **Kenney Game Assets All-in-1** bundle as a *worldbuilding
toolbox*, not a single skin. Each region is a different cohesive Kenney pack, and the
visual shifts are written into the lore as the curse stitching incompatible places
together. This guide explains what's used, how it's chosen, and how a future pass
should add more — without ever bloating the deployed build.

---

## The golden rules

1. **The deployed build depends ONLY on files inside this repo.** Everything the game
   loads at runtime lives under `public/assets/kenney/selected/` and is committed. The
   parent-folder bundle is a *dev-time source*, never a runtime dependency.
2. **Copy only what a region needs.** Never bulk-copy a pack. The whole game ships ~100
   tiny tiles + 16 short audio clips. Curate; don't dump.
3. **Everything has a procedural fallback.** A missing/failed PNG draws a clean
   canvas stand-in (see `Renderer.ts`), and audio falls back to the Web Audio synth.
   So a wrong index or an absent bundle degrades gracefully instead of crashing.
4. **Match the 16×16 scale.** Prefer packs that are also 16×16 individual per-tile PNGs
   so the player/enemy colliders and combat reach stay correct across regions.

---

## Where the bundle lives (dev only)

```txt
parent-folder/
  Kenney Game Assets All-in-1 .../
    2D assets/Tiny Dungeon/Tiles/tile_XXXX.png
    2D assets/Tiny Town/Tiles/...
    2D assets/Tiny Battle/Tiles/...
    Audio/Music Loops/ ...  Audio/RPG Audio/ ...  Audio/Impact Sounds/ ...
  OneShotGamesV3/                       <- this repo
    public/assets/kenney/selected/{tiles,audio,manifest.json}
```

`scripts/prepare-assets.mjs` locates the bundle in the parent dir (tolerant of the
exact folder name), copies the curated selection with **clean semantic filenames**, and
writes `manifest.json` documenting every `source pack + tile index → dest` mapping plus
anything it couldn't find. Re-run any time:

```bash
node scripts/prepare-assets.mjs
```

`AssetManager` loads the manifest at runtime and exposes each tile by its semantic key
(filename minus `.png`). `Renderer` blits by key with a fallback per category.

---

## Packs in use (three regions, three cohesive families)

| Region | Pack | Key prefix | Grid | What it supplies |
| --- | --- | --- | --- | --- |
| Act I — The Sunken Keep | **Tiny Dungeon** | *(none)* | 12×11 (132) | hero, monsters, bosses, walls, doors, gates, chests, potions, braziers, scrolls, the seal ring |
| The Rootward Road | **Tiny Town** | `tt_` | 12×11 (132) | grass, cobble roads, dying autumn trees, houses, fences, a causeway arch, signs, a well, a stall, the bell-token relic |
| The Saltblack Reach | **Tiny Battle** | `tb_` | 18×11 (198) | deep & shallow water, coasts, plank bridges, fords, ruined keeps/bastions, drowned banners, a crossed-blade grave marker, a sand cairn, a beached warship |
| The Glass Country | **Tiny Ski** | `sk_` | 12×11 (132) | bright white/ice terrain (glass ground), frost trees, lift pylons, gate arches, prism banners, a ski-lodge, and red-eyed wolves + a yeti as enemy sprites |

**Terrain from Kenney, magic from the engine.** The Glass Country pairs a real Kenney
pack (Tiny Ski terrain) with **procedural** light effects for everything magical —
crystals, crystal gates, mirror portals, the Crystal Shard, the buried sun, shard
floors. Crystalline light animates and glows far better as additive canvas art than as
flat 16×16 tiles, and it sidesteps slicing the spritesheet-only packs (Generic Items,
Rune Pack, Roguelike, etc. ship no per-tile `Tiles/` folder, only packed sheets). This
"Kenney ground + engine-rendered magic" split is a good default whenever a region's
identity is *light* rather than *stuff*.

Indices were derived by inspecting each pack's tilemap. **Index = `row * columns + col`**
(Tiny Dungeon/Town are 12-wide; Tiny Battle is 18-wide). When in doubt, render a
labeled contact sheet of `tile_XXXX.png` files and read the indices off it before
committing them to `prepare-assets.mjs`.

Audio is drawn from `Audio/Music Loops`, `Audio/RPG Audio`, `Audio/Impact Sounds`, and
`Audio/Interface Sounds`, each as an ordered candidate list (first existing wins, else
synth). The Reach adds a `music_reach.ogg` candidate (a colder, tidal loop).

---

## How styles are justified in-fiction

Mixing packs is deliberate, never random — and the *reason* is the story:

- **Dungeon → Town:** the Keep's curse "takes root" along an old bell-road.
- **Town → Battle:** the road drowns into a war-coast where an ancient war sank
  mid-stride; the curse stitches that broken era into the path.

The question is never "does this asset perfectly match Tiny Dungeon?" — it's "can this
become part of a readable, mobile-friendly adventure region, with a line of lore to
explain the seam?" Put that line in a `LoreEntry` near the visual shift (e.g.
`l_tideshrine`, `l_strand`).

---

## How a future pass should search the bundle creatively

The next sealed segment is teased as **The Iron Orchard** (iron / orchard-rows / the
curse "growing things again" — machines + foliage). Promising directions to scout:

- **Important finding:** only the **Tiny** family (Tiny Dungeon/Town/Battle/Ski — all
  now used) ships per-tile PNGs in a `Tiles/` folder, which is what `prepare-assets.mjs`
  copies by index. Other promising packs (**Generic Items**, **Rune Pack**, **Roguelike**
  sets, **Simple Space**, **RTS Sci-fi**, **Tower Defense**) ship **packed spritesheets
  only** — no `Tiles/` folder — so they can't be copied tile-by-tile without slicing.
- **Two ways forward for a non-Tiny look:** (a) render the region's signature elements
  **procedurally** (as the Glass Country does for all its crystal/mirror/light), pairing
  them with whatever Tiny terrain fits; or (b) pre-slice a *small* set of tiles from a
  packed sheet (PIL/canvas) into individual PNGs committed under `selected/tiles/`. Keep
  the deployed asset count modest either way.
- For the Iron Orchard specifically: Tiny Town has fences/farm-ish props, Tiny Battle
  has machinery-adjacent tiles, and procedural rust/vine/gear-light could carry the rest.

Workflow for adding a pack:

1. Confirm it's 16×16 individual PNGs (or normalize the draw size). Note its column
   count for the `row*cols+col` math.
2. Pick a *small* curated set; map them to a new `xx_`-prefixed selection object in
   `prepare-assets.mjs` (copy the `battleSelection` / `skiSelection` block as a template).
3. Add `floor`/`wall` style cases in `Renderer.floorKey`/`wallKey` and any new
   `PropKind`s in `Renderer.propKey` (+ `types.ts`), each with a fallback. For
   *light/energy* elements, prefer a procedural draw (see `drawCrystal`, `drawMirrorGate`,
   `drawSunstone`, `drawCrystalShard` in `Renderer.ts`).
4. Re-run the prepare script, give the region's rooms `theme` + the new styles, and
   write a lore line justifying the look. **Always ground-check copied indices** — render
   a labelled contact sheet of the `tile_XXXX.png` files; both Tiny Battle and Tiny Ski
   had an off-by-a-few index (a digit tile) caught exactly this way.

---

## Keeping deployment self-contained

- `vite.config.ts` keeps `base: "./"` and `outDir: "dist"`, so relative asset URLs work
  from any path on Cloudflare Pages.
- New assets must be **copied into the repo** via the prepare script and committed —
  never fetched from outside the repo at runtime.
- `npm run build` type-checks then emits a fully static `dist/`. No backend, no env
  vars, no Node at runtime. If the parent bundle is absent, the game still runs
  entirely on procedural art + synth audio.
