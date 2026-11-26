import type { Box, MapDef } from './types.ts';

/** A bullet's end point sits on the face it hit, so it is matched with this much slack (units). */
const FACE_SLACK_UNITS = 1;

const byMap = new WeakMap<MapDef, readonly Box[]>();

/** Whether a point on a surface lies on an air conditioning duct. */
export function onDuct(map: MapDef, x: number, y: number, z: number): boolean {
  let ducts = byMap.get(map);
  if (!ducts) {
    ducts = map.boxes.filter((b) => b.duct);
    byMap.set(map, ducts);
  }
  const e = FACE_SLACK_UNITS;
  return ducts.some((b) => x >= b.min.x - e && x <= b.max.x + e && y >= b.min.y - e && y <= b.max.y + e && z >= b.min.z - e && z <= b.max.z + e);
}
