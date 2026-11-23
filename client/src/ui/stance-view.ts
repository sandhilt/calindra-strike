import { STANCE, type Stance } from '@calindra-strike/shared';
import type { IconName } from './icons.ts';

export interface StanceView {
  readonly icon: IconName;
  /** Portuguese name for the screen reader and the label under the icon. */
  readonly label: string;
}

/** Tilt of the stance icon, in degrees, for a full lean. Positive turns clockwise, toward the right. */
export const LEAN_ICON_DEGREES = 20;
/** Leans closer than this to upright draw no tilt and no arrow, so tiny eased values do not flicker. */
const LEAN_ICON_STEP = 0.2;

/** How the stance icon shows a lean in -1 (left) to 1 (right): its tilt and a small arrow after the label. */
export function leanTilt(lean: number): { degrees: number; arrow: '' | '‹' | '›' } {
  const step = Math.sign(lean) * Math.round(Math.abs(lean) / LEAN_ICON_STEP) * LEAN_ICON_STEP;
  if (step === 0) return { degrees: 0, arrow: '' };
  return { degrees: Math.round(step * LEAN_ICON_DEGREES), arrow: step < 0 ? '‹' : '›' };
}

/** One row per stance, so a new stance without a drawing fails the typecheck. */
export const STANCE_VIEWS: Readonly<Record<Stance, StanceView>> = {
  [STANCE.STAND]: { icon: 'stanceStand', label: 'em pé' },
  [STANCE.CROUCH]: { icon: 'stanceCrouch', label: 'agachado' },
  [STANCE.PRONE]: { icon: 'stanceProne', label: 'deitado' },
};
