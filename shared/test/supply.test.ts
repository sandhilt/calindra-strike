import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ARMOR, MAX_HEALTH, SUPPLY_FLOOR_TOLERANCE_UNITS, SUPPLY_RADIUS_UNITS, WEAPON, createPlayerState, getMaps, inSupplyReach,
  needsSupply, resupply, spawnState, weaponDef,
} from '../src/index.ts';

function player(primary: 2 | 3 | 4 = WEAPON.RIFLE) {
  const s = createPlayerState();
  spawnState(s, 0, 0, 0, 0, primary);
  s.armor = MAX_ARMOR;
  return s;
}

describe('supply stands', () => {
  it('give nothing to a player who has everything, and something to one who lacks any one thing', () => {
    const s = player();
    assert.equal(needsSupply(s), false);
    s.health -= 1;
    assert.equal(needsSupply(s), true);
    s.health = MAX_HEALTH;
    s.armor = 0;
    assert.equal(needsSupply(s), true);
    s.armor = MAX_ARMOR;
    s.mag[WEAPON.RIFLE] -= 1;
    assert.equal(needsSupply(s), true);
    s.mag[WEAPON.RIFLE] = weaponDef(WEAPON.RIFLE).mag;
    s.reserve[WEAPON.PISTOL] = 0;
    assert.equal(needsSupply(s), true);
  });

  it('restock health, armour and the magazines and reserves of the primary and the pistol, nothing else', () => {
    const s = player(WEAPON.SHOTGUN);
    s.health = 12;
    s.armor = 0;
    s.mag.fill(0);
    s.reserve.fill(0);
    const kills = s.tick;
    resupply(s);
    assert.equal(s.health, MAX_HEALTH);
    assert.equal(s.armor, MAX_ARMOR);
    for (const id of [WEAPON.SHOTGUN, WEAPON.PISTOL]) {
      assert.equal(s.mag[id], weaponDef(id).mag);
      assert.equal(s.reserve[id], weaponDef(id).reserve);
    }
    assert.equal(s.reserve[WEAPON.RIFLE], 0, 'a gun the player does not carry stays empty');
    assert.equal(s.tick, kills);
    assert.equal(needsSupply(s), false);
  });

  it('end a reload in progress, since the magazine is full again', () => {
    const s = player();
    s.mag[WEAPON.RIFLE] = 0;
    s.reload = 40;
    resupply(s);
    assert.equal(s.reload, 0);
    assert.equal(s.mag[WEAPON.RIFLE], weaponDef(WEAPON.RIFLE).mag);
  });

  it('reach the stand floor only: close enough sideways and within a step or a jump in height', () => {
    const stand = { x: 100, y: 384, z: -300 };
    assert.equal(inSupplyReach({ x: 100 + SUPPLY_RADIUS_UNITS - 1, y: 384, z: -300 }, stand), true);
    assert.equal(inSupplyReach({ x: 100 + SUPPLY_RADIUS_UNITS + 1, y: 384, z: -300 }, stand), false);
    assert.equal(inSupplyReach({ x: 100, y: 384 + SUPPLY_FLOOR_TOLERANCE_UNITS, z: -300 }, stand), true);
    assert.equal(inSupplyReach({ x: 100, y: 192, z: -300 }, stand), false, 'the food court below is another floor');
  });

  it('stand one on each Mirante of Shopping Sul Rio, on the dais and mirrored between the halves', () => {
    const shopping = getMaps().find((m) => m.id === 'shopping');
    assert.ok(shopping);
    assert.deepEqual(shopping.supplies, [{ x: 0, y: 384, z: -880 }, { x: 0, y: 384, z: 880 }]);
    for (const other of getMaps().filter((m) => m.id !== 'shopping')) assert.deepEqual(other.supplies, []);
  });
});
