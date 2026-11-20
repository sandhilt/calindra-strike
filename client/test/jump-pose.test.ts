import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JUMP_POSE, restingJumpPose, stepJumpPose } from '../src/game/render/jump-pose.ts';

const FRAME = 1 / 60;
const AIR_FRAMES = 40;
/** Most the gun may move in one frame: anything more reads as a snap. */
const MAX_FRAME_STEP = 0.12;

function jump(): number[] {
  const pose = restingJumpPose();
  const offsets: number[] = [stepJumpPose(pose, true, FRAME)];
  for (let i = 0; i < AIR_FRAMES; i++) offsets.push(stepJumpPose(pose, false, FRAME));
  for (let i = 0; i < 120; i++) offsets.push(stepJumpPose(pose, true, FRAME));
  return offsets;
}

test('the gun never snaps, neither on take-off nor on landing', () => {
  const offsets = jump();
  for (let i = 1; i < offsets.length; i++) {
    const step = Math.abs(offsets[i]! - offsets[i - 1]!);
    assert.ok(step < MAX_FRAME_STEP, 'frame ' + i + ' moved ' + step.toFixed(3));
  }
});

test('on take-off the gun first lags below the view, then floats up', () => {
  const air = jump().slice(1, AIR_FRAMES + 1);
  assert.ok(Math.min(...air.slice(0, 10)) < 0, 'sags as the body springs up');
  assert.ok(Math.abs(air.at(-1)! - JUMP_POSE.liftUnits) < 0.15, 'floats near the lift by the top of the jump, got ' + air.at(-1));
});

test('landing dips the gun and it settles back at rest', () => {
  const ground = jump().slice(AIR_FRAMES + 1);
  assert.ok(Math.min(...ground) < -0.08, 'dips below rest on landing');
  assert.equal(ground.at(-1), 0, 'back at rest');
});

test('standing on the ground keeps the gun at rest', () => {
  const pose = restingJumpPose();
  for (let i = 0; i < 10; i++) assert.equal(stepJumpPose(pose, true, FRAME), 0);
});
