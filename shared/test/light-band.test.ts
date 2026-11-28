import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMaps, lightBand, type Box } from '../src/index.ts';

function slab(minY: number, maxY: number, mat: Box['mat'] = 'white', visible = true): Box {
  return { min: { x: -100, y: minY, z: -100 }, max: { x: 100, y: maxY, z: 100 }, mat, solid: true, shootThrough: false, visible };
}

test('a light is bounded by the floor under it and the ceiling over it', () => {
  const band = lightBand([slab(-16, 0), slab(176, 192), slab(368, 384)], { x: 0, y: 160, z: 0, color: '#fff' });
  assert.deepEqual(band, { floor: 0, ceiling: 176 });
});

test('glass, water, lamps and invisible clips do not bound a light', () => {
  const boxes = [slab(0, 4), slab(176, 180, 'glass'), slab(176, 180, 'water'), slab(176, 180, 'lamp'), slab(176, 180, 'clip', false), slab(300, 316)];
  assert.deepEqual(lightBand(boxes, { x: 0, y: 160, z: 0, color: '#fff' }), { floor: 4, ceiling: 300 });
});

test('boxes beside the light do not bound it', () => {
  const beside: Box = { min: { x: 200, y: 170, z: -10 }, max: { x: 300, y: 180, z: 10 }, mat: 'white', solid: true, shootThrough: false, visible: true };
  assert.deepEqual(lightBand([beside], { x: 0, y: 160, z: 0, color: '#fff' }), { floor: -Infinity, ceiling: Infinity });
});

test('every shopping light sits inside its own band, and a lamp under a slab is capped by it', () => {
  const shopping = getMaps().find((map) => map.id === 'shopping');
  assert.ok(shopping);
  const FOOD_COURT_DECK = 192;
  const FOOD_COURT_DECK_UNDERSIDE = 176;
  for (const light of shopping.lights) {
    const band = lightBand(shopping.boxes, light);
    assert.ok(band.floor < light.y && light.y < band.ceiling, `light at y ${light.y} sits between ${band.floor} and ${band.ceiling}`);
  }
  const groundLamp = shopping.lights.find((light) => light.y < FOOD_COURT_DECK && light.color === '#ffe9bd');
  assert.ok(groundLamp);
  assert.equal(lightBand(shopping.boxes, groundLamp).ceiling, FOOD_COURT_DECK_UNDERSIDE);
});
