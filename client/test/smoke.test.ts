import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HeatTracker, SmokePool, puffsForHeat, smokeAlpha, smokeSize } from '../src/game/render/smoke-sim.ts';
import { SMOKE } from '../src/game/render/fx-tuning.ts';
import { QUALITY } from '../src/game/render/quality.ts';

const middle = (): number => 0.5;

test('smoke fades in quickly, then eases out to nothing', () => {
  assert.equal(smokeAlpha(0, 0.2), 0);
  assert.equal(smokeAlpha(1, 0.2), 0);
  assert.ok(Math.abs(smokeAlpha(SMOKE.attackShare, 0.2) - 0.2) < 1e-9);
  let previous = Infinity;
  for (let t = SMOKE.attackShare; t < 1; t += 0.05) {
    const a = smokeAlpha(t, 0.2);
    assert.ok(a <= previous, `alpha must not rise after the peak, t=${t}`);
    previous = a;
  }
  assert.ok(smokeAlpha(0.9, 0.2) < 0.01);
});

test('heat builds on sustained fire, saturates at 1 and cools down when firing stops', () => {
  const heat = new HeatTracker();
  let h = 0;
  for (let i = 0; i < 4; i++) h = heat.shot(1, i * 0.1, 0.14);
  assert.ok(h > 0.3 && h < 0.5, `four quick shots, got ${h}`);
  for (let i = 4; i < 60; i++) h = heat.shot(1, i * 0.1, 0.14);
  assert.equal(h, 1);
  const cooled = heat.shot(1, 6 + 3, 0);
  assert.ok(cooled < 0.1, `three seconds later, got ${cooled}`);
});

test('heat is tracked per shooter', () => {
  const heat = new HeatTracker();
  heat.shot(1, 0, 0.5);
  assert.equal(heat.shot(2, 0, 0.1), 0.1);
  heat.clear();
  assert.equal(heat.shot(1, 0, 0.1), 0.1);
});

test('hotter barrels let out more puffs, and lighter tiers let out fewer', () => {
  const { high, low, performance } = QUALITY;
  assert.equal(puffsForHeat(0, high.fx.puffsByHeat), 1);
  assert.equal(puffsForHeat(0.5, high.fx.puffsByHeat), 2);
  assert.equal(puffsForHeat(1, high.fx.puffsByHeat), 3);
  assert.equal(puffsForHeat(0.5, low.fx.puffsByHeat), 1);
  assert.equal(puffsForHeat(1, low.fx.puffsByHeat), 2);
  assert.equal(puffsForHeat(1, performance.fx.puffsByHeat), 0);
});

test('puffs drift forward, swell, and are gone before their life is over', () => {
  const pool = new SmokePool(8, middle);
  pool.emit(0, 0, 0, 0, 0, -1, 0, 1);
  const p = pool.puffs[0];
  const startSize = smokeSize(p);
  for (let i = 0; i < 20; i++) pool.step(1 / 60);
  assert.ok(p.z < 0, 'moved along the muzzle direction');
  assert.ok(p.y > 0, 'rose');
  assert.ok(smokeSize(p) > startSize);
  for (let i = 0; i < 120; i++) pool.step(1 / 60);
  assert.equal(pool.count, 0);
});

test('hot smoke is denser and lives longer than calm smoke', () => {
  const pool = new SmokePool(4, middle);
  pool.emit(0, 0, 0, 0, 0, -1, 0, 1);
  pool.emit(0, 0, 0, 0, 0, -1, 1, 1);
  const [calm, hot] = pool.puffs;
  assert.ok(hot.alphaPeak > calm.alphaPeak);
  assert.ok(hot.life > calm.life);
  assert.ok(hot.sizeEndUnits > calm.sizeEndUnits);
});

test('the smoke pool never exceeds its cap and drops the oldest puff', () => {
  const pool = new SmokePool(3, middle);
  for (let i = 0; i < 3; i++) {
    pool.emit(i * 100, 0, 0, 0, 0, -1, 0, 1);
    pool.step(0.01);
  }
  pool.emit(999, 0, 0, 0, 0, -1, 0, 1);
  assert.equal(pool.count, 3);
  const xs = pool.puffs.slice(0, pool.count).map((p) => Math.round(p.x / 10) * 10).toSorted((a, b) => a - b);
  assert.ok(!xs.includes(0), 'the oldest puff was evicted');
  pool.setCapacity(1);
  assert.equal(pool.count, 1);
});
