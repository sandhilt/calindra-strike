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

it('never stacks two panels on the same stretch of the Mirante back wall', () => {
  // The shops dress their own back walls; a gallery-wide wainscot over them fights with or hides those faces.
  for (const side of [1, -1]) {
    const panels = shopping.boxes.filter(({ visible, min, max }) => {
      const wall = side * Z;
      const touches = side > 0 ? max.z === wall : min.z === wall;
      return visible && touches && max.z - min.z <= 4 && min.y < DECK3 + 100 && max.y > DECK3;
    });
    for (const [i, a] of panels.entries()) {
      for (const b of panels.slice(i + 1)) {
        const overlap = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) > 0 &&
          Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y) > 0;
        assert.ok(!overlap, `back wall panels overlap at x ${a.min.x}..${a.max.x} and ${b.min.x}..${b.max.x}`);
      }
    }
  }
});
