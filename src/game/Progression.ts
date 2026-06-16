/**
 * Progression.ts — the in-memory RunState plus its derived combat stats.
 *
 * A "run" is one playthrough of an Act. Progress (keys, seals, upgrades, opened
 * chests, world flags, checkpoint) persists across deaths and can be snapshotted
 * to localStorage so closing the tab resumes from the last checkpoint. Normal
 * enemies reset because rooms re-instantiate their spawns on each entry; bosses
 * stay dead because their spawns are gated behind defeat flags.
 */
import { Balance, type DifficultyMode } from "./Balance";
import type { CharacterDef, GameFlag, UpgradeId } from "./types";

export interface RunStats {
  startTime: number;
  elapsedMs: number;
  enemiesDefeated: number;
  embersCollected: number;
  loreFound: number;
  deaths: number;
  damageTaken: number;
  roomsVisited: Set<string>;
  bossDefeated: boolean;
}

export interface RunSnapshot {
  hp: number;
  embers: number;
  keys: number;
  seals: number;
  bellTokens?: number;
  upgrades: UpgradeId[];
  takenUids: string[];
  flags: Record<string, boolean>;
  checkpointId: string | null;
  checkpointRoomId: string | null;
  lostEmbers: number;
  lostRoomId: string | null;
  lostX: number;
  lostY: number;
  stats: Omit<RunStats, "roomsVisited" | "startTime"> & { roomsVisited: string[] };
  difficulty: DifficultyMode;
  characterId?: string; // chosen Vessel (older snapshots default to the Warden)
}

export class RunState {
  hp: number;
  embers = 0;
  keys = 0;
  seals = 0;
  bellTokens = 0; // optional Round 2 collectible (Bell Tokens of the Rootward Road)
  upgrades = new Set<UpgradeId>();
  takenUids = new Set<string>();
  flags: Record<string, boolean> = {};
  checkpointId: string | null = null;
  checkpointRoomId: string | null = null;

  // recoverable "echo" on death (Soulslike)
  lostEmbers = 0;
  lostRoomId: string | null = null;
  lostX = 0;
  lostY = 0;

  difficulty: DifficultyMode = "normal";
  /** the chosen playable Vessel — drives the combat profile + signature perk. */
  character: CharacterDef;

  stats: RunStats = {
    startTime: 0,
    elapsedMs: 0,
    enemiesDefeated: 0,
    embersCollected: 0,
    loreFound: 0,
    deaths: 0,
    damageTaken: 0,
    roomsVisited: new Set<string>(),
    bossDefeated: false,
  };

  constructor(difficulty: DifficultyMode, character: CharacterDef) {
    this.difficulty = difficulty;
    this.character = character;
    this.hp = this.maxHp;
  }

  private get diff() {
    return Balance.difficulty[this.difficulty];
  }
  get iframeMult(): number {
    // difficulty mercy + the Vessel's own toughness perk (e.g. Sentinel's Bulwark)
    return this.diff.iframeMult + (this.character.iframeBonus ?? 0);
  }
  get knockbackMult(): number {
    // a sturdy Vessel (knockbackResist < 1) is shoved around less
    return this.diff.knockbackMult * (this.character.knockbackResist ?? 1);
  }
  get aggroMult(): number {
    return this.diff.aggroMult;
  }

  // ---- derived stats ----
  get heartVesselCount(): number {
    // each max-heart upgrade adds one (Heart Vessel = Act I, Ember Heart = Round 2,
    // Brine Heart = Phase 3, Glass Heart = Phase 4)
    return (
      (this.upgrades.has("heartVessel") ? 1 : 0) +
      (this.upgrades.has("emberHeart") ? 1 : 0) +
      (this.upgrades.has("brineHeart") ? 1 : 0) +
      (this.upgrades.has("glassHeart") ? 1 : 0)
    );
  }
  /** Phase 3: the Tide Relic lets the player ford shallow tide-water. */
  get tideUnlocked(): boolean {
    return this.upgrades.has("tideRelic");
  }
  /** Phase 4: the Crystal Shard wakes dormant mirror gates. */
  get crystalShard(): boolean {
    return this.upgrades.has("crystalShard");
  }
  get maxHearts(): number {
    return (
      Balance.player.maxHeartsStart +
      this.diff.heartsBonus +
      this.heartVesselCount * Balance.upgrades.heartVesselBonus +
      (this.character.heartsBonus ?? 0)
    );
  }
  get maxHp(): number {
    return this.maxHearts * Balance.player.hpPerHeart;
  }
  /** Move speed (px/sec) — scaled by the Vessel's footwork. */
  get moveSpeed(): number {
    return Balance.player.speed * this.character.speedMult;
  }
  get attackReach(): number {
    return (
      Balance.player.attackReach * this.character.reachMult +
      (this.upgrades.has("wardensEdge") ? Balance.upgrades.wardensEdgeReach : 0)
    );
  }
  /** Swing arc width (radians) — wide for axes/whirls, narrow for thrusts. */
  get attackArc(): number {
    const a = Balance.player.attackArc * this.character.arcMult;
    return Math.max(0.2, Math.min(Math.PI * 1.95, a));
  }
  /** Active hit-window (sec) — also paces the weapon's swing animation. */
  get attackDuration(): number {
    return Balance.player.attackDuration * (this.character.durationMult ?? 1);
  }
  get attackCooldown(): number {
    return Balance.player.attackCooldown * this.character.cooldownMult;
  }
  get attackDamage(): number {
    return (
      this.character.damage +
      (this.upgrades.has("wardensEdge") ? Balance.upgrades.wardensEdgeDamage : 0)
    );
  }
  /** How hard a melee hit shoves an enemy back. */
  get enemyKnockback(): number {
    return Balance.combat.enemyKnockback * (this.character.enemyKnockbackMult ?? 1);
  }
  /** Ranged Vessels (staff/bow) attack only through projectiles — no melee. */
  get isRanged(): boolean {
    return this.character.style === "cast";
  }
  /** Chance [0..1] to mend a pip on a kill (Revenant's Harvest). */
  get lifestealChance(): number {
    return this.character.lifestealChance ?? 0;
  }
  get dashCooldown(): number {
    return (
      Balance.player.dashCooldown *
      (this.upgrades.has("swiftBoots") ? Balance.upgrades.swiftBootsCooldownMult : 1) *
      (this.character.dashCooldownMult ?? 1)
    );
  }

  // ---- mutations ----
  addEmbers(n: number) {
    this.embers += n;
    this.stats.embersCollected += n;
  }
  addKey(n = 1) {
    this.keys += n;
  }
  useKey(): boolean {
    if (this.keys <= 0) return false;
    this.keys--;
    return true;
  }
  addSeal(n = 1) {
    this.seals += n;
  }
  addToken(n = 1) {
    this.bellTokens += n;
  }
  addUpgrade(id: UpgradeId) {
    const had = this.upgrades.has(id);
    this.upgrades.add(id);
    // gaining a max-heart upgrade also tops you up by the new heart
    if ((id === "heartVessel" || id === "emberHeart" || id === "brineHeart" || id === "glassHeart") && !had)
      this.hp = Math.min(this.maxHp, this.hp + Balance.player.hpPerHeart);
  }
  heal(pips: number) {
    this.hp = Math.min(this.maxHp, this.hp + pips);
  }
  fullHeal() {
    this.hp = this.maxHp;
  }
  damage(pips: number): boolean {
    this.hp = Math.max(0, this.hp - pips);
    this.stats.damageTaken += pips;
    return this.hp <= 0;
  }

  takeUid(uid?: string) {
    if (uid) this.takenUids.add(uid);
  }
  isTaken(uid?: string): boolean {
    return uid ? this.takenUids.has(uid) : false;
  }
  setFlag(flag: GameFlag, v = true) {
    this.flags[flag] = v;
  }
  getFlag(flag: GameFlag): boolean {
    return !!this.flags[flag];
  }

  // ---- serialization ----
  snapshot(): RunSnapshot {
    return {
      hp: this.hp,
      embers: this.embers,
      keys: this.keys,
      seals: this.seals,
      bellTokens: this.bellTokens,
      upgrades: [...this.upgrades],
      takenUids: [...this.takenUids],
      flags: { ...this.flags },
      checkpointId: this.checkpointId,
      checkpointRoomId: this.checkpointRoomId,
      lostEmbers: this.lostEmbers,
      lostRoomId: this.lostRoomId,
      lostX: this.lostX,
      lostY: this.lostY,
      difficulty: this.difficulty,
      characterId: this.character.id,
      stats: {
        elapsedMs: this.stats.elapsedMs,
        enemiesDefeated: this.stats.enemiesDefeated,
        embersCollected: this.stats.embersCollected,
        loreFound: this.stats.loreFound,
        deaths: this.stats.deaths,
        damageTaken: this.stats.damageTaken,
        bossDefeated: this.stats.bossDefeated,
        roomsVisited: [...this.stats.roomsVisited],
      },
    };
  }

  static restore(s: RunSnapshot, character: CharacterDef): RunState {
    const r = new RunState(s.difficulty, character);
    r.embers = s.embers;
    r.keys = s.keys;
    r.seals = s.seals;
    r.bellTokens = s.bellTokens ?? 0;
    r.upgrades = new Set(s.upgrades);
    r.takenUids = new Set(s.takenUids);
    r.flags = { ...s.flags };
    r.checkpointId = s.checkpointId;
    r.checkpointRoomId = s.checkpointRoomId;
    r.lostEmbers = s.lostEmbers;
    r.lostRoomId = s.lostRoomId;
    r.lostX = s.lostX;
    r.lostY = s.lostY;
    r.hp = Math.min(s.hp, r.maxHp);
    r.stats = {
      startTime: 0,
      elapsedMs: s.stats.elapsedMs,
      enemiesDefeated: s.stats.enemiesDefeated,
      embersCollected: s.stats.embersCollected,
      loreFound: s.stats.loreFound,
      deaths: s.stats.deaths,
      damageTaken: s.stats.damageTaken,
      bossDefeated: s.stats.bossDefeated,
      roomsVisited: new Set(s.stats.roomsVisited),
    };
    return r;
  }
}
