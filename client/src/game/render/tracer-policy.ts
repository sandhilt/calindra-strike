import type { WeaponId } from '@calindra-strike/shared';
import { TRACER_RULES } from './fx-tuning.ts';

/** Decides which shots get a visible tracer, counting shots per shooter so the pattern holds on sustained fire. */
export class TracerPolicy {
  private readonly shooters = new Map<number, { weapon: WeaponId; shots: number }>();

  /** Registers one shot and returns how many of its pellets should draw a tracer. */
  pelletsToDraw(shooter: number, weapon: WeaponId): number {
    const rule = TRACER_RULES[weapon];
    if (rule.everyNthShot === 0) return 0;
    let entry = this.shooters.get(shooter);
    if (!entry || entry.weapon !== weapon) {
      entry = { weapon, shots: 0 };
      this.shooters.set(shooter, entry);
    }
    const draws = entry.shots % rule.everyNthShot === 0;
    entry.shots++;
    return draws ? rule.pelletsPerShot : 0;
  }

  clear(): void {
    this.shooters.clear();
  }
}
