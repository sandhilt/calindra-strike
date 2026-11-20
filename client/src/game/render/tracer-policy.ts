import type { Vector3 } from 'three';
import type { WeaponId } from '@calindra-strike/shared';
import { TRACER_RULES, type ProjectilePattern } from './fx-tuning.ts';
import type { Quality } from './quality.ts';

export class TracerPolicy {
  private readonly phases = new Map<number, number>();

  projectile(shooter: number, weapon: WeaponId, quality: Quality): ProjectilePattern {
    const rule = TRACER_RULES[weapon];
    const accent = rule.accent;
    let phase = 0;
    if (accent) {
      phase = this.phases.get(shooter) ?? 0;
      this.phases.set(shooter, (phase + 1) % accent.everyNthShot);
    } else {
      this.phases.delete(shooter);
    }
    if (quality !== 'high') return rule.standard;
    if (accent && phase === 0) return accent.pattern;
    return rule.high ?? rule.standard;
  }

  clear(): void {
    this.phases.clear();
  }
}

/** Preserve the shot ray's direction when drawing it from an offset muzzle. */
export function projectileRay(
  direction: Vector3, muzzle: Vector3, end: Vector3, rayOrigin: Vector3,
): number {
  direction.subVectors(end, rayOrigin);
  const distance = direction.length();
  if (distance === 0) return 0;
  direction.divideScalar(distance);
  return distance - (
    (muzzle.x - rayOrigin.x) * direction.x +
    (muzzle.y - rayOrigin.y) * direction.y +
    (muzzle.z - rayOrigin.z) * direction.z
  );
}
