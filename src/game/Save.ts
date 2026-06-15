/**
 * Save.ts — lightweight localStorage persistence. No accounts, no backend.
 * All writes are defensive: a corrupt/blocked store never crashes the game.
 */
import type { SaveData, UpgradeId } from "./types";
import type { RunSnapshot } from "./Progression";

const KEY = "emberfall_keep_save_v1";
const RUN_KEY = "emberfall_keep_run_v1";
const VERSION = 1;

function defaults(): SaveData {
  return {
    version: VERSION,
    muted: false,
    bestTimeMs: null,
    bestEmbers: 0,
    totalWins: 0,
    totalDeaths: 0,
    availableActs: ["act1"],
    completedActs: [],
    worldFlags: {},
    regionUnlocks: {},
    bossDefeatedFlags: {},
    permanentUpgrades: [],
    loreDiscovered: [],
    checkpointId: null,
    difficultyMode: "normal",
  };
}

export class Save {
  data: SaveData;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      // Merge over defaults so older/newer saves never miss fields.
      return { ...defaults(), ...parsed, version: VERSION };
    } catch {
      return defaults();
    }
  }

  flush(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage may be unavailable (private mode) — ignore */
    }
  }

  setMuted(m: boolean): void {
    this.data.muted = m;
    this.flush();
  }

  addLore(id: string): boolean {
    if (this.data.loreDiscovered.includes(id)) return false;
    this.data.loreDiscovered.push(id);
    this.flush();
    return true;
  }

  hasUpgrade(id: UpgradeId): boolean {
    return this.data.permanentUpgrades.includes(id);
  }

  /** Record a run completion; returns whether a new best was set. */
  recordWin(timeMs: number, embers: number): { newBestTime: boolean; newBestEmbers: boolean } {
    this.data.totalWins++;
    if (!this.data.completedActs.includes("act1")) this.data.completedActs.push("act1");
    const newBestTime = this.data.bestTimeMs == null || timeMs < this.data.bestTimeMs;
    if (newBestTime) this.data.bestTimeMs = timeMs;
    const newBestEmbers = embers > this.data.bestEmbers;
    if (newBestEmbers) this.data.bestEmbers = embers;
    this.flush();
    return { newBestTime, newBestEmbers };
  }

  recordDeath(): void {
    this.data.totalDeaths++;
    this.flush();
  }

  reset(): void {
    this.data = defaults();
    this.clearRun();
    this.flush();
  }

  // ---- in-progress run snapshot (resume from checkpoint after closing tab) ----
  saveRun(s: RunSnapshot): void {
    try {
      localStorage.setItem(RUN_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }
  loadRun(): RunSnapshot | null {
    try {
      const raw = localStorage.getItem(RUN_KEY);
      return raw ? (JSON.parse(raw) as RunSnapshot) : null;
    } catch {
      return null;
    }
  }
  hasRun(): boolean {
    try {
      return !!localStorage.getItem(RUN_KEY);
    } catch {
      return false;
    }
  }
  clearRun(): void {
    try {
      localStorage.removeItem(RUN_KEY);
    } catch {
      /* ignore */
    }
    this.data.checkpointId = null;
    this.flush();
  }
}
