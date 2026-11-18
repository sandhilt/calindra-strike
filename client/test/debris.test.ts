import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DebrisPool, debrisFade } from '../src/game/render/debris-sim.ts';
import { CASING_SPEC, MAGAZINE_SPEC } from '../src/game/render/fx-tuning.ts';

const STEP = 1 / 60;
const flatFloor = (_x: number, _y: number, _z: number): number => 0;

function seeded(): () => number {
  let s = 12345;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function run(pool: DebrisPool, seconds: number, ground = flatFloor): void {
  for (let t = 0; t < seconds; t += STEP) pool.step(STEP, ground);
}

test('a dropped magazine lands on the floor and lies still at its resting height', () => {
  const pool = new DebrisPool(MAGAZINE_SPEC, 4, seeded());
  pool.spawn(10, 60, 20, 12, -40, -8);
  run(pool, 1.2);
  assert.equal(pool.count, 1);
  const b = pool.bodies[0];
  assert.ok(b.landed);
  assert.ok(Math.abs(b.y - MAGAZINE_SPEC.halfHeightUnits) < 1e-6);
  assert.equal(b.vy, 0);
});

test('a magazine lies for two seconds at full size, then shrinks away', () => {
  const pool = new DebrisPool(MAGAZINE_SPEC, 4, seeded());
  pool.spawn(0, 40, 0, 0, 0, 0);
  run(pool, 1.0);
  const b = pool.bodies[0];
  assert.ok(b.landed);
  const landedAt = b.age - b.landedFor;
  const stillThere = (secondsLanded: number): number => {
    const target = landedAt + secondsLanded;
    while (pool.count > 0 && pool.bodies[0].age < target) pool.step(STEP, flatFloor);
    return pool.count;
  };
  assert.equal(stillThere(MAGAZINE_SPEC.holdSeconds - 0.05), 1);
  assert.equal(debrisFade(MAGAZINE_SPEC, pool.bodies[0].landedFor), 1);
  assert.equal(stillThere(MAGAZINE_SPEC.holdSeconds + MAGAZINE_SPEC.shrinkSeconds / 2), 1);
  const mid = debrisFade(MAGAZINE_SPEC, pool.bodies[0].landedFor);
  assert.ok(mid > 0 && mid < 1, `half way through the shrink, got ${mid}`);
  run(pool, 0.5);
  assert.equal(pool.count, 0);
});

test('the fade curve holds at 1, falls linearly and ends at 0', () => {
  assert.equal(debrisFade(MAGAZINE_SPEC, 0), 1);
  assert.equal(debrisFade(MAGAZINE_SPEC, MAGAZINE_SPEC.holdSeconds), 1);
  assert.ok(Math.abs(debrisFade(MAGAZINE_SPEC, MAGAZINE_SPEC.holdSeconds + MAGAZINE_SPEC.shrinkSeconds / 2) - 0.5) < 1e-9);
  assert.ok(debrisFade(MAGAZINE_SPEC, MAGAZINE_SPEC.holdSeconds + MAGAZINE_SPEC.shrinkSeconds) < 1e-9);
  assert.equal(debrisFade(MAGAZINE_SPEC, 99), 0);
});

test('a body lands on a raised floor, not on the ground below it', () => {
  const pool = new DebrisPool(CASING_SPEC, 2, seeded());
  pool.spawn(0, 90, 0, 0, 0, 0);
  run(pool, 2, () => 32);
  const b = pool.bodies[0];
  assert.ok(b.landed);
  assert.ok(Math.abs(b.y - (32 + CASING_SPEC.halfHeightUnits)) < 1e-6);
});

test('a body with nothing under it is removed once it outlives its safety age', () => {
  const pool = new DebrisPool(CASING_SPEC, 2, seeded());
  pool.spawn(0, 90, 0, 0, 0, 0);
  run(pool, CASING_SPEC.maxAgeSeconds + 0.5, () => -Infinity);
  assert.equal(pool.count, 0);
});

test('a full pool evicts its oldest body and never grows past the cap', () => {
  const pool = new DebrisPool(CASING_SPEC, 3, seeded());
  for (let i = 0; i < 3; i++) {
    pool.spawn(i * 100, 50, 0, 0, 0, 0);
    run(pool, 0.05);
  }
  assert.equal(pool.count, 3);
  pool.spawn(999, 50, 0, 0, 0, 0);
  assert.equal(pool.count, 3);
  const xs = pool.bodies.slice(0, pool.count).map((b) => Math.round(b.x)).toSorted((a, b) => a - b);
  assert.deepEqual(xs, [100, 200, 999]);
});

test('lowering the capacity drops the oldest bodies first, and a zero cap spawns nothing', () => {
  const pool = new DebrisPool(CASING_SPEC, 4, seeded());
  for (let i = 0; i < 4; i++) {
    pool.spawn(i * 100, 50, 0, 0, 0, 0);
    run(pool, 0.05);
  }
  pool.setCapacity(2);
  assert.equal(pool.count, 2);
  const xs = pool.bodies.slice(0, pool.count).map((b) => Math.round(b.x)).toSorted((a, b) => a - b);
  assert.deepEqual(xs, [200, 300]);
  pool.setCapacity(0);
  pool.spawn(0, 50, 0, 0, 0, 0);
  assert.equal(pool.count, 0);
});

test('a landed body eases onto its side', () => {
  const pool = new DebrisPool(MAGAZINE_SPEC, 1, seeded());
  pool.spawn(0, 20, 0, 0, 0, 0);
  run(pool, 1);
  const b = pool.bodies[0];
  assert.ok(b.landed);
  const quarterTurns = (b.rx - Math.PI / 2) / Math.PI;
  assert.ok(Math.abs(quarterTurns - Math.round(quarterTurns)) < 0.01, `rx ${b.rx} should lie axis-horizontal`);
});

test('a body that slides off a ledge falls again', () => {
  const pool = new DebrisPool(CASING_SPEC, 1, seeded());
  pool.spawn(0, 40, 0, 0, 0, 0);
  run(pool, 0.6, () => 30);
  const b = pool.bodies[0];
  assert.ok(b.landed);
  b.vx = 100;
  pool.step(STEP, (x) => (x > 0.5 ? 0 : 30));
  pool.step(STEP, (x) => (x > 0.5 ? 0 : 30));
  assert.equal(pool.bodies[0].landed, false);
});
