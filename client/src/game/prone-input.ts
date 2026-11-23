import { BTN } from '@calindra-strike/shared';

/** Jump and sprint end prone. Duck is not here: the first tap of the double tap holds it. */
export const PRONE_CANCEL_BUTTONS = BTN.JUMP | BTN.SPRINT;

export function nextProne(current: boolean, toggle: boolean, buttons: number): boolean {
  return (buttons & PRONE_CANCEL_BUTTONS) === 0 && current !== toggle;
}
