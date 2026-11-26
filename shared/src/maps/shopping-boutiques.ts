import { brandMat, STORE_BRANDS, type BoutiqueBrand } from './brands.ts';
import type { MapBuilder } from './builder.ts';
import { FACADE_Z, ROOF, DECK3, Z } from './shopping-levels.ts';
import { outfit, Room, seeded } from './room.ts';
import { wallShelves } from './shopping-stores.ts';

/**
 * The boutiques along the back wall of the Mirante: open storefronts like the pharmacy, smaller than a ground floor
 * store, each one a brand's `dress` function in a Room whose width is the slot between two partitions.
 * Authored for the north half, inside `b.mirrored`.
 */

export type SmallBoutique = 'pandorga' | 'loccitano';
/** The shops either side of the cafe's partition on the Mirante lounge, one per half. */
export type LoungeBoutique = 'pe-leve' | 'essencia';
export type LargeBoutique = 'samsong' | 'ray-bao' | 'sentauro' | 'brinco-center';

/** Partitions and the storefront stand this tall; the doorway is the full width between the wall returns. */
export const SHOP_WALL_HEIGHT = 176;
export const DOORWAY_HEIGHT = 132;
const SHOP_DEPTH = FACADE_Z + Z;
const WALL_THICK = 16;
/** Wall returns frame the doorway; a narrow shop gets shorter ones so its doorway stays wide enough to walk. */
const RETURN_WIDTH = 64;
const SIGN_WIDTH = 180;
const LINTEL_TRIM = 6;
const COUNTER_Z = 52;
const LAMP_Y = 160;
const CEILING = SHOP_WALL_HEIGHT;
/** The back wall paint stands in front of the lounge's trim along the outer wall (3 deep), so the two never share a plane. */
const BACK_WALL_DEPTH = 4;

type Hex = number;

interface Boutique {
  /** Wall paint and the colour of the lintel over the doorway. */
  paint: Hex;
  trim: Hex;
  floor: Hex;
  /** Where along the shop's width bots browse: in the open aisle, clear of the fixtures. */
  browseX: number;
  dress(r: Room, half: number): void;
}

function till(r: Room, x: number, width: number, tint: Hex): void {
  r.solid(x, COUNTER_Z, width, 34, 40, 0, 'white', tint);
  r.box(x, COUNTER_Z, width + 4, 38, 2, 40, 'white', 0xf5f5f5);
  r.box(x - width / 4, COUNTER_Z - 2, 14, 10, 10, 42, 'charcoal', 0x1b1b1b);
  r.box(x - width / 4, COUNTER_Z - 7.5, 12, 1, 7, 46, 'screen');
}

function plinth(r: Room, x: number, z: number, tint: Hex): number {
  r.box(x, z, 56, 56, 6, 0, 'white', tint);
  return 6;
}

/** A glass-topped case: a solid base with a pane on top and small goods inside. */
function showcase(r: Room, x: number, z: number, w: number, d: number, base: Hex, goods: readonly Hex[], seed: number): void {
  const rnd = seeded(seed);
  r.solid(x, z, w, d, 30, 0, 'white', base);
  r.box(x, z, w - 2, d - 2, 8, 30, 'glass', 0xdfe8f2);
  const cols = Math.floor((w - 8) / 12);
  for (let i = 0; i < cols; i++) r.box(x - w / 2 + 10 + i * 12, z, 6, 6, 3 + Math.floor(rnd() * 3) * 2, 30.4, 'white', goods[Math.floor(rnd() * goods.length)]);
}

/** The small shops are narrow, so their till is too. */
const SMALL_TILL = 70;

const CHARMS = [0xe77aa6, 0xc0c4cc, 0xf2c200, 0x8a6fc0, 0xffffff, 0x4fb0c6];

function pandorga(r: Room, half: number): void {
  wallShelves(r, 0, 8, 2 * half - 14, 14, 4, CHARMS, 91, 0xf5f0f2);
  r.box(0, 3, 150, 1.2, 60, 104, 'glass', 0xdfe8f2);
  r.box(0, 2.6, 156, 1.6, 3, 102, 'white', 0xc0c4cc);
  till(r, 0, SMALL_TILL, 0xe77aa6);
  showcase(r, -(half - 30), 150, 50, 40, 0xf4eef1, CHARMS, 92);
  r.box(0, 190, 2 * half - 20, 60, 0.8, 0, 'carpet', 0xe9c8d6);
}

const PROVENCE = [0xf2c200, 0x8a6fc0, 0xffffff, 0xf4e3a6, 0x6b8f4a, 0x1c3a6b];

function loccitano(r: Room, half: number): void {
  wallShelves(r, 0, 8, 2 * half - 14, 14, 4, PROVENCE, 93, 0xf1e6c4);
  till(r, 0, SMALL_TILL, 0x1c3a6b);
  const crate = half - 30;
  r.solid(crate, 118, 44, 34, 24, 0, 'wood', 0xb98a58);
  for (let i = 0; i < 4; i++) r.box(crate - 15 + i * 10, 118, 7, 7, 8 + (i % 2) * 5, 24, 'white', PROVENCE[(i + 3) % PROVENCE.length]);
  r.box(crate, 118, 34, 28, 10, 32, 'plant', 0x8a6fc0);
  r.solid(-(half - 36), 170, 50, 50, 30, 0, 'wood', 0xd8b878);
  r.box(-(half - 36), 170, 56, 56, 2, 30, 'white', 0xf2c200);
  for (let i = 0; i < 4; i++) r.box(-(half - 36) - 12 + (i % 2) * 24, 160 + Math.floor(i / 2) * 20, 8, 8, 14, 32, 'white', PROVENCE[i % PROVENCE.length]);
}

const SHOES = [0xf4e3b0, 0x1f3d2b, 0xd7263d, 0xf5f5f5, 0x6b4a32, 0x1b1b1b];

function peLeve(r: Room, half: number): void {
  wallShelves(r, 0, 8, 2 * half - 14, 14, 4, SHOES, 101, 0xe6efe8);
  till(r, 0, 120, 0x1f3d2b);
  for (const side of [-1, 1]) {
    r.solid(side * 80, 150, 90, 34, 14, 0, 'wood', 0xb98a58);
    for (let i = 0; i < 5; i++) r.box(side * 80 - 36 + i * 18, 150, 14, 24, 8, 14, 'white', SHOES[(i + (side > 0 ? 2 : 0)) % SHOES.length]);
  }
  r.solid(0, 205, 110, 28, 20, 0, 'sofa', 0x1f3d2b);
  r.box(0, 190, 2 * half - 20, 60, 0.8, 0, 'carpet', 0xd9e6dc);
}

const SCENTS = [0xf3c6dd, 0x8a6fc0, 0xf2c200, 0x4fb0c6, 0xffffff, 0xd7263d];

function essencia(r: Room, half: number): void {
  wallShelves(r, 0, 8, 2 * half - 14, 14, 4, SCENTS, 102, 0xf6ecf2);
  till(r, 0, 120, 0x7a2f5a);
  for (const side of [-1, 1]) {
    showcase(r, side * 85, 150, 90, 40, 0xf6ecf2, SCENTS, 103 + side);
    r.solid(side * 85, 205, 40, 40, 36, 0, 'white', 0xe9d3e0);
    for (let i = 0; i < 3; i++) r.box(side * 85 - 10 + i * 10, 205, 7, 7, 14, 36, 'glass', SCENTS[(i + 1) % SCENTS.length]);
  }
  r.box(0, 190, 2 * half - 20, 60, 0.8, 0, 'carpet', 0xe9c8d6);
}

const SCREENS = 5;

function samsong(r: Room, half: number): void {
  wallShelves(r, 0, 8, 2 * half - 14, 14, 2, [0x1b1b1b, 0xf5f5f5, 0x1428a0], 94, 0xe8ecf3);
  const step = (2 * half - 40) / SCREENS;
  for (let i = 0; i < SCREENS; i++) {
    const x = -half + 20 + step * (i + 0.5);
    r.box(x, 4.2, step - 6, 1.6, 50, 73, 'charcoal', 0x161616);
    r.box(x, 5.2, step - 12, 1, 44, 76, 'screen');
  }
  till(r, 0, 140, 0x1428a0);
  for (const side of [-1, 1]) {
    r.solid(side * 130, 150, 90, 44, 34, 0, 'white', 0xf2f4f8);
    for (let i = 0; i < 4; i++) {
      r.box(side * 130 - 30 + i * 20, 150, 14, 9, 1.4, 34.4, 'charcoal', 0x161616);
      r.box(side * 130 - 30 + i * 20, 151, 12, 6, 6, 35.4, 'screen');
    }
  }
}

const FRAMES = [0x161616, 0xd71f26, 0x6b4a32, 0xf5f5f5];

function glasses(r: Room, x: number, z: number, y: number, tint: Hex): void {
  r.box(x - 4.5, z, 7, 1.4, 5, y, 'glass', tint);
  r.box(x + 4.5, z, 7, 1.4, 5, y, 'glass', tint);
  r.box(x, z, 3, 1.2, 1.2, y + 3, 'charcoal', 0x161616);
}

function rayBao(r: Room, half: number): void {
  wallShelves(r, 0, 8, 2 * half - 14, 14, 4, FRAMES, 95, 0xf4f1ee);
  r.box(0, 3, 2 * half - 14, 2, 3, 112, 'white', 0xd71f26);
  const pairs = Math.floor((2 * half - 40) / 22);
  for (let i = 0; i < pairs; i++) glasses(r, -half + 28 + i * 22, 4, 98, i % 2 ? 0x2b3a4a : 0x161616);
  till(r, 0, 140, 0xd71f26);
  for (const side of [-1, 1]) {
    showcase(r, side * 120, 150, 90, 40, 0xf4f1ee, FRAMES, 96 + side);
    for (let i = 0; i < 4; i++) glasses(r, side * 120 - 30 + i * 20, 150, 38, 0x161616);
  }
}

const KIT = [0xe4002b, 0x161616, 0xf5f5f5, 0x2e2e2e];

function sentauro(r: Room, half: number): void {
  wallShelves(r, 0, 8, 2 * half - 14, 14, 4, KIT, 97, 0xe9e9e9);
  r.box(0, 3, 2 * half - 14, 2, 3, 112, 'white', 0xe4002b);
  till(r, 0, 140, 0x161616);
  for (const side of [-1, 1]) {
    r.rack(side * (half - 24), 120, side < 0 ? 'right' : 'left', 90, KIT);
    r.mannequin(side * 120, 220, 'front', outfit(side < 0 ? 0xe4002b : 0xf5f5f5, 0x161616, 0xf5f5f5), plinth(r, side * 120, 220, 0x161616));
  }
  r.solid(0, 170, 110, 30, 20, 0, 'wood', 0x2b2b2b);
  for (let i = 0; i < 3; i++) r.box(-30 + i * 30, 170, 22, 14, 9, 20, 'white', KIT[i]);
}

const TOYS = [0xe4002b, 0x1f6fd1, 0x2f9e44, 0xf2c200, 0xff7ab0, 0xff7a1a];

function brincoCenter(r: Room, half: number): void {
  wallShelves(r, 0, 8, 2 * half - 14, 14, 4, TOYS, 98, 0xfff3c4);
  till(r, 0, 140, 0xe4002b);
  const rnd = seeded(99);
  for (const side of [-1, 1]) {
    r.solid(side * 130, 130, 80, 30, 50, 0, 'white', 0xfff3c4);
    for (let i = 0; i < 6; i++) r.box(side * 130 - 30 + i * 12, 130, 9, 22, 7 + Math.floor(rnd() * 3) * 3, 50, 'white', TOYS[Math.floor(rnd() * TOYS.length)]);
  }
  r.box(0, 195, 200, 70, 0.8, 0, 'carpet', 0x2f9e44);
  [[-30, 0xe4002b], [0, 0x1f6fd1], [30, 0xf2c200]].forEach(([x, tint]) => r.solid(x, 190, 22, 22, 22, 0.8, 'white', tint));
  r.solid(70, 215, 34, 34, 26, 0.8, 'wood', 0x8a5a33);
  r.solid(70, 215, 24, 24, 20, 26.8, 'wood', 0x8a5a33);
  for (const ear of [-8, 8]) r.box(70 + ear, 215, 7, 7, 7, 46.8, 'wood', 0x6b4a32);
}

const BOUTIQUES: Record<BoutiqueBrand, Boutique> = {
  pandorga: { paint: 0xfaf3f6, trim: 0xe77aa6, floor: 0xf4eef1, browseX: 20, dress: pandorga },
  loccitano: { paint: 0xf6e9bd, trim: 0x1c3a6b, floor: 0xe7d6a2, browseX: 0, dress: loccitano },
  'pe-leve': { paint: 0xeef4ef, trim: 0x1f3d2b, floor: 0xdbe5dd, browseX: 0, dress: peLeve },
  essencia: { paint: 0xf8eff4, trim: 0x7a2f5a, floor: 0xeedbe5, browseX: 0, dress: essencia },
  samsong: { paint: 0xeef1f8, trim: 0x1428a0, floor: 0xdfe3ec, browseX: 0, dress: samsong },
  'ray-bao': { paint: 0xf7f4f1, trim: 0xd71f26, floor: 0xe7e1da, browseX: 0, dress: rayBao },
  sentauro: { paint: 0xefefef, trim: 0xe4002b, floor: 0xcfcfcf, browseX: 0, dress: sentauro },
  'brinco-center': { paint: 0xfff8d9, trim: 0x1f6fd1, floor: 0xf2c200, browseX: 0, dress: brincoCenter },
};

/** Shell of the room: paint, floor, baseboard, a lamp and a ceiling slab that hides the roof gap. */
function shell(r: Room, half: number, spec: Boutique): void {
  r.box(0, SHOP_DEPTH / 2, 2 * half, SHOP_DEPTH - 8, 0.5, 0, 'tile', spec.floor);
  r.box(0, BACK_WALL_DEPTH / 2, 2 * half, BACK_WALL_DEPTH, CEILING - 6, 0, 'white', spec.paint);
  r.box(0, 2, 2 * half, 3.4, 8, 0, 'white', spec.trim);
  r.box(0, SHOP_DEPTH / 2, 2 * half, SHOP_DEPTH - 8, 3, CEILING - 3, 'white', spec.paint);
  for (const x of [-half / 2, half / 2]) r.box(x, 150, 60, 6, 1.4, CEILING - 4.4, 'lamp');
}

/** The lintel closes the gap between the doorway and the roof; the sign hangs on it, clear of the doorway. */
function facade(b: MapBuilder, x1: number, x2: number, brand: BoutiqueBrand, spec: Boutique): void {
  const z = FACADE_Z + 8;
  const cx = (x1 + x2) / 2;
  const top = ROOF - DECK3;
  b.deco(x1, DECK3 + DOORWAY_HEIGHT, z, x2, DECK3 + top, z + 2, 'white', spec.paint);
  b.deco(x1, DECK3 + DOORWAY_HEIGHT, z + 2, x2, DECK3 + DOORWAY_HEIGHT + LINTEL_TRIM, z + 3, 'white', spec.trim);
  b.deco(cx - SIGN_WIDTH / 2, DECK3 + DOORWAY_HEIGHT + LINTEL_TRIM + 4, z + 2, cx + SIGN_WIDTH / 2, DECK3 + DOORWAY_HEIGHT + LINTEL_TRIM + 4 + SIGN_WIDTH / 2, z + 4, brandMat(brand));
}

/** Which of its two partitions a shop builds; the neighbour that shares one builds it. */
export interface Walls {
  readonly left: boolean;
  readonly right: boolean;
}

/** A boutique between the partitions centred on `x1` and `x2`, whose short returns frame the open doorway. */
export function boutiqueShop(b: MapBuilder, brand: BoutiqueBrand, x1: number, x2: number, walls: Walls): void {
  const spec = BOUTIQUES[brand];
  const cx = (x1 + x2) / 2;
  const half = (x2 - x1) / 2 - WALL_THICK / 2;
  if (walls.left) b.wallZ(-Z, FACADE_Z, x1, WALL_THICK, SHOP_WALL_HEIGHT, 'white', [], DECK3);
  if (walls.right) b.wallZ(-Z, FACADE_Z, x2, WALL_THICK, SHOP_WALL_HEIGHT, 'white', [], DECK3);
  const returnWidth = Math.min(RETURN_WIDTH, (x2 - x1) / 6);
  b.block(x1 + returnWidth / 2, FACADE_Z, returnWidth, WALL_THICK, SHOP_WALL_HEIGHT, 'white', DECK3);
  b.block(x2 - returnWidth / 2, FACADE_Z, returnWidth, WALL_THICK, SHOP_WALL_HEIGHT, 'white', DECK3);
  const r = new Room(b, cx, DECK3, -Z);
  shell(r, half, spec);
  spec.dress(r, half);
  facade(b, x1, x2, brand, spec);
  b.light(cx, DECK3 + LAMP_Y, -Z + 200, '#ffe9bd');
  b.interior(cx + spec.browseX, DECK3, -Z + 142);
  b.landmark(`${STORE_BRANDS[brand].name} (Mirante)`, cx, -Z + 152);
}
