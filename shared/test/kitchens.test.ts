import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MapBuilder, type Box } from '../src/index.ts';
import { STORE_BRANDS, type FoodBrand } from '../src/maps/brands.ts';
import { Room } from '../src/maps/room.ts';
import { KITCHEN_DEPTH, KITCHEN_WIDTH, buildKitchen } from '../src/maps/shopping-kitchens.ts';

const EPS = 0.01;
const FOOD_BRANDS = Object.entries(STORE_BRANDS).flatMap(([id, brand]) => (brand.kind === 'food' ? [id as FoodBrand] : []));

/** The outer planes a player sees a kitchen from: the two side walls and the front. */
const OUTER_PLANES = [
  { name: 'left wall', axis: 'x', side: 'min', at: -KITCHEN_WIDTH / 2 },
  { name: 'right wall', axis: 'x', side: 'max', at: KITCHEN_WIDTH / 2 },
  { name: 'front', axis: 'z', side: 'max', at: KITCHEN_DEPTH },
] as const;

const look = (box: Box) => `${box.mat}/${box.tint ?? 'plain'}`;

describe('food court kitchens', () => {
  for (const brand of FOOD_BRANDS) {
    it(`${brand} shows one look on each outer plane, so no two boxes fight over a pixel`, () => {
      const b = new MapBuilder();
      buildKitchen(new Room(b, 0, 0, 0), brand);
      for (const { name, axis, side, at } of OUTER_PLANES) {
        const onPlane = b.boxes.filter((box) => box.visible && Math.abs(box[side][axis] - at) < EPS);
        assert.ok(onPlane.length > 0, `${name} has a box`);
        assert.deepEqual([...new Set(onPlane.map(look))], [look(onPlane[0])], `${name} is a single look`);
      }
    });
  }
});
