import assert from 'node:assert/strict';
import test from 'node:test';
import { BTN } from '@calindra-strike/shared';
import { nextProne } from '../src/game/prone-input.ts';

test('prone toggles on presses and persists across ticks', () => {
  assert.equal(nextProne(false, true, 0), true);
  assert.equal(nextProne(true, false, BTN.FWD), true);
  assert.equal(nextProne(true, true, 0), false);
});

test('jump and sprint cancel prone even during a toggle', () => {
  for (const button of [BTN.JUMP, BTN.SPRINT]) {
    assert.equal(nextProne(true, false, button), false);
    assert.equal(nextProne(false, true, button), false);
  }
});
