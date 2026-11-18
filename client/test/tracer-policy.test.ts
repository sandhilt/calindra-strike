import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPON, WEAPONS } from '@calindra-strike/shared';
import { TracerPolicy } from '../src/game/render/tracer-policy.ts';
import { TRACER_RULES } from '../src/game/render/fx-tuning.ts';

function pattern(policy: TracerPolicy, shooter: number, weapon: (typeof WEAPON)[keyof typeof WEAPON], shots: number): number[] {
  return Array.from({ length: shots }, () => policy.pelletsToDraw(shooter, weapon));
}

test('an automatic rifle traces every third shot, starting with the first', () => {
  assert.deepEqual(pattern(new TracerPolicy(), 1, WEAPON.RIFLE, 7), [1, 0, 0, 1, 0, 0, 1]);
});

test('the pistol and the sniper rifle trace every shot', () => {
  assert.deepEqual(pattern(new TracerPolicy(), 1, WEAPON.PISTOL, 3), [1, 1, 1]);
  assert.deepEqual(pattern(new TracerPolicy(), 1, WEAPON.SNIPER, 3), [1, 1, 1]);
});

test('the shotgun traces a few pellets of each shot, and the hammer never traces', () => {
  assert.deepEqual(pattern(new TracerPolicy(), 1, WEAPON.SHOTGUN, 2), [3, 3]);
  assert.deepEqual(pattern(new TracerPolicy(), 1, WEAPON.HAMMER, 3), [0, 0, 0]);
});

test('shooters are counted separately and a weapon switch restarts the count', () => {
  const policy = new TracerPolicy();
  assert.deepEqual(pattern(policy, 1, WEAPON.SMG, 2), [1, 0]);
  assert.deepEqual(pattern(policy, 2, WEAPON.SMG, 2), [1, 0]);
  assert.equal(policy.pelletsToDraw(1, WEAPON.PISTOL), 1);
  assert.equal(policy.pelletsToDraw(1, WEAPON.SMG), 1);
  policy.clear();
  assert.equal(policy.pelletsToDraw(2, WEAPON.SMG), 1);
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
