import { brandMat, type StoreBrand } from './brands.ts';
import type { MapBuilder } from './builder.ts';

/**
 * Cover that breaks the long clean shots of Shopping Sul Rio: ad boards in the covered gallery, a car promotion, an
 * information desk, planters and ad columns in the atrium, menu boards and hedges in the food court.
 * Authored for the north half, inside `b.mirrored`, so the south half gets the same pieces turned 180 degrees.
 * `sightlines.test.ts` pins how open the map stays.
 */

/** Body height of a full-height blocker: above a standing eye, so nobody shoots over it. */
const WALL = 150;
/** Waist-high cover: a crouching player hides behind it, a standing one shoots over. */
const WAIST = 40;
const HEDGE = 70;
const PAINT = 0xe9edf2;

const GALLERY_FLOOR = 0;
const DECK = 192;
/** Ad columns stay under the longest drop a walker takes (300 units, `MAX_DROP` in the nav grid). */
const COLUMN = 280;

/** An ad panel is drawn whole on each of its faces, so one thin box carries the sign on both sides of a board. */
function adPanel(b: MapBuilder, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, brand: StoreBrand): void {
  b.deco(x1, y1, z1, x2, y2, z2, brandMat(brand));
}

/** A free-standing board across the walkway: a thin slab long in z with the same ad on both faces. */
function board(b: MapBuilder, x: number, z: number, length: number, y0: number, height: number, brand: StoreBrand, tint = PAINT): void {
  b.block(x, z, 20, length, height, 'white', y0, { tint });
  adPanel(b, x - 10.6, y0 + height * 0.4, z - length * 0.45, x + 10.6, y0 + height * 0.4 + length * 0.45, z + length * 0.45, brand);
}

/** A square ad column well above a head, still low enough to drop from, so a glider that lands on top can get down. */
function column(b: MapBuilder, x: number, z: number, side: number, top: number, brand: StoreBrand, tint = PAINT): void {
  b.block(x, z, side, side, top, 'white', 0, { tint });
  adPanel(b, x - side / 2 - 0.6, top - 110, z - side / 2 - 0.6, x + side / 2 + 0.6, top - 110 + side / 2, z + side / 2 + 0.6, brand);
}

/** Planter walls: a tiled base with a hedge on top that stops bullets. */
function planter(b: MapBuilder, x: number, z: number, w: number, d: number, y0 = 0): void {
  b.block(x, z, w, d, 26, 'tile', y0, { tint: 0xd8d2c4 });
  b.block(x, z, w - 8, d - 8, HEDGE, 'plant', y0 + 26);
}

/** A bench: a slatted seat on two legs, waist-high cover. */
function bench(b: MapBuilder, x: number, z: number, w: number, d: number, alongX: boolean): void {
  b.block(x, z, alongX ? w : d, alongX ? d : w, 22, 'wood', 0, { tint: 0xb98a58 });
  if (alongX) b.block(x, z - d / 2 + 3, w, 6, 18, 'wood', 22, { tint: 0xa4784a });
  else b.block(x - d / 2 + 3, z, 6, w, 18, 'wood', 22, { tint: 0xa4784a });
}

/** A cart with a canopy: counter-high base and a tall back panel, so it hides a standing player too. */
function cart(b: MapBuilder, x: number, z: number, brand: StoreBrand, tint: number): void {
  b.block(x, z, 96, 56, 46, 'white', 0, { tint });
  b.block(x, z + 22, 96, 8, 100, 'white', 46, { tint: 0xdfe3e8 });
  b.deco(x - 54, 146, z - 32, x + 54, 152, z + 32, 'white', tint);
  adPanel(b, x - 44, 70, z + 17.4, x + 44, 114, z + 26.6, brand);
  for (const sx of [-1, 1]) b.block(x + sx * 49, z - 24, 5, 5, 100, 'charcoal', 46);
}

/** The car on its stand: a low red body, a cabin, wheels and a backdrop wall that hides what is behind. */
function carStand(b: MapBuilder, x: number, z: number): void {
  b.block(x, z, 300, 170, 8, 'tile', 0, { tint: 0x2b2f36 });
  b.block(x, z + 6, 190, 82, 28, 'metal', 8, { tint: 0xb3202a });
  b.block(x - 8, z + 6, 108, 70, 26, 'metal', 36, { tint: 0xb3202a });
  b.deco(x - 62, 42, z - 30, x + 46, 58, z + 42, 'glass');
  for (const [wx, wz] of [[-62, -34], [62, -34], [-62, 46], [62, 46]] as const) b.block(x + wx, z + wz, 30, 12, 30, 'charcoal', 8);
  b.block(x, z - 96, 300, 14, WALL, 'white', 0, { tint: 0x1d2330 });
  adPanel(b, x - 110, 62, z - 88.6, x + 110, 62 + 110, z - 88.4, 'kfg');
  b.block(x - 140, z + 80, 10, 10, 90, 'charcoal', 8);
  b.block(x + 140, z + 80, 10, 10, 90, 'charcoal', 8);
}

/** An information desk with a tall pylon at its end. */
function infoDesk(b: MapBuilder, x: number, z: number): void {
  b.block(x, z, 190, 54, 100, 'desk', 0, { tint: 0xe2d6bf });
  b.deco(x - 98, 100, z - 29, x + 98, 104, z + 29, 'white', 0x3a2a1c);
  b.block(x + 120, z, 26, 26, 190, 'white', 0, { tint: 0x1b4d8f });
  adPanel(b, x + 105, 130, z - 14, x + 135, 160, z + 14, 'cea');
  b.add(x - 40, 104, z + 16, x + 40, 160, z + 18, 'screen', { solid: false });
  b.landmark('Informações', x, z);
}

/**
 * Ad boards that cross the covered walkway, one in front of the blank stretch of facade between two stores (the benchmark tour owns the other one). None
 * stands in front of a shop window or a door: the glass is what the walkway is for, so a board there only hid the
 * display and made a maze of walls before the entrances.
 */
function gallery(b: MapBuilder): void {
  const edge = -672;
  const run = 110;
  const boards: readonly (readonly [number, StoreBrand])[] = [
    [-690, 'cea'],
  ];
  for (const [x, brand] of boards) board(b, x, edge - 8 - run / 2, run, GALLERY_FLOOR, WALL, brand);
}

function atrium(b: MapBuilder): void {
  carStand(b, 860, -250);
  infoDesk(b, -300, -560);
  cart(b, -90, -330, 'mequi', 0xd7263d);
  cart(b, 220, -600, 'cacau-chou', 0x6a3a1c);
  cart(b, -1180, -80, 'cea', 0x0050a0);

  planter(b, -1010, -340, 200, 44);
  planter(b, 528, -150, 130, 44);
  planter(b, -60, -380, 200, 44);
  planter(b, 820, -540, 170, 44);
  planter(b, -1180, -620, 44, 150);

  bench(b, -360, -70, 130, 30, true);
  bench(b, 380, -80, 130, 30, true);
  bench(b, 1180, -140, 30, 130, false);

  for (const [x, z, brand] of [
    [-1160, -380, 'zarra'], [-700, -600, 'hew'], [-140, -470, 'riachuela'], [350, -360, 'travessura'],
    [1260, -560, 'amerikanas'], [-640, -100, 'cea'], [1250, -60, 'rener'],
  ] as const) column(b, x, z, 52, COLUMN, brand);
}

function foodCourt(b: MapBuilder): void {
  const menus: readonly (readonly [number, StoreBrand])[] = [
    [-600, 'mania-picanha'], [600, 'mequi'],
  ];
  for (const [x, brand] of menus) board(b, x, -795, 120, DECK, 140, brand, 0xd9c7a3);
  // nothing stands outside the lift doorway at x = 0
  for (const x of [-1000, -320, 320, 1000]) planter(b, x, -704, 160, 28, DECK);
}

export function coverShopping(b: MapBuilder): void {
  gallery(b);
  atrium(b);
  foodCourt(b);
}
