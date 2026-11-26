import { SPRINT_SPEED_MULT, WEAPONS, reloadTotalTicks, type WeaponDef, type WeaponId } from '@calindra-strike/shared';
import { type ScopeOverlay, scopeOverlay } from '../game/render/ads-view.ts';
import type { WeaponSkin } from '../game/render/weapons3d.ts';

export interface ViewerRequest {
  weapon: WeaponId;
  skin: WeaponSkin;
  aim: boolean;
  reload: number | null;
}

export const DEFAULT_VIEWER_WEAPON = WEAPONS[WEAPONS.length - 1].id;

const normalizeTag = (tag: string): string => tag.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function weaponByTag(tag: string): WeaponId | undefined {
  const wanted = normalizeTag(tag);
  return WEAPONS.find((def) => normalizeTag(def.tag) === wanted)?.id;
}

export function viewerRequest(search: string): ViewerRequest | null {
  const params = new URLSearchParams(search);
  if (!params.has('viewer')) return null;

  const reload = Number(params.get('reload')?.trim() || NaN);
  return {
    weapon: weaponByTag(params.get('weapon') ?? '') ?? DEFAULT_VIEWER_WEAPON,
    skin: params.get('skin') === 'carrapeta' ? 'carrapeta' : 'standard',
    aim: params.get('aim') === '1',
    reload: Number.isFinite(reload) ? Math.min(1, Math.max(0, reload)) : null,
  };
}

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

/** What the viewer shows for the weapon on show while "mirando" is on: whether the weapon aims, and the overlay at the given blend. */
export function previewAim(def: WeaponDef, aiming: boolean, blend: number): { aiming: boolean; overlay: ScopeOverlay } {
  const on = aiming && def.ads !== undefined;
  return { aiming: on, overlay: scopeOverlay(def, { zoom: 0, aiming: on, blend }) };
}

const PREVIEW_WALK_SPEED = 250;

export function previewMovementSpeed(walking: boolean, running: boolean): number {
  if (running) return PREVIEW_WALK_SPEED * SPRINT_SPEED_MULT;
  return walking ? PREVIEW_WALK_SPEED : 0;
}
