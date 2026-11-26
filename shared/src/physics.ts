import { PLAYER_RADIUS } from './constants.ts';
import { LIFT_DOOR_HEIGHT_UNITS, liftDoorOpen, type Lift, type LiftDoor } from './lift.ts';
import { rayAabb } from './math.ts';
import type { Mat, MapDef } from './maps/types.ts';
import { isPane, surfaceOf } from './surface.ts';

const EPS = 0.03125;

function withBox(boxes: Float64Array, bounds: readonly number[]): Float64Array {
  const next = new Float64Array(boxes.length + 6);
  next.set(boxes);
  next.set(bounds, boxes.length);
  return next;
}

export interface TraceHit {
  t: number;
  nx: number;
  ny: number;
  nz: number;
  /** What the ray hit: the map box's material, or a crate for the bug's desk and crate. */
  mat: Mat;
}

const PROP_MAT: Mat = 'crate';

/** Where an open door's slot parks its box: far from any play space, so it never overlaps a hull or a ground query. */
const PARKED = [1e9, 1e9, 1e9, 1e9 + 1, 1e9 + 1, 1e9 + 1] as const;

interface DoorSlot {
  lift: Lift;
  door: LiftDoor;
  /** Offset of the slot's six numbers in the solids array. */
  at: number;
}

/**
 * Static collision world built from the map's boxes. Solids block movement;
 * bullet blockers stop hitscan (glass and foliage are see/shoot-through).
 */
export class CollisionWorld {
  private readonly mapSolids: Float64Array;
  private solids: Float64Array;
  private propKey = '';
  private readonly mapBullets: Float64Array;
  private bullets: Float64Array;
  private readonly mapBulletMats: readonly Mat[];
  private bulletMats: readonly Mat[];
  private readonly panes: Float64Array;
  private readonly paneMats: readonly Mat[];
  readonly map: MapDef;
  private readonly doors: readonly DoorSlot[];
  private tick = 0;
  private doorsHeldOpen = false;

  constructor(map: MapDef) {
    this.map = map;
    const solid = map.boxes.filter((b) => b.solid);
    const bullet = map.boxes.filter((b) => !b.shootThrough);
    const doorways = map.lifts.flatMap((lift) => lift.doors.map((door) => ({ lift, door })));
    this.doors = doorways.map((d, i) => ({ ...d, at: (solid.length + i) * 6 }));
    this.mapSolids = new Float64Array((solid.length + doorways.length) * 6);
    this.mapBullets = new Float64Array(bullet.length * 6);
    solid.forEach((b, i) => this.mapSolids.set([b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z], i * 6));
    this.solids = this.mapSolids;
    bullet.forEach((b, i) => this.mapBullets.set([b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z], i * 6));
    this.bullets = this.mapBullets;
    this.mapBulletMats = bullet.map((b) => b.mat);
    this.bulletMats = this.mapBulletMats;
    const panes = map.boxes.filter((b) => b.visible && b.shootThrough && isPane(surfaceOf(b.mat)));
    this.panes = new Float64Array(panes.length * 6);
    panes.forEach((b, i) => this.panes.set([b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z], i * 6));
    this.paneMats = panes.map((b) => b.mat);
    this.syncDoors();
  }

  /**
   * The server tick the next command runs at, for the lift cab: set by whoever applies the command (see `liftClockTick`).
   * Setting it also shuts or opens the doorways, so every query after it sees the doors of that tick.
   */
  get liftTick(): number {
    return this.tick;
  }

  set liftTick(tick: number) {
    this.tick = tick;
    this.syncDoors();
  }

  /** Runs `build` with every doorway open, for code that maps the walkable space (the bots' grid) rather than moving in it. */
  withDoorsOpen<T>(build: () => T): T {
    this.doorsHeldOpen = true;
    this.syncDoors();
    try {
      return build();
    } finally {
      this.doorsHeldOpen = false;
      this.syncDoors();
    }
  }

  private syncDoors(): void {
    for (const { lift, door, at } of this.doors) {
      const open = this.doorsHeldOpen || liftDoorOpen(lift, door, this.tick);
      const bounds = open ? PARKED : [door.minX, door.y, door.minZ, door.maxX, door.y + LIFT_DOOR_HEIGHT_UNITS, door.maxZ];
      this.mapSolids.set(bounds, at);
      if (this.solids !== this.mapSolids) this.solids.set(bounds, at);
    }
  }

  /**
   * One movable solid on top of the map (the bug's desk or crate), replaced on each call and cleared by null.
   * Behaves like a map crate: it blocks movement, can be stood on and stops bullets and sight.
   */
  setProp(box: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } | null): void {
    const key = box ? [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].join() : '';
    if (key === this.propKey) return;
    this.propKey = key;
    if (!box) {
      this.solids = this.mapSolids;
      this.bullets = this.mapBullets;
      this.bulletMats = this.mapBulletMats;
      return;
    }
    const bounds = [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z];
    this.solids = withBox(this.mapSolids, bounds);
    this.bullets = withBox(this.mapBullets, bounds);
    this.bulletMats = [...this.mapBulletMats, PROP_MAT];
  }

  overlaps(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): boolean {
    const s = this.solids;
    for (let i = 0; i < s.length; i += 6) {
      if (maxX > s[i] && minX < s[i + 3] && maxY > s[i + 1] && minY < s[i + 4] && maxZ > s[i + 2] && minZ < s[i + 5]) {
        return true;
      }
    }
    return false;
  }

  hullOverlaps(x: number, y: number, z: number, height: number): boolean {
    const r = PLAYER_RADIUS;
    return this.overlaps(x - r, y, z - r, x + r, y + height, z + r);
  }

  /**
   * Moves a player hull along one axis and stops at the first solid face.
   * Boxes the hull already overlaps are ignored so a stuck player can walk out.
   * Returns the distance actually travelled.
   */
  clipAxis(x: number, y: number, z: number, height: number, axis: 0 | 1 | 2, delta: number): number {
    if (delta === 0) return 0;
    const r = PLAYER_RADIUS;
    const sMinX = x - r;
    const sMaxX = x + r;
    const sMinY = y;
    const sMaxY = y + height;
    const sMinZ = z - r;
    const sMaxZ = z + r;
    let minX = sMinX;
    let maxX = sMaxX;
    let minY = sMinY;
    let maxY = sMaxY;
    let minZ = sMinZ;
    let maxZ = sMaxZ;
    if (axis === 0) {
      if (delta > 0) maxX += delta;
      else minX += delta;
    } else if (axis === 1) {
      if (delta > 0) maxY += delta;
      else minY += delta;
    } else if (delta > 0) maxZ += delta;
    else minZ += delta;

    let allowed = delta;
    const s = this.solids;
    for (let i = 0; i < s.length; i += 6) {
      const bx0 = s[i];
      const by0 = s[i + 1];
      const bz0 = s[i + 2];
      const bx1 = s[i + 3];
      const by1 = s[i + 4];
      const bz1 = s[i + 5];
      if (!(maxX > bx0 && minX < bx1 && maxY > by0 && minY < by1 && maxZ > bz0 && minZ < bz1)) continue;
      // already inside this box at the start: ignore (lets players escape)
      if (sMaxX > bx0 && sMinX < bx1 && sMaxY > by0 && sMinY < by1 && sMaxZ > bz0 && sMinZ < bz1) continue;
      let limit: number;
      if (axis === 0) limit = delta > 0 ? bx0 - sMaxX - EPS : bx1 - sMinX + EPS;
      else if (axis === 1) limit = delta > 0 ? by0 - sMaxY - EPS : by1 - sMinY + EPS;
      else limit = delta > 0 ? bz0 - sMaxZ - EPS : bz1 - sMinZ + EPS;
      if (delta > 0) {
        if (limit < allowed) allowed = limit < 0 ? 0 : limit;
      } else if (limit > allowed) allowed = limit > 0 ? 0 : limit;
    }
    return allowed;
  }

  /** Nearest bullet-blocking surface along a normalized ray. */
  trace(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): TraceHit | null {
    return nearestHit(this.bullets, this.bulletMats, ox, oy, oz, dx, dy, dz, maxDist);
  }

  /** Nearest glass or water along a normalized ray. Bullets fly on through it, so `trace` never sees it, but the shot still rings off it. */
  tracePane(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): TraceHit | null {
    return nearestHit(this.panes, this.paneMats, ox, oy, oz, dx, dy, dz, maxDist);
  }

  /** Height of the first surface below (x, z) starting at y, or -Infinity. */
  groundBelow(x: number, y: number, z: number, halfSize: number): number {
    const s = this.solids;
    let best = -Infinity;
    for (let i = 0; i < s.length; i += 6) {
      if (x + halfSize > s[i] && x - halfSize < s[i + 3] && z + halfSize > s[i + 2] && z - halfSize < s[i + 5]) {
        const top = s[i + 4];
        if (top <= y + 0.001 && top > best) best = top;
      }
    }
    return best;
  }
}

function nearestHit(
  s: Float64Array,
  mats: readonly Mat[],
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
): TraceHit | null {
  let best = maxDist;
  let bi = -1;
  for (let i = 0; i < s.length; i += 6) {
    const t = rayAabb(ox, oy, oz, dx, dy, dz, s[i], s[i + 1], s[i + 2], s[i + 3], s[i + 4], s[i + 5], best);
    if (t >= 0 && t < best) {
      best = t;
      bi = i;
    }
  }
  if (bi < 0) return null;
  const hx = ox + dx * best;
  const hy = oy + dy * best;
  const hz = oz + dz * best;
  // pick the face the hit point lies on
  const faces = [
    [Math.abs(hx - s[bi]), -1, 0, 0],
    [Math.abs(hx - s[bi + 3]), 1, 0, 0],
    [Math.abs(hy - s[bi + 1]), 0, -1, 0],
    [Math.abs(hy - s[bi + 4]), 0, 1, 0],
    [Math.abs(hz - s[bi + 2]), 0, 0, -1],
    [Math.abs(hz - s[bi + 5]), 0, 0, 1],
  ];
  let f = faces[0];
  for (const c of faces) if (c[0] < f[0]) f = c;
  return { t: best, nx: f[1], ny: f[2], nz: f[3], mat: mats[bi / 6] ?? PROP_MAT };
}
