import { WEAPON, type AdsKind, type WeaponDef, type WeaponId } from '@calindra-strike/shared';
import type { GunPlacement } from './weapon-placement.ts';

/** Seconds the gun takes to come up to the eye (and back): about 130 ms. */
export const ADS_BLEND_SECONDS = 0.13;
/** A scope-kind weapon swaps the gun for the optic once the blend is this far in. */
export const OPTIC_IN_BLEND = 0.9;
/** Share of the walking bob and the mouse sway that is left at full aim. */
export const ADS_BOB_KEEP = 0.3;
/** How far the dynamic crosshair shrinks at full aim with iron sights. */
export const ADS_CROSSHAIR_SCALE = 0.6;
/** Top of each gun's sights above its model origin, in model units (measured from the built models, scaled by the placement). */
const SIGHT_TOP_UNITS: Partial<Record<WeaponId, number>> = {
  [WEAPON.PISTOL]: 3.4,
  [WEAPON.RIFLE]: 5.5,
  [WEAPON.SMG]: 5.3,
  [WEAPON.SHOTGUN]: 3.5,
  [WEAPON.LMG]: 6.7,
};
const DEFAULT_SIGHT_TOP_UNITS = 5;
/** The sights sit this far below the centre of the view, so they frame the target instead of covering it. */
const SIGHT_BELOW_CENTRE_UNITS = 0.9;
/** The optic weapon slides this far toward the eye before it is hidden, in view units. */
const OPTIC_SLIDE_UNITS = 6;

/** Which full-screen scope is drawn: the AWP's CS mask, the war-game optic of an aimed rifle, or none. */
export type ScopeOverlay = 'none' | 'awp' | 'optic';

export interface AimState {
  /** The CS scope level of the AWP (0 = off). It never comes from aiming. */
  zoom: number;
  aiming: boolean;
  /** 0..1 linear blend of the aim, see `stepBlend`. */
  blend: number;
}

export function scopeOverlay(def: WeaponDef, s: AimState): ScopeOverlay {
  if (s.zoom > 0 && def.zoomFov.length > 0) return 'awp';
  if (s.aiming && def.ads?.kind === 'scope' && s.blend >= OPTIC_IN_BLEND) return 'optic';
  return 'none';
}

/** The first-person gun is not drawn behind a scope overlay or while parachuting. */
export function gunHidden(def: WeaponDef, s: AimState, dropping: boolean): boolean {
  return dropping || scopeOverlay(def, s) !== 'none';
}

/** Ground truth for the crosshair: drawn for everything but a scope overlay, the AWP and the parachute; smaller with iron sights. */
export function crosshairFor(def: WeaponDef, s: AimState, dropping: boolean, isSniper: boolean, out = { visible: false, scale: 1 }): { visible: boolean; scale: number } {
  out.visible = !dropping && !isSniper && scopeOverlay(def, s) === 'none';
  out.scale = out.visible && def.ads?.kind === 'sights' && s.aiming ? 1 - (1 - ADS_CROSSHAIR_SCALE) * s.blend : 1;
  return out;
}

/** The horizontal field of view (CS, at 4:3) held while aiming, or 0 when the weapon is not aimed. It never widens the view. */
export function aimFovFor(def: WeaponDef, aiming: boolean, settingsFov: number): number {
  return aiming && def.ads ? Math.min(def.ads.fov, settingsFov) : 0;
}

/** Mouse scale while aiming: the scope's rule (fov ratio times the zoom ratio), but never faster than the hip. */
export function aimSensitivityScale(aimFov: number, settingsFov: number, zoomRatio: number): number {
  return Math.min(1, (aimFov / settingsFov) * zoomRatio);
}

/** Where the gun moves, in view units, when fully aimed: onto the centre line at the eye line, an optic gun also toward the eye. */
export function aimOffset(id: WeaponId, p: GunPlacement, kind: AdsKind, side: 1 | -1): readonly [number, number, number] {
  const sightTop = (SIGHT_TOP_UNITS[id] ?? DEFAULT_SIGHT_TOP_UNITS) * p.scale;
  return [-side * p.position[0], -p.position[1] - sightTop - SIGHT_BELOW_CENTRE_UNITS, kind === 'scope' ? OPTIC_SLIDE_UNITS : 0];
}

/** The part of the walking bob and sway that is kept at `aim` (0..1, already eased). */
export function bobKeep(aim: number): number {
  return 1 - (1 - ADS_BOB_KEEP) * aim;
}
