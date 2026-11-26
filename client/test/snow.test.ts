import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMaps } from '@calindra-strike/shared';
import { QUALITY } from '../src/game/render/quality.ts';
import { snowPosition, wrapSnow } from '../src/game/render/snow-motion.ts';
import { SnowView } from '../src/game/render/snow.ts';

test('falling snow is available on high and low only', () => {
  assert.equal(QUALITY.high.fallingSnow, true);
  assert.equal(QUALITY.low.fallingSnow, true);
  assert.equal(QUALITY.performance.fallingSnow, false);
});

test('snow falls and drifts deterministically, wrapping below the volume back to its top', () => {
  const flake = { x: 20, y: 90, z: 30, pace: 1, phase: 0 };
  const first = { x: 0, y: 0, z: 0 };
  const next = { ...first };
  snowPosition(flake, 0, first);
  snowPosition(flake, 2, next);
  assert.deepEqual(first, { x: 20, y: 90, z: 44 });
  assert.equal(next.y, -6);
  assert.ok(next.x > first.x);
  assert.equal(wrapSnow(next.y, 4, 96), 90);
  snowPosition(flake, 2, first);
  assert.deepEqual(first, next);
  assert.equal(wrapSnow(100, 4, 96), 4);
});

test('the snow mesh keeps every flake inside the exposed atrium and clears away from it', () => {
  const theme = getMaps().find(({ id }) => id === 'shopping-natal')?.theme.snow;
  assert.ok(theme);
  const snow = new SnowView(theme);
  const geometry = snow.mesh.geometry;
  const positions = geometry.getAttribute('position');
  assert.equal(geometry.drawRange.count, 0);
  snow.update(2, { x: 0, y: 64, z: theme.min.z });
  assert.ok(geometry.drawRange.count > 0 && geometry.drawRange.count < theme.flakes);
  for (let i = 0; i < geometry.drawRange.count; i++) {
    assert.ok(positions.getX(i) >= theme.min.x && positions.getX(i) < theme.max.x);
    assert.ok(positions.getY(i) >= theme.min.y && positions.getY(i) < theme.max.y);
    assert.ok(positions.getZ(i) >= theme.min.z && positions.getZ(i) < theme.max.z);
  }
  snow.update(0, { x: 0, y: 64, z: theme.min.z - 1500 });
  assert.equal(geometry.drawRange.count, 0);
  let disposed = 0;
  geometry.addEventListener('dispose', () => disposed++);
  snow.mesh.material.addEventListener('dispose', () => disposed++);
  snow.dispose();
  assert.equal(disposed, 2);
});
