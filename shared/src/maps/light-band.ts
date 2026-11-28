import type { Box, MapLight } from './types.ts';

/** Heights a light's halo may span: the top of the floor under it and the underside of the ceiling over it. */
export interface LightBand {
  floor: number;
  ceiling: number;
}

/** Glass and water let the light through, and a lamp is itself the light, so none of them bounds a halo. */
const PASSES_LIGHT: ReadonlySet<Box['mat']> = new Set(['glass', 'water', 'lamp']);

function blocksLight(box: Box): boolean {
  return box.visible && !PASSES_LIGHT.has(box.mat);
}

/**
 * The band of heights a halo drawn at `light` can cover without leaking through a slab. Only boxes over the light's own
 * column count, so a slab between two floors bounds the lamps on both sides of it.
 */
export function lightBand(boxes: readonly Box[], light: MapLight): LightBand {
  let floor = -Infinity;
  let ceiling = Infinity;
  for (const box of boxes) {
    if (!blocksLight(box)) continue;
    if (light.x < box.min.x || light.x > box.max.x || light.z < box.min.z || light.z > box.max.z) continue;
    if (box.max.y <= light.y) floor = Math.max(floor, box.max.y);
    else if (box.min.y >= light.y) ceiling = Math.min(ceiling, box.min.y);
  }
  return { floor, ceiling };
}
