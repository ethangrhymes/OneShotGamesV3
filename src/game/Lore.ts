/**
 * Lore.ts — discovery + resolution of short atmospheric fragments. Discovery is
 * tracked both on the run (for the victory tally) and persistently in Save.
 */
import type { RunState } from "./Progression";
import type { Save } from "./Save";
import type { LoreEntry, WorldAct } from "./types";

export function resolveLore(act: WorldAct, id: string): LoreEntry | null {
  return act.lore[id] ?? null;
}

export function discoverLore(
  run: RunState,
  save: Save,
  act: WorldAct,
  id: string
): { entry: LoreEntry | null; isNew: boolean } {
  const entry = resolveLore(act, id);
  if (!entry) return { entry: null, isNew: false };
  const persistedNew = save.addLore(id);
  let runNew = false;
  if (!run.getFlag("lore_" + id)) {
    run.setFlag("lore_" + id, true);
    run.stats.loreFound++;
    runNew = true;
  }
  return { entry, isNew: persistedNew || runNew };
}
