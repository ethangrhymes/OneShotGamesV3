#!/usr/bin/env node
/**
 * prepare-assets.mjs — Kenney asset discovery & copy step.
 *
 * The full "Kenney Game Assets All-in-1" bundle is expected to live ONE FOLDER
 * ABOVE this repo during local development. This script:
 *   1. Locates the Kenney bundle in the parent directory (tolerant of naming).
 *   2. Copies only the assets Act 1 needs into public/assets/kenney/selected/
 *      using clean semantic filenames.
 *   3. Writes a manifest.json documenting every source -> dest mapping, plus a
 *      list of anything it could not find (the game falls back to procedural
 *      art / Web Audio for those).
 *
 * The deployed Cloudflare Pages build depends ONLY on the copied files inside
 * this repo — never on the parent folder. Re-run any time with:
 *     node scripts/prepare-assets.mjs
 *
 * Art direction: Kenney "Tiny Dungeon" (16x16 top-down). Chosen because it is
 * the most cohesive dungeon-crawler set in the bundle and ships as individual
 * per-tile PNGs (no spritesheet slicing). Tile index -> role mappings below were
 * derived by visually inspecting every tile in the pack.
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const parentDir = path.resolve(repoRoot, "..");
const outDir = path.join(repoRoot, "public", "assets", "kenney", "selected");

/** Find the Kenney bundle folder in the parent directory. */
function findKenneyBundle() {
  let entries = [];
  try {
    entries = fs.readdirSync(parentDir, { withFileTypes: true });
  } catch {
    return null;
  }
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  // Prefer folders that look like the All-in-1 bundle.
  const scored = dirs
    .map((name) => {
      const lower = name.toLowerCase();
      let score = 0;
      if (lower.includes("kenney")) score += 5;
      if (lower.includes("all-in-1") || lower.includes("all in 1")) score += 4;
      if (lower.includes("game assets")) score += 2;
      return { name, score };
    })
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score);
  for (const cand of scored) {
    const full = path.join(parentDir, cand.name);
    // Confirm it really has the expected 2D assets / Tiny Dungeon structure.
    if (fs.existsSync(path.join(full, "2D assets"))) return full;
  }
  // Fallback: any sibling that directly contains a Tiny Dungeon folder.
  for (const name of dirs) {
    const td = path.join(parentDir, name, "2D assets", "Tiny Dungeon");
    if (fs.existsSync(td)) return path.join(parentDir, name);
  }
  return null;
}

const bundle = findKenneyBundle();

// ----- Tile selection (Tiny Dungeon: <bundle>/2D assets/Tiny Dungeon/Tiles) ---
// Map of destFile -> source tile index in the Tiny Dungeon pack.
const TINY_DUNGEON = (idx) =>
  bundle
    ? path.join(
        bundle,
        "2D assets",
        "Tiny Dungeon",
        "Tiles",
        `tile_${String(idx).padStart(4, "0")}.png`
      )
    : null;

const tileSelection = {
  // --- terrain ---
  "wall.png": 0,
  "wall_cracked.png": 12,
  "wall_stone.png": 14,
  "wall_dark.png": 1,
  "gargoyle.png": 19,
  "floor.png": 36,
  "floor_b.png": 37,
  "floor_c.png": 38,
  "floor_dirt.png": 48,
  "floor_dirt_b.png": 50,
  "floor_dirt_c.png": 53,
  "floor_tile.png": 42,
  // --- doors & gates ---
  "door_closed.png": 21,
  "door_open.png": 23,
  "gate.png": 7,
  "gate_v.png": 18,
  "bars.png": 45,
  // --- interactables / props ---
  "torch.png": 29,
  "trap.png": 41,
  "chest_closed.png": 89,
  "chest_open.png": 92,
  "vault_closed.png": 54,
  "vault_open.png": 55,
  "ring.png": 56,
  "scroll.png": 66,
  "statue.png": 64,
  "barrel.png": 63,
  "barrel_top.png": 82,
  "crate.png": 72,
  "fence.png": 76,
  "anvil.png": 74,
  // --- characters ---
  "player.png": 112,
  "enemy_ooze.png": 108,
  "enemy_imp.png": 110,
  "enemy_wraith.png": 121,
  "enemy_spider.png": 122,
  "enemy_rat.png": 123,
  "enemy_bat.png": 120,
  "enemy_guard.png": 97,
  "enemy_caster.png": 84,
  "miniboss.png": 109,
  "boss.png": 87,
  "npc_captive.png": 99,
  "npc_elder.png": 100,
  // --- items / weapons ---
  "potion_red.png": 115,
  "potion_green.png": 114,
  "potion_blue.png": 116,
  "sword.png": 104,
  "dagger.png": 103,
  "axe.png": 119,
  "hammer.png": 117,
  "staff.png": 130,
};

// ----- Tile selection — pack 2: Tiny Town -----------------------------------
// Round 2 outdoor region "The Rootward Road". Same 16x16 scale/style as Tiny
// Dungeon (so collision/combat readability is unchanged), but a distinct
// overground identity: cursed dying woods, a swallowed hamlet, a broken
// causeway. Keys are prefixed "tt_" so they never clash with Tiny Dungeon keys.
const TINY_TOWN = (idx) =>
  bundle
    ? path.join(bundle, "2D assets", "Tiny Town", "Tiles", `tile_${String(idx).padStart(4, "0")}.png`)
    : null;

const townSelection = {
  "tt_grass.png": 0,
  "tt_grass_b.png": 1,
  "tt_grass_flower.png": 43,
  "tt_path.png": 48, // cobblestone path
  "tt_dirt.png": 41,
  "tt_tree.png": 9, // autumn/dying tree — the "rootward" look
  "tt_tree2.png": 21,
  "tt_tree_green.png": 4,
  "tt_bush.png": 17,
  "tt_mushroom.png": 29,
  "tt_fence.png": 80,
  "tt_wall_stone.png": 60,
  "tt_wall_red.png": 64,
  "tt_wall_wood.png": 72,
  "tt_roof.png": 67,
  "tt_house.png": 75, // building face with doorway
  "tt_door.png": 86,
  "tt_bridge.png": 100, // wooden bridge planks
  "tt_arch.png": 112, // stone causeway arch — the sealed Act II gate
  "tt_sign.png": 83, // hanging sign — outdoor lore
  "tt_stall.png": 104,
  "tt_barrel.png": 107,
  "tt_crate.png": 103,
  "tt_well.png": 125,
  "tt_chest.png": 131,
  "tt_relic.png": 94, // gold ring — the Bell Token relic
};

// ----- Audio selection -------------------------------------------------------
// destFile -> ordered list of candidate source relative paths (under <bundle>).
// First existing candidate wins; if none exist the game uses its Web Audio synth.
const audioSelection = {
  "attack.ogg": ["Audio/RPG Audio/Audio/knifeSlice.ogg", "Audio/RPG Audio/Audio/knifeSlice2.ogg"],
  "hit.ogg": [
    "Audio/Impact Sounds/Audio/impactPunch_medium_002.ogg",
    "Audio/Impact Sounds/Audio/impactPunch_medium_000.ogg",
  ],
  "hurt.ogg": [
    "Audio/Impact Sounds/Audio/impactPunch_heavy_002.ogg",
    "Audio/Impact Sounds/Audio/impactPunch_heavy_004.ogg",
  ],
  "bosshit.ogg": [
    "Audio/Impact Sounds/Audio/impactMetal_heavy_000.ogg",
    "Audio/Impact Sounds/Audio/impactMetal_heavy_001.ogg",
  ],
  "coin.ogg": ["Audio/RPG Audio/Audio/handleCoins.ogg", "Audio/RPG Audio/Audio/handleCoins2.ogg"],
  "pickup.ogg": [
    "Audio/Interface Sounds/Audio/confirmation_001.ogg",
    "Audio/Interface Sounds/Audio/confirmation_002.ogg",
  ],
  "door.ogg": ["Audio/RPG Audio/Audio/doorOpen_1.ogg", "Audio/RPG Audio/Audio/doorOpen_2.ogg"],
  "unlock.ogg": ["Audio/RPG Audio/Audio/metalLatch.ogg", "Audio/RPG Audio/Audio/metalClick.ogg"],
  "gate.ogg": ["Audio/RPG Audio/Audio/creak1.ogg", "Audio/RPG Audio/Audio/creak2.ogg"],
  "lore.ogg": ["Audio/RPG Audio/Audio/bookFlip1.ogg", "Audio/RPG Audio/Audio/bookOpen.ogg"],
  "checkpoint.ogg": [
    "Audio/Interface Sounds/Audio/confirmation_003.ogg",
    "Audio/Interface Sounds/Audio/bong_001.ogg",
  ],
  "select.ogg": ["Audio/Interface Sounds/Audio/select_001.ogg", "Audio/Interface Sounds/Audio/select_002.ogg"],
  "music_explore.ogg": ["Audio/Music Loops/Loops/Infinite Descent.ogg"],
  "music_boss.ogg": ["Audio/Music Loops/Loops/Sad Descent.ogg", "Audio/Music Loops/Retro/Retro Mystic.ogg"],
  // colder, wider ambience for the outdoor Rootward Road region
  "music_region2.ogg": [
    "Audio/Music Loops/Loops/Flowing Rocks.ogg",
    "Audio/Music Loops/Loops/Sad Town.ogg",
    "Audio/Music Loops/Retro/Retro Mystic.ogg",
  ],
};

// ----- run -------------------------------------------------------------------
function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true });
}

function firstExisting(candidates) {
  for (const rel of candidates) {
    const full = path.join(bundle, rel);
    if (fs.existsSync(full)) return { rel, full };
  }
  return null;
}

const manifest = {
  generatedBy: "scripts/prepare-assets.mjs",
  artDirection:
    "16x16 top-down, CC0. Act I (The Sunken Keep) = Kenney Tiny Dungeon. " +
    "Round 2 region (The Rootward Road) = Kenney Tiny Town (tt_* keys). " +
    "Two cohesive same-scale packs used as distinct cursed regions.",
  bundleFound: !!bundle,
  bundlePath: bundle ? path.basename(bundle) : null,
  tileSize: 16,
  tiles: {},
  audio: {},
  missing: [],
};

const tilesOut = path.join(outDir, "tiles");
const audioOut = path.join(outDir, "audio");
ensureDir(tilesOut);
ensureDir(audioOut);

let copiedTiles = 0;
let copiedAudio = 0;

if (!bundle) {
  console.warn(
    "[prepare-assets] Kenney bundle NOT found in parent directory. " +
      "The game will run with procedural fallback art/audio."
  );
} else {
  console.log(`[prepare-assets] Using Kenney bundle: ${bundle}`);

  for (const [dest, idx] of Object.entries(tileSelection)) {
    const src = TINY_DUNGEON(idx);
    if (src && fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(tilesOut, dest));
      manifest.tiles[dest] = {
        pack: "2D assets/Tiny Dungeon",
        tile: `tile_${String(idx).padStart(4, "0")}.png`,
        index: idx,
      };
      copiedTiles++;
    } else {
      manifest.missing.push({ category: "tile", dest, wantedIndex: idx });
    }
  }

  for (const [dest, idx] of Object.entries(townSelection)) {
    const src = TINY_TOWN(idx);
    if (src && fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(tilesOut, dest));
      manifest.tiles[dest] = {
        pack: "2D assets/Tiny Town",
        tile: `tile_${String(idx).padStart(4, "0")}.png`,
        index: idx,
      };
      copiedTiles++;
    } else {
      manifest.missing.push({ category: "tile", dest, wantedIndex: idx });
    }
  }

  for (const [dest, candidates] of Object.entries(audioSelection)) {
    const found = firstExisting(candidates);
    if (found) {
      fs.copyFileSync(found.full, path.join(audioOut, dest));
      manifest.audio[dest] = { source: found.rel };
      copiedAudio++;
    } else {
      manifest.missing.push({ category: "audio", dest, candidates });
    }
  }
}

manifest.counts = {
  tiles: copiedTiles,
  audio: copiedAudio,
  missing: manifest.missing.length,
};

ensureDir(outDir);
fs.writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n"
);

console.log(
  `[prepare-assets] Copied ${copiedTiles} tiles, ${copiedAudio} audio files. ` +
    `${manifest.missing.length} missing (fallbacks active). Manifest written.`
);
