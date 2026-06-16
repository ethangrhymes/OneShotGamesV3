/**
 * World.ts — owns the loaded WorldAct and the room graph. It resolves which
 * doors are open from the persistent run flags/keys, builds the current Room
 * (geometry from Dungeon.ts), and computes where the player lands after a
 * transition. Adding content = editing data files; this engine stays untouched.
 */
import { TILE } from "./Balance";
import { Room } from "./Dungeon";
import type { RunState } from "./Progression";
import type { DoorDef, RoomDef, WorldAct } from "./types";

export class World {
  act: WorldAct;
  private roomsById = new Map<string, RoomDef>();
  private regionOfRoom = new Map<string, string>();
  current!: Room;

  constructor(act: WorldAct) {
    this.act = act;
    for (const region of act.regions) {
      for (const r of region.rooms) {
        this.roomsById.set(r.id, r);
        this.regionOfRoom.set(r.id, region.id);
      }
    }
  }

  hasRoom(id: string): boolean {
    return this.roomsById.has(id);
  }

  region(regionId: string) {
    return this.act.regions.find((r) => r.id === regionId);
  }

  regionOf(roomId: string) {
    const id = this.regionOfRoom.get(roomId);
    return id ? this.region(id) : undefined;
  }

  get startRoomId(): string {
    const region = this.act.regions.find((r) => r.id === this.act.startingRegionId)!;
    return region.startRoomId;
  }
  get startDoorId(): string | undefined {
    const region = this.act.regions.find((r) => r.id === this.act.startingRegionId)!;
    return region.startDoorId;
  }

  roomDef(id: string): RoomDef | undefined {
    return this.roomsById.get(id);
  }

  /** persistent flag id marking a specific door as permanently unlocked. */
  static doorFlag(id: string): string {
    return "door_" + id;
  }

  /** Is a door currently passable, given the run's flags? */
  isDoorOpen(d: DoorDef, run: RunState): boolean {
    switch (d.type) {
      case "open":
      case "oneWay":
        return true;
      case "locked":
      case "requiresItem":
      case "bossGate":
        return run.getFlag(World.doorFlag(d.id));
      case "shortcut":
        return d.flag ? run.getFlag(d.flag) : run.getFlag(World.doorFlag(d.id));
      default:
        return true;
    }
  }

  /** Build (and set as current) a room with door states from run. */
  enter(roomId: string, run: RunState): Room {
    const def = this.roomsById.get(roomId);
    if (!def) throw new Error("Unknown room: " + roomId);
    this.current = new Room(def, (d) => this.isDoorOpen(d, run), run.tideUnlocked);
    run.stats.roomsVisited.add(roomId);
    return this.current;
  }

  /** Build a room without making it current (e.g., for transitions/preview). */
  build(roomId: string, run: RunState): Room {
    const def = this.roomsById.get(roomId);
    if (!def) throw new Error("Unknown room: " + roomId);
    return new Room(def, (d) => this.isDoorOpen(d, run), run.tideUnlocked);
  }

  /** Where should the player stand after arriving through `door` in `room`? */
  entryPosition(room: Room, doorId: string): { x: number; y: number } {
    const dr = room.doorRuntime(doorId);
    if (!dr) {
      // fallback: room center
      return { x: room.pxW / 2, y: room.pxH / 2 };
    }
    const c = Room.tileCenter(dr.def.tx, dr.def.ty);
    switch (dr.def.edge) {
      case "w":
        c.x += TILE;
        break;
      case "e":
        c.x -= TILE;
        break;
      case "n":
        c.y += TILE;
        break;
      case "s":
        c.y -= TILE;
        break;
    }
    return c;
  }
}
