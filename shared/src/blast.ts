import { CARRAPETA_BLAST_RADIUS_UNITS, CARRAPETA_SELF_DAMAGE_SCALE } from './constants.ts';
import type { CarrapetaPosition } from './carrapeta.ts';
import type { CollisionWorld } from './physics.ts';

/** Linear blast falloff to the target point, with solid geometry blocking the blast. */
export function blastDamage(
  world: Pick<CollisionWorld, 'trace'>, origin: CarrapetaPosition, target: CarrapetaPosition, damage: number, self: boolean,
): number {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dz = target.z - origin.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance >= CARRAPETA_BLAST_RADIUS_UNITS) return 0;
  if (distance > 0 && world.trace(origin.x, origin.y, origin.z, dx / distance, dy / distance, dz / distance, distance)) return 0;
  return damage * (1 - distance / CARRAPETA_BLAST_RADIUS_UNITS) * (self ? CARRAPETA_SELF_DAMAGE_SCALE : 1);
}
