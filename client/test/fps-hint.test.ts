import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FPS_HINT, FpsHintWatch } from '../src/game/fps-hint.ts';
import type { Quality } from '../src/game/render/quality.ts';

/** Feeds frames of a fixed length until `seconds` have passed and returns how many times the hint fired. */
function run(watch: FpsHintWatch, fps: number, seconds: number, quality: Quality = 'high'): number {
  let fired = 0;
  const frames = Math.round(fps * seconds);
  for (let i = 0; i < frames; i++) if (watch.sample(1 / fps, quality)) fired++;
  return fired;
}

const WARMUP_AND_WINDOW = FPS_HINT.warmupSeconds + FPS_HINT.windowSeconds + 1;

test('a slow match gets the hint once, only after the warm-up and a full window', () => {
  const watch = new FpsHintWatch();
  assert.equal(run(watch, 20, FPS_HINT.warmupSeconds), 0);
  assert.equal(run(watch, 20, FPS_HINT.windowSeconds - 1), 0);
  assert.equal(run(watch, 20, 2), 1);
  assert.equal(run(watch, 20, 60), 0);
});

test('a smooth match never gets the hint', () => {
  assert.equal(run(new FpsHintWatch(), 60, 120), 0);
  assert.equal(run(new FpsHintWatch(), FPS_HINT.belowFps + 5, 120), 0);
});

test('the performance tier never gets the hint, whatever the speed', () => {
  assert.equal(run(new FpsHintWatch(), 10, 60, 'performance'), 0);
});

test('both lighter-than-performance tiers can get the hint', () => {
  assert.equal(run(new FpsHintWatch(), 15, WARMUP_AND_WINDOW, 'high'), 1);
  assert.equal(run(new FpsHintWatch(), 15, WARMUP_AND_WINDOW, 'low'), 1);
});

test('a stall or hidden tab restarts the warm-up instead of counting as slow frames', () => {
  const watch = new FpsHintWatch();
  assert.equal(run(watch, 60, 12), 0);
  assert.equal(watch.sample(FPS_HINT.maxFrameSeconds + 5, 'high'), false);
  assert.equal(run(watch, 20, FPS_HINT.warmupSeconds - 1), 0);
});

test('a recovered machine is not flagged, and a later slow stretch still is', () => {
  const watch = new FpsHintWatch();
  assert.equal(run(watch, 60, WARMUP_AND_WINDOW + 10), 0);
  assert.equal(run(watch, 15, FPS_HINT.windowSeconds + 1), 1);
});

test('a new join restarts the warm-up but a hint already given is not repeated', () => {
  const shown = new FpsHintWatch();
  assert.equal(run(shown, 15, WARMUP_AND_WINDOW), 1);
  shown.restart();
  assert.equal(run(shown, 15, 60), 0);

  const fresh = new FpsHintWatch();
  assert.equal(run(fresh, 60, 20), 0);
  fresh.restart();
  assert.equal(run(fresh, 15, FPS_HINT.warmupSeconds - 1), 0);
});

test('switching to performance mid-measurement stops the hint', () => {
  const watch = new FpsHintWatch();
  assert.equal(run(watch, 15, FPS_HINT.warmupSeconds + 2), 0);
  assert.equal(run(watch, 15, 30, 'performance'), 0);
});
