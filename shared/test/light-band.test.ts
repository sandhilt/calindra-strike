import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMaps, lightBand, type Box } from '../src/index.ts';

function slab(minY: number, maxY: number, mat: Box['mat'] = 'white', visible = true): Box {
  return { min: [-100, minY, -100], max: [100, maxY, 100], mat, solid: true, shootThrough: false, visible };
}

test('a light is bounded by the floor under it and the ceiling over it', () => {
  const band = lightBand([slab(-16, 0), slab(176, 192), slab(368, 384)], { x: 0, y: 160, z: 0, color: '#fff' });
  assert.deepEqual(band, { floor: 0, ceiling: 176 });
});

test('glass, water and invisible clips do not bound a light', () => {
  const boxes = [slab(0, 4), slab(176, 180, 'glass'), slab(176, 180, 'water'), slab(176, 180, 'clip', false), slab(300, 316)];
  assert.deepEqual(lightBand(boxes, { x: 0, y: 160, z: 0, color: '#fff' }), { floor: 4, ceiling: 300 });
});

test('boxes beside the light do not bound it', () => {
  const beside: Box = { min: [200, 170, -10], max: [300, 180, 10], mat: 'white', solid: true, shootThrough: false, visible: true };
  assert.deepEqual(lightBand([beside], { x: 0, y: 160, z: 0, color: '#fff' }), { floor: -Infinity, ceiling: Infinity });
});

test('every shopping light keeps its halo on its own floor', () => {
  const shopping = getMaps().find((map) => map.id === 'shopping');
  assert.ok(shopping);
  for (const light of shopping.lights) {
    const band = lightBand(shopping.boxes, light);
    assert.ok(Number.isFinite(band.ceiling), `light at ${light.x},${light.y},${light.z} has a ceiling`);
    assert.ok(band.ceiling > light.y && band.floor < light.y, `light at ${light.y} sits between ${band.floor} and ${band.ceiling}`);
  }
});
