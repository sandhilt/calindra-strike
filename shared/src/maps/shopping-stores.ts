import type { ShopBrand } from './brands.ts';
import { outfit, Room, seeded } from './room.ts';

/** A store is 688 wide between its partitions, 272 deep, and 176 under the food court floor. */
export const STORE_HALF_WIDTH = 344;
export const STORE_DEPTH = 272;
const CEILING = 176;
/** A grille on the 30 unit shell duct, short enough to leave a strip of duct above and below it (units). */
const DUCT_VENT_HEIGHT = 22;
type Hex = number;

const STEEL = 0xc9ced6;

/** The surfaces and light every store shares, in the colours of its brand. */
interface Dress {
  floor: 'tile' | 'desk' | 'white';
  floorTint: Hex;
  wall: Hex;
  trim: Hex;
}

function shell(r: Room, d: Dress): void {
  r.box(0, STORE_DEPTH / 2 - 1, 2 * STORE_HALF_WIDTH - 4, STORE_DEPTH - 6, 0.5, 0, d.floor, d.floorTint);
  r.box(0, 1, 2 * STORE_HALF_WIDTH - 4, 2, CEILING - 6, 0, 'white', d.wall);
  for (const side of [-1, 1]) r.box(side * (STORE_HALF_WIDTH - 1.5), STORE_DEPTH / 2, 2, STORE_DEPTH - 6, CEILING - 6, 0, 'white', d.wall);
  r.box(0, 1.4, 2 * STORE_HALF_WIDTH - 4, 2.4, 6, 0, 'white', d.trim);
  r.box(0, 1.4, 2 * STORE_HALF_WIDTH - 4, 2.4, 3, 112, 'white', d.trim);
  r.duct(0, 15, 2 * STORE_HALF_WIDTH - 8, 30, 30, CEILING - 36);
  for (const x of [-200, 200]) r.vent(x, CEILING - 21, 30, 'front', 44, DUCT_VENT_HEIGHT);
  for (const x of [-230, -80, 80, 230]) r.box(x, 150, 70, 6, 1.4, CEILING - 1.4, 'lamp');
}

/** A table of folded goods: a solid base with stacks of coloured squares on top. */
function foldedTable(r: Room, x: number, z: number, w: number, d: number, palette: readonly Hex[], seed: number): void {
  const rnd = seeded(seed);
  r.solid(x, z, w, d, 26, 0, 'desk', 0xf3ece0);
  const cols = Math.floor(w / 18);
  const rows = Math.floor(d / 18);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const color = palette[Math.floor(rnd() * palette.length)];
      r.box(x - w / 2 + 9 + i * 18, z - d / 2 + 9 + j * 18, 15, 15, 4 + Math.floor(rnd() * 3) * 3, 26, 'white', color);
    }
  }
}

/** Shelves along a wall with rows of boxes of goods in the given colours. */
export function wallShelves(r: Room, x: number, z: number, width: number, depth: number, levels: number, palette: readonly Hex[], seed: number, shelfTint = 0xe6dccb): void {
  const rnd = seeded(seed);
  const gap = 88 / levels;
  r.solid(x, z, width, depth, 8, 0, 'desk', shelfTint);
  for (let l = 0; l < levels; l++) {
    const y = 14 + l * gap;
    r.box(x, z, width, depth, 1.6, y, 'desk', shelfTint);
    for (let i = 0; i < Math.floor(width / 9); i++) {
      const h = 7 + Math.floor(rnd() * 3) * 3;
      r.box(x - width / 2 + 5 + i * 9, z, 7.6, depth - 4, Math.min(h, gap - 4), y + 1.6, 'white', palette[Math.floor(rnd() * palette.length)]);
    }
  }
  r.box(x, z - depth / 2 + 0.75, width, 1, 96, 8, 'desk', shelfTint);
}

function plinth(r: Room, x: number, z: number, tint: Hex): number {
  r.box(x, z, 56, 56, 6, 0, 'white', tint);
  return 6;
}

function counter(r: Room, tint: Hex, topTint: Hex): void {
  r.box(0, 52, 144, 40, 1.4, 40, 'white', topTint);
  r.box(0, 34, 140, 1.4, 40, 0, 'white', tint);
  r.box(-34, 50, 18, 12, 12, 41.4, 'charcoal', 0x1b1b1b);
  r.box(-34, 44, 14, 1, 8, 49, 'screen');
}

const MONO = [0x111111, 0xf5f5f5, 0x8d8d8d, 0x2e2e2e];
const DENIM = [0x2a4f8f, 0x4d77b8, 0x1d3463, 0xe8e8e8];
const WARM = [0xe50010, 0xffffff, 0x222222, 0xf2b84b];
const NAVY = [0x1c2a5a, 0xc9a227, 0xf2ece0, 0x6b7fb5];

function saleSign(r: Room, x: number, z: number, y: number, tint: Hex): void {
  r.box(x, z, 34, 2, 24, y, 'white', tint);
  for (const step of [-1, 0, 1]) {
    r.box(x + step * 4, z + 1.5, 4, 1, 5, y + 9 + step * 5, 'white', 0xffffff);
  }
  r.box(x - 8, z + 1.5, 4, 1, 4, y + 16, 'white', 0xffffff);
  r.box(x + 8, z + 1.5, 4, 1, 4, y + 5, 'white', 0xffffff);
}

function clothingDisplay(r: Room, palette: readonly Hex[], accent: Hex): void {
  r.box(-152, 14, 62, 3, 3, 99, 'metal', STEEL);
  for (const offset of [-24, -16, -8, 0, 8, 16, 24]) {
    r.box(-152 + offset, 14, 7.8, 3 + (Math.abs(offset) % 16 ? 3 : 0), 92, 7, 'white', palette[0]);
  }
  r.box(-205, 7, 29, 3, 89, 7, 'metal', STEEL);
  r.box(-205, 9, 24, 1, 83, 10, 'white', 0xc7dbe1);
  r.box(-211, 9.8, 3, 0.6, 72, 17, 'white', 0xeaf5f8);
  for (const y of [46, 72]) {
    r.box(238, 11, 94, 14, 2, y, 'desk', accent);
    palette.forEach((color, i) => {
      const x = 202 + i * 23;
      r.box(x, 12, 16, 9, 5, y + 2, 'white', color);
      r.box(x - 3, 10, 9, 5, 5, y + 7, 'white', color);
    });
  }
  r.box(110, 148, 2, 2, 22, 56, 'metal', STEEL);
  saleSign(r, 110, 148, 78, accent);
  r.box(192, 142, 17, 12, 2, 56, 'white', 0xf2efe8);
  r.box(192, 142, 4, 4, 9, 58, 'metal', STEEL);
  r.box(192, 142, 14, 8, 19, 67, 'white', palette[1]);
  r.box(192, 142, 23, 7, 5, 80, 'white', palette[1]);
  r.box(192, 142, 7, 7, 9, 86, 'white', 0xd7baa6);
}

function zarra(r: Room): void {
  shell(r, { floor: 'tile', floorTint: 0xf3f3f0, wall: 0xf4f4f1, trim: 0x151515 });
  r.box(0, 3, 200, 2, 120, 20, 'charcoal', 0x151515);
  counter(r, 0x141414, 0xf5f5f5);
  for (const side of [-1, 1]) {
    r.rack(side * 316, 110, side < 0 ? 'right' : 'left', 90, MONO);
    r.rack(side * 316, 220, side < 0 ? 'right' : 'left', 90, MONO);
    r.rack(side * 250, 40, 'front', 100, MONO);
  }
  r.mannequin(-150, 232, 'front', outfit(0xf5f5f5, 0x1b1b1b, 0x111111), plinth(r, -150, 232, 0x151515));
  r.mannequin(-235, 232, 'front', outfit(0x111111, 0x111111, 0xf5f5f5, true), plinth(r, -235, 232, 0x151515));
  r.mannequin(150, 232, 'front', outfit(0x111111, 0x8d8d8d, 0xf5f5f5), plinth(r, 150, 232, 0x151515));
  r.mannequin(235, 232, 'front', outfit(0xf5f5f5, 0x111111, 0x151515, true), plinth(r, 235, 232, 0x151515));
  clothingDisplay(r, MONO, 0x972a3d);
}

function cea(r: Room): void {
  shell(r, { floor: 'white', floorTint: 0x4f78b8, wall: 0xdbe7f7, trim: 0x0050a0 });
  r.box(0, 3, 240, 2, 70, 90, 'white', 0x0050a0);
  counter(r, 0x0050a0, 0xf5f5f5);
  for (const side of [-1, 1]) {
    r.rack(side * 316, 120, side < 0 ? 'right' : 'left', 110, DENIM);
    r.rack(side * 250, 205, 'front', 90, [0x0050a0, 0xe8e8e8, 0xd94f4f]);
    foldedTable(r, side * 268, 85, 76, 44, DENIM, 11 + side);
  }
  r.mannequin(-215, 232, 'front', outfit(0x4d77b8, 0x1d3463, 0xffffff), plinth(r, -215, 232, 0xdbe7f7));
  r.mannequin(215, 232, 'front', outfit(0xd94f4f, 0x2a4f8f, 0xffffff), plinth(r, 215, 232, 0xdbe7f7));
  r.mannequin(-160, 232, 'front', outfit(0xf2b84b, 0xf5f5f5, 0x0050a0, true), plinth(r, -160, 232, 0xdbe7f7));
  clothingDisplay(r, DENIM, 0x0050a0);
}

function rener(r: Room): void {
  shell(r, { floor: 'desk', floorTint: 0x8a6a4a, wall: 0xb5503a, trim: 0x1b1b1b });
  r.box(0, 2.5, 2 * STORE_HALF_WIDTH - 4, 3, 110, 0, 'brick', 0xb86a55);
  counter(r, 0x1b1b1b, 0x3a2a1c);
  for (const side of [-1, 1]) {
    r.rack(side * 316, 105, side < 0 ? 'right' : 'left', 100, [0x151515, 0x2b2b2b, 0x4a3b2a, 0x1f2f3f]);
    r.rack(side * 316, 215, side < 0 ? 'right' : 'left', 90, [0x151515, 0x6e2a22, 0x2b2b2b]);
    foldedTable(r, side * 268, 85, 70, 44, [0x151515, 0x3b3b3b, 0x6e2a22], 21 + side);
  }
  r.mannequin(-190, 232, 'front', outfit(0x151515, 0x2d2d2d, 0xe6e6e6), plinth(r, -190, 232, 0x2b2b2b));
  r.mannequin(190, 232, 'front', outfit(0x6e2a22, 0x1d1d1d, 0xe6e6e6), plinth(r, 190, 232, 0x2b2b2b));
  r.mannequin(-250, 190, 'right', outfit(0x2b2b2b, 0x151515, 0xa5fa00), 0);
  r.box(0, 14, 180, 2, 3, 128, 'lime');
  clothingDisplay(r, [0x6e2a22, 0x2b2b2b, 0x9b684a, 0xe6e6e6], 0x6e2a22);
}

function hew(r: Room): void {
  shell(r, { floor: 'tile', floorTint: 0xf0eeea, wall: 0xf4f0ea, trim: 0xe50010 });
  r.box(0, 3, 300, 2, 90, 76, 'white', 0xe50010);
  counter(r, 0xe50010, 0xf5f5f5);
  for (const side of [-1, 1]) {
    r.rack(side * 316, 100, side < 0 ? 'right' : 'left', 100, WARM);
    r.rack(side * 316, 210, side < 0 ? 'right' : 'left', 100, WARM);
    r.rack(side * 240, 60, 'front', 80, DENIM);
    r.rack(side * 240, 120, 'front', 80, WARM);
  }
  const shoes = seeded(77);
  for (let i = 0; i < 14; i++) r.box(-128 + i * 20, 8, 15, 12, 6, 28 + (i % 3) * 22, 'white', WARM[Math.floor(shoes() * WARM.length)]);
  r.mannequin(-210, 232, 'front', outfit(0xe50010, 0x2a4f8f, 0xf5f5f5), plinth(r, -210, 232, 0xe50010));
  r.mannequin(210, 232, 'front', outfit(0xf5f5f5, 0x1b1b1b, 0xe50010, true), plinth(r, 210, 232, 0xe50010));
  r.mannequin(-290, 232, 'front', outfit(0x222222, 0xe50010, 0xf5f5f5), plinth(r, -290, 232, 0xe50010));
  clothingDisplay(r, WARM, 0xe50010);
}

function riachuela(r: Room): void {
  shell(r, { floor: 'desk', floorTint: 0xd0a070, wall: 0xf3ecdc, trim: 0xc9a227 });
  r.box(0, 3, 260, 2, 90, 60, 'white', 0x1c2a5a);
  r.box(0, 3.4, 266, 1, 3, 150, 'white', 0xc9a227);
  counter(r, 0x1c2a5a, 0xe9dcc0);
  for (const side of [-1, 1]) {
    r.rack(side * 316, 110, side < 0 ? 'right' : 'left', 110, NAVY);
    r.rack(side * 250, 210, 'front', 90, NAVY);
    foldedTable(r, side * 268, 90, 70, 44, NAVY, 31 + side);
    r.mannequin(side * 215, 232, 'front', outfit(side < 0 ? 0xc9a227 : 0x1c2a5a, side < 0 ? 0x1c2a5a : 0xc9a227, 0xf2ece0, true), plinth(r, side * 215, 232, 0xc9a227));
    r.mannequin(side * 290, 232, 'front', outfit(0xf2ece0, 0x6b7fb5, 0xc9a227, side > 0), plinth(r, side * 290, 232, 0xc9a227));
  }
  r.box(0, 150, 56, 56, 2, CEILING - 8, 'white', 0xf2ece0);
  r.box(0, 150, 20, 20, 24, CEILING - 32, 'white', 0xc9a227);
  clothingDisplay(r, NAVY, 0x1c2a5a);
}

export const CHOCOLATES = [0x4a2513, 0x6a3a1c, 0xe9c27a, 0xd98a9a, 0x2b160b, 0xf5e6c8, 0x8a5a33];

function cacauChou(r: Room): void {
  shell(r, { floor: 'desk', floorTint: 0x7a4e30, wall: 0x5a2f1b, trim: 0xe9c27a });
  wallShelves(r, 0, 8, 300, 14, 4, CHOCOLATES, 41, 0x6a3a1c);
  r.box(0, 3, 200, 2, 14, 128, 'white', 0xe9c27a);
  counter(r, 0x3b1d0e, 0xe9c27a);
  for (let i = 0; i < 8; i++) r.box(-56 + i * 16, 48, 10, 10, 6, 41.6, 'white', CHOCOLATES[i % CHOCOLATES.length]);
  for (const side of [-1, 1]) {
    wallShelves(r, side * 330, 140, 14, 150, 4, CHOCOLATES, 42 + side, 0x6a3a1c);
    r.solid(side * 230, 150, 70, 46, 40, 0, 'desk', 0x3b1d0e);
    r.box(side * 230, 150, 74, 50, 1.6, 40, 'white', 0xe9c27a);
  }
  r.box(0, 190, 40, 40, 6, 0, 'desk', 0x3b1d0e);
  r.box(0, 190, 28, 28, 16, 6, 'desk', 0x4a2513);
  r.box(0, 190, 18, 18, 14, 22, 'desk', 0x5a3118);
  r.box(0, 190, 9, 9, 12, 36, 'desk', 0x6a3a1c);
  r.box(0, 190, 5, 5, 6, 48, 'wood', 0x3b1d0e);
  r.box(-239, 162, 54, 27, 3, 41.6, 'metal', STEEL);
  r.box(-239, 162, 42, 20, 1, 44.6, 'white', 0x4a2513);
  for (const x of [-253, -239, -225]) r.box(x, 162, 8, 14, 1, 45.6, 'white', 0x8a5a33);
  for (const [i, x] of [208, 230, 252].entries()) {
    const tint = CHOCOLATES[i + 2];
    r.box(x, 162, 17, 14, 12, 41.6, 'white', tint);
    r.box(x, 162, 17.8, 14.8, 2, 53.6, 'white', tint);
    r.box(x, 162, 3, 15.2, 2.6, 53.6, 'white', 0xf5e6c8);
    r.box(x, 172, 1, 1, 36, 140, 'metal', STEEL);
    r.box(x, 172, 8, 8, 5, 120, 'white', tint);
    r.box(x, 172, 14, 11, 10, 125, 'white', tint);
    r.box(x, 172, 10, 9, 5, 135, 'white', tint);
  }
}

/** The logo red; the sign in `client/src/game/render/store-signs.ts` draws the same one. */
const AMERIKANAS_RED = 0xe60014;
const AMERIKANAS_WHITE = 0xf8f6f2;
const SWEETS = [0xe60014, 0xf2c200, 0x1f9bd1, 0x2f9e44, 0xff7ab0, 0xff7a1a, 0x7a3fb0, 0xffffff];
const HOUSEHOLD = [0xe60014, 0xf2c200, 0x1f6fd1, 0x2f9e44, 0xffffff, 0xdcdcdc, 0x8d8d8d];
const GONDOLA_HEIGHT = 90;
const GONDOLA_GOODS_REACH = 4;

/** Goods on shelf lips along one face of a gondola; `jars` swaps every other box for a lidded jar. */
function gondolaFace(r: Room, x: number, faceZ: number, width: number, palette: readonly Hex[], rnd: () => number, jars: boolean): void {
  const levels = 3;
  const gap = (GONDOLA_HEIGHT - 8) / levels;
  for (let l = 0; l < levels; l++) {
    const y = 8 + l * gap;
    r.box(x, faceZ, width - 2, 2 * GONDOLA_GOODS_REACH - 1, 1.6, y, 'white', AMERIKANAS_RED);
    for (let i = 0; i < Math.floor((width - 6) / 9); i++) {
      const gx = x - width / 2 + 7 + i * 9;
      const color = palette[Math.floor(rnd() * palette.length)];
      const h = 7 + Math.floor(rnd() * 3) * 3;
      if (jars && (i + l) % 2 === 0) {
        r.box(gx, faceZ, 6, 6, 11, y + 1.6, 'white', color);
        r.box(gx, faceZ, 6.6, 6.6, 2, y + 12.6, 'white', AMERIKANAS_RED);
      } else {
        r.box(gx, faceZ, 7.6, 2 * GONDOLA_GOODS_REACH - 2, Math.min(h, gap - 4), y + 1.6, 'white', color);
      }
    }
  }
}

/** A free-standing double-sided gondola: a white solid core, red ends and cap, goods stacked on both faces. */
function gondola(r: Room, x: number, z: number, width: number, depth: number, palette: readonly Hex[], seed: number, jars: boolean): void {
  const rnd = seeded(seed);
  r.solid(x, z, width, depth - 2 * GONDOLA_GOODS_REACH, GONDOLA_HEIGHT, 0, 'white', AMERIKANAS_WHITE);
  r.box(x, z, width, depth - 2 * GONDOLA_GOODS_REACH + 2, 1.4, GONDOLA_HEIGHT, 'white', AMERIKANAS_RED);
  for (const side of [-1, 1]) {
    r.box(x + side * (width / 2 + 1.5), z, 3, depth, GONDOLA_HEIGHT + 3, 0, 'white', AMERIKANAS_WHITE);
    gondolaFace(r, x, z + side * (depth / 2 - GONDOLA_GOODS_REACH), width, palette, rnd, jars);
  }
}

/** Open bins of loose sweets against a wall. */
function sweetBin(r: Room, x: number, z: number, seed: number): void {
  const rnd = seeded(seed);
  r.solid(x, z, 24, 24, 22, 0, 'white', AMERIKANAS_WHITE);
  r.box(x, z, 24.8, 24.8, 5, 12, 'white', AMERIKANAS_RED);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      r.box(x - 7 + i * 7, z - 7 + j * 7, 6, 6, 3 + Math.floor(rnd() * 4), 22, 'white', SWEETS[Math.floor(rnd() * SWEETS.length)]);
    }
  }
}

/** A lollipop stand: a red base with rows of sticks topped by flat coloured heads. */
function lollipopStand(r: Room, x: number, z: number): void {
  r.solid(x, z, 26, 26, 14, 0, 'white', AMERIKANAS_RED);
  r.box(x, z, 28, 28, 1.4, 14, 'white', AMERIKANAS_WHITE);
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 4; j++) {
      const gx = x - 10 + i * 5;
      const gz = z - 9 + j * 6;
      r.box(gx, gz, 1.2, 1.2, 14, 15.4, 'white', AMERIKANAS_WHITE);
      r.box(gx, gz, 4.4, 1.6, 4.4, 29.4, 'white', SWEETS[(i * 3 + j) % SWEETS.length]);
    }
  }
}

/** Impulse sweets on the counter: a stepped red rack of small boxes. */
function checkoutCandy(r: Room, x: number, z: number): void {
  const rnd = seeded(77);
  for (let tier = 0; tier < 3; tier++) {
    r.box(x, z - tier * 3, 34, 6, 2, 41.4 + tier * 7, 'white', AMERIKANAS_RED);
    for (let i = 0; i < 6; i++) {
      r.box(x - 14 + i * 5.6, z - tier * 3, 4.6, 4, 5, 43.4 + tier * 7, 'white', SWEETS[Math.floor(rnd() * SWEETS.length)]);
    }
  }
}

/** A white split air conditioner facing +z: body, louvre slit and a small display. */
function airConditioner(r: Room, x: number, z: number, y: number): void {
  const w = 54;
  const d = 22;
  r.box(x, z, w, d, 22, y, 'white', 0xfbfbfb);
  r.box(x, z + d / 2, w - 6, 1, 2.4, y + 5, 'charcoal', 0x3a3d42);
  r.box(x + w / 2 - 10, z + d / 2, 8, 0.8, 3, y + 14, 'screen');
  r.box(x - w / 2 + 6, z + d / 2, 4, 0.8, 1.4, y + 15, 'white', AMERIKANAS_RED);
}

/** A white split air conditioner on a side wall, its front toward +x or -x. */
function wallAirConditioner(r: Room, wallX: number, side: -1 | 1, z: number, y: number): void {
  const depth = 18;
  const cx = wallX - side * (depth / 2 + 0.5);
  r.box(cx, z, depth, 70, 24, y, 'white', 0xfbfbfb);
  r.box(cx - side * depth / 2, z, 1, 58, 2.4, y + 6, 'charcoal', 0x3a3d42);
  r.box(cx - side * depth / 2, z + 26, 0.8, 8, 3, y + 15, 'screen');
}

/** A pedestal fan facing +z: base, pole, motor, a square cage and cross blades. */
function pedestalFan(r: Room, x: number, z: number, bladeTint: Hex): void {
  r.box(x, z, 22, 22, 3, 0, 'charcoal', 0x2b2b2b);
  r.box(x, z, 3, 3, 52, 3, 'metal', STEEL);
  r.box(x, z - 5, 9, 11, 9, 53, 'white', AMERIKANAS_WHITE);
  const cageY = 48;
  const size = 32;
  r.box(x, z + 1, size, 1.5, 1.5, cageY, 'metal', STEEL);
  r.box(x, z + 1, size, 1.5, 1.5, cageY + size - 1.5, 'metal', STEEL);
  r.box(x - size / 2 + 0.75, z + 1, 1.5, 1.5, size, cageY, 'metal', STEEL);
  r.box(x + size / 2 - 0.75, z + 1, 1.5, 1.5, size, cageY, 'metal', STEEL);
  r.box(x, z + 3, 26, 0.8, 5, cageY + size / 2 - 2.5, 'white', bladeTint);
  r.box(x, z + 3.1, 5, 0.8, 24, cageY + size / 2 - 12, 'white', bladeTint);
  r.box(x, z + 3.6, 5, 2, 5, cageY + size / 2 - 2.5, 'charcoal', 0x2b2b2b);
}

/** Red squares of a checkered floor, laid on the white tile of the central aisle. */
function checkeredAisle(r: Room): void {
  const size = 32;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 5; j++) {
      if ((i + j) % 2 === 0) r.box(-80 + i * size, 100 + j * size, size, size, 0.8, 0, 'tile', AMERIKANAS_RED);
    }
  }
}

/** A line of red and white pennants across the candy aisle. */
function bunting(r: Room, z: number, fromX: number, toX: number, y: number): void {
  r.box((fromX + toX) / 2, z, toX - fromX, 0.8, 0.8, y, 'white', AMERIKANAS_WHITE);
  for (let i = 0, x = fromX + 8; x < toX - 4; i++, x += 14) {
    r.box(x, z, 8, 0.6, 9, y - 9, 'white', i % 2 ? AMERIKANAS_WHITE : AMERIKANAS_RED);
  }
}

/**
 * The candy gondolas start past the storefront window counters (they stand at x 90..210, depth 130..154), so the aisles
 * open toward the middle of the store. The rows leave a 50 unit aisle on the bot grid line at depth 216.
 */
const CANDY_ROWS = [88, 181, 251] as const;
const CANDY_X = 258;
const CANDY_LENGTH = 80;
/** A ceiling fan's rod climbs 42.5 above its mount, so this keeps the top inside the 176..192 slab under the food court. */
const FAN_MOUNT_Y = 133;

function amerikanas(r: Room): void {
  shell(r, { floor: 'tile', floorTint: 0xeceae4, wall: AMERIKANAS_WHITE, trim: AMERIKANAS_RED });
  r.box(0, 3, 2 * STORE_HALF_WIDTH - 4, 2, 32, 118, 'white', AMERIKANAS_RED);
  r.box(0, 4.4, 2 * STORE_HALF_WIDTH - 4, 0.4, 3, 130, 'white', AMERIKANAS_WHITE);
  for (const x of [-230, -80, 80, 230]) r.box(x, 150, 76, 12, 1, CEILING - 1, 'white', AMERIKANAS_RED);
  checkeredAisle(r);
  r.fan(-215, 135, FAN_MOUNT_Y, 34);
  r.fan(0, 205, FAN_MOUNT_Y, 36);

  wallShelves(r, 0, 8, 320, 14, 4, HOUSEHOLD, 51, AMERIKANAS_WHITE);
  counter(r, AMERIKANAS_RED, 0xf5f5f5);
  r.box(0, 70.7, 141.4, 1.4, 39, 0, 'white', AMERIKANAS_RED);
  checkoutCandy(r, 40, 62);
  lollipopStand(r, -108, 62);

  for (const z of CANDY_ROWS) gondola(r, CANDY_X, z, CANDY_LENGTH, 20, SWEETS, 52 + z, true);
  [122, 150, 198, 226, 254].forEach((z, i) => sweetBin(r, 329, z, 60 + i));
  bunting(r, 135, CANDY_X - CANDY_LENGTH / 2, CANDY_X + CANDY_LENGTH / 2, 150);

  r.solid(-215, 100, 190, 30, 24, 0, 'white', AMERIKANAS_WHITE);
  r.box(-215, 100, 191, 31, 6, 0, 'white', AMERIKANAS_RED);
  [-277, -215, -153].forEach((x, i) => {
    airConditioner(r, x, 100, 24);
    r.box(x, 115.8, 30, 0.6, 8, 10, 'white', AMERIKANAS_WHITE);
    if (i === 1) r.box(x, 116.2, 12, 0.4, 4, 12, 'white', AMERIKANAS_RED);
  });
  [50, 130, 210].forEach((z) => wallAirConditioner(r, -(STORE_HALF_WIDTH - 2.5), -1, z, 96));
  [-300, -255, -210, -165].forEach((x, i) => pedestalFan(r, x, 170, i % 2 ? 0xf2f2f2 : AMERIKANAS_RED));
  gondola(r, -215, 235, 190, 20, HOUSEHOLD, 54, false);

  r.rack(316, 48, 'left', 80, [AMERIKANAS_RED, 0xffffff, 0x222222, 0x1f6fd1]);
  r.rack(160, 40, 'front', 70, [0xffffff, AMERIKANAS_RED, 0xf2c200]);
  r.solid(250, 45, 60, 36, 26, 0, 'desk', 0xf3ece0);
  for (const x of [236, 264]) {
    r.box(x, 44, 26, 25, 9, 26, 'white', AMERIKANAS_RED);
    r.box(x, 44, 23, 21, 2, 35, 'white', AMERIKANAS_WHITE);
    for (const [i, dx] of [-7, 0, 7].entries()) {
      r.box(x + dx, 45, 6, 12, 4 + i * 2, 37, 'white', HOUSEHOLD[i + 1]);
    }
  }
  r.box(250, 59, 2, 2, 20, 26, 'metal', STEEL);
  saleSign(r, 250, 59, 46, AMERIKANAS_RED);
}

const BOOKS = [0x8b2e2e, 0x2e5d8b, 0x2f6b3a, 0xc9a227, 0x5a3b7a, 0xd8cdb0, 0x1f3d2b, 0xb5503a];

function bookRun(r: Room, x: number, z: number, y: number, width: number, depth: number, rnd: () => number): void {
  let cursor = x - width / 2;
  while (cursor < x + width / 2 - 6) {
    const w = Math.min(6 + rnd() * 10, x + width / 2 - cursor);
    r.box(cursor + w / 2, z, w - 0.6, depth - 3, 12 + rnd() * 8, y, 'white', BOOKS[Math.floor(rnd() * BOOKS.length)]);
    cursor += w;
  }
}

function travessura(r: Room): void {
  shell(r, { floor: 'desk', floorTint: 0xa07a52, wall: 0x2e5a3f, trim: 0xefe6cf });
  const rnd = seeded(61);
  const levels = [14, 36, 58, 80, 102, 124];
  r.solid(0, 8, 310, 16, 6, 0, 'desk', 0x4a2d18);
  for (const y of levels) {
    r.box(0, 8, 310, 16, 1.6, y, 'desk', 0x4a2d18);
    bookRun(r, 0, 8, y + 1.6, 306, 16, rnd);
  }
  for (const side of [-1, 1]) {
    r.solid(side * 328, 150, 16, 220, 6, 0, 'desk', 0x4a2d18);
    for (const y of levels) {
      r.box(side * 328, 150, 16, 220, 1.6, y, 'desk', 0x4a2d18);
      for (const z of [60, 140, 220]) bookRun(r, side * 328, z, y + 1.6, 16, 76, rnd);
    }
    r.solid(side * 240, 70, 90, 46, 24, 0, 'desk', 0x4a2d18);
    if (side < 0) for (let i = 0; i < 6; i++) r.box(-276 + i * 14, 70, 11, 30, 5 + (i % 3) * 3, 24, 'white', BOOKS[(i + 2) % BOOKS.length]);
  }
  r.box(-230, 205, 110, 80, 0.8, 0, 'carpet', 0x8b2e2e);
  r.solid(-262, 205, 34, 34, 28, 0, 'white', 0x2f6b3a);
  r.box(-262, 205, 34, 10, 26, 28, 'white', 0x2f6b3a);
  r.solid(-204, 190, 30, 30, 26, 0, 'white', 0x8b2e2e);
  r.solid(-228, 238, 24, 24, 20, 0, 'wood', 0x4a2d18);
  r.box(-228, 238, 6, 6, 40, 20, 'wood', 0x4a2d18);
  r.box(-228, 238, 22, 22, 14, 60, 'white', 0xfff0c0);
  r.box(-60, 8, 120, 1, 14, 150, 'white', 0xefe6cf);
  r.box(240, 91, 66, 2, 13, 24, 'white', 0x2e5a3f);
  for (const [i, x] of [212, 240, 268].entries()) {
    r.box(x, 71, 20, 17, 4, 24, 'white', BOOKS[i + 3]);
    r.box(x + 1, 71, 18, 16, 3, 28, 'white', 0xe7ddc4);
    r.box(x, 71, 20, 17, 1, 31, 'white', BOOKS[i]);
    r.box(x - 2, 71, 16, 14, 3, 32, 'white', BOOKS[i + 3]);
  }
  r.box(-262, 211, 27, 21, 3, 28, 'white', 0xefe6cf);
  r.box(-204, 190, 19, 14, 2, 26, 'white', 0x5a3b7a);
  for (const x of [-209, -199]) r.box(x, 190, 9, 12, 1, 28, 'white', 0xefe6cf);
  for (const y of [38, 64]) {
    r.box(224, 12, 94, 20, 2, y, 'desk', 0x4a2d18);
    for (const [i, x] of [190, 212, 234, 256].entries()) {
      r.box(x, 15, 17, 4, 17, y + 2, 'white', BOOKS[i + 2]);
      r.box(x, 17.3, 9, 0.6, 8, y + 7, 'white', 0xefe6cf);
    }
  }
}

const PILLS = [0xffffff, 0xe8f4ee, 0x2f9e44, 0x1f6fd1, 0xf2c200, 0xe60014, 0xdcdcdc];

interface Pharmacy {
  wall: Hex;
  trim: Hex;
  cross: Hex;
}

/** A pharmacy: medicine shelves along the back wall, a dispensing counter, one gondola row and a cross on the side wall. */
function pharmacy(r: Room, p: Pharmacy, seed: number): void {
  shell(r, { floor: 'tile', floorTint: 0xf1f4f2, wall: p.wall, trim: p.trim });
  wallShelves(r, 0, 8, 320, 14, 4, PILLS, seed, 0xf5f7f6);
  counter(r, p.trim, 0xf5f5f5);
  for (const z of CANDY_ROWS) gondola(r, CANDY_X, z, CANDY_LENGTH, 20, PILLS, seed + z, false);
  r.box(-(STORE_HALF_WIDTH - 2.5), 150, 1.5, 14, 44, 100, 'white', p.cross);
  r.box(-(STORE_HALF_WIDTH - 2.5), 150, 1.5, 44, 14, 115, 'white', p.cross);
  r.box(0, 30, 2 * STORE_HALF_WIDTH - 8, 1, 6, 118, 'white', p.cross);
  for (const x of [-122, -42, 38, 118]) {
    r.box(x, 16, 66, 1.5, 10, 106, 'white', p.trim);
    r.box(x, 17, 30, 0.5, 3, 110, 'white', 0xf5f7f6);
  }
  const cosmetics = [0xe8f4ee, 0xd5a7b7, 0xb7c6e5, 0xf3d7a2];
  for (const y of [46, 67, 88]) {
    r.box(-229, 13, 54, 19, 2, y, 'desk', 0xf5f7f6);
    for (const [i, tint] of cosmetics.entries()) {
      const x = -247 + i * 12;
      r.box(x, 16, 7, 7, 8 + i, y + 2, 'white', tint);
      r.box(x, 16, 5, 5, 2, y + 10 + i, 'metal', STEEL);
    }
  }
  r.box(46, 54, 36, 16, 9, 41.4, 'white', p.trim);
  r.box(46, 55, 30, 12, 2, 50.4, 'white', 0xe8f4ee);
  r.box(43, 55, 18, 9, 0.8, 52.4, 'white', 0xffffff);
  r.box(20, 12, 2, 20, 2, 120, 'metal', STEEL);
  r.box(72, 12, 2, 20, 2, 120, 'metal', STEEL);
  r.box(46, 22, 78, 2, 12, 116, 'white', p.trim);
  r.box(46, 23.3, 45, 0.6, 3, 120, 'white', 0xffffff);
}

function drogaRaio(r: Room): void {
  pharmacy(r, { wall: 0xf7f2f0, trim: 0xd8202a, cross: 0xd8202a }, 71);
  r.box(-289, 24, 36, 34, 5, 0, 'white', 0xf5f7f6);
  r.box(-289, 14, 5, 5, 54, 5, 'metal', STEEL);
  r.box(-289, 16, 21, 10, 9, 59, 'white', 0xf5f7f6);
  r.box(-289, 21.3, 13, 0.6, 5, 61, 'screen');
}

function paguePouco(r: Room): void {
  pharmacy(r, { wall: 0xf1f5fa, trim: 0x1f4fa8, cross: 0xf2c200 }, 83);
  r.box(-289, 24, 36, 32, 38, 0, 'white', 0xf5f7f6);
  r.box(-289, 22, 40, 34, 2, 38, 'white', 0x1f4fa8);
  r.box(-300, 15, 12, 11, 13, 40, 'white', 0xf5f7f6);
  r.box(-300, 20.8, 8, 0.6, 6, 45, 'screen');
  for (const x of [-286, -275]) r.box(x, 24, 5, 16, 12, 40, 'charcoal');
  for (const z of [16, 32]) r.box(-280.5, z, 6, 3, 12, 40, 'charcoal');
}

const STORES: Record<ShopBrand, (r: Room) => void> = {
  zarra,
  cea,
  rener,
  hew,
  'cacau-chou': cacauChou,
  amerikanas,
  riachuela,
  travessura,
  'droga-raio': drogaRaio,
  'pague-pouco': paguePouco,
};

/** The colour of each store's window displays and counters. */
const ACCENT: Record<ShopBrand, Hex> = {
  zarra: 0x151515,
  cea: 0x0050a0,
  rener: 0x6e2a22,
  hew: 0xe50010,
  'cacau-chou': 0x6a3a1c,
  amerikanas: 0xe60014,
  riachuela: 0x1c2a5a,
  travessura: 0x2e5a3f,
  'droga-raio': 0xd8202a,
  'pague-pouco': 0x1f4fa8,
};

export function storeAccent(brand: ShopBrand): Hex {
  return ACCENT[brand];
}

/** Window displays sit on the two solid counters the storefront places at the windows (depth 142, x +-150). */
const WINDOW_DISPLAY_DEPTH = 142;
const WINDOW_DISPLAY_X = 150;
const WINDOW_DISPLAY_HEIGHT = 56;
const CLOTHING = new Set<ShopBrand>(['zarra', 'cea', 'rener', 'hew', 'riachuela']);

/** Full-length mirrors hang on both side walls of a clothing store, in the strip between the back wall and its first rack. */
const SIDE_MIRROR_X = STORE_HALF_WIDTH - 3.5;
const SIDE_MIRROR_Z = 28;
const SIDE_MIRROR_WIDTH = 44;
const SIDE_MIRROR_HEIGHT = 124;
const SIDE_MIRROR_Y = 8;

export function dressStore(r: Room, brand: ShopBrand): void {
  STORES[brand](r);
  if (CLOTHING.has(brand)) {
    r.mirror(-SIDE_MIRROR_X, SIDE_MIRROR_Z, SIDE_MIRROR_Y, SIDE_MIRROR_WIDTH, SIDE_MIRROR_HEIGHT, 'left');
    r.mirror(SIDE_MIRROR_X, SIDE_MIRROR_Z, SIDE_MIRROR_Y, SIDE_MIRROR_WIDTH, SIDE_MIRROR_HEIGHT, 'right');
  }
  const accent = ACCENT[brand];
  for (const side of [-1, 1]) {
    const displayCount = side > 0 && CLOTHING.has(brand) ? 3 : 4;
    for (let i = 0; i < displayCount; i++) {
      const x = side * WINDOW_DISPLAY_X - 42 + i * 28;
      if (CLOTHING.has(brand)) {
        r.box(x, WINDOW_DISPLAY_DEPTH, 22, 16, 4, WINDOW_DISPLAY_HEIGHT, 'white', accent);
        r.box(x + 1, WINDOW_DISPLAY_DEPTH, 19, 14, 3, WINDOW_DISPLAY_HEIGHT + 4, 'white', 0xf2efe8);
        r.box(x - 1, WINDOW_DISPLAY_DEPTH, 16, 12, 3, WINDOW_DISPLAY_HEIGHT + 7, 'white', accent);
      } else {
        r.box(x, WINDOW_DISPLAY_DEPTH, 20, 14, 8 + (i % 2) * 6, WINDOW_DISPLAY_HEIGHT, 'white', i % 2 ? 0xf2efe8 : accent);
      }
    }
  }
}
