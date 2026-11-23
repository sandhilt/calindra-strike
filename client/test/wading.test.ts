import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Wader } from '../src/game/wading.ts';

test('only the step from dry to wet splashes while walking', () => {
  const wader = new Wader();
  const sounds = [false, true, true, true, false, false, true].map((wet) => wader.update(wet, true, false));
  assert.deepEqual(sounds, [null, 'splash', null, null, null, null, 'splash']);
});

test('leaving the water is silent and the state follows', () => {
  const wader = new Wader();
  wader.update(true, true, false);
  assert.equal(wader.wet, true);
  assert.equal(wader.update(false, true, false), null);
  assert.equal(wader.wet, false);
});

test('a fall splashes once when the surface is crossed, not again at the basin floor', () => {
  const wader = new Wader();
  assert.equal(wader.update(false, false, false), null, 'in the air above the pool');
  assert.equal(wader.update(true, false, false), 'splash', 'the feet cross the surface');
  assert.equal(wader.update(true, true, true), null, 'the feet reach the floor of the basin');
});

test('a jump inside the water splashes again on the next landing', () => {
  const wader = new Wader();
  wader.update(true, false, false);
  wader.update(true, true, true);
  wader.update(true, false, false);
  assert.equal(wader.update(true, true, true), 'splash');
});

test('a landing on dry ground thuds, and one in water that was never entered splashes', () => {
  const wader = new Wader();
  assert.equal(wader.update(false, true, true), 'thud');
  assert.equal(wader.update(true, true, true), 'splash', 'dry to wet on the touchdown tick is one splash');
});

test('a skydive into the pool splashes once and the touchdown adds no thud', () => {
  const wader = new Wader();
  assert.equal(wader.update(true, false, false), 'splash');
  assert.equal(wader.update(true, true, true), null);
});

test('reset makes the next wet update an entry again', () => {
  const wader = new Wader();
  wader.update(true, false, false);
  wader.reset();
  assert.equal(wader.update(true, true, false), 'splash');
});
