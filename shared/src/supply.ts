import { MAX_ARMOR, MAX_HEALTH, TICK_RATE } from './constants.ts';
import { WEAPON, magCapacity, reserveCapacity, weaponDef, type WeaponId } from './weapons.ts';
import type { PlayerState } from './sim.ts';

/**
 * Supply stands: a fixed place on a map where a player who needs it restocks, then the stand refills on its own.
 * Shopping Sul Rio puts one on each Mirante (the top floor), a reason to climb and a place worth guarding.
 */
export interface SupplyPoint {
  x: number;
  y: number;
  z: number;
}

/** Time a stand stays empty after somebody restocks (tuning value). */
export const SUPPLY_COOLDOWN_SECONDS = 40;
export const SUPPLY_COOLDOWN_TICKS = SUPPLY_COOLDOWN_SECONDS * TICK_RATE;
/** Horizontal reach of a stand, from its centre: a little more than a bot that walks to it stops short by (units). */
export const SUPPLY_RADIUS_UNITS = 64;
/** A player this much above or below the stand's floor is on another floor and cannot take it (units). */
export const SUPPLY_FLOOR_TOLERANCE_UNITS = 40;

const stocked = (s: PlayerState): WeaponId[] => [s.primary, WEAPON.PISTOL];

/** True when a restock would give something: a hurt or unarmoured player, or a gun short of ammunition. */
export function needsSupply(s: PlayerState): boolean {
  if (s.health < MAX_HEALTH || s.armor < MAX_ARMOR) return true;
  return stocked(s).some((id) => {
    const def = weaponDef(id);
    return def.mag > 0 && (s.mag[id] < magCapacity(def, s.halvedAmmo) || s.reserve[id] < reserveCapacity(def, s.halvedAmmo));
  });
}

export function inSupplyReach(s: { x: number; y: number; z: number }, p: SupplyPoint): boolean {
  return Math.hypot(s.x - p.x, s.z - p.z) < SUPPLY_RADIUS_UNITS && Math.abs(s.y - p.y) <= SUPPLY_FLOOR_TOLERANCE_UNITS;
}

/** Full health and armour, and full magazines and reserves for the primary and the pistol; a reload in progress ends, the magazine being full. */
export function resupply(s: PlayerState): void {
  s.reload = 0;
  s.health = MAX_HEALTH;
  s.armor = MAX_ARMOR;
  for (const id of stocked(s)) {
    const def = weaponDef(id);
    s.mag[id] = magCapacity(def, s.halvedAmmo);
    s.reserve[id] = reserveCapacity(def, s.halvedAmmo);
  }
}
