/**
 * Dungeon.ts — Room geometry. Turns an ASCII RoomDef into a tile grid, carves
 * door openings, and answers collision queries. A Room is rebuilt every time the
 * player enters it (so normal enemies reset); door open/closed state is supplied
 * by World from the persistent run flags.
 */
import { TILE } from "./Balance";
import type { DoorDef, RoomDef } from "./types";

export type CellKind = "floor" | "wall" | "gargoyle" | "hazard" | "void" | "water" | "bridge";

export interface Cell {
  kind: CellKind;
  solid: boolean;
  variant: number; // for floor/wall variety; for water: 0 = shallow, 1 = deep
  doorId?: string;
}

export interface DoorRuntime {
  def: DoorDef;
  open: boolean;
}

// deterministic pseudo-random for tile variety (no Math.random in render path)
function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

export class Room {
  def: RoomDef;
  w: number;
  h: number;
  cells: Cell[][];
  doors: DoorRuntime[];

  /** whether shallow tide-water is fordable right now (player holds the Tide Relic). */
  tideUnlocked: boolean;

  constructor(def: RoomDef, doorOpen: (d: DoorDef) => boolean, tideUnlocked = false) {
    this.def = def;
    this.tideUnlocked = tideUnlocked;
    this.h = def.layout.length;
    this.w = def.layout[0].length;
    this.cells = [];
    for (let y = 0; y < this.h; y++) {
      const row: Cell[] = [];
      const line = def.layout[y];
      for (let x = 0; x < this.w; x++) {
        const ch = line[x] ?? "#";
        row.push(this.makeCell(ch, x, y));
      }
      this.cells.push(row);
    }
    // carve doors: the door cell becomes passable floor + tagged with doorId
    this.doors = def.doors.map((d) => {
      const cell = this.cells[d.ty]?.[d.tx];
      if (cell) {
        cell.kind = "floor";
        cell.doorId = d.id;
        cell.variant = 0;
      }
      return { def: d, open: doorOpen(d) };
    });
  }

  private makeCell(ch: string, x: number, y: number): Cell {
    const r = hash2(x, y);
    switch (ch) {
      case "#":
        return { kind: "wall", solid: true, variant: r < 0.18 ? 1 : 0 };
      case "=":
        return { kind: "gargoyle", solid: true, variant: 0 };
      case "~":
        return { kind: "hazard", solid: false, variant: 0 };
      case "W":
        // deep water — always solid (a drowned-coast border / moat)
        return { kind: "water", solid: true, variant: 1 };
      case "w":
        // shallow tide — fordable only once the Tide Relic is held
        return { kind: "water", solid: !this.tideUnlocked, variant: 0 };
      case "B":
        // bridge planks — always walkable, spans water
        return { kind: "bridge", solid: false, variant: 0 };
      case ",":
        return { kind: "floor", solid: false, variant: 3 };
      case ".":
        return { kind: "floor", solid: false, variant: r < 0.12 ? 1 : r < 0.22 ? 2 : 0 };
      default:
        return { kind: "void", solid: true, variant: 0 };
    }
  }

  get pxW(): number {
    return this.w * TILE;
  }
  get pxH(): number {
    return this.h * TILE;
  }

  cellAt(tx: number, ty: number): Cell | null {
    if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return null;
    return this.cells[ty][tx];
  }

  doorRuntime(id: string): DoorRuntime | undefined {
    return this.doors.find((d) => d.def.id === id);
  }

  setDoorOpen(id: string, open: boolean) {
    const d = this.doorRuntime(id);
    if (d) d.open = open;
  }

  /**
   * Grant fording mid-room (player just picked up the Tide Relic): make every
   * shallow tide cell walkable now, without rebuilding the room. Deep water is
   * never affected. Idempotent.
   */
  unlockTide() {
    if (this.tideUnlocked) return;
    this.tideUnlocked = true;
    for (const row of this.cells) {
      for (const c of row) {
        if (c.kind === "water" && c.variant === 0) c.solid = false;
      }
    }
  }

  /** Is the tile solid for movement right now (door state aware)? */
  tileSolid(tx: number, ty: number): boolean {
    const c = this.cellAt(tx, ty);
    if (!c) return true;
    if (c.doorId) {
      const dr = this.doorRuntime(c.doorId);
      return dr ? !dr.open : true;
    }
    return c.solid;
  }

  /** World-pixel point solidity (for circle/AABB collision). */
  solidAtPx(wx: number, wy: number): boolean {
    return this.tileSolid(Math.floor(wx / TILE), Math.floor(wy / TILE));
  }

  /** Is the world point on a hazard tile? */
  hazardAtPx(wx: number, wy: number): boolean {
    const c = this.cellAt(Math.floor(wx / TILE), Math.floor(wy / TILE));
    return !!c && c.kind === "hazard";
  }

  /** center px of a tile */
  static tileCenter(tx: number, ty: number) {
    return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
  }

  private boxHitsSolid(x: number, y: number, half: number): boolean {
    const minTx = Math.floor((x - half) / TILE);
    const maxTx = Math.floor((x + half - 0.001) / TILE);
    const minTy = Math.floor((y - half) / TILE);
    const maxTy = Math.floor((y + half - 0.001) / TILE);
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (this.tileSolid(tx, ty)) return true;
      }
    }
    return false;
  }

  /**
   * Move an axis-aligned box (half-extent `half`) from (x,y) by (dx,dy),
   * resolving against solid tiles one axis at a time. Robust for top-down play.
   */
  moveBox(
    x: number,
    y: number,
    half: number,
    dx: number,
    dy: number
  ): { x: number; y: number; hitX: boolean; hitY: boolean } {
    let hitX = false;
    let hitY = false;

    // --- X axis ---
    let nx = x + dx;
    if (this.boxHitsSolid(nx, y, half)) {
      hitX = true;
      if (dx > 0) {
        const edge = Math.floor((nx + half) / TILE) * TILE;
        nx = edge - half - 0.001;
      } else if (dx < 0) {
        const edge = (Math.floor((nx - half) / TILE) + 1) * TILE;
        nx = edge + half + 0.001;
      }
      if (this.boxHitsSolid(nx, y, half)) nx = x; // give up, stay put
    }

    // --- Y axis ---
    let ny = y + dy;
    if (this.boxHitsSolid(nx, ny, half)) {
      hitY = true;
      if (dy > 0) {
        const edge = Math.floor((ny + half) / TILE) * TILE;
        ny = edge - half - 0.001;
      } else if (dy < 0) {
        const edge = (Math.floor((ny - half) / TILE) + 1) * TILE;
        ny = edge + half + 0.001;
      }
      if (this.boxHitsSolid(nx, ny, half)) ny = y;
    }

    return { x: nx, y: ny, hitX, hitY };
  }
}
