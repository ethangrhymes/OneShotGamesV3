/**
 * Checkpoints.ts — "Emberlight" rest points. Resting sets the respawn point,
 * fully restores health and persists the run so the tab can be closed safely.
 * Bosses are NOT reset here (their defeat flags live in run.flags); normal
 * enemies reset naturally because rooms rebuild their spawns on entry.
 */
import type { RunState } from "./Progression";
import type { Save } from "./Save";

export function restAtCheckpoint(
  run: RunState,
  save: Save,
  checkpointId: string,
  roomId: string,
  persist: (run: RunState) => void
): void {
  run.checkpointId = checkpointId;
  run.checkpointRoomId = roomId;
  run.fullHeal();
  save.data.checkpointId = checkpointId;
  save.flush();
  persist(run);
}
