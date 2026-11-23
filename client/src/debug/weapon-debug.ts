import type { WeaponDef } from '@calindra-strike/shared';
import { SPRINT_SPEED_MULT, reloadTotalTicks } from '@calindra-strike/shared';
import { stepBlend } from '../game/render/movement-pose.ts';
import { ADS_BLEND_SECONDS, type AimState, type ScopeOverlay, scopeOverlay } from '../game/render/ads-view.ts';

/** The reload of the weapon on show: ticks since it began (-1 when none), and how it plays. */
export interface ReloadScrub {
  elapsed: number;
  playing: boolean;
  speed: number;
  loop: boolean;
}

/** Ticks of one full reload, 0 for a weapon that has none. A shotgun reload loads `shells` rounds. */
export function reloadTotal(def: WeaponDef, shells: number): number {
  return def.reloadTiming ? reloadTotalTicks(def.reloadTiming, shells) : 0;
}

export function startReload(r: ReloadScrub): void {
  r.elapsed = 0;
  r.playing = true;
}

/** Holds the reload at `progress` (0..1), paused, so one pose can be looked at as long as needed. */
export function scrubTo(r: ReloadScrub, progress: number, total: number): void {
  r.elapsed = Math.min(1, Math.max(0, progress)) * total;
  r.playing = false;
}

/** Plays the reload forward at `speed` times the game's pace; at the end it starts over or stops. */
export function stepReload(r: ReloadScrub, dtSeconds: number, total: number): void {
  if (!r.playing || r.elapsed < 0 || total <= 0) return;
  r.elapsed += dtSeconds * 60 * r.speed;
  if (r.elapsed < total) return;
  if (r.loop) r.elapsed %= total;
  else {
    r.elapsed = -1;
    r.playing = false;
  }
}

/** Shots to fire this frame to hold `def`'s cadence while the trigger is down; `carry` keeps the fraction between frames. */
export function autoFireShots(carry: { ticks: number }, dtSeconds: number, fireTicks: number): number {
  carry.ticks += dtSeconds * 60;
  const shots = Math.floor(carry.ticks / fireTicks);
  carry.ticks -= shots * fireTicks;
  return shots;
}

export function previewAim(def: WeaponDef, aiming: boolean, dt: number, state: AimState): ScopeOverlay {
  state.aiming = aiming && def.ads !== undefined;
  state.blend = stepBlend(state.blend, state.aiming, dt, ADS_BLEND_SECONDS);
  return scopeOverlay(def, state);
}

const PREVIEW_WALK_SPEED = 250;

export function previewMovementSpeed(walking: boolean, running: boolean): number {
  if (running) return PREVIEW_WALK_SPEED * SPRINT_SPEED_MULT;
  return walking ? PREVIEW_WALK_SPEED : 0;
}
