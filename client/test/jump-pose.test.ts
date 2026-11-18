import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JUMP_POSE, restingJumpPose, stepJumpPose } from '../src/game/render/jump-pose.ts';

const FRAME = 1 / 60;

test('the gun lifts gradually after leaving the ground instead of jumping up in one frame', () => {
  const pose = restingJumpPose();
  const first = stepJumpPose(pose, false, FRAME);
  assert.ok(first > 0 && first < JUMP_POSE.liftUnits / 2, `first airborne frame lifts only a little, got ${first}`);
  let offset = first;
  for (let i = 0; i < 30; i++) offset = stepJumpPose(pose, false, FRAME);
  assert.ok(Math.abs(offset - JUMP_POSE.liftUnits) < 0.05, 'settles at a small lift in the air');
});

test('landing dips the gun a little and it eases back to rest, never snapping', () => {
  const pose = restingJumpPose();
  for (let i = 0; i < 30; i++) stepJumpPose(pose, false, FRAME);
  let previous = stepJumpPose(pose, true, FRAME);
  assert.ok(previous < JUMP_POSE.liftUnits, 'starts coming down on the landing frame');
  let lowest = previous;
  for (let i = 0; i < 60; i++) {
    const offset = stepJumpPose(pose, true, FRAME);
    assert.ok(Math.abs(offset - previous) < 0.3, 'no frame-to-frame snap');
    lowest = Math.min(lowest, offset);
    previous = offset;
  }
  assert.ok(lowest < 0, 'a small dip on landing');
  assert.ok(Math.abs(previous) < 0.01, 'back at rest');
});

test('standing on the ground keeps the gun at rest', () => {
  const pose = restingJumpPose();
  for (let i = 0; i < 10; i++) assert.equal(stepJumpPose(pose, true, FRAME), 0);
});
