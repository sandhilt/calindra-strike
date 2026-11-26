import assert from 'node:assert/strict';
import { it } from 'node:test';
import { buildShopping } from '../src/maps/shopping.ts';
import { DECK, DECK3, FACADE_Z, TOP_X, X, Z } from '../src/maps/shopping-levels.ts';

const shopping = buildShopping();
const CLEARANCE_UNITS = 64;
const FACADE_FRONT_Z = FACADE_Z + 8;
const COUNTER_FRONT_Z = -Z + 132;

it('keeps solid cover out of the first 64 units of aisle in front of every storefront', () => {
  const strips = [
    { x: 0, halfWidth: X, y: 0, z: FACADE_FRONT_Z },
    // The stair-bay rails use the outer four units on either side of the Mirante.
    { x: 0, halfWidth: TOP_X - 4, y: DECK3, z: FACADE_FRONT_Z },
    ...shopping.restaurants.filter(({ z }) => z < 0).map(({ x }) => ({
      x, halfWidth: 150, y: DECK, z: COUNTER_FRONT_Z,
    })),
  ];
  for (const { x, halfWidth, y, z } of strips) {
    for (const direction of [1, -1]) {
      const near = Math.min(direction * z, direction * (z + CLEARANCE_UNITS));
      const far = Math.max(direction * z, direction * (z + CLEARANCE_UNITS));
      const blockers = shopping.boxes.filter(({ solid, min, max }) =>
        solid && min.x < direction * x + halfWidth && max.x > direction * x - halfWidth &&
        min.z < far && max.z > near && min.y < y + 112 && max.y > y);
      assert.deepEqual(blockers, [], `blocked frontage at x=${direction * x}, y=${y}, z=${direction * z}`);
    }
  }
});
