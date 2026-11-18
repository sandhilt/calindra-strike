import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HeatTracker, SmokePool, puffsForHeat, smokeAlpha, smokeSize } from '../src/game/render/smoke-sim.ts';
import { SMOKE_STYLES } from '../src/game/render/fx-tuning.ts';

const HIGH = SMOKE_STYLES.high;
const LOW = SMOKE_STYLES.low;

const middle = (): number => 0.5;

test('smoke fades in quickly, then eases out to nothing', () => {
  assert.equal(smokeAlpha(0, 0.2, HIGH.attackShare), 0);
  assert.equal(smokeAlpha(1, 0.2, HIGH.attackShare), 0);
  assert.ok(Math.abs(smokeAlpha(HIGH.attackShare, 0.2, HIGH.attackShare) - 0.2) < 1e-9);
  let previous = Infinity;
  for (let t = HIGH.attackShare; t < 1; t += 0.05) {
    const a = smokeAlpha(t, 0.2, HIGH.attackShare);
    assert.ok(a <= previous, `alpha must not rise after the peak, t=${t}`);
    previous = a;
  }
  assert.ok(smokeAlpha(0.9, 0.2, HIGH.attackShare) < 0.01);
});

test('heat builds on sustained fire, saturates at 1 and cools down when firing stops', () => {
  const heat = new HeatTracker();
  let h = 0;
  for (let i = 0; i < 4; i++) h = heat.shot(1, i * 0.1, 0.14, HIGH.heatDecayPerS);
  assert.ok(h > 0.3 && h < 0.5, `four quick shots, got ${h}`);
  for (let i = 4; i < 60; i++) h = heat.shot(1, i * 0.1, 0.14, HIGH.heatDecayPerS);
  assert.equal(h, 1);
  const cooled = heat.shot(1, 6 + 3, 0, HIGH.heatDecayPerS);
  assert.ok(cooled < 0.1, `three seconds later, got ${cooled}`);
});

test('heat is tracked per shooter', () => {
  const heat = new HeatTracker();
  heat.shot(1, 0, 0.5, 0.6);
  assert.equal(heat.shot(2, 0, 0.1, 0.6), 0.1);
  heat.clear();
  assert.equal(heat.shot(1, 0, 0.1, 0.6), 0.1);
});

test('hotter barrels let out more puffs, and low quality lets out fewer', () => {
  assert.equal(puffsForHeat(0, HIGH), 1);
  assert.equal(puffsForHeat(0.5, HIGH), 2);
  assert.equal(puffsForHeat(1, HIGH), 3);
  assert.equal(puffsForHeat(0.5, LOW), 1);
  assert.equal(puffsForHeat(1, LOW), 2);
});

test('puffs drift forward, swell, and are gone before their life is over', () => {
  const pool = new SmokePool(8, middle, HIGH);
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
  const pool = new SmokePool(4, middle, HIGH);
  pool.emit(0, 0, 0, 0, 0, -1, 0, 1);
  pool.emit(0, 0, 0, 0, 0, -1, 1, 1);
  const [calm, hot] = pool.puffs;
  assert.ok(hot.alphaPeak > calm.alphaPeak);
  assert.ok(hot.life > calm.life);
  assert.ok(hot.sizeEndUnits > calm.sizeEndUnits);
});

test('the smoke pool never exceeds its cap and drops the oldest puff', () => {
  const pool = new SmokePool(3, middle, HIGH);
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

test('high quality smoke curls sideways and lingers about a second; low stays short and straight', () => {
  const track = (style: typeof HIGH) => {
    const pool = new SmokePool(1, middle, style);
    pool.emit(0, 0, 0, 0, 0, -1, 0, 1);
    const p = pool.puffs[0];
    let maxSide = 0;
    let lived = 0;
    while (pool.count > 0) {
      pool.step(1 / 60);
      lived += 1 / 60;
      maxSide = Math.max(maxSide, Math.abs(p.x));
    }
    return { maxSide, lived };
  };
  const high = track(HIGH);
  const low = track(LOW);
  assert.ok(high.lived > 0.75 && high.lived < 1.6, `high lives about a second, got ${high.lived}`);
  assert.ok(low.lived < 0.7, `low stays short, got ${low.lived}`);
  assert.ok(high.maxSide > low.maxSide, 'high curls sideways more than low');
});

test('impact dust blows off along the surface normal and only high quality asks for it', () => {
  const pool = new SmokePool(2, middle, HIGH);
  pool.emitDust(0, 0, 0, 1, 0, 0);
  for (let i = 0; i < 10; i++) pool.step(1 / 60);
  assert.ok(pool.puffs[0].x > 0, 'moved off the wall');
  assert.ok(HIGH.impactDustPuffs > 0);
  assert.equal(LOW.impactDustPuffs, 0);
});
