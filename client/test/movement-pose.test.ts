import assert from 'node:assert/strict';
import test from 'node:test';
import { STANCE, STANCES } from '@calindra-strike/shared';
import { movementEye, smoothBlend, stepBlend } from '../src/game/render/movement-pose.ts';

test('movement poses blend both ways in 150 ms and clamp after a long frame', () => {
  const halfway = stepBlend(0, true, 0.075);
  assert.equal(halfway, 0.5);
  assert.equal(stepBlend(halfway, true, 0.075), 1);
  assert.equal(stepBlend(1, false, 0.075), halfway);
  assert.equal(stepBlend(halfway, false, 1), 0);
  assert.equal(smoothBlend(halfway), halfway);
  assert.ok(smoothBlend(0.25) < 0.25);
  assert.ok(smoothBlend(0.75) > 0.75);
});

test('camera eyes follow each stance, with crouch tuck and slide dip', () => {
  for (const stance of [STANCE.STAND, STANCE.CROUCH, STANCE.PRONE]) {
    assert.equal(movementEye(stance, true, 0), STANCES[stance].eye);
  }
  assert.ok(movementEye(STANCE.CROUCH, false, 0) > STANCES[STANCE.CROUCH].eye);
  assert.ok(movementEye(STANCE.CROUCH, true, 1) < STANCES[STANCE.CROUCH].eye);
});
