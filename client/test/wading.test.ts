import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Wader, stepVoice } from '../src/game/wading.ts';

test('only the step from dry to wet counts as entering', () => {
  const wader = new Wader();
  const entered = [false, true, true, true, false, false, true].map((wet) => wader.update(wet));
  assert.deepEqual(entered, [false, true, false, false, false, false, true]);
});

test('leaving the water is not an entry and the state follows', () => {
  const wader = new Wader();
  wader.update(true);
  assert.equal(wader.wet, true);
  assert.equal(wader.update(false), false);
  assert.equal(wader.wet, false);
});

test('reset makes the next wet update an entry again', () => {
  const wader = new Wader();
  wader.update(true);
  wader.reset();
  assert.equal(wader.update(true), true);
});

test('footsteps are wet while in water and dry otherwise', () => {
  assert.equal(stepVoice(true), 'wet');
  assert.equal(stepVoice(false), 'dry');
});
