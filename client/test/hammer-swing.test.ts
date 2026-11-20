import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SwingPlayer, hammerSwingPose, nextHammerSwing, swingSeconds, type HammerSwing, type SwingPose } from '../src/game/render/hammer-swing.ts';

const KINDS: readonly HammerSwing[] = ['rightToLeft', 'leftToRight', 'overhead'];
const yawAt = (kind: HammerSwing, t: number): number => hammerSwingPose(kind, t).arm[1];
const pitchAt = (kind: HammerSwing, t: number): number => hammerSwingPose(kind, t).arm[0];
const angles = (p: SwingPose): number[] => [...p.arm, ...p.wrist];
const largestStep = (a: SwingPose, b: SwingPose): number => {
  const bs = angles(b);
  return Math.max(...angles(a).map((v, i) => Math.abs(v - bs[i]!)));
};
const FRAME = 1 / 60;

test('every swing starts and ends at rest', () => {
  for (const kind of KINDS) {
    assert.deepEqual(hammerSwingPose(kind, 0), hammerSwingPose(kind, 1), kind);
    assert.deepEqual(hammerSwingPose(kind, 0).arm, [0, 0, 0], kind);
  }
});

test('light attacks go through all three swings and the heavy one comes from above', () => {
  assert.equal(nextHammerSwing(null, false), 'rightToLeft');
  assert.equal(nextHammerSwing('rightToLeft', false), 'leftToRight');
  assert.equal(nextHammerSwing('leftToRight', false), 'overhead');
  assert.equal(nextHammerSwing('overhead', false), 'rightToLeft');
  assert.equal(nextHammerSwing('leftToRight', true), 'overhead');
});

test('each swing crosses the view the way it is named', () => {
  assert.ok(yawAt('rightToLeft', 0.24) < 0 && yawAt('rightToLeft', 0.56) > 0, 'right to left turns the arm leftward');
  assert.ok(yawAt('leftToRight', 0.24) > 0 && yawAt('leftToRight', 0.56) < 0, 'left to right turns the arm rightward');
  assert.ok(pitchAt('overhead', 0.28) > 0 && pitchAt('overhead', 0.56) < 0, 'overhead raises the arm, then brings it down');
});

test('a held attack flows from swing to swing without a jump and settles at rest', () => {
  const player = new SwingPlayer();
  let shown = player.step(FRAME);
  let worst = 0;
  const refireFrames = 27;
  for (let f = 0; f < refireFrames * 6; f++) {
    if (f % refireFrames === 0) player.start(false);
    const next = player.step(FRAME);
    worst = Math.max(worst, largestStep(shown, next));
    shown = next;
  }
  assert.ok(worst < 0.2, 'largest change in one frame was ' + worst.toFixed(3) + ' rad');
  for (let f = 0; f < 120; f++) shown = player.step(FRAME);
  assert.ok(Math.max(...angles(shown).map(Math.abs)) < 0.001, 'back at rest');
});

test('a held attack lands each blow before the next swing starts', () => {
  const player = new SwingPlayer();
  const refireFrames = 27;
  const reach = { rightToLeft: 0, leftToRight: 0, overhead: 0 };
  for (const kind of KINDS) {
    player.start(false);
    for (let f = 0; f < refireFrames; f++) {
      const { arm } = player.step(FRAME);
      reach[kind] = Math.max(reach[kind], kind === 'rightToLeft' ? arm[1] : kind === 'leftToRight' ? -arm[1] : -arm[0]);
    }
  }
  assert.ok(reach.rightToLeft > 0.35, 'right to left reached ' + reach.rightToLeft.toFixed(2));
  assert.ok(reach.leftToRight > 0.15, 'left to right reached ' + reach.leftToRight.toFixed(2));
  assert.ok(reach.overhead > 0.3, 'overhead came down to ' + reach.overhead.toFixed(2));
});

test('a swing still reaches its blow through the glide', () => {
  const player = new SwingPlayer();
  player.start(true);
  let lowest = 0;
  for (let f = 0; f < swingSeconds('overhead') * 60; f++) lowest = Math.min(lowest, player.step(FRAME).arm[0]);
  assert.ok(lowest < -0.4, 'the overhead blow came down to ' + lowest.toFixed(2) + ' rad');
});
