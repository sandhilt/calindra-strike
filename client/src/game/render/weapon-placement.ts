import { WEAPON, type WeaponId } from '@calindra-strike/shared';

/** Where the first-person weapon sits in the view, in the weapon's own units and radians. */
export interface GunPlacement {
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly scale: number;
}

const HAMMER: GunPlacement = { position: [7.5, -5.5, -19.5], rotation: [0.12, -0.3, 0.25], scale: 0.5 };
const PISTOL: GunPlacement = { position: [5.2, -5.6, -15], rotation: [0, 0.05, 0], scale: 0.62 };
const LONG_GUN: GunPlacement = { position: [6, -6.4, -13], rotation: [0, 0.045, 0], scale: 0.62 };

export function placementFor(id: WeaponId): GunPlacement {
  if (id === WEAPON.HAMMER) return HAMMER;
  if (id === WEAPON.PISTOL) return PISTOL;
  return LONG_GUN;
}

const trim = (v: number): number => Math.round(v * 1000) / 1000;

/** The placement as the lines to paste into the table above. */
export function formatPlacement(p: GunPlacement): string {
  return `{ position: [${p.position.map(trim).join(', ')}], rotation: [${p.rotation.map(trim).join(', ')}], scale: ${trim(p.scale)} }`;
}
