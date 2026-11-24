import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ESCALATOR_SPEED_UNITS_PER_S,
  LIFT_DOOR_OPEN_UNITS,
  LIFT_DOOR_SHUT_UNITS,
  doorOpening,
  nearestStop,
  JET_DROP,
  CASCADE_DROP,
  WISPS_PER_VENT,
  WISP_LIFE_SECONDS,
  WISP_MAX_ALPHA,
  WISP_SINK_UNITS,
  dropPose,
  escalatorPhase,
  fillStepSlot,
  newStepSlot,
  stepGeometry,
  wispPose,
  type DropPose,
  type WispPose,
} from '../src/game/render/prop-motion.ts';
import { MAX_VENT_HUMS, VentHum, nearestVents } from '../src/game/vent-hum.ts';

const SHAPE = { length: 320, height: 192 };

test('an escalator keeps the 16 unit steps of the stair boxes under it', () => {
  assert.deepEqual(stepGeometry(SHAPE), { count: 12, rise: 16, depth: 320 / 12 });
});

test('at a whole step the moving steps sit exactly on the stair boxes', () => {
  const { rise, depth, count } = stepGeometry(SHAPE);
  const slot = newStepSlot();
  for (let i = 0; i < count; i++) {
    fillStepSlot(slot, i, SHAPE);
    assert.equal(slot.treadOn, true);
    assert.ok(Math.abs(slot.treadFrom - depth * i) < 1e-9);
    assert.ok(Math.abs(slot.treadTo - depth * (i + 1)) < 1e-9);
    assert.ok(Math.abs(slot.treadTop - rise * (i + 1)) < 1e-9);
  }
});

for (const travel of ['up', 'down'] as const) {
  test(`steps moving ${travel} stay inside the escalator`, () => {
    const { count, depth } = stepGeometry(SHAPE);
    const period = depth / ESCALATOR_SPEED_UNITS_PER_S;
    const slot = newStepSlot();
    for (let sample = 0; sample <= 20; sample++) {
      const phase = escalatorPhase(sample * period / 20, SHAPE, travel);
      for (let i = 0; i <= count; i++) {
        fillStepSlot(slot, i - 1 + phase, SHAPE);
        if (slot.treadOn) {
          assert.ok(slot.treadFrom >= 0 && slot.treadTo <= SHAPE.length && slot.treadTo >= slot.treadFrom);
          assert.ok(slot.treadTop > 0 && slot.treadTop <= SHAPE.height);
        }
        if (slot.riserOn) {
          assert.ok(slot.riserAt > 0 && slot.riserAt <= SHAPE.length);
          assert.ok(slot.riserBottom >= 0 && slot.riserTop <= SHAPE.height && slot.riserTop > slot.riserBottom);
        }
      }
    }
  });
}

test('the steps travel at the escalator speed and the motion repeats once per step', () => {
  const { depth } = stepGeometry(SHAPE);
  const period = depth / ESCALATOR_SPEED_UNITS_PER_S;
  for (const travel of ['up', 'down'] as const) {
    assert.equal(escalatorPhase(0, SHAPE, travel), 0);
    assert.ok(Math.abs(escalatorPhase(period / 2, SHAPE, travel) - 0.5) < 1e-9);
    const phase = escalatorPhase(period / 4, SHAPE, travel);
    assert.ok(Math.abs(escalatorPhase(1.25 * period, SHAPE, travel) - phase) < 1e-9);
  }
});

test('downhill travel mirrors the uphill phase modulo one step', () => {
  const period = stepGeometry(SHAPE).depth / ESCALATOR_SPEED_UNITS_PER_S;
  for (const fraction of [0, 0.1, 0.25, 0.6, 0.99, 1, 1.01]) {
    const seconds = fraction * period;
    const up = escalatorPhase(seconds, SHAPE, 'up');
    const down = escalatorPhase(seconds, SHAPE, 'down');
    assert.ok(down >= 0 && down < 1);
    assert.ok(Math.abs(down - (1 - up) % 1) < 1e-9);
  }
});

test('fountain drops fly out and fall, ending below where they started', () => {
  const pose: DropPose = { r: 0, y: 0 };
  dropPose(pose, JET_DROP, 0);
  assert.deepEqual(pose, { r: JET_DROP.radius, y: JET_DROP.y0 });
  dropPose(pose, JET_DROP, 0.4);
  assert.ok(pose.y > JET_DROP.y0, 'the jet climbs first');
  dropPose(pose, JET_DROP, 1);
  assert.ok(pose.y < 0 && pose.r < 76, 'it lands inside the upper basin');
  dropPose(pose, CASCADE_DROP, 1);
  assert.ok(pose.y < -78 && pose.r > CASCADE_DROP.radius, 'the cascade reaches the lower basin');
});

test('a vent wisp fades in and out and never gets denser than the faint maximum', () => {
  const pose: WispPose = { out: 0, down: 0, side: 0, alpha: 0 };
  let peak = 0;
  for (let s = 0; s < 12; s += 0.1) {
    for (let i = 0; i < WISPS_PER_VENT; i++) {
      wispPose(pose, i, s, 0.3);
      assert.ok(pose.alpha >= 0 && pose.alpha <= WISP_MAX_ALPHA + 1e-9);
      assert.ok(pose.out >= 0 && pose.down >= 0);
      peak = Math.max(peak, pose.alpha);
    }
  }
  assert.ok(peak > WISP_MAX_ALPHA * 0.9);
  assert.ok(WISP_MAX_ALPHA <= 0.25, 'meant to be barely visible');
});

test('a vent wisp sinks and never climbs, because the air from a vent is cold', () => {
  const pose: WispPose = { out: 0, down: 0, side: 0, alpha: 0 };
  let deepest = 0;
  for (let s = 0; s < 12; s += 0.05) {
    for (let i = 0; i < WISPS_PER_VENT; i++) {
      wispPose(pose, i, s, 0.3);
      assert.ok(pose.down >= 0, 'never above the grille');
      assert.ok(pose.down <= WISP_SINK_UNITS + 1e-9);
      deepest = Math.max(deepest, pose.down);
    }
  }
  assert.ok(deepest > WISP_SINK_UNITS * 0.9, 'it does sink most of the way');
  const early: WispPose = { out: 0, down: 0, side: 0, alpha: 0 };
  const late: WispPose = { out: 0, down: 0, side: 0, alpha: 0 };
  wispPose(early, 0, 0.3 * WISP_LIFE_SECONDS, 0);
  wispPose(late, 0, 0.9 * WISP_LIFE_SECONDS, 0);
  assert.ok(late.down - early.down > early.down, 'it falls faster as it goes');
});

test('only the nearest vents within earshot hum', () => {
  const vents = [0, 100, 200, 300, 900].map((x) => ({ x, y: 0, z: 0 }));
  assert.deepEqual(nearestVents(vents, { x: 90, y: 0, z: 0 }, 3, 420), [1, 0, 2]);
  assert.deepEqual(nearestVents(vents, { x: 5000, y: 0, z: 0 }, 3, 420), []);
});

test('hums start near a vent, stop when the listener leaves, and all stop on dispose', () => {
  const vents = [0, 100, 200, 300, 1000].map((x) => ({ x, y: 0, z: 0 }));
  const live = new Set<number>();
  const hum = new VentHum(vents, (at) => {
    live.add(at.x);
    return { stop: () => live.delete(at.x) };
  });
  hum.update(1, { x: 0, y: 0, z: 0 });
  assert.deepEqual([...live].toSorted((a, b) => a - b), [0, 100, 200]);
  assert.ok(live.size <= MAX_VENT_HUMS);
  hum.update(1, { x: 1000, y: 0, z: 0 });
  assert.deepEqual([...live], [1000]);
  hum.dispose();
  assert.equal(live.size, 0);
});

const LIFT_SHAPE = {
  x: 0, z: -616, yaw: 0, width: 112, depth: 112,
  stops: [{ y: 0, side: 'back' }, { y: 192, side: 'front' }, { y: 384, side: 'front' }],
} as const;

test('the doors are open at a stop, shut between stops and ease in between', () => {
  assert.equal(doorOpening(0), 1);
  assert.equal(doorOpening(LIFT_DOOR_OPEN_UNITS), 1);
  assert.equal(doorOpening(LIFT_DOOR_SHUT_UNITS), 0);
  assert.equal(doorOpening(90), 0);
  const mid = doorOpening((LIFT_DOOR_OPEN_UNITS + LIFT_DOOR_SHUT_UNITS) / 2);
  assert.ok(mid > 0.4 && mid < 0.6);
  assert.deepEqual(nearestStop(LIFT_SHAPE.stops, 170), { index: 1, distance: 22 });
});
