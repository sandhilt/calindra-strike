/** Two crouch presses this close together (ms) lie the player down; tuning value. */
export const DOUBLE_TAP_MS = 300;

export type CrouchTapState = { readonly kind: 'idle' } | { readonly kind: 'tapped'; readonly at: number };

export const CROUCH_TAPS_IDLE: CrouchTapState = { kind: 'idle' };

export interface CrouchPress {
  /** performance.now() of the key press. */
  readonly now: number;
  /** Sprint is held, so this press is the slide gesture and not a tap. */
  readonly sprinting: boolean;
  readonly prone: boolean;
}

export interface CrouchTapResult {
  readonly state: CrouchTapState;
  readonly prone: boolean;
}

/** One fresh (non-repeat) crouch key press: the second within DOUBLE_TAP_MS lies down, any press while prone gets up. */
export function pressCrouch(state: CrouchTapState, press: CrouchPress): CrouchTapResult {
  if (press.sprinting) return { state: CROUCH_TAPS_IDLE, prone: press.prone };
  if (press.prone) return { state: CROUCH_TAPS_IDLE, prone: false };
  if (state.kind === 'tapped' && press.now - state.at <= DOUBLE_TAP_MS) return { state: CROUCH_TAPS_IDLE, prone: true };
  return { state: { kind: 'tapped', at: press.now }, prone: false };
}
