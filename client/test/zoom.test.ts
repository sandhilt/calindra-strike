import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZOOM_EASE_SECONDS, easeFov } from '../src/game/render/zoom.ts';

test('zoom glides toward the scoped field of view instead of jumping, and settles', () => {
  const first = easeFov(74, 30, 1 / 60);
  assert.ok(first < 74 && first > 30, 'one frame moves part of the way');
  let fov = 74;
  for (let frame = 0; frame < 60 * 0.32; frame++) fov = easeFov(fov, 30, 1 / 60);
  assert.equal(fov, 30, 'settled within about 0.3 s');
  assert.equal(easeFov(40, 74, 0), 40, 'no time, no change');
  const halfway = easeFov(74, 30, ZOOM_EASE_SECONDS);
  assert.ok(Math.abs(halfway - (30 + 44 / Math.E)) < 1e-9);
});

test('the glide does not depend on the frame rate', () => {
  let at30 = 74;
  let at144 = 74;
  for (let i = 0; i < 3; i++) at30 = easeFov(at30, 30, 1 / 30);
  for (let i = 0; i < 14.4; i++) at144 = easeFov(at144, 30, 1 / 144);
  assert.ok(Math.abs(at30 - easeFov(74, 30, 0.1)) < 1e-9);
  assert.ok(Math.abs(at144 - at30) < 1.5);
});
