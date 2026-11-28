import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DECK, DECK3, FACADE_Z, Z } from '../src/maps/shopping-levels.ts';
import { buildShoppingNatal } from '../src/maps/shopping-natal.ts';
import { RECYCLE_BIN_DEPTH_UNITS, RECYCLE_BIN_HEIGHT_UNITS, RECYCLE_BIN_WIDTH_UNITS } from '../src/maps/shopping-scenery.ts';
import { buildShopping } from '../src/maps/shopping.ts';
import { CollisionWorld } from '../src/physics.ts';

for (const map of [buildShopping(), buildShoppingNatal()]) {
  test(`${map.id} keeps recycling cabinets on the floor, against fixtures and out of storefronts`, () => {
    const bins = map.props.filter((prop) => prop.kind === 'recycleBin');
    assert.deepEqual(bins.map(({ y }) => y).sort((a, b) => a - b), [0, 0, DECK, DECK, DECK3, DECK3]);
    const world = new CollisionWorld(map);
    for (const { x, y, z, yaw } of bins) {
      const width = RECYCLE_BIN_WIDTH_UNITS / 2;
      const depth = RECYCLE_BIN_DEPTH_UNITS / 2;
      const top = y + RECYCLE_BIN_HEIGHT_UNITS;
      assert.equal(world.groundBelow(x, y + 1, z, 1), y);
      const solids = map.boxes.filter(({ solid, min, max }) => solid &&
        min.x < x + width && max.x > x - width && min.z < z + depth && max.z > z - depth &&
        min.y < top && max.y > y);
      assert.equal(solids.length, 1);
      assert.partialDeepStrictEqual(solids[0], {
        min: { x: x - width, y, z: z - depth },
        max: { x: x + width, y: top, z: z + depth },
        visible: false,
      });
      const face = Math.cos(yaw) > 0 ? -1 : 1;
      const back = z - face * depth;
      assert.ok(map.boxes.some(({ solid, min, max }) => solid &&
        min.x <= x - width && max.x >= x + width && min.y <= y && max.y >= top &&
        (face === 1 ? max.z === back : min.z === back)));
      const storefrontFront = y === DECK ? Z - 132 : Math.abs(FACADE_Z + 8);
      assert.ok(Math.abs(z) + depth <= storefrontFront - 64);
    }
  });
}
