import assert from 'node:assert/strict';
import test from 'node:test';
import { STAMINA_MAX, STAMINA_RESUME } from '@calindra-strike/shared';
import { STAMINA_LOW_FRACTION, STAMINA_RESUME_FRACTION, staminaLevel } from '../src/ui/stamina-meter.ts';

test('the level follows the fraction around the low threshold', () => {
  assert.equal(staminaLevel(1, false), 'ok');
  assert.equal(staminaLevel(STAMINA_LOW_FRACTION, false), 'ok');
  assert.equal(staminaLevel(STAMINA_LOW_FRACTION - 0.01, false), 'low');
  assert.equal(staminaLevel(0, false), 'low');
});

test('winded wins over the fraction', () => {
  assert.equal(staminaLevel(1, true), 'winded');
  assert.equal(staminaLevel(0.1, true), 'winded');
});

test('the tick sits where sprint resumes', () => {
  assert.equal(STAMINA_RESUME_FRACTION, STAMINA_RESUME / STAMINA_MAX);
  assert.ok(STAMINA_RESUME_FRACTION > 0 && STAMINA_RESUME_FRACTION < STAMINA_LOW_FRACTION);
});
