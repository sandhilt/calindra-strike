import type { MapProp } from './types.ts';

export type TwinkleStrand = Extract<MapProp, { kind: 'twinkleLights' }>;

export function strandPoint(strand: TwinkleStrand, t: number) {
  return {
    x: strand.x + (strand.x2 - strand.x) * t,
    y: strand.y + (strand.y2 - strand.y) * t - 4 * strand.sag * t * (1 - t),
    z: strand.z + (strand.z2 - strand.z) * t,
  };
}

export function strandBulbs(strand: TwinkleStrand) {
  return Array.from({ length: strand.bulbs }, (_, i) => strandPoint(strand, (i + 1) / (strand.bulbs + 1)));
}
