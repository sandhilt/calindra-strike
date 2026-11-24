import type { FoodBrand } from './brands.ts';
import { Room } from './room.ts';
import { DECK, FOOD_CEILING } from './shopping-levels.ts';

/** Stainless steel, scrubbed tile and dark cooking surfaces; tints on the mats the map already has. */
const STEEL = 0xaab1ba;
const STEEL_DARK = 0x7d848d;
const TILE_WHITE = 0xf1efe8;
const FLOOR_DARK = 0x77797d;
const IRON = 0x75736f;

/** Depth of every kitchen behind its counter, from the back wall to the serving window. */
export const KITCHEN_DEPTH = 96;
export const KITCHEN_WIDTH = 320;
/** Height of the kitchen box above the deck: its lid sits against the floor slab of the top floor. */
export const KITCHEN_HEIGHT = 176;
/** The cooks stand on a platform this high, so equipment shows over the 40 unit counter. Rooms of the kitchen start on top of it. */
export const KITCHEN_FLOOR = 28;
const KITCHEN_TOP = KITCHEN_HEIGHT - KITCHEN_FLOOR;
/** Height of the food court ceiling above the kitchen platform, where the hood duct ends. */
const ROOF_ABOVE_FLOOR = FOOD_CEILING - DECK - KITCHEN_FLOOR;
/**
 * Size of the boxes that run wall to wall. The side walls are 2 units thick, so ending these 0.5 short of the outer face buries
 * their end caps in the wall, and stopping them 0.5 short of the front keeps the wall's front cap alone on that plane. At the full
 * size they share the wall's outer planes and the two colours fight for the pixels.
 */
const SHELL_SPAN = KITCHEN_WIDTH - 1;
const SHELL_DEPTH = KITCHEN_DEPTH - 0.5;
/** The front fascia hangs from the lid down to here (relative to the platform). */
const FASCIA_BOTTOM = 122;

type Hex = number;

/** What differs between two kitchens of the same kind. */
interface FastSpec {
  accent: Hex;
  fryers: number;
  griddle: boolean;
  /** Flame grilled: the griddle has flames under its patties. */
  flameGrilled?: boolean;
  extras: (r: Room) => void;
}

interface GrillSpec {
  accent: Hex;
  extras: (r: Room) => void;
}

function fridge(r: Room, x: number, accent: Hex): void {
  r.box(x, 16, 30, 30, 84, 0, 'white', STEEL);
  r.box(x, 31.2, 28, 1.2, 36, 44, 'white', STEEL_DARK);
  r.box(x, 31.2, 28, 1.2, 36, 4, 'white', STEEL_DARK);
  r.box(x + 11, 32, 2, 2, 24, 50, 'charcoal');
  r.box(x + 11, 32, 2, 2, 24, 14, 'charcoal');
  r.box(x, 31.6, 26, 0.8, 5, 82 - 6, 'white', accent);
}

function fryer(r: Room, x: number): void {
  r.box(x, 17, 24, 32, 34, 0, 'white', STEEL);
  r.box(x, 17, 20, 26, 1, 34, 'charcoal', IRON);
  r.box(x, 31.5, 22, 2.4, 7, 28, 'charcoal', IRON);
  for (const side of [-5, 5]) {
    r.box(x + side, 8, 1.4, 14, 1.4, 35, 'charcoal', IRON);
    r.box(x + side, 1.5, 6, 6, 5, 35, 'white', STEEL_DARK);
  }
  r.box(x, 3.5, 22, 4, 12, 34, 'white', STEEL_DARK);
}

function griddle(r: Room, x: number, width: number): void {
  r.cook(x, 17, 36, 'griddle');
  r.box(x, 17, width, 32, 34, 0, 'white', STEEL);
  r.box(x, 17, width - 2, 28, 1.6, 34, 'charcoal', 0x1b1b1b);
  r.box(x, 33.5, width, 3, 4, 34, 'white', STEEL_DARK);
  r.box(x - width / 4, 13, 8, 5, 4, 36, 'wood', 0x5a2a1a);
  r.box(x + width / 5, 22, 8, 5, 4, 36, 'wood', 0x5a2a1a);
}

function hood(r: Room, x: number, width: number): void {
  r.box(x, 17, width, 34, 6, 82, 'white', STEEL_DARK);
  r.box(x, 17, width - 6, 30, 24, 88, 'white', STEEL);
  r.box(x, 17, width - 14, 26, 1, 81.5, 'charcoal', IRON);
  r.box(x, 17, 26, 26, ROOF_ABOVE_FLOOR - 112, 112, 'white', STEEL);
}

function prepTable(r: Room, x: number, width: number, z: number): void {
  r.box(x, z, width, 24, 30, 0, 'white', STEEL);
  r.box(x, z, width + 2, 26, 2, 30, 'white', STEEL_DARK);
  r.box(x, z, width - 8, 2, 2, 8, 'white', STEEL_DARK);
  r.box(x - width / 3, z, 18, 12, 2.4, 32, 'white', 0xe9c46a);
  r.box(x + width / 6, z, 14, 10, 4, 32, 'crate', 0xd98e3f);
}

function shelf(r: Room, x: number, y: number, width: number, goods: readonly Hex[]): void {
  r.box(x, 8, width, 14, 1.6, y, 'white', STEEL_DARK);
  const step = width / goods.length;
  goods.forEach((color, i) => r.box(x - width / 2 + step * (i + 0.5), 8, step - 2, 10, 8 + (i % 3) * 3, y + 1.6, 'white', color));
}

function drinks(r: Room, x: number, color: Hex): void {
  r.box(x, 12, 22, 20, 58, 0, 'white', color);
  r.box(x, 21.8, 18, 0.6, 16, 28, 'screen');
  r.box(x, 20, 16, 6, 3, 18, 'charcoal', IRON);
}

function menuBoards(r: Room, x1: number, x2: number): void {
  for (const x of [x1, x2]) {
    r.box(x, 3, 40, 1.6, 26, 50, 'charcoal', IRON);
    r.box(x, 4, 36, 0.6, 22, 52, 'screen');
  }
}

/** What every kitchen has: a platform, a tiled back wall, side walls, a lid, a front fascia above the serving window. */
function shell(r: Room, accent: Hex): void {
  r.box(0, SHELL_DEPTH / 2, SHELL_SPAN, SHELL_DEPTH, KITCHEN_FLOOR, -KITCHEN_FLOOR, 'tile', FLOOR_DARK);
  r.box(0, 1, SHELL_SPAN, 2, 112, 18, 'tile', TILE_WHITE);
  r.box(0, 1, SHELL_SPAN, 2, 18, 0, 'white', STEEL_DARK);
  for (const side of [-1, 1]) {
    r.box(side * (KITCHEN_WIDTH / 2 - 1), KITCHEN_DEPTH / 2, 2, KITCHEN_DEPTH, KITCHEN_HEIGHT, -KITCHEN_FLOOR, 'white');
    r.box(side * (KITCHEN_WIDTH / 2 - 2.2), SHELL_DEPTH / 2, 1.6, SHELL_DEPTH, 110, 0, 'tile', TILE_WHITE);
  }
  r.box(0, KITCHEN_DEPTH / 2, SHELL_SPAN, KITCHEN_DEPTH, 4, KITCHEN_TOP - 4, 'white');
  r.box(0, SHELL_DEPTH - 1, SHELL_SPAN, 2, KITCHEN_TOP - FASCIA_BOTTOM, FASCIA_BOTTOM, 'white', accent);
  r.box(0, SHELL_DEPTH - 3, SHELL_SPAN, 6, 4, FASCIA_BOTTOM - 4, 'white', STEEL_DARK);
}

/** Distance between two fryers along the kitchen. */
const FRYER_PITCH = 28;

/** Low flames licking up under the patties of a flame grilled griddle. */
function flameGrill(r: Room, x: number): void {
  for (const dx of [-14, 14]) r.flame(x + dx, 17, 35, 9);
}

function fastKitchen(r: Room, spec: FastSpec): void {
  shell(r, spec.accent);
  fridge(r, -138, spec.accent);
  fridge(r, 138, spec.accent);
  let x = -92;
  if (spec.fryers > 0) r.cook(x + ((spec.fryers - 1) * FRYER_PITCH) / 2, 17, 34, 'fryer');
  for (let i = 0; i < spec.fryers; i++, x += FRYER_PITCH) fryer(r, x);
  if (spec.griddle) {
    griddle(r, x + 22, 60);
    if (spec.flameGrilled) flameGrill(r, x + 22);
    x += 64;
  }
  hood(r, (-92 + x - 28) / 2, Math.max(70, x + 92 - 8));
  prepTable(r, 40, 80, 62);
  prepTable(r, -60, 70, 70);
  shelf(r, -70, 56, 60, [spec.accent, 0xfff4d6, spec.accent, 0xfff4d6, spec.accent]);
  menuBoards(r, -112, 112);
  spec.extras(r);
}

function bucketStack(r: Room, x: number): void {
  for (let i = 0; i < 3; i++) {
    r.box(x + i * 12 - 12, 10, 10, 10, 13, 12, 'white', i % 2 ? 0xc8102e : 0xffffff);
    r.box(x + i * 12 - 12, 10, 10.4, 10.4, 3, 25, 'white', 0xc8102e);
  }
}

function toasterRack(r: Room, x: number): void {
  r.box(x, 14, 40, 26, 4, 56, 'white', STEEL_DARK);
  for (let i = 0; i < 4; i++) r.box(x - 15 + i * 10, 14, 8, 22, 3.4, 60, 'desk', 0xe0a458);
}

function warmerCabinet(r: Room, x: number): void {
  r.box(x, 18, 44, 30, 46, 40, 'white', STEEL);
  r.box(x, 33.2, 36, 0.8, 30, 46, 'wood', 0xd6892a);
  r.box(x, 33, 40, 2, 4, 80, 'charcoal', IRON);
}

function softServe(r: Room, x: number, color: Hex): void {
  r.box(x, 20, 30, 30, 40, 34, 'white', color);
  r.box(x, 20, 14, 14, 8, 74, 'white', 0xffffff);
  r.box(x, 33.6, 10, 1.4, 8, 50, 'charcoal', IRON);
}

type Kitchen = { kind: 'fast'; spec: FastSpec } | { kind: 'grill'; spec: GrillSpec };

const FAST_SPECS = {
  kfg: { accent: 0xc8102e, fryers: 4, griddle: false, extras: (r: Room) => { bucketStack(r, 110); warmerCabinet(r, -118); } },
  'burguer-rei': { accent: 0xd62300, fryers: 1, griddle: true, flameGrilled: true, extras: (r: Room) => { toasterRack(r, 100); r.box(60, 17, 50, 30, 8, 34, 'brick', 0xff7a3a); } },
  mequi: { accent: 0xda291c, fryers: 2, griddle: true, extras: (r: Room) => { drinks(r, 100, 0xda291c); softServe(r, 128, 0xffc72c); } },
  bobis: { accent: 0xe30613, fryers: 2, griddle: false, extras: (r: Room) => { softServe(r, -118, 0xe30613); drinks(r, 108, 0x1f5fbf); griddle(r, 60, 56); } },
} satisfies Record<string, FastSpec>;

/** Flames along the coal bed of a brick grill, under the skewers. */
const GRILL_FLAMES = 4;

function brickGrill(r: Room, x: number, width: number): void {
  r.cook(x, 18, 40, 'charcoal');
  for (let i = 0; i < GRILL_FLAMES; i++) r.flame(x - width / 2 + 14 + (i * (width - 28)) / (GRILL_FLAMES - 1), 18, 33, 11 + (i % 2) * 3);
  r.box(x, 18, width, 34, 30, 0, 'brick', 0x7a3f2e);
  r.box(x, 18, width - 6, 26, 3, 30, 'brick', 0xff6a2a);
  for (let i = 0; i < 9; i++) r.box(x - width / 2 + 6 + i * ((width - 12) / 8), 18, 1.4, 28, 1.4, 33, 'charcoal', IRON);
  for (let i = 0; i < 6; i++) {
    const sx = x - width / 2 + 10 + i * ((width - 20) / 5);
    r.box(sx, 10, 1.4, 1.4, 54, 34, 'white', STEEL_DARK);
    r.box(sx, 10, 5, 5, 9, 44, 'wood', 0x8d2f25);
    r.box(sx, 10, 5, 5, 9, 58, 'wood', 0xb0472f);
  }
}

function doubleOven(r: Room, x: number): void {
  r.box(x, 17, 44, 32, 70, 0, 'white', STEEL);
  for (const y of [8, 40]) {
    r.box(x, 33.2, 36, 0.8, 24, y, 'charcoal', IRON);
    r.box(x, 33.6, 38, 1.2, 2.4, y + 25, 'white', STEEL_DARK);
  }
}

function woodOven(r: Room, x: number): void {
  r.cook(x, 30, 20, 'wood');
  r.flame(x, 37, 11, 14);
  r.flame(x - 6, 37, 11, 9);
  r.flame(x + 6, 37, 11, 9);
  r.box(x, 20, 56, 38, 24, 0, 'brick', 0x8a4b36);
  r.box(x, 20, 46, 32, 16, 24, 'brick', 0x8a4b36);
  r.box(x, 20, 34, 26, 12, 40, 'brick', 0x8a4b36);
  r.box(x, 37.6, 22, 1.4, 14, 10, 'charcoal', 0x120d0b);
  r.box(x, 38.2, 16, 0.6, 8, 12, 'brick', 0xff7a2a);
  r.box(x, 20, 12, 12, 40, 52, 'brick', 0x8a4b36);
}

function potRail(r: Room, x: number, width: number): void {
  r.box(x, 8, width, 1.6, 1.6, 128, 'white', STEEL_DARK);
  for (let i = 0; i < 5; i++) {
    const px = x - width / 2 + 8 + (i * (width - 16)) / 4;
    r.box(px, 8, 1, 1, 8, 120, 'white', STEEL_DARK);
    r.box(px, 8, 10 + (i % 2) * 3, 10 + (i % 2) * 3, 8 + (i % 2) * 2, 112 - (i % 2) * 2, 'white', i % 2 ? STEEL_DARK : IRON);
  }
}

function wineRack(r: Room, x: number): void {
  r.box(x, 8, 60, 14, 72, 12, 'wood', 0x5a3a22);
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 6; col++) r.box(x - 24 + col * 9.6, 10, 5, 8, 5, 18 + row * 13, 'plant', 0x3d6b3a);
  }
}

function grillKitchen(r: Room, spec: GrillSpec): void {
  shell(r, spec.accent);
  fridge(r, -142, spec.accent);
  prepTable(r, 24, 90, 66);
  hood(r, -20, 118);
  shelf(r, 88, 56, 60, [0xf2e4c4, spec.accent, 0xf2e4c4, spec.accent]);
  menuBoards(r, -112, 112);
  spec.extras(r);
}

const GRILL_SPECS = {
  'mania-picanha': { accent: 0xe0261b, extras: (r: Room) => { brickGrill(r, -20, 100); doubleOven(r, 118); potRail(r, 100, 70); } },
  parrilha: { accent: 0x5a3a22, extras: (r: Room) => { brickGrill(r, -22, 112); doubleOven(r, 122); potRail(r, 96, 60); } },
  outbaque: { accent: 0x7a2a1a, extras: (r: Room) => { brickGrill(r, -26, 84); doubleOven(r, 120); wineRack(r, 70); } },
  madeiro: { accent: 0x1b1b1b, extras: (r: Room) => { woodOven(r, -24); doubleOven(r, 120); potRail(r, 92, 60); } },
} satisfies Record<string, GrillSpec>;

/** One entry per food brand: a brand added to STORE_BRANDS without a kitchen fails the typecheck. */
const KITCHENS: Record<FoodBrand, Kitchen> = {
  kfg: { kind: 'fast', spec: FAST_SPECS.kfg },
  'burguer-rei': { kind: 'fast', spec: FAST_SPECS['burguer-rei'] },
  mequi: { kind: 'fast', spec: FAST_SPECS.mequi },
  bobis: { kind: 'fast', spec: FAST_SPECS.bobis },
  'mania-picanha': { kind: 'grill', spec: GRILL_SPECS['mania-picanha'] },
  parrilha: { kind: 'grill', spec: GRILL_SPECS.parrilha },
  outbaque: { kind: 'grill', spec: GRILL_SPECS.outbaque },
  madeiro: { kind: 'grill', spec: GRILL_SPECS.madeiro },
};

/**
 * The kitchen behind a food court counter, seen over the counter and never walked into: the caller keeps a solid
 * invisible volume over it. Fast food gets fryers, a griddle and drinks; sit-down places a grill, ovens and pots.
 */
export function buildKitchen(r: Room, brand: FoodBrand): void {
  const kitchen = KITCHENS[brand];
  if (kitchen.kind === 'fast') fastKitchen(r, kitchen.spec);
  else grillKitchen(r, kitchen.spec);
}

/** Counter front colour of a food court kitchen: the brand's accent. */
export function counterTint(brand: FoodBrand): number {
  const kitchen = KITCHENS[brand];
  return kitchen.spec.accent;
}
