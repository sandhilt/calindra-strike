import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SALE_RIBBON_CHANCE, SALE_SLOT_MS } from '../src/constants.ts';
import { brandMat, STORE_BRANDS, type StoreBrand } from '../src/maps/brands.ts';
import { SALE_EASELS, saleOn } from '../src/maps/sale.ts';
import { DECK3, FACADE_Z } from '../src/maps/shopping-levels.ts';
import { buildShoppingNatal } from '../src/maps/shopping-natal.ts';
import { SALE_EASEL_DEPTH_UNITS, SALE_EASEL_WIDTH_UNITS } from '../src/maps/shopping-scenery.ts';
import { buildShopping } from '../src/maps/shopping.ts';
import { CollisionWorld } from '../src/physics.ts';

const shopping = buildShopping();

test('ribbons use one deterministic roll per eligible brand per slot', () => {
  const brands = Object.keys(STORE_BRANDS) as StoreBrand[];
  const slots = 1500;
  for (const brand of brands) {
    let active = 0;
    for (let slot = 0; slot < slots; slot++) {
      const ms = slot * SALE_SLOT_MS;
      const on = saleOn(brand, ms);
      assert.equal(saleOn(brand, ms + SALE_SLOT_MS - 1), on);
      active += Number(on);
    }
    const { kind } = STORE_BRANDS[brand];
    if (kind === 'shop' || kind === 'boutique') {
      assert.ok(Math.abs(active / slots - SALE_RIBBON_CHANCE) < 0.055, brand);
    } else {
      assert.equal(active, 0, brand);
    }
  }
  const activeAt = (slot: number) => brands.filter((brand) => saleOn(brand, slot * SALE_SLOT_MS));
  assert.notDeepEqual(activeAt(0), activeAt(1));
});

test('each storefront ribbon has backing at its own shop, clear of the sign and doorway', () => {
  for (const map of [shopping, buildShoppingNatal()]) {
    const ribbons = map.props.filter((prop) => prop.kind === 'saleRibbon');
    const storefronts = map.boxes.filter(({ min, max, mat }) =>
      ((min.y === 114 && max.y === 174) || min.y === DECK3 + 142) && mat.startsWith('brand:') &&
      Math.abs(Math.abs((min.z + max.z) / 2) - Math.abs(FACADE_Z)) <= 16);
    assert.equal(ribbons.length, storefronts.length);
    assert.equal(new Set(ribbons.map(({ brand }) => brand)).size, ribbons.length);
    for (const { brand, x, y, z, width, height } of ribbons) {
      assert.ok(['shop', 'boutique'].includes(STORE_BRANDS[brand].kind), brand);
      const sign = storefronts.find(({ mat, min, max }) =>
        mat === brandMat(brand) && Math.sign(z) === Math.sign(min.z) &&
        Math.abs(x - (min.x + max.x) / 2) <= 192);
      assert.ok(sign, brand);
      const bottom = y - height / 2;
      const top = y + height / 2;
      assert.ok(top <= sign.min.y, brand);
      assert.ok(y < DECK3 || bottom > DECK3 + 132, brand);
      assert.ok(map.boxes.some(({ mat, min, max }) =>
        (y < DECK3 ? mat === 'glass' : mat === 'white') &&
        min.x <= x - width / 2 && max.x >= x + width / 2 &&
        min.y <= bottom && max.y >= top &&
        (z < 0 ? z - max.z : min.z - z) > 0 &&
        (z < 0 ? z - max.z : min.z - z) <= 4), brand);
    }
  }
});

test('easels keep the authored discounts and stand clear on storefront walkways', () => {
  const easels = shopping.props.filter((prop) => prop.kind === 'saleEasel');
  assert.deepEqual(easels.map(({ percent }) => percent).sort(), Object.values(SALE_EASELS).sort());
  const world = new CollisionWorld(shopping);
  for (const { x, y, z } of easels) {
    const width = SALE_EASEL_WIDTH_UNITS / 2;
    const depth = SALE_EASEL_DEPTH_UNITS / 2;
    assert.equal(world.groundBelow(x, y + 1, z, 1), y);
    assert.ok(Math.abs(z) + depth < Math.abs(FACADE_Z + 8 + 64));
    assert.ok(!shopping.boxes.some(({ solid, min, max }) => solid &&
      min.x < x + width && max.x > x - width && min.z < z + depth && max.z > z - depth &&
      min.y < y + 40 && max.y > y));

  }
});
