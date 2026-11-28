import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { QUALITY, QUALITY_OPTIONS, QUALITY_TIERS, parseQuality, renderPixelRatio } from '../src/game/render/quality.ts';
import { SMOKE_STYLES } from '../src/game/render/fx-tuning.ts';
import { loadSettings } from '../src/settings.ts';

const realStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

afterEach(() => {
  if (realStorage) Object.defineProperty(globalThis, 'localStorage', realStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

function storeSettings(saved: unknown): void {
  const getItem = () => JSON.stringify(saved);
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem }, configurable: true });
}

test('saved high and low keep their meaning and the new tier is accepted', () => {
  assert.equal(parseQuality('high'), 'high');
  assert.equal(parseQuality('low'), 'low');
  assert.equal(parseQuality('performance'), 'performance');
});

test('an unknown, missing or malformed saved tier falls back to high', () => {
  for (const bad of [undefined, null, '', 'ultra', 'Performance', 0, {}, ['low']]) assert.equal(parseQuality(bad), 'high');
});

test('loading settings migrates the quality field without touching the rest', () => {
  storeSettings({ name: 'ana', quality: 'low' });
  assert.partialDeepStrictEqual(loadSettings(), { name: 'ana', quality: 'low' });
  storeSettings({ name: 'ana', quality: 'performance' });
  assert.equal(loadSettings().quality, 'performance');
  storeSettings({ name: 'ana', quality: 'turbo' });
  assert.equal(loadSettings().quality, 'high');
  storeSettings({ name: 'ana' });
  assert.equal(loadSettings().quality, 'high');
});

test('the options list every tier once, in order, with the Portuguese labels', () => {
  assert.deepEqual(QUALITY_TIERS, ['high', 'low', 'performance']);
  assert.deepEqual(
    QUALITY_OPTIONS.map((o) => o.label),
    ['alta', 'leve', 'desempenho'],
  );
  assert.deepEqual(
    QUALITY_OPTIONS.map((o) => o.v),
    QUALITY_TIERS,
  );
});

test('high and low keep the full-resolution look they had before the third tier', () => {
  assert.equal(QUALITY.high.renderScale, 1);
  assert.equal(QUALITY.low.renderScale, 1);
  assert.equal(renderPixelRatio(QUALITY.high, 3), 1.5);
  assert.equal(renderPixelRatio(QUALITY.high, 1.25), 1.25);
  assert.equal(renderPixelRatio(QUALITY.low, 3), 1);
  assert.deepEqual(
    [QUALITY.high.antialias, QUALITY.high.shadows, QUALITY.high.shadowMapPx],
    [true, true, 2048],
  );
  assert.deepEqual(
    [QUALITY.low.antialias, QUALITY.low.shadows, QUALITY.low.shadowMapPx],
    [false, true, 1024],
  );
});

test('the performance tier draws below window resolution, without shadows or smoothing', () => {
  const p = QUALITY.performance;
  assert.ok(p.renderScale < 1 && p.renderScale >= 0.5);
  assert.equal(renderPixelRatio(p, 1), p.renderScale);
  assert.equal(renderPixelRatio(p, 2), p.renderScale);
  assert.equal(p.antialias, false);
  assert.equal(p.shadows, false);
  assert.ok(p.laptopScreenRefreshMs > QUALITY.high.laptopScreenRefreshMs);
  assert.ok(p.envMapPx < QUALITY.high.envMapPx);
});

test('each lighter tier never has more effects than the one above it', () => {
  const order = QUALITY_TIERS.map((t) => QUALITY[t].fx);
  for (let i = 1; i < order.length; i++) {
    const heavier = order[i - 1];
    const lighter = order[i];
    for (const key of ['magazines', 'casings', 'smokePuffs', 'tracers', 'casingChance', 'beltLinks'] as const) {
      assert.ok(lighter[key] <= heavier[key], `${QUALITY_TIERS[i]} ${key}`);
    }
  }
});

test('the performance tier has no smoke or casings but keeps magazines and tracers', () => {
  const fx = QUALITY.performance.fx;
  assert.equal(fx.smokePuffs, 0);
  assert.equal(SMOKE_STYLES.performance.impactDustPuffs, 0, 'no impact dust either');
  assert.equal(fx.casings, 0);
  assert.equal(fx.casingChance, 0);
  assert.ok(fx.magazines > 0);
  assert.ok(fx.tracers > 0);
});

test('only the high and low tiers ripple the water', () => {
  assert.deepEqual(QUALITY_TIERS.filter((tier) => QUALITY[tier].waterRipples), ['high', 'low']);
});

test('only the high tier twinkles', () => {
  assert.deepEqual(QUALITY_TIERS.filter((tier) => QUALITY[tier].twinkleLights), ['high']);
});
