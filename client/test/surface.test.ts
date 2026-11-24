import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QUALITY, QUALITY_TIERS } from '../src/game/render/quality.ts';
import { IMPACT_SOUND } from '../src/game/surface-sound.ts';
import { sparkPlan, SPARK_LOOK, SURFACE_OF, surfaceOf, type Surface } from '../src/game/surface.ts';

test('metal and concrete have their own surface, and each surface has a spark look', () => {
  assert.equal(surfaceOf('metal'), 'metal');
  assert.equal(surfaceOf('lime'), 'metal');
  assert.equal(surfaceOf('concrete'), 'concrete');
  assert.equal(surfaceOf('charcoal'), 'concrete');
  assert.equal(surfaceOf('ground'), 'ground');
  for (const surface of new Set<Surface>(Object.values(SURFACE_OF))) assert.ok(SPARK_LOOK[surface], surface);
});

test('metal throws more sparks and more glints than concrete, and cloth and plants almost none', () => {
  assert.ok(SPARK_LOOK.metal.sparks > SPARK_LOOK.concrete.sparks);
  assert.ok(SPARK_LOOK.metal.glints > SPARK_LOOK.concrete.glints);
  for (const soft of ['cloth', 'plant'] as const) assert.ok(SPARK_LOOK[soft].sparks <= 1 && SPARK_LOOK[soft].glints === 0, soft);
});

test('every surface has a sound of its own and no two surfaces share one', () => {
  const surfaces = Object.keys(SPARK_LOOK) as Surface[];
  for (const surface of surfaces) {
    assert.ok(IMPACT_SOUND[surface].length > 0, surface);
    for (const layer of IMPACT_SOUND[surface]) assert.ok(layer.gain > 0 && layer.gain <= 0.4, `${surface} gain ${layer.gain}`);
  }
  assert.equal(new Set(surfaces.map((surface) => JSON.stringify(IMPACT_SOUND[surface]))).size, surfaces.length);
});

test('wood, crates and metal drums each sound different from plain metal and concrete', () => {
  assert.equal(surfaceOf('wood'), 'wood');
  assert.equal(surfaceOf('desk'), 'wood');
  assert.equal(surfaceOf('crate'), 'crate');
  assert.equal(surfaceOf('container'), 'container');
  assert.equal(surfaceOf('screen'), 'screen');
  assert.equal(surfaceOf('plant'), 'plant');
});

test('only the high tier sparkles', () => {
  assert.deepEqual(QUALITY_TIERS.filter((tier) => QUALITY[tier].fx.sparkle), ['high']);
});

test('only high and low render kitchen flames', () => {
  assert.deepEqual(QUALITY_TIERS.filter((tier) => QUALITY[tier].kitchenFire), ['high', 'low']);
});

test('only the high tier blurs the AWP scope surround', () => {
  assert.equal(QUALITY.high.scopeBlur, true);
  assert.equal(QUALITY.low.scopeBlur, false);
  assert.equal(QUALITY.performance.scopeBlur, false);
});

test('on performance the ambient motion and the vent smoke are off, and elsewhere they are on', () => {
  assert.deepEqual(QUALITY_TIERS.filter((tier) => QUALITY[tier].ambientMotion), ['high', 'low']);
  assert.deepEqual(QUALITY_TIERS.filter((tier) => QUALITY[tier].ventSmoke), ['high', 'low']);
  assert.equal(QUALITY.performance.ambientMotion, false);
  assert.equal(QUALITY.performance.ventSmoke, false);
});

test('escalator steps are not an ambient column: no tier can switch them off', () => {
  assert.deepEqual(Object.keys(QUALITY.performance).filter((key) => /escalator/i.test(key)), []);
});

test('outside the high tier every surface throws the same plain sparks, with no glints and no fade', () => {
  const plain = sparkPlan('concrete', false);
  for (const surface of Object.keys(SPARK_LOOK) as Surface[]) assert.deepEqual(sparkPlan(surface, false), plain, surface);
  assert.deepEqual(plain, { color: '#ffd38a', sparks: 6, glints: 0, fades: false });
});

test('on the high tier sparks take the surface colour, metal glints and everything fades', () => {
  assert.deepEqual(sparkPlan('metal', true), { ...SPARK_LOOK.metal, fades: true });
  assert.notEqual(sparkPlan('metal', true).color, sparkPlan('wood', true).color);
  assert.ok(sparkPlan('metal', true).glints > 0 && sparkPlan('plant', true).glints === 0);
});
