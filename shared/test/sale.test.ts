import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SALE_RIBBON_CHANCE, SALE_SLOT_MS } from '../src/constants.ts';
import { brandMat, STORE_BRANDS, type StoreBrand } from '../src/maps/brands.ts';
import { SALE_EASELS, saleOn } from '../src/maps/sale.ts';

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
