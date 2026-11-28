import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KITCHEN_DEPTH } from '../src/maps/shopping-kitchens.ts';
import { BAY_ESCALATORS, BAY_FOOT_Z, DECK, GALLERY_Z, X, Z } from '../src/maps/shopping-levels.ts';
import { buildShoppingNatal } from '../src/maps/shopping-natal.ts';
import { RECYCLE_BIN_DEPTH_UNITS, RECYCLE_BIN_HEIGHT_UNITS, RECYCLE_BIN_WIDTH_UNITS, TRAY_COUNTER_HEIGHT_UNITS } from '../src/maps/shopping-scenery.ts';
import { buildShopping } from '../src/maps/shopping.ts';
import type { Box } from '../src/maps/types.ts';
import { CollisionWorld } from '../src/physics.ts';

type Bounds = Pick<Box, 'min' | 'max'>;
const MAX_COUNTER_GAP_UNITS = 12;
const CLEARANCE_UNITS = 64;
const COUNTER_FRONT_Z = -Z + 132;

function overlaps(a: Bounds, b: Bounds): boolean {
  return a.min.x < b.max.x && a.max.x > b.min.x &&
    a.min.y < b.max.y && a.max.y > b.min.y &&
    a.min.z < b.max.z && a.max.z > b.min.z;
}

function fromNorth(direction: number, x1: number, z1: number, x2: number, z2: number): Bounds {
  return {
    min: { x: direction === 1 ? x1 : -x2, y: DECK, z: direction === 1 ? z1 : -z2 },
    max: { x: direction === 1 ? x2 : -x1, y: DECK + 112, z: direction === 1 ? z2 : -z1 },
  };
}

for (const map of [buildShopping(), buildShoppingNatal()]) {
  test(`${map.id} keeps every recycling cabinet at a clear food court tray station`, () => {
    const bins = map.props.filter((prop) => prop.kind === 'recycleBin');
    const world = new CollisionWorld(map);
    assert.equal(bins.filter(({ z }) => z < 0).length, 3);
    assert.equal(bins.filter(({ z }) => z > 0).length, 3);

    const solids = map.boxes.filter(({ solid }) => solid);
    const trayCounters = new Set<Box>();
    for (const { x, y, z, yaw } of bins) {
      const direction = -Math.sign(z);
      const label = `station at ${x}, ${y}, ${z}`;
      const bounds = {
        min: { x: x - RECYCLE_BIN_WIDTH_UNITS / 2, y, z: z - RECYCLE_BIN_DEPTH_UNITS / 2 },
        max: { x: x + RECYCLE_BIN_WIDTH_UNITS / 2, y: y + RECYCLE_BIN_HEIGHT_UNITS, z: z + RECYCLE_BIN_DEPTH_UNITS / 2 },
      };
      assert.equal(y, DECK, label);
      assert.ok(Math.abs(x) + RECYCLE_BIN_WIDTH_UNITS / 2 < X, label);
      assert.ok(Math.abs(z) - RECYCLE_BIN_DEPTH_UNITS / 2 >= -GALLERY_Z, label);
      assert.ok(Math.abs(z) + RECYCLE_BIN_DEPTH_UNITS / 2 <= Z, label);
      assert.equal(world.groundBelow(x, y + 1, z, 1), y, label);
      assert.ok(-Math.cos(yaw) * direction > 0.99, label);

      const hulls = solids.filter((box) => overlaps(box, bounds));
      assert.equal(hulls.length, 1, label);
      assert.partialDeepStrictEqual(hulls[0], { ...bounds, visible: false });

      const counterTop = y + TRAY_COUNTER_HEIGHT_UNITS;
      const counter = solids.find(({ min, max, mat, visible }) => visible && mat === 'wood' &&
        min.y === y && max.y === counterTop && min.z === bounds.min.z && max.z === bounds.max.z &&
        (max.x === bounds.min.x || min.x === bounds.max.x));
      assert.ok(counter, label);
      assert.ok(!trayCounters.has(counter), label);
      trayCounters.add(counter);
      assert.deepEqual(solids.filter((box) => box !== counter && overlaps(box, counter)), [], label);
      assert.equal(world.groundBelow((counter.min.x + counter.max.x) / 2, y + 1, z, 1), y, label);

      const trays = map.boxes.filter(({ solid, visible, tint, min, max }) => !solid && visible && tint !== undefined &&
        min.y === counterTop && min.x > counter.min.x && max.x < counter.max.x &&
        min.z > counter.min.z && max.z < counter.max.z);
      assert.equal(new Set(trays.map(({ tint }) => tint)).size, 3, label);
      for (const tray of trays) {
        assert.ok(map.boxes.some(({ solid, min, max, tint }) => !solid && tint === tray.tint &&
          min.y === tray.max.y && min.x >= tray.min.x && max.x <= tray.max.x &&
          min.z === tray.min.z && max.z === tray.max.z), label);
      }

      const restaurants = map.restaurants.filter(({ z }) => Math.sign(z) === -direction);
      assert.ok(restaurants.some(({ x: cx }) => {
        const kitchenCounter = fromNorth(direction, direction * cx - 150, -Z + KITCHEN_DEPTH,
          direction * cx + 150, COUNTER_FRONT_Z);
        return solids.some(({ min, max }) => min.x === kitchenCounter.min.x && max.x === kitchenCounter.max.x &&
          min.z === kitchenCounter.min.z && max.z === kitchenCounter.max.z && min.y === y && max.y === counterTop) &&
          Math.max(kitchenCounter.min.x - bounds.max.x, bounds.min.x - kitchenCounter.max.x) <= MAX_COUNTER_GAP_UNITS &&
          bounds.min.z < kitchenCounter.max.z && bounds.max.z > kitchenCounter.min.z;
      }), label);

      const approaches = [
        ...restaurants.map(({ x: cx }) => fromNorth(direction, direction * cx - 150, COUNTER_FRONT_Z,
          direction * cx + 150, COUNTER_FRONT_Z + CLEARANCE_UNITS)),
        ...BAY_ESCALATORS.map(({ x1, x2 }) => fromNorth(direction, x1, BAY_FOOT_Z, x2, BAY_FOOT_Z + CLEARANCE_UNITS)),
        fromNorth(direction, -576, GALLERY_Z - CLEARANCE_UNITS, 576, GALLERY_Z),
      ];
      for (const approach of approaches) {
        assert.ok(!overlaps(bounds, approach) && !overlaps(counter, approach), label);
      }
    }
  });
}
