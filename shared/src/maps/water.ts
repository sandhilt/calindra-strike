import type { MapDef } from './types.ts';

/** How far below a pool's bottom face the basin floor may lie, in units. Lets feet at ground level count as wading in a raised basin. */
export const WATER_BASIN_DEPTH_UNITS = 32;

interface Pool {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  floorY: number;
  surfaceY: number;
}

const poolsByMap = new WeakMap<MapDef, readonly Pool[]>();

function poolsOf(map: MapDef): readonly Pool[] {
  const cached = poolsByMap.get(map);
  if (cached) return cached;
  const pools = map.boxes
    .filter((box) => box.mat === 'water')
    .map((box) => ({
      minX: box.min.x,
      maxX: box.max.x,
      minZ: box.min.z,
      maxZ: box.max.z,
      floorY: box.min.y - WATER_BASIN_DEPTH_UNITS,
      surfaceY: box.max.y,
    }));
  poolsByMap.set(map, pools);
  return pools;
}

/** Height of the water surface the feet at (x, feetY, z) stand in, or null when they are dry. Any `water` box of the map is a pool. */
export function waterSurfaceAt(map: MapDef, x: number, feetY: number, z: number): number | null {
  for (const pool of poolsOf(map)) {
    if (x < pool.minX || x > pool.maxX || z < pool.minZ || z > pool.maxZ) continue;
    if (feetY >= pool.floorY && feetY < pool.surfaceY) return pool.surfaceY;
  }
  return null;
}
