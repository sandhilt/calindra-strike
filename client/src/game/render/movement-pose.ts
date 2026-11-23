import { STANCE, STANCES, type Stance } from '@calindra-strike/shared';

export const LEAN_ROLL_RAD = 0.14;
export const SPRINT_FOV_KICK_DEG = 4;

const POSE_BLEND_SECONDS = 0.15;
const SLIDE_DIP_UNITS = 4;
const AIR_CROUCH_TUCK_UNITS = 18;

export function stepBlend(current: number, active: boolean, dt: number): number {
  const step = dt / POSE_BLEND_SECONDS;
  return active ? Math.min(1, current + step) : Math.max(0, current - step);
}

export function smoothBlend(t: number): number {
  return t * t * (3 - 2 * t);
}

export function movementEye(stance: Stance, onGround: boolean, slideBlend: number): number {
  const tuck = stance === STANCE.CROUCH && !onGround ? AIR_CROUCH_TUCK_UNITS : 0;
  return STANCES[stance].eye + tuck - SLIDE_DIP_UNITS * slideBlend;
}
