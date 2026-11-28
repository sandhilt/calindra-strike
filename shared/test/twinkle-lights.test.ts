import assert from 'node:assert/strict';
import { test } from 'node:test';
import { strandBulbs, strandPoint, type TwinkleStrand } from '../src/maps/twinkle-lights.ts';

test('the strand meets its anchors, sags below the chord and spaces its bulbs evenly', () => {
  const strand: TwinkleStrand = { kind: 'twinkleLights', x: 10, y: 20, z: 30, x2: 50, y2: 28, z2: 70, sag: 4, bulbs: 3 };
  assert.deepEqual(strandPoint(strand, 0), { x: 10, y: 20, z: 30 });
  assert.deepEqual(strandPoint(strand, 1), { x: 50, y: 28, z: 70 });
  assert.deepEqual(strandBulbs(strand), [
    { x: 20, y: 19, z: 40 },
    { x: 30, y: 20, z: 50 },
    { x: 40, y: 23, z: 60 },
  ]);
});
