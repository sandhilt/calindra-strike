import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STORE_BRANDS, brandMat, getMaps, type BoutiqueBrand } from '../src/index.ts';
import { DECK3, ROOF } from '../src/maps/shopping-levels.ts';

const shopping = getMaps().find((m) => m.id === 'shopping');
assert.ok(shopping);
const BOUTIQUES = Object.entries(STORE_BRANDS).flatMap(([id, brand]) => (brand.kind === 'boutique' ? [id as BoutiqueBrand] : []));

describe('the shops of the Mirante', () => {
  it('has six boutiques', () => {
    assert.equal(BOUTIQUES.length, 6);
  });

  for (const brand of BOUTIQUES) {
    it(`${brand} stands once on the top floor, with its sign over the doorway and a spot for bots to browse`, () => {
      const name = `${STORE_BRANDS[brand].name} (Mirante)`;
      const landmarks = shopping.features.filter((f) => f.kind === 'landmark' && f.name === name);
      assert.equal(landmarks.length, 1, 'one landmark');
      const sign = shopping.boxes.filter((b) => b.mat === brandMat(brand) && b.min.y >= DECK3 && b.max.y <= ROOF);
      assert.equal(sign.length, 1, 'one sign on the top floor');
      const { x, z } = landmarks[0];
      assert.ok(shopping.interiors.some((i) => i.y === DECK3 && Math.abs(i.x - x) < 40 && Math.abs(i.z - z) < 20), 'a browse spot in front of the counter');
    });
  }

  it('puts three boutiques in the north half, the other three in the south one', () => {
    const north = BOUTIQUES.filter((brand) => shopping.features.some((f) => f.kind === 'landmark' && f.name === `${STORE_BRANDS[brand].name} (Mirante)` && f.z < 0));
    assert.equal(north.length, 3, 'three boutiques in the north half');
  });
});
