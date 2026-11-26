export const BOT_TEMPER = {
  enterAngryHealthPoints: 28,
  leaveAngryHealthPoints: 10,
  closeHitBonusHealthPoints: 14,
  decayHealthPointsPerSecond: 12,
  closeHitUnits: 144,
  closeHitSampleSeconds: 0.1,
  rushEnterUnits: 252,
  rushExitUnits: 288,
  carrierRushUnits: 72,
  lostTargetSeconds: 0.35,
  swingReachUnits: 80,
};

export interface Temper {
  readonly kind: 'calm' | 'angry';
  readonly healthPoints: number;
}

export function calmTemper(): Temper {
  return { kind: 'calm', healthPoints: 0 };
}

export function stepTemper(
  temper: Temper, damageHealthPoints: number, closeHit: boolean, elapsedSeconds: number,
): Temper {
  const bonus = damageHealthPoints > 0 && closeHit ? BOT_TEMPER.closeHitBonusHealthPoints : 0;
  const remaining = Math.max(0, temper.healthPoints - elapsedSeconds * BOT_TEMPER.decayHealthPointsPerSecond);
  const healthPoints = remaining + damageHealthPoints + bonus;
  const angry = healthPoints > BOT_TEMPER.enterAngryHealthPoints
    || (temper.kind === 'angry' && healthPoints >= BOT_TEMPER.leaveAngryHealthPoints);
  return { kind: angry ? 'angry' : 'calm', healthPoints };
}

export function meleeChoice(
  temper: Temper,
  options: {
    distanceUnits: number | null;
    currentSlot: number;
    hasHammer: boolean;
    rushing: boolean;
    carryingObjective: boolean;
    canSwitch: boolean;
  },
): 'hammer' | 'primary' | 'keep' {
  const { distanceUnits, currentSlot, hasHammer, rushing, carryingObjective, canSwitch } = options;
  if (!canSwitch) return 'keep';
  const radius = carryingObjective ? BOT_TEMPER.carrierRushUnits
    : rushing ? BOT_TEMPER.rushExitUnits : BOT_TEMPER.rushEnterUnits;
  if (hasHammer && temper.kind === 'angry' && distanceUnits !== null && distanceUnits <= radius) {
    return currentSlot === 3 ? 'keep' : 'hammer';
  }
  return rushing && currentSlot === 3 ? 'primary' : 'keep';
}
