import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RT_GOVERNOR, RtGovernor, medianOf } from '../src/game/render/rt-governor.ts';
import { cheaperRtLevel, resolveRtChoice, type RtLevel } from '../src/game/render/rt-levels.ts';

/** Feeds frames of a fixed length for `seconds` and returns the levels the governor asked for. */
function run(governor: RtGovernor, frameMs: number, seconds: number, running: RtLevel): RtLevel[] {
  const asked: RtLevel[] = [];
  const frames = Math.round((seconds * 1000) / frameMs);
  for (let i = 0; i < frames; i++) {
    const level = governor.sample(frameMs / 1000, running);
    if (level) asked.push(level);
  }
  return asked;
}

const WARMUP_AND_WINDOW = RT_GOVERNOR.warmupSeconds + RT_GOVERNOR.windowSeconds + 0.5;

test('slow frames step the level down one notch, only after the warm-up and a full window', () => {
  const governor = new RtGovernor();
  assert.deepEqual(run(governor, 40, RT_GOVERNOR.warmupSeconds, 'medium'), []);
  assert.deepEqual(run(governor, 40, RT_GOVERNOR.windowSeconds - 0.5, 'medium'), []);
  assert.deepEqual(run(governor, 40, 1, 'medium'), ['light']);
});

test('a smooth match is left alone', () => {
  assert.deepEqual(run(new RtGovernor(), 1000 / 60, 120, 'high'), []);
  assert.deepEqual(run(new RtGovernor(), RT_GOVERNOR.overMs - 1, 120, 'medium'), []);
});

test('it steps after the warm-up that follows a step, one notch at a time, and stops at light', () => {
  const governor = new RtGovernor();
  assert.deepEqual(run(governor, 40, WARMUP_AND_WINDOW, 'high'), ['medium']);
  assert.deepEqual(run(governor, 40, WARMUP_AND_WINDOW, 'medium'), ['light']);
  assert.deepEqual(run(governor, 40, 120, 'light'), []);
});

test('off and light never ask for anything, however slow', () => {
  assert.deepEqual(run(new RtGovernor(), 100, 120, 'off'), []);
  assert.deepEqual(run(new RtGovernor(), 100, 120, 'light'), []);
});

test('a stall or hidden tab restarts the measurement instead of counting as slow frames', () => {
  const governor = new RtGovernor();
  run(governor, 16, RT_GOVERNOR.warmupSeconds, 'medium');
  assert.equal(governor.sample(RT_GOVERNOR.maxFrameSeconds + 1, 'medium'), null);
  assert.deepEqual(run(governor, 16, RT_GOVERNOR.warmupSeconds - 0.5, 'medium'), []);
});

test('one slow spike in a smooth stretch does not move the median', () => {
  const governor = new RtGovernor();
  run(governor, 16, RT_GOVERNOR.warmupSeconds, 'medium');
  assert.equal(governor.sample(0.5, 'medium'), null);
  assert.deepEqual(run(governor, 16, RT_GOVERNOR.windowSeconds + 1, 'medium'), []);
});

test('a few spikes down to 24 fps are accepted, many are not', () => {
  const frames = (spikeEvery: number): RtLevel[] => {
    const governor = new RtGovernor();
    run(governor, 16, RT_GOVERNOR.warmupSeconds, 'medium');
    const asked: RtLevel[] = [];
    for (let i = 0; i < 400; i++) {
      const level = governor.sample((i % spikeEvery === 0 ? 45 : 16) / 1000, 'medium');
      if (level) asked.push(level);
    }
    return asked;
  };
  assert.deepEqual(frames(40), [], 'one frame in forty is a spike');
  assert.deepEqual(frames(8), ['light'], 'one in eight is not a few');
});

test('median averages the middle pair of an even count', () => {
  assert.equal(medianOf([3, 1, 2]), 2);
  assert.equal(medianOf([4, 1, 2, 3]), 2.5);
});

test('levels step down one at a time and only auto follows the ceiling', () => {
  assert.equal(cheaperRtLevel('high'), 'medium');
  assert.equal(cheaperRtLevel('medium'), 'light');
  assert.equal(cheaperRtLevel('light'), 'light');
  assert.equal(cheaperRtLevel('off'), 'off');
  assert.equal(resolveRtChoice('auto', 'high'), 'high');
  assert.equal(resolveRtChoice('auto', 'light'), 'light');
  assert.equal(resolveRtChoice('high', 'light'), 'high');
  assert.equal(resolveRtChoice('off', 'light'), 'off');
});
