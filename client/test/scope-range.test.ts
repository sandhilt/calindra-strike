import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NO_RANGE, RANGE_MAX_METERS, RULER_STOPS_METERS, METERS_PER_UNIT, rangeReading, rulerFraction } from '../src/game/scope-range.ts';

test('units become metres', () => {
  const r = rangeReading(1000);
  assert.equal(r.meters, 1000 * METERS_PER_UNIT);
});

test('no hit and a hit beyond the ruler both read as out of range', () => {
  assert.deepEqual(rangeReading(null), NO_RANGE);
  assert.deepEqual(rangeReading((RANGE_MAX_METERS + 1) / METERS_PER_UNIT), NO_RANGE);
});

test('the ruler grows with the range, stays inside 0..1 and every mark fits', () => {
  assert.equal(rulerFraction(0), 0);
  assert.equal(rulerFraction(RANGE_MAX_METERS), 1);
  assert.equal(rulerFraction(RANGE_MAX_METERS * 4), 1);
  let last = -1;
  for (const stop of RULER_STOPS_METERS) {
    const f = rulerFraction(stop);
    assert.ok(f > last && f < 1);
    last = f;
  }
});
