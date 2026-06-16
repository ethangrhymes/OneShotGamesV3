/**
 * types.ts — shared type vocabulary for the whole game.
 *
 * The content model (WorldAct -> Region -> Room) is intentionally data-driven so
 * future AI/human passes can add Act 2+, new regions, enemies, bosses, items and
 * lore by writing new data files in src/content/ — without touching the engine.
 * See CONTENT_GUIDE.md.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export type Direction = "up" | "down" | "left" | "right";

/** Cardinal edge a door sits on. */
export type Edge = "n" | "s" | "e" | "w";

// ---------------------------------------------------------------------------
// Flags & progression
// ---------------------------------------------------------------------------

/** Named world-state flags. Open string union keeps it extensible. */
export type GameFlag =
  | "minibossDefeated"
  | "shortcutUnlocked"
  | "actBossDefeated"
  | (string & {});

export type UpgradeId =
  | "heartVessel" // +1 max heart
  | "wardensEdge" // longer / stronger attack
  | "swiftBoots" // faster dash cooldown
  | "emberHeart" // +1 max heart (Round 2)
  | "tideRelic" // Phase 3: ford shallow tide-water
  | "brineHeart" // Phase 3: +1 max heart (Drowned Gear reward)
  | "crystalShard" // Phase 4: wake dormant mirror gates
  | "glassHeart" // Phase 4: +1 max heart (Glass Warden reward)
  | (string & {});

// ---------------------------------------------------------------------------
// Connections between rooms
// ---------------------------------------------------------------------------

export type ConnectionType =
  | "open"
  | "locked" // consumes an Iron Key
  | "bossGate" // requires N seals / a flag
  | "shortcut" // sealed until a world flag is set (one-time unlock)
  | "oneWay" // passable in a single direction
  | "requiresItem"
  | "crystalGate" // Phase 4: opens when its crystal `flag` is lit (a crystal switch)
  | "mirror"; // Phase 4: teleport door, passable only with the Crystal Shard

/**
 * A door placed on a room edge. Doors are linked in pairs by `to`/`toDoorId`,
 * so traversing one places the player at its partner in the target room.
 */
export interface DoorDef {
  id: string;
  /** Tile coordinates of the door opening within the room. */
  tx: number;
  ty: number;
  edge: Edge;
  to: string; // target room id
  toDoorId: string; // partner door id in target room
  type: ConnectionType;
  /** For "bossGate": how many seals are required (default 2). */
  sealsRequired?: number;
  /** For "shortcut": the world flag that opens it. */
  flag?: GameFlag;
  /** For "requiresItem": item id needed. */
  requiredItemId?: string;
  /** Hint shown to the player when the door is blocked. */
  lockedHint?: string;
}

// ---------------------------------------------------------------------------
// Entities placed in rooms (spawns)
// ---------------------------------------------------------------------------

export type SpawnKind =
  | "enemy"
  | "miniboss"
  | "boss"
  | "checkpoint"
  | "lore"
  | "chest"
  | "pickup"
  | "key"
  | "seal"
  | "upgrade"
  | "lever" // opens a shortcut flag
  | "prop"; // decorative / collidable

export type PickupKind = "heart" | "ember" | "potion" | "token";

export type PropKind =
  | "barrel"
  | "crate"
  | "statue"
  | "anvil"
  | "fence"
  | "gargoyle"
  | "bars"
  | "torch"
  | "scroll"
  // outdoor (Tiny Town) props
  | "tree"
  | "bush"
  | "mushroom"
  | "sign"
  | "well"
  | "stall"
  | "arch"
  // war-coast (Tiny Battle) props
  | "ship" // beached warship hull
  | "flag" // drowned banner
  | "tower" // ruined keep / watchtower
  | "dune" // sand cairn
  | "warcross" // crossed-blade grave marker
  // glass-country (Tiny Ski + procedural) props
  | "crystal" // a still (decorative) glowing crystal
  | "sunstone" // a buried-sun shard (large glow)
  | "pylon" // a crystal pylon
  | "shrine"; // a glass chapel / station

export interface SpawnDef {
  kind: SpawnKind;
  tx: number;
  ty: number;
  /** enemy/boss definition id, item id, lore id, etc. */
  ref?: string;
  /** pickup specifics */
  pickup?: PickupKind;
  amount?: number;
  /** prop specifics */
  prop?: PropKind;
  /** a unique id so we can persist "already taken / already opened" state. */
  uid?: string;
  /** chest can contain a reward */
  contains?: ChestContents;
  /** lever sets this flag when pulled */
  setsFlag?: GameFlag;
  /** only spawn if this flag is set / not set */
  requiresFlag?: GameFlag;
  blockedByFlag?: GameFlag;
  /** solid prop blocks movement */
  solid?: boolean;
}

export interface ChestContents {
  embers?: number;
  hearts?: number;
  key?: number;
  seal?: number;
  upgrade?: UpgradeId;
  loreId?: string;
}

// ---------------------------------------------------------------------------
// Rooms / Regions / Acts
// ---------------------------------------------------------------------------

export type FloorStyle = "stone" | "dirt" | "tile" | "grass" | "path" | "saltgrass" | "glass";
export type WallStyle = "brick" | "stone" | "townstone" | "redbrick" | "wood" | "hedge" | "glass";
export type RoomTheme = "dungeon" | "outdoor" | "glass";
export type MusicTrack = "explore" | "boss" | "region" | "reach" | "glass";

export interface RoomDef {
  id: string;
  name: string;
  /** Short atmospheric subtitle shown on entry. */
  subtitle?: string;
  /**
   * ASCII layout. Each string is a row. Characters:
   *   '#' wall   '.' floor   ',' floor-variant   '~' hazard/pit
   *   '=' decorative wall (gargoyle)   ' ' void/outside
   *   'W' deep water (always solid)   'w' shallow tide (solid until the
   *   Tide Relic is held)   'B' bridge planks (always walkable)
   * Door openings are carved automatically from `doors`.
   */
  layout: string[];
  floor: FloorStyle;
  wall: WallStyle;
  /** drives decorative-tile + prop sprite choice (dungeon vs outdoor). */
  theme?: RoomTheme;
  doors: DoorDef[];
  spawns: SpawnDef[];
  /** Region-space grid coordinate, used for the minimap. */
  gx: number;
  gy: number;
  isSafe?: boolean;
  music?: MusicTrack;
}

export interface RegionDef {
  id: string;
  name: string;
  theme: string;
  rooms: RoomDef[];
  startRoomId: string;
  startDoorId?: string;
  /** minimap accent color for this region. */
  accent?: string;
}

export interface WorldAct {
  id: string;
  title: string;
  description: string;
  startingRegionId: string;
  regions: RegionDef[];
  enemies: Record<string, EnemyDef>;
  bosses: Record<string, BossDef>;
  items: Record<string, ItemDef>;
  lore: Record<string, LoreEntry>;
  /** Number of Warden Seals needed to open the boss gate. */
  sealsForBoss: number;
}

// ---------------------------------------------------------------------------
// Enemy / boss / item / lore definitions
// ---------------------------------------------------------------------------

export type EnemyBehavior =
  | "chaser" // moves straight at player, contact damage
  | "swarm" // fast, light, erratic chaser
  | "patroller" // patrols, charges when player in range
  | "shooter" // keeps distance, fires projectiles
  | "tank" // slow, high health, telegraphed lunge
  // --- Round 2 behaviors ---
  | "turret" // stationary; fires telegraphed volleys
  | "charger" // long telegraphed windup, then a fast straight charge
  | "splitter"; // on death, splits into smaller swarmers

export interface EnemyDef {
  id: string;
  name: string;
  sprite: string; // AssetManager key
  behavior: EnemyBehavior;
  hp: number;
  damage: number;
  speed: number; // px/sec
  radius: number; // collision radius (px)
  /** embers dropped on death. */
  embers: number;
  /** tint used by the procedural fallback shape. */
  fallbackColor: string;
  /** shooter cadence (sec) and projectile speed (px/sec). */
  fireInterval?: number;
  projectileSpeed?: number;
  /** detection / aggro radius (px). 0 = always active. */
  aggroRange?: number;
  /** scale multiplier for rendering (elites). */
  scale?: number;
  /** chance [0..1] to drop a heart on death. */
  heartChance?: number;
  /** elite/champion: tougher, glows, drops more. */
  elite?: boolean;
  /** splitter: what it spawns on death. */
  splitsInto?: { ref: string; count: number };
}

export interface BossAttackPattern {
  id: string;
  /** telegraph (windup) seconds before the hit lands. */
  telegraph: number;
  /** recovery seconds after. */
  recovery: number;
  /** cooldown before this can be chosen again. */
  cooldown: number;
  kind: "slam" | "shockwave" | "volley" | "charge" | "summon";
  damage: number;
}

export interface BossDef {
  id: string;
  name: string;
  title: string;
  sprite: string;
  hp: number;
  contactDamage: number;
  speed: number;
  radius: number;
  scale: number;
  fallbackColor: string;
  embers: number;
  patterns: BossAttackPattern[];
  /** intro / phase / defeat lore lines. */
  introLine: string;
  phaseLine: string;
  defeatLine: string;
  isMiniboss?: boolean;
  /** what defeating this boss grants. */
  reward?: ChestContents;
  /** flag set when defeated. */
  setsFlag?: GameFlag;
  /** enemy id summoned by a "summon" pattern (default "wraith"). */
  summonRef?: string;
}

// ---------------------------------------------------------------------------
// Playable characters ("Vessels")
// ---------------------------------------------------------------------------

/** How a character's weapon looks + animates, and how its hit is shaped. */
export type WeaponKind =
  | "sword" // balanced arc swing
  | "hammer" // slow heavy arc, big knockback
  | "axe" // wide heavy arc
  | "spear" // long narrow thrust (cleaves the line)
  | "dagger" // short fast thrust
  | "scythe" // medium reaping arc
  | "quarterstaff" // 360° spin (hits all around)
  | "cutlass" // quick light arc (combo)
  | "staff" // ranged caster (ember-bolts)
  | "bow"; // ranged archer (piercing arrows)

/** The shape of the attack motion the renderer plays + combat resolves. */
export type AttackStyle = "swing" | "thrust" | "spin" | "cast";

/**
 * A playable "Vessel". The Ember chooses one at the start and may take up a
 * different fallen form at any Emberlight. Each is a Tiny Dungeon figure paired
 * with a distinct procedural weapon (animated on attack) and a signature perk,
 * so the choice changes both how the game looks and how it plays. Data-driven:
 * see src/content/characters/characterDefinitions.ts.
 */
export interface CharacterDef {
  id: string;
  name: string;
  /** short class/role line shown under the name. */
  role: string;
  /** AssetManager sprite key (pc_*). */
  sprite: string;
  weapon: WeaponKind;
  style: AttackStyle;
  /** accent + weapon colour (hex). */
  color: string;
  /** flavour for the select screen (1–2 lines). */
  blurb: string;
  /** short label for the signature perk. */
  perkName: string;
  /** one-line description of the perk's effect. */
  perkDesc: string;

  // ---- combat profile (× multipliers on Balance.player unless noted) ----
  damage: number; // base attack / projectile damage (absolute pips)
  reachMult: number; // melee reach ×
  arcMult: number; // swing arc width ×
  cooldownMult: number; // attack cooldown ×
  durationMult?: number; // active hit-window × (default 1)
  speedMult: number; // move speed ×
  enemyKnockbackMult?: number; // how hard hits shove enemies (default 1)

  // ---- ranged (style === "cast") ----
  ranged?: {
    projectileSpeed: number;
    pierce?: number; // extra enemies a shot passes through (default 0)
    shots?: number; // projectiles per attack (default 1)
    spread?: number; // radians between multi-shots
  };

  // ---- passive perk effects ----
  heartsBonus?: number; // + max hearts
  dashCooldownMult?: number; // dash cooldown × (default 1)
  iframeBonus?: number; // + added to the hurt-iframe multiplier
  knockbackResist?: number; // ×, scales knockback TAKEN (default 1; <1 = sturdier)
  lifestealChance?: number; // chance [0..1] to heal 1 pip on a kill
}

export type ItemKind = "key" | "seal" | "upgrade" | "consumable";

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  sprite: string;
  description: string;
  upgrade?: UpgradeId;
}

export interface LoreEntry {
  id: string;
  title: string;
  text: string;
}

// ---------------------------------------------------------------------------
// Save data
// ---------------------------------------------------------------------------

export interface SaveData {
  version: number;
  muted: boolean;
  // best / lifetime stats
  bestTimeMs: number | null;
  bestEmbers: number;
  totalWins: number;
  totalDeaths: number;
  // expansion hooks (intentionally generous for future acts)
  availableActs: string[];
  completedActs: string[];
  worldFlags: Record<string, boolean>;
  regionUnlocks: Record<string, boolean>;
  bossDefeatedFlags: Record<string, boolean>;
  permanentUpgrades: UpgradeId[];
  loreDiscovered: string[];
  checkpointId: string | null;
  difficultyMode: "easy" | "normal" | "hard";
  // ---- Round 2 expansion hooks (older saves auto-initialize these) ----
  unlockedRegions: string[];
  discoveredRegions: string[];
  completedMiniRegion: boolean;
  round2VisitedWorldGate: boolean;
  optionalEliteDefeated: boolean;
  audioModeVersion: number;
  // ---- Phase 3 expansion hooks (older saves auto-initialize these) ----
  completedReach: boolean; // reached the Drowned Toll-Gate (Phase 3 endpoint)
  // ---- Phase 4 expansion hooks (older saves auto-initialize these) ----
  completedGlassCountry: boolean; // reached the Sun-Gate (Phase 4 endpoint)
  // ---- Character-roster hooks (older saves auto-initialize these) ----
  characterId: string; // last-chosen playable Vessel (character-select default)
}
