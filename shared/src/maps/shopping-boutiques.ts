import { brandMat, STORE_BRANDS, type BoutiqueBrand } from './brands.ts';
import type { MapBuilder } from './builder.ts';
import { FACADE_Z, ROOF, DECK3, Z } from './shopping-levels.ts';
import { Room } from './room.ts';
import { CHOCOLATES, wallShelves } from './shopping-stores.ts';

/**
 * The boutiques along the back wall of the Mirante: open storefronts like the pharmacy, smaller than a ground floor
 * store, each one a brand's `dress` function in a Room whose width is the slot between two partitions.
 * Authored for the north half, inside `b.mirrored`.
 */

export type SmallBoutique = 'pandorga' | 'loccitano';
/** The shops either side of the cafe's partition on the Mirante lounge, one per half. */
export type LoungeBoutique = 'pe-leve' | 'essencia';
export type CornerBoutique = 'linha-fina' | 'papel-e-cor';
export type LargeBoutique = 'samsong' | 'ray-bao' | 'sentauro' | 'brinco-center';
/** Any shop on the Mirante's back wall: a boutique, or the Cacau Chou branch that fills the gap by the old cafe. */
export type GalleryShopBrand = BoutiqueBrand | 'cacau-chou';

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

const SMALL_TILL = 70;
const CHARMS = [0xe77aa6, 0xc0c4cc, 0xf2c200, 0x8a6fc0, 0xffffff, 0x4fb0c6];

function pandorga(r: Room, half: number): void {
  const spacing = half / 2;
  r.box(0, 12, 2 * half - 16, 16, 3, 74, 'wood', 0xc0c4cc);
  for (const x of [-spacing, 0, spacing]) {
    r.box(x, 12, 24, 10, 11, 77, 'charcoal');
    r.box(x, 12, 13, 10, 12, 88, 'charcoal');
    r.box(x, 17.5, 12, 1, 1.5, 89, 'white', 0xf2c200);
    r.box(x, 18, 4, 2, 4, 85, 'white', 0xf2c200);
  }
  till(r, 0, SMALL_TILL, 0xe77aa6);
  const trayX = 28 - half;
  r.solid(trayX, 150, 48, 40, 36, 0, 'white', 0xf4eef1);
  for (const z of [139, 159]) {
    r.box(trayX, z, 40, 16, 2, 36, 'sofa', 0x54243e);
    for (const dx of [-12, 0, 12]) {
      r.box(trayX + dx, z, 5, 4, 3, 38, 'white', z === 139 ? 0xf2c200 : 0xc0c4cc);
      r.box(trayX + dx, z, 3, 3, 2, 41, 'glass', CHARMS[(dx + 12) / 12]);
    }
  }
  r.box(0, 190, 2 * half - 20, 60, 0.8, 0, 'carpet', 0xe9c8d6);
}

const PROVENCE = [0xf2c200, 0x8a6fc0, 0xffffff, 0xf4e3a6, 0x6b8f4a, 0x1c3a6b];

function loccitano(r: Room, half: number): void {
  wallShelves(r, 0, 10, 2 * half - 14, 14, 2, PROVENCE, 93, 0xf1e6c4);
  till(r, 0, SMALL_TILL, 0x1c3a6b);
  const tableX = 27 - half;
  r.solid(tableX, 164, 46, 56, 30, 0, 'wood', 0xd8b878);
  r.box(tableX, 164, 50, 60, 2, 30, 'wood', 0xf4e3a6);
  for (const dx of [-14, 0, 14]) {
    r.box(tableX + dx, 176, 11, 17, 4, 32, 'white', PROVENCE[(dx + 14) / 14 + 1]);
    r.box(tableX + dx, 176, 4, 17, 0.5, 36, 'white', 0xf4e3a6);
    r.box(tableX + dx, 145, 9, 9, 6, 32, 'wood');
    r.box(tableX + dx, 145, 3, 3, 12, 38, 'plant', 0x6b8f4a);
    r.box(tableX + dx, 145, 6, 5, 7, 46, 'white', 0x8a6fc0);
  }
}

const SHOES = [0xf4e3b0, 0x1f3d2b, 0xd7263d, 0xf5f5f5, 0x6b4a32, 0x1b1b1b];

function shoe(r: Room, x: number, z: number, y: number, tint: Hex): void {
  r.box(x, z, 9, 20, 2, y, 'white', 0xe1ddd2);
  r.box(x, z, 9, 19, 4, y + 2, 'white', tint);
  r.box(x, z - 4, 9, 10, 4, y + 6, 'white', tint);
}

function shoeWall(r: Room, x: number, width: number, levels: readonly number[]): void {
  const step = width / SHOES.length;
  for (const y of levels) {
    SHOES.forEach((tint, i) => {
      const shoeX = x - width / 2 + step * (i + 0.5);
      r.box(shoeX, 15, 20, 22, 3, y, 'wood', 0xc5a078);
      shoe(r, shoeX, 15, y + 3, tint);
    });
  }
}

function peLeve(r: Room, half: number): void {
  shoeWall(r, 0, 2 * half - 20, [68, 96, 124]);
  till(r, 0, 100, 0x1f3d2b);
  const benchX = half - 34;
  r.solid(benchX, 172, 50, 90, 16, 0, 'wood', 0xb98a58);
  r.box(benchX, 172, 52, 92, 5, 16, 'sofa', 0x1f3d2b);
  r.box(0, 190, 2 * half - 20, 60, 0.8, 0, 'carpet', 0xd9e6dc);
}

const SCENTS = [0xf3c6dd, 0x8a6fc0, 0xf2c200, 0x4fb0c6, 0xffffff, 0xd7263d];

function perfume(r: Room, x: number, z: number, y: number, tint: Hex): void {
  r.box(x, z, 8, 7, 10, y, 'glass', tint);
  r.box(x, z + 3.7, 5, 0.6, 4, y + 3, 'white', 0xf6ecf2);
  r.box(x, z, 4, 4, 4, y + 10, 'white', 0xd8af55);
}

function essencia(r: Room, half: number): void {
  wallShelves(r, 0, 10, 2 * half - 14, 14, 2, SCENTS, 102, 0xf6ecf2);
  till(r, 0, 100, 0x7a2f5a);
  for (const z of [127, 199]) {
    const x = half - 29;
    r.solid(x, z, 38, 38, 42, 0, 'white', 0xe9d3e0);
    r.box(x, z, 44, 44, 3, 42, 'wood', 0x7a2f5a);
    for (const dx of [-12, 0, 12]) perfume(r, x + dx, z + 7, 45, SCENTS[(dx + 12) / 12]);
  }
  const x = 38 - half;
  r.solid(x, 170, 64, 58, 30, 0, 'white', 0xf6ecf2);
  for (const tier of [0, 1, 2]) {
    const z = 186 - tier * 16;
    const y = 30 + tier * 12;
    const count = 5 - tier * 2;
    r.box(x, z, 12 * count + 2, 15, 2 + tier * 12, 30, 'wood', 0x7a2f5a);
    for (let i = 0; i < count; i++) perfume(r, x + (i - (count - 1) / 2) * 12, z, y + 2, SCENTS[i + tier]);
  }
  r.box(0, 190, 2 * half - 20, 60, 0.8, 0, 'carpet', 0xe9c8d6);
}

function displayScreen(r: Room, x: number, z: number, y: number, width: number, height: number, tint: Hex): void {
  r.box(x, z, width, 2, height, y, 'charcoal', 0x161616);
  r.box(x, z + 1.3, width - 2, 0.6, height - 2, y + 1, 'screen', tint);
}

function samsong(r: Room, half: number): void {
  const tvSpacing = (2 * half - 24) / 5;
  for (const column of [-2, -1, 0, 1, 2]) {
    displayScreen(r, column * tvSpacing, 6, 76, tvSpacing - 10, 40, column % 2 ? 0xa4c8ff : 0xffffff);
  }
  const aisleDisplay = half * 0.58;
  till(r, 0, 110, 0x1428a0);
  r.solid(-aisleDisplay, 140, 94, 56, 34, 0, 'white', 0xf2f4f8);
  for (const z of [125, 152]) {
    for (const dx of [-30, -10, 10, 30]) {
      r.box(-aisleDisplay + dx, z, 12, 8, 2, 34, 'wood', 0xa8b1c2);
      displayScreen(r, -aisleDisplay + dx, z, 36, 8, 15, z === 125 ? 0xd8d4ff : 0xb5edff);
    }
  }
  r.solid(aisleDisplay, 140, 94, 56, 34, 0, 'white', 0xf2f4f8);
  for (const dx of [-28, 0, 28]) {
    r.box(aisleDisplay + dx, 140, 18, 16, 2, 34, 'wood', 0xa8b1c2);
    r.box(aisleDisplay + dx, 138, 5, 5, 8, 36, 'charcoal');
    displayScreen(r, aisleDisplay + dx, 141, 40, 22, 15, 0xc3eeff);
  }
  r.solid(-aisleDisplay, 210, 92, 28, 38, 0, 'desk', 0x1428a0);
  r.box(-aisleDisplay, 216, 83, 8, 2, 38, 'charcoal');
  for (const dx of [-28, 0, 28]) {
    r.box(-aisleDisplay + dx, 217, 9, 14, 2, 40, 'charcoal');
    r.box(-aisleDisplay + dx, 217, 7, 11, 0.6, 42, 'screen');
    r.box(-aisleDisplay + dx, 209, 1, 5, 0.5, 38, 'white');
  }
  r.box(aisleDisplay, 16, 92, 18, 3, 45, 'desk', 0xe8ecf3);
  for (const dx of [-30, 0, 30]) {
    const x = aisleDisplay + dx;
    r.box(x, 16, 9, 10, 2, 48, 'charcoal');
    r.box(x, 16, 2, 3, 17, 50, 'wood', 0xa8b1c2);
    r.box(x, 16, 18, 5, 3, 64, 'charcoal');
    for (const ear of [-7, 7]) r.box(x + ear, 16, 5, 6, 11, 53, 'charcoal');
  }
  r.box(-aisleDisplay, 16, 92, 20, 3, 45, 'desk', 0xe8ecf3);
  for (const dx of [-30, 0, 30]) {
    r.box(-aisleDisplay + dx, 16, 23, 14, 16, 48, 'white', 0xe8ecf3);
    r.box(-aisleDisplay + dx, 23.3, 12, 0.6, 7, 52, 'white', 0x1428a0);
  }
}

const FRAMES = [0x161616, 0xd71f26, 0x6b4a32, 0xf5f5f5];

function glasses(r: Room, x: number, z: number, y: number, tint: Hex): void {
  r.box(x - 4.5, z, 7, 1.4, 5, y, 'glass', tint);
  r.box(x + 4.5, z, 7, 1.4, 5, y, 'glass', tint);
  r.box(x, z, 3, 1.2, 1.2, y + 3, 'charcoal', 0x161616);
}

/** A pair of sunglasses lying on a table, lenses up. */
function glassesFlat(r: Room, x: number, z: number, y: number, tint: Hex): void {
  r.box(x - 4.5, z, 7, 5, 1.4, y, 'glass', tint);
  r.box(x + 4.5, z, 7, 5, 1.4, y, 'glass', tint);
  r.box(x, z, 3, 1.2, 1.2, y, 'charcoal', 0x161616);
}

const RAY_WOOD = 0x563530;
/** Three shelves of frames along the back wall, and a pair of glasses every `RAY_PAIR_SPACING` units. */
const RAY_SHELF_HEIGHTS = [40, 64, 88] as const;
const RAY_PAIR_SPACING = 30;
const RAY_SHELF_FRONT_Z = 15;
/** The try-on mirrors stand on the side partitions, clear of the central table. */
const RAY_MIRROR_Z = 196;

/**
 * Eyewear: frames on the back wall, a central table of glasses lying open, the till at the back and a try-on mirror
 * on each side wall. The table stands forward of the browse spot, so bots browsing at the back stay in the aisle.
 */
function rayBao(r: Room, half: number): void {
  till(r, 0, 110, 0xd71f26);
  const span = 2 * half - 40;
  const pairs = Math.floor(span / RAY_PAIR_SPACING);
  RAY_SHELF_HEIGHTS.forEach((y, level) => {
    r.box(0, 9, span, 10, 2, y, 'wood', RAY_WOOD);
    for (let i = 0; i < pairs; i++) {
      glasses(r, -span / 2 + RAY_PAIR_SPACING / 2 + i * RAY_PAIR_SPACING, RAY_SHELF_FRONT_Z, y + 2, FRAMES[(i + level) % FRAMES.length]);
    }
  });
  r.solid(0, 190, 120, 46, 30, 0, 'wood', RAY_WOOD);
  r.box(0, 190, 124, 50, 2, 30, 'glass', 0xdfeaf2);
  for (const z of [180, 200]) {
    [-42, -14, 14, 42].forEach((x, i) => glassesFlat(r, x, z, 32, FRAMES[(i + (z === 180 ? 0 : 2)) % FRAMES.length]));
  }
  r.mirror(-half + 1, RAY_MIRROR_Z, 6, 46, 130, 'left');
  r.mirror(half - 1, RAY_MIRROR_Z, 6, 46, 130, 'right');
}

/** Depth of the sports shop try-on mirrors, between the back displays and the bike. */
const SENTAURO_MIRROR_Z = 60;

const KIT = [0xe4002b, 0x161616, 0xf5f5f5, 0x2e2e2e];

function sentauro(r: Room, half: number): void {
  const displayX = half * 0.52;
  shoeWall(r, -displayX, half - 22, [74, 102]);
  KIT.forEach((tint, i) => {
    const x = displayX + (i - 1.5) * 38;
    r.box(x, 9, 20, 3, 29, 83, 'white', tint);
    for (const side of [-1, 1]) r.box(x + side * 13, 9, 7, 3, 12, 99, 'white', tint);
    r.box(x, 11, 6, 1, 8, 94, 'white', i === 2 ? KIT[1] : KIT[2]);
  });
  till(r, 0, 110, 0x161616);
  for (const z of [133, 197]) {
    r.solid(-displayX, z, 57, 42, 19, 0, 'charcoal');
    r.box(-displayX, z + 20, 57, 3, 9, 19, 'white', 0xe4002b);
    r.box(-displayX, z - 20, 57, 3, 9, 19, 'white', 0xe4002b);
    for (const dx of [-16, 0, 16]) {
      r.box(-displayX + dx, z, 13, 13, 12, 19, 'white', z === 133 ? 0xff8a29 : 0xf5f5f5);
      r.box(-displayX + dx, z + 7, 2, 1, 10, 20, 'charcoal');
    }
  }
  r.solid(displayX, 166, 46, 76, 9, 0, 'desk', 0x555555);
  r.box(displayX, 170, 34, 61, 1, 9, 'charcoal');
  for (const side of [-1, 1]) {
    r.box(displayX + side * 19, 136, 5, 5, 39, 9, 'wood', 0x888888);
    r.box(displayX + side * 19, 144, 5, 19, 4, 48, 'charcoal');
  }
  displayScreen(r, displayX, 135, 48, 26, 10, 0xb5edff);
  const bikeX = half - 30;
  r.solid(bikeX, 165, 28, 63, 6, 0, 'desk', 0x555555);
  r.box(bikeX, 146, 10, 20, 23, 6, 'charcoal');
  r.box(bikeX, 150, 4, 5, 17, 29, 'wood', 0xa8b1c2);
  r.box(bikeX, 154, 24, 5, 4, 46, 'charcoal');
  r.box(bikeX, 174, 5, 5, 29, 6, 'wood', 0xa8b1c2);
  r.box(bikeX, 175, 14, 15, 4, 35, 'charcoal');
  r.mirror(-half + 1, SENTAURO_MIRROR_Z, 6, 46, 130, 'left');
  r.mirror(half - 1, SENTAURO_MIRROR_Z, 6, 46, 130, 'right');
}

const TOYS = [0xe4002b, 0x1f6fd1, 0x2f9e44, 0xf2c200, 0xff7ab0, 0xff7a1a];

function brincoCenter(r: Room, half: number): void {
  const displayX = half * 0.57;
  till(r, 0, 110, 0xe4002b);
  for (const y of [74, 98, 122]) {
    r.box(0, 14, 2 * half - 24, 20, 3, y, 'wood', 0xfff3c4);
    for (const column of [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]) {
      const x = column * (half - 22) / 5;
      const tint = TOYS[(column + 5 + (y - 74) / 24) % TOYS.length];
      r.box(x, 14, 23, 14, 9, y + 3, 'white', tint);
      for (const dx of [-6, 6]) r.box(x + dx, 14, 5, 5, 2, y + 12, 'white', tint);
    }
  }
  r.solid(-displayX, 156, 98, 64, 18, 0, 'wood', 0xe5b96e);
  r.box(-displayX, 147, 69, 40, 12, 18, 'sofa', 0xffc885);
  for (const [dx, z, y, tint] of [[-31, 170, 18, 0x8a5a33], [0, 149, 30, 0xb57948], [31, 170, 18, 0xcc866d]]) {
    const x = -displayX + dx;
    r.box(x, z, 23, 20, 16, y, 'sofa', tint);
    r.box(x, z + 1, 17, 15, 13, y + 16, 'sofa', tint);
    for (const ear of [-7, 7]) r.box(x + ear, z, 6, 7, 6, y + 27, 'sofa', tint);
    r.box(x, z + 9, 7, 4, 5, y + 19, 'wood', 0xffdcab);
  }
  r.solid(displayX, 156, 106, 72, 28, 0, 'wood', 0xb98a58);
  r.box(displayX, 156, 102, 68, 2, 28, 'carpet', 0x2f9e44);
  for (const z of [135, 177]) {
    r.box(displayX, z, 81, 11, 1, 30, 'wood', 0x6b4a32);
    for (const rail of [-4, 4]) r.box(displayX, z + rail, 82, 1, 1, 31, 'metal');
  }
  for (const side of [-1, 1]) {
    r.box(displayX + side * 40, 156, 11, 31, 1, 30, 'wood', 0x6b4a32);
    for (const rail of [-4, 4]) r.box(displayX + side * 40 + rail, 156, 1, 43, 1, 31.1, 'metal');
  }
  for (const dx of [-23, -3, 19]) {
    r.box(displayX + dx, 177, 16, 9, 3, 32, 'charcoal');
    r.box(displayX + dx, 177, 16, 9, 7, 35, 'white', dx === 19 ? TOYS[0] : TOYS[1]);
  }
  r.box(displayX + 14, 177, 7, 9, 5, 42, 'white', TOYS[0]);
  r.box(displayX + 25, 177, 3, 3, 5, 42, 'charcoal');
}

function stationery(r: Room, half: number, trim: Hex, colors: readonly Hex[]): void {
  wallShelves(r, 0, 10, 2 * half - 12, 14, 2, colors, 102, 0xf4efe4);
  till(r, 0, SMALL_TILL, trim);
  const shelfX = half - 20;
  r.solid(shelfX, 186, 28, 88, 34, 0, 'wood', trim);
  colors.forEach((color, index) => {
    r.box(shelfX, 154 + index * 12, 20, 10, 5 + index, 34, 'white', color);
  });
}

/** A small chocolate shop: chocolate boxes on the back shelves, a glass display case in the middle and the till. */
function chocolates(r: Room, half: number): void {
  wallShelves(r, 0, 10, 2 * half - 12, 14, 4, CHOCOLATES, 91, 0x6a3a1c);
  till(r, 0, SMALL_TILL, 0xe9c27a);
  r.solid(0, 182, 96, 40, 34, 0, 'wood', 0x3b1d0e);
  r.box(0, 182, 98, 42, 1.4, 34, 'glass', 0xf3ead6);
  [-36, -18, 0, 18, 36].forEach((x, i) => {
    for (const z of [174, 190]) r.box(x, z, 13, 13, 6, 35.4, 'white', CHOCOLATES[(i + (z === 174 ? 0 : 3)) % CHOCOLATES.length]);
  });
  for (const side of [-1, 1]) {
    r.solid(side * 66, 150, 24, 56, 30, 0, 'desk', 0x6a3a1c);
    for (const z of [140, 160]) r.box(side * 66, z, 12, 12, 9, 30, 'white', CHOCOLATES[(side > 0 ? 2 : 0) + (z === 140 ? 0 : 3)]);
  }
}

const BOUTIQUES: Record<GalleryShopBrand, Boutique> = {
  'cacau-chou': { paint: 0x5a2f1b, trim: 0xe9c27a, floor: 0x7a4e30, browseX: 0, dress: chocolates },
  pandorga: { paint: 0xfaf3f6, trim: 0xe77aa6, floor: 0xf4eef1, browseX: 20, dress: pandorga },
  loccitano: { paint: 0xf6e9bd, trim: 0x1c3a6b, floor: 0xe7d6a2, browseX: 0, dress: loccitano },
  'pe-leve': { paint: 0xeef4ef, trim: 0x1f3d2b, floor: 0xdbe5dd, browseX: 0, dress: peLeve },
  essencia: { paint: 0xf8eff4, trim: 0x7a2f5a, floor: 0xeedbe5, browseX: 0, dress: essencia },
  samsong: { paint: 0xeef1f8, trim: 0x1428a0, floor: 0xdfe3ec, browseX: 0, dress: samsong },
  'ray-bao': { paint: 0xf7f4f1, trim: 0xd71f26, floor: 0xe7e1da, browseX: 0, dress: rayBao },
  'linha-fina': {
    paint: 0xf2eee4, trim: 0x30544e, floor: 0xe4e0d4, browseX: 0,
    dress: (r, half) => stationery(r, half, 0x30544e, [0x30544e, 0xd1a465, 0xb45d53, 0xe4e0d4]),
  },
  'papel-e-cor': {
    paint: 0xf6efe4, trim: 0x7b3d54, floor: 0xf0dfcf, browseX: 0,
    dress: (r, half) => stationery(r, half, 0x7b3d54, [0x7b3d54, 0xedb454, 0x448da3, 0xe58f79]),
  },
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
function facade(b: MapBuilder, x1: number, x2: number, brand: GalleryShopBrand, spec: Boutique): void {
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
export function boutiqueShop(b: MapBuilder, brand: GalleryShopBrand, x1: number, x2: number, walls: Walls): void {
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
  r.vent(0, 152, BACK_WALL_DEPTH + 4, 'front');
  facade(b, x1, x2, brand, spec);
  b.light(cx, DECK3 + LAMP_Y, -Z + 200, '#ffe9bd');
  b.interior(cx + spec.browseX, DECK3, -Z + 142);
  b.landmark(`${STORE_BRANDS[brand].name} (Mirante)`, cx, -Z + 152);
}
