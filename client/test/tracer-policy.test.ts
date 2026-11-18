import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPON, WEAPONS } from '@calindra-strike/shared';
import { TracerPolicy } from '../src/game/render/tracer-policy.ts';
import { TRACER_RULES } from '../src/game/render/fx-tuning.ts';

function pattern(policy: TracerPolicy, shooter: number, weapon: (typeof WEAPON)[keyof typeof WEAPON], shots: number): number[] {
  return Array.from({ length: shots }, () => policy.pelletsToDraw(shooter, weapon));
}

test('every gun traces every shot like the sniper rifle, starting with the first', () => {
  for (const weapon of [WEAPON.PISTOL, WEAPON.RIFLE, WEAPON.SMG, WEAPON.SNIPER, WEAPON.LMG]) {
    assert.deepEqual(pattern(new TracerPolicy(), 1, weapon, 4), [1, 1, 1, 1], String(weapon));
  }
});

test('the shotgun traces a few pellets of each shot, and the hammer never traces', () => {
  assert.deepEqual(pattern(new TracerPolicy(), 1, WEAPON.SHOTGUN, 2), [3, 3]);
  assert.deepEqual(pattern(new TracerPolicy(), 1, WEAPON.HAMMER, 3), [0, 0, 0]);
});

test('every ranged weapon has a tracer rule and melee has none', () => {
  for (const def of WEAPONS) {
    const rule = TRACER_RULES[def.id];
    if (def.slot === 3) assert.equal(rule.everyNthShot, 0, def.name);
    else {
      assert.ok(rule.everyNthShot >= 1, def.name);
      assert.ok(rule.pelletsPerShot >= 1 && rule.pelletsPerShot <= def.pellets, def.name);
    }
  }
});
