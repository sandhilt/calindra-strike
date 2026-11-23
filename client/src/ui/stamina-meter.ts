import { STAMINA_MAX, STAMINA_RESUME } from '@calindra-strike/shared';

export type StaminaLevel = 'ok' | 'low' | 'winded';

/** Below this share of the meter the bar turns amber, a warning before the player is winded. */
export const STAMINA_LOW_FRACTION = 0.4;

/** Where the sprint comes back after the player is winded, as a share of the track (0 to 1). */
export const STAMINA_RESUME_FRACTION = STAMINA_RESUME / STAMINA_MAX;

/** Winded wins over the fraction: the server decides it, and the bar stays red until the resume mark. */
export function staminaLevel(fraction: number, winded: boolean): StaminaLevel {
  if (winded) return 'winded';
  return fraction < STAMINA_LOW_FRACTION ? 'low' : 'ok';
}
