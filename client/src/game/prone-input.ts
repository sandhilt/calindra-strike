import { BTN } from '@calindra-strike/shared';

export function nextProne(current: boolean, toggle: boolean, buttons: number): boolean {
  return (buttons & (BTN.JUMP | BTN.SPRINT | BTN.DUCK)) === 0 && current !== toggle;
}
