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
  | "requiresItem";

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
  | "arch";

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

export type FloorStyle = "stone" | "dirt" | "tile" | "grass" | "path";
export type WallStyle = "brick" | "stone" | "townstone" | "redbrick" | "wood" | "hedge";
export type RoomTheme = "dungeon" | "outdoor";
export type MusicTrack = "explore" | "boss" | "region";

export interface RoomDef {
  id: string;
  name: string;
  /** Short atmospheric subtitle shown on entry. */
  subtitle?: string;
  /**
   * ASCII layout. Each string is a row. Characters:
   *   '#' wall   '.' floor   ',' floor-variant   '~' hazard/pit
   *   '=' decorative wall (gargoyle)   ' ' void/outside
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
}
