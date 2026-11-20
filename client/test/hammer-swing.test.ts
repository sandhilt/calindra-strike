import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hammerSwingPose, nextHammerSwing, swingSeconds, type HammerSwing } from '../src/game/render/hammer-swing.ts';

const KINDS: readonly HammerSwing[] = ['rightToLeft', 'leftToRight', 'overhead'];
const yawAt = (kind: HammerSwing, t: number): number => hammerSwingPose(kind, t).arm[1];
const pitchAt = (kind: HammerSwing, t: number): number => hammerSwingPose(kind, t).arm[0];

test('every swing starts and ends at rest', () => {
  for (const kind of KINDS) {
    assert.deepEqual(hammerSwingPose(kind, 0), hammerSwingPose(kind, 1), kind);
    assert.deepEqual(hammerSwingPose(kind, 0).arm, [0, 0, 0], kind);
  }
});

test('light attacks alternate sides and the heavy one comes from above', () => {
  assert.equal(nextHammerSwing(null, false), 'rightToLeft');
  assert.equal(nextHammerSwing('rightToLeft', false), 'leftToRight');
  assert.equal(nextHammerSwing('leftToRight', false), 'rightToLeft');
  assert.equal(nextHammerSwing('overhead', false), 'rightToLeft');
  assert.equal(nextHammerSwing('leftToRight', true), 'overhead');
});

test('each swing crosses the view the way it is named', () => {
  assert.ok(yawAt('rightToLeft', 0.3) < 0 && yawAt('rightToLeft', 0.62) > 0, 'right to left turns the arm leftward');
  assert.ok(yawAt('leftToRight', 0.3) > 0 && yawAt('leftToRight', 0.62) < 0, 'left to right turns the arm rightward');
  assert.ok(pitchAt('overhead', 0.38) > 0 && pitchAt('overhead', 0.62) < 0, 'overhead raises the arm, then brings it down');
});

test('the arm moves without jumps', () => {
  const steps = 1000;
  for (const kind of KINDS) {
    for (let i = 1; i <= steps; i++) {
      const a = hammerSwingPose(kind, (i - 1) / steps);
      const b = hammerSwingPose(kind, i / steps);
      const angles = [...b.arm, ...b.wrist];
      const step = Math.max(...[...a.arm, ...a.wrist].map((v, j) => Math.abs(v - angles[j]!)));
      assert.ok(step < 0.01, kind + ' jumped ' + step.toFixed(3) + ' rad at t=' + (i / steps).toFixed(3));
    }
  }
});

test('a light swing ends before the next one can start', () => {
  assert.ok(swingSeconds('rightToLeft') < 27 / 60);
});
