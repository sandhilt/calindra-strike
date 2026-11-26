import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildShopping } from '../src/maps/shopping.ts';
import { MIRROR_GLASS_TINT } from '../src/maps/room.ts';
import { DUMBBELL_PLATE_TINT, SHOE_SOLE_TINT } from '../src/maps/shopping-boutiques.ts';
import { brandMat, STORE_BRANDS, type ShopBrand } from '../src/maps/brands.ts';
import { DECK, DECK3, FACADE_Z, Z } from '../src/maps/shopping-levels.ts';
import { CHOCOLATES, STORE_HALF_WIDTH } from '../src/maps/shopping-stores.ts';
import type { Box } from '../src/maps/types.ts';

const shopping = buildShopping();
/** The ground floor stores that sell clothes, each with racks, mannequins and so a mirror on each side wall. */
const CLOTHING: readonly ShopBrand[] = ['zarra', 'cea', 'rener', 'hew', 'riachuela'];
/** Overlaps thinner than this (units) are faces that merely touch. */
const SLACK_UNITS = 0.5;

function overlaps(a: Box, b: Box): boolean {
  const reach = (lo: number, hi: number, lo2: number, hi2: number) => Math.min(hi, hi2) - Math.max(lo, lo2) > SLACK_UNITS;
  return reach(a.min.x, a.max.x, b.min.x, b.max.x) && reach(a.min.y, a.max.y, b.min.y, b.max.y) && reach(a.min.z, a.max.z, b.min.z, b.max.z);
}

function centre(box: Box): { x: number; z: number } {
  return { x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2 };
}

/** The bot browse spot of a Mirante shop, at its landmark, must have room for a player and nothing solid in its way. */
function assertBrowseSpotClear(x: number, z: number): void {
  const spot = shopping.interiors.find((i) => i.y === DECK3 && Math.abs(i.x - x) < 40 && Math.abs(i.z - z) < 20);
  assert.ok(spot, 'a browse spot in front of the counter');
  const blocker = shopping.boxes.find((box) => box.solid && box.min.y < DECK3 + 112 && box.max.y > DECK3 &&
    box.min.x < spot.x + 16 && box.max.x > spot.x - 16 && box.min.z < spot.z + 16 && box.max.z > spot.z - 16);
  assert.equal(blocker, undefined, `browse spot blocked by ${blocker?.mat}`);
}

/** The solid partition centred on `x`, which runs from the back wall (|z| = Z) to the storefront line (|z| = |FACADE_Z|). */
function partitionAt(x: number): Box | undefined {
  return shopping.boxes.find((box) => box.solid &&
    Math.abs(box.min.x - (x - 8)) < 0.5 && Math.abs(box.max.x - (x + 8)) < 0.5 &&
    Math.abs(Math.max(Math.abs(box.min.z), Math.abs(box.max.z)) - Z) < 1 &&
    Math.abs(Math.min(Math.abs(box.min.z), Math.abs(box.max.z)) - Math.abs(FACADE_Z)) < 1);
}

function groundStoreCentre(brand: ShopBrand): number {
  const name = STORE_BRANDS[brand].name;
  const landmark = shopping.features.find((f) => f.kind === 'landmark' && f.name === name);
  assert.ok(landmark && landmark.kind === 'landmark', `${name} has a landmark on the ground floor`);
  return landmark.x;
}

const mirrors = shopping.boxes.filter((box) => box.tint === MIRROR_GLASS_TINT);

describe('mirrors in the clothing stores', () => {
  for (const brand of CLOTHING) {
    it(`${brand} hangs a full-length mirror on each side wall, clear of its racks and mannequins`, () => {
      const cx = groundStoreCentre(brand);
      const own = mirrors.filter((m) => {
        const c = centre(m);
        return m.min.y >= 0 && m.max.y <= DECK && Math.abs(c.x - cx) > STORE_HALF_WIDTH - 10 && Math.abs(c.x - cx) < STORE_HALF_WIDTH && c.z < -Z + 272;
      });
      assert.equal(own.length, 2, 'one glass panel per side wall');
      assert.deepEqual(own.map((m) => Math.sign(centre(m).x - cx)).sort(), [-1, 1]);
      for (const mirror of own) {
        assert.equal(mirror.solid, false, 'look only');
        assert.equal(mirror.visible, true);
        const hit = shopping.boxes.find((other) => other !== mirror && overlaps(mirror, other));
        assert.equal(hit, undefined, `mirror inside ${hit?.mat} at ${JSON.stringify(hit?.min)}`);
      }
    });
  }

  it('hangs two mirrors per clothing store and two try-on mirrors each at Ray-Bão and Minotauro, and none anywhere else', () => {
    assert.equal(mirrors.length, CLOTHING.length * 2 + 4);
  });

  it('keeps every mirror clear of every other box on the map', () => {
    for (const mirror of mirrors) {
      const hit = shopping.boxes.find((other) => other !== mirror && overlaps(mirror, other));
      assert.equal(hit, undefined, `mirror inside ${hit?.mat} at ${JSON.stringify(hit?.min)}`);
    }
  });
});

describe('Ray-Bão, the eyewear boutique of the Mirante', () => {
  const name = `${STORE_BRANDS['ray-bao'].name} (Mirante)`;
  const landmark = shopping.features.find((f) => f.kind === 'landmark' && f.name === name);
  assert.ok(landmark && landmark.kind === 'landmark', 'a landmark on the Mirante');
  const cx = landmark.x;
  const inShop = (box: Box) => {
    const c = centre(box);
    return box.min.y >= DECK3 && Math.abs(c.x - cx) < 230 && c.z < landmark.z + 150 && c.z > landmark.z - 160;
  };
  const lenses = shopping.boxes.filter((box) => box.mat === 'glass' && inShop(box));

  it('shows three shelves of frames along the back wall', () => {
    const back = lenses.filter((box) => centre(box).z < landmark.z - 130 && box.min.y < DECK3 + 120);
    assert.equal(back.length, 3 * 13 * 2, 'two lenses for every pair, thirteen pairs on each of three shelves');
  });

  it('lays eight pairs of glasses open on the central table', () => {
    const table = lenses.filter((box) => box.min.y === DECK3 + 32);
    assert.equal(table.length, 8 * 2);
  });

  it('keeps the browse spot clear of the table and the displays', () => {
    assertBrowseSpotClear(landmark.x, landmark.z);
  });

  it('stands a try-on mirror on each side partition', () => {
    const mirrorsHere = mirrors.filter((m) => inShop(m) && Math.abs(centre(m).x - cx) > 200);
    assert.equal(mirrorsHere.length, 2);
    assert.deepEqual(mirrorsHere.map((m) => Math.sign(centre(m).x - cx)).sort(), [-1, 1]);
  });
});

describe('Minotauro, the sports shop of the Mirante', () => {
  const name = `${STORE_BRANDS.sentauro.name} (Mirante)`;
  const landmark = shopping.features.find((f) => f.kind === 'landmark' && f.name === name);
  assert.ok(landmark && landmark.kind === 'landmark', 'a landmark on the Mirante');
  const cx = landmark.x;
  const inShop = (box: Box) => {
    const c = centre(box);
    return box.min.y >= DECK3 && Math.abs(c.x - cx) < 230 && c.z < landmark.z + 150 && c.z > landmark.z - 160;
  };

  it('shows the shoe wall and a shoe table of six more pairs', () => {
    const soles = shopping.boxes.filter((box) => box.tint === SHOE_SOLE_TINT && inShop(box));
    assert.equal(soles.length, 2 * 6 + 6, 'two shelves of six pairs on the wall and six on the table');
  });

  it('racks dumbbells on three shelves, two plates each', () => {
    const plates = shopping.boxes.filter((box) => box.tint === DUMBBELL_PLATE_TINT && inShop(box));
    assert.equal(plates.length, 3 * 7 * 2);
  });

  it('keeps the browse spot clear of the shoe table and the rack', () => {
    assertBrowseSpotClear(landmark.x, landmark.z);
  });
});

describe('the Cacau Chou chocolate shop in the gap of the Mirante', () => {
  const name = `${STORE_BRANDS['cacau-chou'].name} (Mirante)`;
  /** Two landmarks, one per half: a name shared by both is suffixed with its compass corner. */
  const shops = shopping.features.filter((f) => f.kind === 'landmark' && f.name.startsWith(name));
  const SHOP_EDGES = [90, 276, -90, -276] as const;

  it('stands once in each half, between the corner boutique and the first large one', () => {
    assert.equal(shops.length, 2);
    for (const shop of shops) {
      assert.ok(Math.abs(shop.x) > 90 && Math.abs(shop.x) < 276, `x ${shop.x} lies in the gap`);
    }
  });

  it('is walled in by its neighbours partitions on both sides, so it adds no wall of its own', () => {
    for (const x of SHOP_EDGES) {
      assert.ok(partitionAt(x), `partition at x ${x}`);
    }
  });

  it('has its sign over the doorway in each half', () => {
    const signs = shopping.boxes.filter((box) => box.mat === brandMat('cacau-chou') && box.min.y >= DECK3);
    assert.equal(signs.length, 2);
  });

  it('stacks chocolate boxes on the back shelves and lays them out in a display case', () => {
    for (const shop of shops) {
      // The back wall is at |z| = Z, so the shelves are the boxes deeper than the landmark, on whichever side the shop stands.
      const chocolates = shopping.boxes.filter((box) => box.mat === 'white' && box.tint !== undefined && CHOCOLATES.includes(box.tint) &&
        box.min.y >= DECK3 && Math.abs(centre(box).x - shop.x) < 90 && Math.abs(centre(box).z) > Math.abs(shop.z) + 60);
      assert.ok(chocolates.length >= 40, `${chocolates.length} boxes on the shelves`);
      const cabinet = shopping.boxes.find((box) => box.solid && box.tint === 0x3b1d0e && box.min.y >= DECK3 &&
        Math.abs(centre(box).x - shop.x) < 10 && Math.abs(centre(box).z - shop.z) < 40);
      assert.ok(cabinet, 'a display case in the middle of the shop');
    }
  });

  it('keeps the browse spot in the aisle', () => {
    for (const shop of shops) assertBrowseSpotClear(shop.x, shop.z);
  });
});
