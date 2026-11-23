import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_CYCLE_MS, DAY_SLOT_MS, DAY_TRANSITION_MS, dayCycleAt, dayCycleTarget } from '../src/index.ts';

describe('day cycle', () => {
  it('starts at full day and lasts 15 minutes', () => {
    assert.deepEqual(dayCycleAt(0), { phase: 'day', next: 'afternoon', blend: 0 });
    assert.equal(DAY_CYCLE_MS, 15 * 60_000);
  });

  it('runs day, afternoon, night and starts over', () => {
    const at = (ms: number) => dayCycleAt(ms).phase;
    assert.equal(at(DAY_SLOT_MS.day - 1), 'day');
    assert.equal(at(DAY_SLOT_MS.day), 'afternoon');
    assert.equal(at(DAY_SLOT_MS.day + DAY_SLOT_MS.afternoon), 'night');
    assert.equal(at(DAY_CYCLE_MS), 'day');
    assert.equal(at(DAY_CYCLE_MS * 40 + 5), 'day');
  });

  it('blends into the next phase over the last transition window of a slot', () => {
    const slot = DAY_SLOT_MS.afternoon;
    const start = DAY_SLOT_MS.day;
    assert.equal(dayCycleAt(start + slot - DAY_TRANSITION_MS).blend, 0);
    assert.deepEqual(dayCycleAt(start + slot - DAY_TRANSITION_MS / 2), { phase: 'afternoon', next: 'night', blend: 0.5 });
    assert.ok(dayCycleAt(start + slot - 1).blend > 0.99);
  });

  it('night hands over to day, closing the loop', () => {
    const c = dayCycleAt(DAY_CYCLE_MS - DAY_TRANSITION_MS / 4);
    assert.equal(c.phase, 'night');
    assert.equal(c.next, 'day');
    assert.equal(c.blend, 0.75);
  });

  it('the target is the next phase only once blending has started', () => {
    assert.equal(dayCycleTarget(dayCycleAt(1000)), 'day');
    assert.equal(dayCycleTarget(dayCycleAt(DAY_SLOT_MS.day - 1)), 'afternoon');
  });

  it('keeps a valid cycle for a negative clock', () => {
    assert.equal(dayCycleAt(-1).phase, 'night');
  });
});
