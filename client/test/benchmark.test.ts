import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CollisionWorld, getMaps, MAX_SPEED, STEP_SIZE, WALK_SPEED_MULT } from '@calindra-strike/shared';
import { medianTiming } from '../src/benchmark/gpu-timer.ts';
import { buildTour, groundAt, sampleTour, TOURS, TOUR_EYE_HEIGHT } from '../src/benchmark/tours.ts';
import { parseBenchmarkParams } from '../src/benchmark/options.ts';
import { recommend, summarize } from '../src/benchmark/score.ts';

test('frame summaries include the 5% tolerance and use elapsed frame time for FPS', () => {
  assert.deepEqual(summarize([33, 17.5, 17.51, 16]), {
    frames: 4, fps: 47.6, medianMs: 17.51, p95Ms: 33, smoothPct: 50,
  });
  assert.deepEqual(summarize([]), { frames: 0, fps: 0, medianMs: 0, p95Ms: 0, smoothPct: 0 });
  assert.equal(summarize([16, 16, 33]).smoothPct, 67);
});

test('recommendation prefers quality at 90% and smoothness below 90%', () => {
  const high = summarize([...Array<number>(9).fill(16), 33]);
  const low = summarize([16]);
  const performance = summarize([16, 33]);
  assert.deepEqual(recommend({ performance, low, high }), {
    tier: 'high', percent: 90, tiers: [{ tier: 'high', ...high }, { tier: 'low', ...low }, { tier: 'performance', ...performance }],
  });
  assert.equal(recommend({ high: performance, low })?.tier, 'low');
  assert.equal(recommend({ high: summarize([33]), low: performance })?.tier, 'low');
  assert.equal(recommend({ low: performance, high: performance })?.tier, 'high');
  assert.equal(recommend({}), null);
});

const mapIds = ['forja', 'escritorio', 'shopping'];

test('benchmark parameters select known IDs and preserve explicit order', () => {
  const report = 'http://127.0.0.1:8000/report?key=value';
  assert.deepEqual(parseBenchmarkParams(`?benchmark&tiers=high-no-rt,high,high,invalid&maps=shopping,forja&rounds=2&ms=600&report=${encodeURIComponent(report)}`, mapIds), {
    enabled: true, options: { tiers: ['high-no-rt', 'high'], maps: ['shopping', 'forja'], rounds: 2, ms: 600 }, report,
  });
});

test('benchmark defaults invalid inputs and accepts only HTTP(S) loopback reporting', () => {
  for (const report of ['https://localhost.example/report', 'ftp://localhost/report', 'http://localhost@remote.test/', '/report']) {
    assert.deepEqual(parseBenchmarkParams(`?tiers=invalid&maps=1&rounds=-1&ms=NaN&report=${encodeURIComponent(report)}`, mapIds), {
      enabled: false, options: { tiers: ['high', 'low', 'performance'], maps: mapIds, rounds: 1, ms: 3000 }, report: null,
    });
  }
  assert.equal(parseBenchmarkParams('?benchmark&report=http://localhost:8000/', mapIds).report, 'http://localhost:8000/');
});

test('the tour walks at player speed and eases yaw across corners and the loop seam', () => {
  const map = getMaps().find(({ id }) => id === 'forja');
  assert.ok(map);
  const world = new CollisionWorld(map);
  const tour = buildTour(TOURS[map.id]);
  const durationMs = 1000 * tour.length / tour.speed;
  const start = sampleTour(tour, world, 0);
  const next = sampleTour(tour, world, 1000);
  const loop = sampleTour(tour, world, durationMs);
  assert.ok(Math.abs(Math.hypot(next.x - start.x, next.z - start.z) - MAX_SPEED * WALK_SPEED_MULT) < 1e-6);
  assert.ok(Math.hypot(loop.x - start.x, loop.z - start.z) < 1e-6);
  assert.equal(start.y, TOUR_EYE_HEIGHT);
  let previous = start;
  for (let ms = 10; ms < durationMs + 20; ms += 10) {
    const pose = sampleTour(tour, world, ms);
    const delta = pose.yaw - previous.yaw;
    assert.ok(Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta))) <= Math.PI / 300 + 1e-6);
    previous = pose;
  }
});

for (const map of getMaps().filter(({ id }) => Object.hasOwn(TOURS, id))) {
  test(`the ${map.id} tour keeps its footing and clears solid geometry`, () => {
    const world = new CollisionWorld(map);
    const tour = buildTour(TOURS[map.id]);
    for (const { from, to, start, distance } of tour.legs) {
      const steps = Math.ceil(distance / 2);
      let previousGround: number | undefined;
      let previousEye: ReturnType<typeof sampleTour> | undefined;
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const point = {
          x: from.x + (to.x - from.x) * f,
          z: from.z + (to.z - from.z) * f,
          y: (from.y ?? 0) + ((to.y ?? 0) - (from.y ?? 0)) * f,
        };
        const ground = groundAt(world, point);
        const where = JSON.stringify(point);
        assert.ok(Number.isFinite(ground), `missing ground at ${where}`);
        if (previousGround !== undefined) {
          assert.ok(Math.abs(ground - previousGround) <= STEP_SIZE, `ledge at ${where}`);
        }
        assert.ok(!world.hullOverlaps(point.x, ground + STEP_SIZE, point.z, TOUR_EYE_HEIGHT - STEP_SIZE),
          `blocked walking corridor at ${where}`);
        const eye = sampleTour(tour, world, (start + distance * f) * 1000 / tour.speed);
        const prior = previousEye ?? eye;
        // Sweep a narrow box between eye samples against movement solids, including glass.
        assert.ok(!world.overlaps(
          Math.min(eye.x, prior.x) - 1, Math.min(eye.y, prior.y) - 1, Math.min(eye.z, prior.z) - 1,
          Math.max(eye.x, prior.x) + 1, Math.max(eye.y, prior.y) + 1, Math.max(eye.z, prior.z) + 1,
        ), `blocked camera at ${where}`);
        previousGround = ground;
        previousEye = eye;
      }
    }
  });
}

test('timing medians use available samples and preserve missing GPU timing', () => {
  assert.equal(medianTiming([]), null);
  assert.equal(medianTiming([19, 3.124, 7, 3.125]), 5.06);
  assert.equal(medianTiming([5, 19, 7]), 7);
});

test('shopping tour climbs to the food court and descends to the atrium', () => {
  const map = getMaps().find(({ id }) => id === 'shopping');
  assert.ok(map);
  const world = new CollisionWorld(map);
  const tour = buildTour(TOURS[map.id]);
  const legs = tour.legs.filter(({ from, to }) => from.y !== to.y && from.z !== to.z);
  const foodCourtY = 192;
  assert.equal(legs.length, 2);
  for (const leg of legs) {
    const eye = (fraction: number) => sampleTour(tour, world, 1000 * (leg.start + leg.distance * fraction) / tour.speed).y;
    assert.equal(eye(-0.05), TOUR_EYE_HEIGHT + (leg.from.y ?? 0));
    assert.ok(Math.abs(eye(0.5) - (TOUR_EYE_HEIGHT + foodCourtY / 2)) <= STEP_SIZE);
    assert.equal(eye(1.05), TOUR_EYE_HEIGHT + (leg.to.y ?? 0));
  }
});
