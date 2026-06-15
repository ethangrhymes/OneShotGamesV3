/**
 * Progression.ts — the in-memory RunState plus its derived combat stats.
 *
 * A "run" is one playthrough of an Act. Progress (keys, seals, upgrades, opened
 * chests, world flags, checkpoint) persists across deaths and can be snapshotted
 * to localStorage so closing the tab resumes from the last checkpoint. Normal
 * enemies reset because rooms re-instantiate their spawns on each entry; bosses
 * stay dead because their spawns are gated behind defeat flags.
 */
import { Balance } from "./Balance";
import type { GameFlag, UpgradeId } from "./types";

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
  difficulty: "normal" | "hard";
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

  difficulty: "normal" | "hard" = "normal";

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

  constructor(difficulty: "normal" | "hard" = "normal") {
    this.difficulty = difficulty;
    this.hp = this.maxHp;
  }

  // ---- derived stats ----
  get heartVesselCount(): number {
    // each max-heart upgrade adds one (Heart Vessel from Act I, Ember Heart from Round 2)
    return (this.upgrades.has("heartVessel") ? 1 : 0) + (this.upgrades.has("emberHeart") ? 1 : 0);
  }
  get maxHearts(): number {
    return Balance.player.maxHeartsStart + this.heartVesselCount * Balance.upgrades.heartVesselBonus;
  }
  get maxHp(): number {
    return this.maxHearts * Balance.player.hpPerHeart;
  }
  get attackReach(): number {
    return (
      Balance.player.attackReach +
      (this.upgrades.has("wardensEdge") ? Balance.upgrades.wardensEdgeReach : 0)
    );
  }
  get attackDamage(): number {
    return (
      Balance.player.attackDamage +
      (this.upgrades.has("wardensEdge") ? Balance.upgrades.wardensEdgeDamage : 0)
    );
  }
  get dashCooldown(): number {
    return (
      Balance.player.dashCooldown *
      (this.upgrades.has("swiftBoots") ? Balance.upgrades.swiftBootsCooldownMult : 1)
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
    if ((id === "heartVessel" || id === "emberHeart") && !had) this.hp = Math.min(this.maxHp, this.hp + Balance.player.hpPerHeart);
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

  static restore(s: RunSnapshot): RunState {
    const r = new RunState(s.difficulty);
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
