# Emberfall Keep — Act I

A complete, mobile-friendly **top-down dungeon crawler** in the spirit of Zelda, with
light Soulslike structure (Emberlight checkpoints, a recoverable death drop, a boss
gate sealed behind relics, and a shortcut you open from deep inside). Built with
TypeScript + Vite + HTML5 Canvas, rendered with Kenney's **Tiny Dungeon** art.

> The light that kept the Keep has gone hollow. Descend the Sunken Keep, gather the
> Warden Seals, break the curse — and glimpse the wider world that waits beyond.

This is **Act I** of a deliberately expandable world: the engine is data-driven, so
future acts/regions/bosses are added as content files, not engine rewrites
(see [`CONTENT_GUIDE.md`](CONTENT_GUIDE.md)).

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

### Art direction

One cohesive style: **Kenney "Tiny Dungeon"** (16×16 top-down, CC0). It ships as
individual per-tile PNGs, so there's no spritesheet slicing. Chosen sprites
include the green-hooded hero, six monsters (rat, ooze, spider, moth, wraith,
cultist), an armored sentinel, the Gaoler brute (miniboss), the horned Hollow
Warden (final boss), chests, potions, doors, gates, braziers, scrolls, and the
Warden Seal ring.

### Fallback behavior

The game **never breaks on a missing asset**:

- Hearts, embers (currency), and Iron Keys have no Tiny Dungeon tile, so they are
  **always drawn procedurally** in a matching chunky-pixel style.
- Every sprite category also has a procedural fallback shape — if a PNG fails to
  load, the renderer draws a clean readable stand-in instead of crashing.
- Audio uses a **Web Audio synth engine** for all sound effects and an ambient
  music bed, which works on every browser (including older iOS Safari that can't
  decode `.ogg`). Decoded Kenney clips are preferred when the browser supports
  them; otherwise the synth fallback is seamless. Mute persists in `localStorage`.

If asset discovery fails entirely, the game still runs fully with procedural art
and synth audio.

---

## What's in Act I

- 16 connected rooms in one region ("The Sunken Keep"), with a minimap.
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

---

## Persistence

Everything is `localStorage`, no accounts/servers/cookies:

- Settings (mute, difficulty) and lifetime stats (best time, most embers, wins,
  deaths).
- An in-progress **run snapshot** (resources, opened chests, world flags,
  discovered lore, current checkpoint) so closing the tab resumes from your last
  Emberlight via **Continue Descent**.

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
                       #         Checkpoints, Lore, UI, Balance, types
  content/             # DATA-DRIVEN content (add new acts here)
    acts/act1.ts
    enemies/enemyDefinitions.ts
    bosses/bossDefinitions.ts
    items/itemDefinitions.ts
    lore/loreEntries.ts
```

See [`CONTENT_GUIDE.md`](CONTENT_GUIDE.md) for how to add Act 2+, regions, rooms,
enemies, bosses, items, lore, and asset mappings.

---

## Credits

- Art & audio: **Kenney** (kenney.nl) — *Tiny Dungeon* + RPG/Impact/Interface/Music
  packs, all **CC0**. Crediting is voluntary and gladly given.
- Engine, design, content, and the procedurally-drawn HUD icons were built for
  this project in TypeScript + Vite + Canvas.
