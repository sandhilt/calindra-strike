import { WEAPON, type AdsKind, type WeaponDef, type WeaponId } from '@calindra-strike/shared';
import { RIFLE_DOT_HEIGHT_UNITS } from './weapons3d.ts';
import type { GunPlacement } from './weapon-placement.ts';

/** Seconds the gun takes to come up to the eye (and back): about 130 ms. */
export const ADS_BLEND_SECONDS = 0.13;
/** A red dot weapon drops its crosshair once the gun is this far at the eye: the dot on the sight takes over. */
export const DOT_IN_BLEND = 0.9;
/** Share of the walking bob and the mouse sway that is left at full aim. */
export const ADS_BOB_KEEP = 0.3;
/** How far the dynamic crosshair shrinks at full aim with iron sights. */
export const ADS_CROSSHAIR_SCALE = 0.6;
/** Top of each gun's sights above its model origin, in model units (measured from the built models, scaled by the placement). The rifle's is the centre of its red dot. */
const SIGHT_TOP_UNITS: Partial<Record<WeaponId, number>> = {
  [WEAPON.PISTOL]: 3.4,
  [WEAPON.RIFLE]: RIFLE_DOT_HEIGHT_UNITS,
  [WEAPON.SMG]: 5.3,
  [WEAPON.SHOTGUN]: 3.5,
  [WEAPON.LMG]: 6.7,
  [WEAPON.MGL]: 9.5,
};
const DEFAULT_SIGHT_TOP_UNITS = 5;
/** Iron sights sit this far below the centre of the view, so they frame the target instead of covering it. A red dot sits on the centre. */
const SIGHT_BELOW_CENTRE_UNITS = 0.9;

/** Which full-screen scope is drawn: the AWP's CS mask or none. Aimed guns are never hidden behind a lens. */
export type ScopeOverlay = 'none' | 'awp';

export interface AimState {
  /** The CS scope level of the AWP (0 = off). It never comes from aiming. */
  zoom: number;
  aiming: boolean;
  /** 0..1 linear blend of the aim, see `stepBlend`. */
  blend: number;
}

export function scopeOverlay(def: WeaponDef, s: AimState): ScopeOverlay {
  if (s.zoom > 0 && def.zoomFov.length > 0) return 'awp';
  return 'none';
}

/** The first-person gun is not drawn behind a scope overlay or while parachuting. */
export function gunHidden(def: WeaponDef, s: AimState, dropping: boolean): boolean {
  return dropping || scopeOverlay(def, s) !== 'none';
}

/** Ground truth for the crosshair: drawn for everything but a scope overlay, the AWP and the parachute; smaller with iron sights, gone behind a red dot. */
export function crosshairFor(def: WeaponDef, s: AimState, dropping: boolean, isSniper: boolean): { visible: boolean; scale: number } {
  if (dropping || isSniper || scopeOverlay(def, s) !== 'none') return { visible: false, scale: 1 };
  if (def.ads?.kind === 'dot' && s.aiming && s.blend >= DOT_IN_BLEND) return { visible: false, scale: 1 };
  const shrink = def.ads !== undefined && s.aiming ? 1 - (1 - ADS_CROSSHAIR_SCALE) * s.blend : 1;
  return { visible: true, scale: shrink };
}

/** The horizontal field of view (CS, at 4:3) held while aiming, or 0 when the weapon is not aimed. It never widens the view. */
export function aimFovFor(def: WeaponDef, aiming: boolean, settingsFov: number): number {
  return aiming && def.ads ? Math.min(def.ads.fov, settingsFov) : 0;
}

/** Mouse scale while aiming: the scope's rule (fov ratio times the zoom ratio), but never faster than the hip. */
export function aimSensitivityScale(aimFov: number, settingsFov: number, zoomRatio: number): number {
  return Math.min(1, (aimFov / settingsFov) * zoomRatio);
}

/** Where the gun moves, in view units, when fully aimed: onto the centre line, its sights (or its red dot) at the eye line. */
export function aimOffset(id: WeaponId, p: GunPlacement, kind: AdsKind, side: 1 | -1): readonly [number, number, number] {
  const sightTop = (SIGHT_TOP_UNITS[id] ?? DEFAULT_SIGHT_TOP_UNITS) * p.scale;
  const below = kind === 'dot' ? 0 : SIGHT_BELOW_CENTRE_UNITS;
  return [-side * p.position[0], -p.position[1] - sightTop - below, 0];
}

/** The part of the walking bob and sway that is kept at `aim` (0..1, already eased). */
export function bobKeep(aim: number): number {
  return 1 - (1 - ADS_BOB_KEEP) * aim;
}
