import { WEAPON, type WeaponId } from '@calindra-strike/shared';

/**
 * The recoil of the weapon in view, in unit kicks (one unit pushes the gun back 2.4 and tilts it 0.09 rad). Two parts:
 * the thump is the jolt of the shot, which falls away at a steady rate; the push is a slower shove that builds up while the
 * gun keeps firing and eases off after, so a sustained burst holds the gun back a little instead of pumping it a full stroke every shot.
 * Pure, so it is testable without WebGL.
 */
export interface KickState {
  thump: number;
  push: number;
}

export interface KickFeel {
  /** Added to the thump by one shot, and the most it can reach. */
  thumpPerShot: number;
  thumpMax: number;
  /** How much of the thump falls away each second (a straight line). */
  thumpFallPerS: number;
  /** Added to the push by one shot, and the most it can reach. */
  pushPerShot: number;
  pushMax: number;
  /** How fast the push decays toward nothing, as a rate: it loses 1 - e^-rate of itself each second. */
  pushEasePerS: number;
}

const THUMP_MAX = 1.8;
const THUMP_FALL_PER_S = 7;

const jolt = (perShot: number): KickFeel => ({
  thumpPerShot: perShot,
  thumpMax: THUMP_MAX,
  thumpFallPerS: THUMP_FALL_PER_S,
  pushPerShot: 0,
  pushMax: 0,
  pushEasePerS: 1,
});

/**
 * The machine gun fires twelve rounds a second. The thump is small and dies out within one shot interval (about 3 frames at 60 fps),
 * so each round still shows, and the push climbs to about 0.35 over the first second of a burst and holds there.
 */
const MACHINE_GUN_THUMP_FALL_PER_S = 3.6;
const MACHINE_GUN: KickFeel = {
  thumpPerShot: 0.18,
  thumpMax: 0.4,
  thumpFallPerS: MACHINE_GUN_THUMP_FALL_PER_S,
  pushPerShot: 0.08,
  pushMax: 0.5,
  pushEasePerS: 2.4,
};

export function kickFeelFor(id: WeaponId | -1): KickFeel {
  if (id === WEAPON.LMG) return MACHINE_GUN;
  if (id === WEAPON.MGL) return jolt(1.8);
  if (id === WEAPON.SNIPER || id === WEAPON.SHOTGUN) return jolt(1.6);
  return jolt(0.7);
}

export function fireKick(kick: KickState, feel: KickFeel): void {
  kick.thump = Math.min(feel.thumpMax, kick.thump + feel.thumpPerShot);
  kick.push = Math.min(feel.pushMax, kick.push + feel.pushPerShot);
}

export function stepKick(kick: KickState, feel: KickFeel, dt: number): void {
  kick.thump = Math.max(0, kick.thump - dt * feel.thumpFallPerS);
  kick.push *= Math.exp(-feel.pushEasePerS * dt);
}

export const kickTotal = (kick: Readonly<KickState>): number => kick.thump + kick.push;

const PISTOL_PEAK_S = 0.018;
const PISTOL_SLIDE_HOME_S = 0.075;
const PISTOL_REST_S = 0.15;
const PISTOL_AT_REST = { recoil: 0, slide: 0 };

function pistolReturn(elapsed: number, end: number): number {
  return Math.max(0, (end - elapsed) / (end - PISTOL_PEAK_S)) ** 2;
}

/** The slide closes while the frame is still settling from the shot. Time is in seconds. */
export function pistolShotPose(elapsed: number): Readonly<{ recoil: number; slide: number }> {
  if (elapsed >= PISTOL_REST_S) return PISTOL_AT_REST;
  if (elapsed < PISTOL_PEAK_S) {
    const rise = elapsed / PISTOL_PEAK_S;
    return { recoil: 0.65 + 0.35 * rise, slide: 0.25 + 0.75 * rise };
  }
  return { recoil: pistolReturn(elapsed, PISTOL_REST_S), slide: pistolReturn(elapsed, PISTOL_SLIDE_HOME_S) };
}
