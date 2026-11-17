import { dirFromAngles } from './math.ts';
import type { CollisionWorld } from './physics.ts';
import { eyeHeight } from './sim.ts';

export function sprayPlacement(
  world: CollisionWorld,
  s: { x: number; y: number; z: number; yaw: number; pitch: number; ducked: boolean },
  range: number,
): { x: number; y: number; z: number; nx: number; ny: number; nz: number } | null {
  const d = dirFromAngles(s.yaw, s.pitch);
  const y = s.y + eyeHeight(s);
  const hit = world.trace(s.x, y, s.z, d.x, d.y, d.z, range);
  if (!hit) return null;
  return { x: s.x + d.x * hit.t, y: y + d.y * hit.t, z: s.z + d.z * hit.t, nx: hit.nx, ny: hit.ny, nz: hit.nz };
}
