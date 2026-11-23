import { STANCE, type Stance } from '@calindra-strike/shared';
import type { IconName } from './icons.ts';

export interface StanceView {
  readonly icon: IconName;
  /** Portuguese name for the screen reader and the label under the icon. */
  readonly label: string;
}

/** One row per stance, so a new stance without a drawing fails the typecheck. */
export const STANCE_VIEWS: Readonly<Record<Stance, StanceView>> = {
  [STANCE.STAND]: { icon: 'stanceStand', label: 'em pé' },
  [STANCE.CROUCH]: { icon: 'stanceCrouch', label: 'agachado' },
  [STANCE.PRONE]: { icon: 'stanceProne', label: 'deitado' },
};
