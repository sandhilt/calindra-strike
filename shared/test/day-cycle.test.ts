import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_CYCLE_MS, DAY_SLOT_MS, DAY_TRANSITION_MS, MOON_ECLIPSE_CHANCE, SOLAR_ECLIPSE_MS, cycleRoll, dayCycleAt, dayCycleTarget, eclipseAt, eclipseKindAt, moonPhaseAt } from '../src/index.ts';

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

describe('moon and eclipses', () => {
  it('shows the next of the four phases each cycle, holding through the night', () => {
    const phases = [0, 1, 2, 3, 4].map((i) => moonPhaseAt(i * DAY_CYCLE_MS + 1));
    assert.deepEqual(phases, ['new', 'waxing', 'full', 'waning', 'new']);
    assert.equal(moonPhaseAt(DAY_CYCLE_MS * 2), moonPhaseAt(DAY_CYCLE_MS * 3 - 1));
    assert.equal(moonPhaseAt(-1), 'waning');
  });

  it('rolls eclipses near their chance, only on full or new moons, deterministically', () => {
    let eligible = 0;
    let hits = 0;
    for (let i = 0; i < 40_000; i++) {
      const ms = i * DAY_CYCLE_MS + 1;
      const kind = eclipseKindAt(ms);
      const phase = moonPhaseAt(ms);
      if (phase === 'full' || phase === 'new') eligible++;
      if (!kind) continue;
      hits++;
      assert.equal(kind, phase === 'full' ? 'lunar' : 'solar');
      assert.equal(eclipseKindAt(ms), kind);
    }
    assert.ok(Math.abs(hits / eligible - MOON_ECLIPSE_CHANCE) < 0.01, `rate ${hits / eligible}`);
    assert.equal(cycleRoll(17), cycleRoll(17));
  });

  it('peaks a lunar eclipse mid night and a solar one mid day, clear elsewhere', () => {
    const find = (kind: string) => {
      for (let i = 0; ; i++) if (eclipseKindAt(i * DAY_CYCLE_MS + 1) === kind) return i * DAY_CYCLE_MS;
    };
    const lunar = find('lunar');
    const nightStart = lunar + DAY_CYCLE_MS - DAY_SLOT_MS.night;
    assert.ok(eclipseAt(nightStart + (DAY_SLOT_MS.night - DAY_TRANSITION_MS) / 2).depth > 0.99);
    assert.equal(eclipseAt(lunar + 1000).depth, 0);
    const solar = find('solar');
    const mid = solar + (DAY_SLOT_MS.day - DAY_TRANSITION_MS) / 2;
    assert.ok(eclipseAt(mid).depth > 0.99);
    assert.equal(eclipseAt(mid + SOLAR_ECLIPSE_MS).depth, 0);
    assert.equal(eclipseAt(1).kind === null || eclipseAt(1).kind === 'solar', true);
  });
});
