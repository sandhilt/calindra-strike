import { DUCK_HEIGHT, STAND_HEIGHT } from '../constants.ts';
import type { Box } from './types.ts';

const MIN_SCENERY_HEIGHT = 24;
const WALL_LENGTH = 96;
const THIN_WIDTH = 24;
const PLATFORM_ELEVATION = 64;
export interface BoxDescription {
  kind: 'wall' | 'cover' | 'window' | 'platform';
  coverFor: 'stand' | 'crouch' | null;
}
export function describeBox(box: Box): BoxDescription | null {
  const height = box.max.y - box.min.y;
  if (!box.visible || !box.solid || box.stair || box.max.y <= 0 || height < MIN_SCENERY_HEIGHT) return null;
  const width = box.max.x - box.min.x;
  const depth = box.max.z - box.min.z;
  const long = Math.max(width, depth);
  const thin = Math.min(width, depth) <= THIN_WIDTH;
  const coverFor = height >= STAND_HEIGHT ? 'stand' : height >= DUCK_HEIGHT ? 'crouch' : null;
  if (box.mat === 'glass') return { kind: 'window', coverFor };
  if (height >= STAND_HEIGHT && (long >= WALL_LENGTH || thin)) return { kind: 'wall', coverFor };
  if (box.min.y >= PLATFORM_ELEVATION && Math.min(width, depth) >= WALL_LENGTH) return { kind: 'platform', coverFor };
  return { kind: 'cover', coverFor };
}
