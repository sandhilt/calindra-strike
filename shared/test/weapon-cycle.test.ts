import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPON, createPlayerState, cycleWeaponSlot, type WeaponId } from '../src/index.ts';

const holding = (weapon: WeaponId, primary: WeaponId = WEAPON.RIFLE) => ({ ...createPlayerState(), primary, weapon });

describe('cycleWeaponSlot', () => {
  it('steps primary, pistol, hammer and wraps around', () => {
    assert.equal(cycleWeaponSlot(holding(WEAPON.RIFLE), 'next'), 2);
    assert.equal(cycleWeaponSlot(holding(WEAPON.PISTOL), 'next'), 3);
    assert.equal(cycleWeaponSlot(holding(WEAPON.HAMMER), 'next'), 1);
  });

  it('goes the other way for previous', () => {
    assert.equal(cycleWeaponSlot(holding(WEAPON.RIFLE), 'previous'), 3);
    assert.equal(cycleWeaponSlot(holding(WEAPON.HAMMER), 'previous'), 2);
    assert.equal(cycleWeaponSlot(holding(WEAPON.PISTOL), 'previous'), 1);
  });

  it('follows the chosen primary, not a fixed weapon', () => {
    assert.equal(cycleWeaponSlot(holding(WEAPON.SHOTGUN, WEAPON.SHOTGUN), 'next'), 2);
    assert.equal(cycleWeaponSlot(holding(WEAPON.SMG, WEAPON.SMG), 'previous'), 3);
  });

  it('starts from the primary when the weapon in hand is not in the wheel', () => {
    assert.equal(cycleWeaponSlot(holding(WEAPON.SNIPER), 'next'), 2);
  });
});
