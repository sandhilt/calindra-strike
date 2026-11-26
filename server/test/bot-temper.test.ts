import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calmTemper, meleeChoice, stepTemper } from '../src/bot-temper.ts';

test('temper builds with damage, gets a bonus for a close hit and cools with hysteresis', () => {
  const calm = stepTemper(calmTemper(), 20, false, 0);
  const angry = stepTemper(calmTemper(), 20, true, 0);
  assert.equal(calm.kind, 'calm');
  assert.equal(angry.kind, 'angry');
  assert.equal(stepTemper(calm, 10, false, 0).kind, 'angry');
  assert.equal(stepTemper(angry, 0, false, 1).kind, 'angry');
  assert.deepEqual(stepTemper(angry, 0, false, 3), calmTemper());
});

test('melee choice retains an active rush farther out and restores the gun when it ends', () => {
  const angry = stepTemper(calmTemper(), 40, false, 0);
  const gun = { distanceUnits: 150, currentSlot: 1, hasHammer: true, rushing: false, carryingObjective: false, canSwitch: true };
  const rush = { ...gun, currentSlot: 3, rushing: true };
  assert.equal(meleeChoice(angry, gun), 'hammer');
  assert.equal(meleeChoice(calmTemper(), gun), 'keep');
  assert.equal(meleeChoice(angry, { ...gun, distanceUnits: 270 }), 'keep');
  assert.equal(meleeChoice(angry, { ...rush, distanceUnits: 270 }), 'keep');
  assert.equal(meleeChoice(angry, { ...rush, distanceUnits: 300 }), 'primary');
  assert.equal(meleeChoice(angry, { ...rush, distanceUnits: null }), 'primary');
  assert.equal(meleeChoice(calmTemper(), rush), 'primary');
  assert.equal(meleeChoice(angry, { ...gun, carryingObjective: true }), 'keep');
  assert.equal(meleeChoice(angry, { ...gun, carryingObjective: true, distanceUnits: 70 }), 'hammer');
  assert.equal(meleeChoice(angry, { ...gun, hasHammer: false }), 'keep');
  assert.equal(meleeChoice(angry, { ...gun, canSwitch: false }), 'keep');
});
