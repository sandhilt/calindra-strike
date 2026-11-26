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
  r.box(x, 17, 20, 26, 1, 34, 'white', 0xa26228);
  r.box(x, 31.5, 22, 2.4, 7, 28, 'charcoal', IRON);
  for (const side of [-1, 1]) {
    r.box(x + side * 8, 17, 1.4, 17, 4, 35, 'white', STEEL_DARK);
    r.box(x, 17 + side * 8.5, 14.6, 1.4, 4, 35.2, 'white', STEEL);
  }
  for (const dx of [-5, 0, 5]) r.box(x + dx, 17, 1, 14, 1, 35, 'white', STEEL);
  r.box(x, 30, 2, 11, 2, 38, 'white', STEEL);
  r.box(x, 38, 4, 7, 3, 37.5, 'charcoal');
}


/** A shallow pan with an inset cooking surface and a handle facing the serving window. */
function pan(r: Room, x: number, z: number, y: number): void {
  r.box(x, z, 14, 14, 2, y, 'charcoal', IRON);
  for (const side of [-1, 1]) {
    r.box(x + side * 7, z, 2, 13, 3, y + 1, 'charcoal', IRON);
    r.box(x, z + side * 7, 13, 2, 3.2, y + 1, 'charcoal', IRON);
  }
  r.box(x, z + 12, 3, 10, 2, y + 2, 'charcoal');
}

type Pot = 'pressure' | 'stock';

/** Three adjoining strips bevel the corners of a round pot in the static box mesh. */
function potLayer(r: Room, x: number, z: number, y: number, size: number, height: number, tint: Hex): void {
  const middleDepth = size * 0.6;
  const endDepth = (size - middleDepth) / 2;
  r.box(x, z, size, middleDepth, height, y, 'white', tint);
  for (const side of [-1, 1]) {
    r.box(x, z + side * (middleDepth + endDepth) / 2, size * 0.72, endDepth, height, y, 'white', tint);
  }
}

/** A lidded pot over a raised gas ring. The pressure regulator is the source of the steam. */
function burnerPot(r: Room, x: number, z: number, y: number, style: Pot): void {
  const height = style === 'pressure' ? 10 : 14;
  const base = y + 6;
  const lid = base + height;
  r.box(x, z, 22, 22, 2, y, 'charcoal', IRON);
  for (const side of [-1, 1]) r.box(x + side * 8, z, 2, 15, 4, y + 2, 'charcoal');
  r.flame(x, z, y + 2, 6, 'burner');
  potLayer(r, x, z, base, 16, height, STEEL);
  potLayer(r, x, z, lid, 17, 2, STEEL_DARK);
  for (const side of [-1, 1]) r.box(x + side * 10, z, 5, 4, 2, lid - 3, 'charcoal');
  r.box(x, z, 3, 3, 2, lid + 2, 'charcoal');
  if (style === 'pressure') r.box(x, z, 4.5, 4.5, 1.8, lid + 4, 'white', STEEL_DARK);
  r.steam(x, z, lid + (style === 'pressure' ? 5.8 : 4));
  r.cook(x, z, lid, 'boil');
}

function range(r: Room, x: number, style: Pot): void {
  r.box(x, 22, 28, 34, 34, 0, 'white', STEEL);
  burnerPot(r, x, 24, 34, style);
}

/** Base cabinet the counter-top stations below stand on, in the footprint a range takes. */
function stationBase(r: Room, x: number): void {
  r.box(x, 22, 28, 34, 34, 0, 'white', STEEL);
}

/** Fried chicken breading table: a tub of seasoned flour, a sieve and a tray of breaded pieces. */
function breadingTable(r: Room, x: number): void {
  stationBase(r, x);
  r.box(x - 5, 22, 16, 26, 6, 34, 'white', STEEL_DARK);
  r.box(x - 5, 22, 14, 24, 1, 39.5, 'white', 0xf1e2bf);
  r.box(x + 9, 22, 9, 9, 3, 34, 'charcoal', IRON);
  for (const dz of [-8, 0, 8]) r.box(x + 9, 22 + dz, 6, 5, 2, 37, 'desk', 0xc98a3c);
}

/** Fry station: a stainless dump under heat lamps, cartons of fries and a scoop. */
function fryStation(r: Room, x: number, carton: Hex): void {
  stationBase(r, x);
  r.box(x, 22, 26, 30, 4, 34, 'white', STEEL_DARK);
  r.box(x, 22, 22, 26, 2, 37.5, 'desk', 0xf2c14e);
  r.box(x, 22, 26, 4, 2, 56, 'lamp');
  for (const side of [-1, 1]) r.box(x + side * 12, 22, 2, 2, 18, 38, 'white', STEEL_DARK);
  for (const dz of [-9, -3, 3, 9]) {
    r.box(x - 10, 22 + dz, 4, 4, 6, 38, 'white', carton);
    r.box(x - 10, 22 + dz, 3, 3, 2, 44, 'desk', 0xf2c14e);
  }
}

/** Sandwich assembly board: a heated bun chute, a cutting board and wrapped burgers waiting to go. */
function assemblyBoard(r: Room, x: number, wrap: Hex): void {
  stationBase(r, x);
  r.box(x, 22, 24, 30, 1.6, 34, 'wood', 0xd6a467);
  r.box(x + 8, 22, 8, 20, 18, 35.6, 'white', STEEL_DARK);
  r.box(x + 8, 13, 6, 1, 4, 44, 'desk', 0xe0a458);
  for (const dz of [-8, 0, 8]) r.box(x - 6, 22 + dz, 7, 6, 3, 35.6, 'white', wrap);
}

/** Milkshake bar: spindle mixers with steel cups and a row of tall cups. */
function shakeMixers(r: Room, x: number, color: Hex): void {
  stationBase(r, x);
  for (const dz of [-9, 0, 9]) {
    r.box(x + 6, 22 + dz, 6, 6, 24, 34, 'white', color);
    r.box(x + 4, 22 + dz, 6, 4, 3, 54, 'white', color);
    r.box(x + 1.5, 22 + dz, 4, 4, 8, 40, 'white', STEEL);
  }
  for (const dz of [-8, 0, 8]) r.box(x - 8, 22 + dz, 5, 5, 9, 34, 'white', 0xfff4d6);
}

function griddle(r: Room, x: number, width: number): void {
  r.cook(x, 17, 36, 'griddle');
  r.box(x, 17, width, 32, 34, 0, 'white', STEEL);
  r.box(x, 17, width - 2, 28, 1.6, 34, 'charcoal', 0x1b1b1b);
  r.box(x, 33.5, width, 3, 4, 34, 'white', STEEL_DARK);
  r.box(x - width / 4, 13, 8, 5, 4, 36, 'wood', 0x5a2a1a);
  const panX = x + width / 5;
  r.flame(panX, 22, 35.6, 6, 'burner');
  for (const side of [-1, 1]) r.box(panX + side * 6, 22, 2, 12, 3.9, 35.6, 'charcoal', IRON);
  pan(r, panX, 22, 39.5);
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

/**
 * The staff aisle: a strip at the left end of every kitchen, from just in front of the fridge to the serving window, where the
 * platform is cut away. The cook and the server stand in it on the food court deck, so they are as tall as a player at the
 * counter. No kitchen keeps equipment standing in it.
 */
const AISLE_MAX_X = -106;
const AISLE_MIN_Z = 36;

/** What every kitchen has: a platform with the staff aisle cut out, a tiled back wall, side walls, a lid, a front fascia above the serving window. */
function shell(r: Room, accent: Hex): void {
  r.box(0, AISLE_MIN_Z / 2, SHELL_SPAN, AISLE_MIN_Z, KITCHEN_FLOOR, -KITCHEN_FLOOR, 'tile', FLOOR_DARK);
  const frontWidth = SHELL_SPAN / 2 - AISLE_MAX_X;
  const frontDepth = SHELL_DEPTH - AISLE_MIN_Z;
  r.box(AISLE_MAX_X + frontWidth / 2, AISLE_MIN_Z + frontDepth / 2, frontWidth, frontDepth, KITCHEN_FLOOR, -KITCHEN_FLOOR, 'tile', FLOOR_DARK);
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
  for (const dx of [-14, 14]) r.flame(x + dx, 17, 35, 13);
}

/** Where the cook stands, clear of every kitchen's equipment, and where the server stands behind the serving window. */
const COOK_X = -120;
const COOK_Z = 52;
const SERVER_X = -120;
const SERVER_Z = 84;
/** Staff stand in the aisle on the deck, below the platform the kitchen is authored on. */
const STAFF_Y = -KITCHEN_FLOOR;

/** Top of the serving counter's cap above the kitchen platform: the cap is 42 units over the deck and reaches 4 units into the kitchen. */
const COUNTER_TOP = 42 - KITCHEN_FLOOR;
const COUNTER_CAP_Z = KITCHEN_DEPTH - 4;
/** The register stands beside the server, at the window's edge and inside the kitchen, clear of the server's body. */
const REGISTER_X = SERVER_X + 34;
const REGISTER_Z = KITCHEN_DEPTH - 5;

/**
 * A cash register on a steel stand flush with the counter top, half on the counter cap: the stand rises from the platform
 * behind the cap, so the register sits at counter height, the operator screen faces the server and a small display faces the customer.
 */
function register(r: Room, x: number, z: number): void {
  r.box(x, (z - 5 + COUNTER_CAP_Z) / 2, 18, COUNTER_CAP_Z - (z - 5), COUNTER_TOP - STAFF_Y, STAFF_Y, 'white', STEEL_DARK);
  r.box(x, z, 16, 8, 5, COUNTER_TOP, 'charcoal', 0x1b1b1b);
  r.box(x, z - 1, 12, 4, 1.5, COUNTER_TOP + 5, 'charcoal', 0x3a3a3a);
  r.box(x, z - 3.5, 12, 1, 8, COUNTER_TOP + 5, 'screen');
  r.box(x + 4, z + 3.5, 6, 0.8, 4, COUNTER_TOP + 5, 'screen');
}

/** The people behind a food court counter, all inside the kitchen so players never reach them: a cook at a station and a server at the window with the register. */
function kitchenStaff(r: Room, brand: FoodBrand): void {
  r.staff(COOK_X, COOK_Z, 'back', 'cook', brand, STAFF_Y);
  r.staff(SERVER_X, SERVER_Z, 'front', 'server', brand, STAFF_Y);
  register(r, REGISTER_X, REGISTER_Z);
}

function fastKitchen(r: Room, spec: FastSpec, brand: FoodBrand): void {
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
  kitchenStaff(r, brand);
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
  kfg: {
    accent: 0xc8102e, fryers: 4, griddle: false,
    extras(r: Room) {
      bucketStack(r, 110);
      warmerCabinet(r, -118);
      breadingTable(r, 43);
      for (const x of [-77, -63, -49]) {
        r.box(x, 73, 10, 10, 15, 32, 'white', 0xc8102e);
        r.box(x, 73, 12, 12, 3, 47, 'white', TILE_WHITE);
      }
      for (const y of [32, 35, 38]) r.box(32, 62, 18, 13, 2.5, y, 'white', 0xc8102e);
    },
  },
  'burguer-rei': {
    accent: 0xd62300, fryers: 1, griddle: true, flameGrilled: true,
    extras(r: Room) {
      toasterRack(r, 100);
      assemblyBoard(r, 18, 0xf0e5cb);
      r.box(60, 17, 50, 30, 8, 34, 'brick', 0xff7a3a);
      shelf(r, 45, 50, 54, [0xd62300, 0xffc04b, 0xf0e5cb, 0x789548]);
      for (const [x, tint] of [[26, 0x9dbd58], [36, 0xe34c2d], [46, 0xb5c375]]) {
        r.box(x, 70, 9, 7, 4, 32, 'white', STEEL_DARK);
        r.box(x, 70, 7, 5, 1.5, 36, 'white', tint);
      }
    },
  },
  mequi: {
    accent: 0xda291c, fryers: 2, griddle: true,
    extras(r: Room) {
      drinks(r, 100, 0xda291c);
      softServe(r, 128, 0xffc72c);
      fryStation(r, 43, 0xda291c);
      for (const x of [29, 40]) {
        r.box(x, 63, 6, 6, 14, 32, 'white', 0xffc72c);
        r.box(x, 63, 8, 8, 4, 46, 'white', TILE_WHITE);
      }
      for (const x of [-74, -61, -48]) {
        r.box(x, 73, 10, 8, 10, 32, 'white', 0xda291c);
        for (const dx of [-3, 0, 3]) r.box(x + dx, 73, 2, 3, 4 + Math.abs(dx), 42, 'white', 0xffc752);
      }
      r.box(0, 92, 244, 1.2, 1.8, 116.2, 'screen');
    },
  },
  bobis: {
    accent: 0xe30613, fryers: 2, griddle: false,
    extras(r: Room) {
      softServe(r, -118, 0xe30613);
      drinks(r, 108, 0x1f5fbf);
      griddle(r, 60, 56);
      shakeMixers(r, -28, 0xe30613);
      for (const [x, tint] of [[-77, 0xf68bb2], [-65, 0xc88b65], [-53, 0xffdf94]]) {
        r.box(x, 73, 6, 6, 10, 32, 'white', tint);
        r.box(x, 73, 8, 8, 4, 42, 'white', TILE_WHITE);
        r.box(x + 1, 73, 1.3, 1.3, 6, 46, 'white', 0xe30613);
      }
      shelf(r, 39, 54, 40, [0xeeb9d2, 0x9b6648, 0xe4c47f]);
    },
  },
} satisfies Record<string, FastSpec>;

/** Flames along the coal bed of a brick grill, under the skewers. */
const GRILL_FLAMES = 6;

function brickGrill(r: Room, x: number, width: number): void {
  r.cook(x, 18, 40, 'charcoal');
  const panX = x - width / 2 + 14;
  for (let i = 1; i < GRILL_FLAMES; i++) r.flame(panX + (i * (width - 28)) / (GRILL_FLAMES - 1), 18, 33, 17 + (i % 2) * 5);
  r.flame(panX, 19, 33, 6);
  r.box(x, 18, width, 34, 30, 0, 'brick', 0x7a3f2e);
  r.box(x, 18, width - 6, 26, 3, 30, 'brick', 0xff6a2a);
  pan(r, panX, 19, 34.4);
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

/** The mouth sits on the oven's second tier, so the fire shows over the 12 unit high counter and not behind it. */
const WOOD_OVEN_MOUTH_Y = 26;

function woodOven(r: Room, x: number): void {
  r.cook(x, 30, 20, 'wood');
  r.flame(x, 37, WOOD_OVEN_MOUTH_Y + 1, 20);
  r.flame(x - 6, 37, WOOD_OVEN_MOUTH_Y + 1, 13);
  r.flame(x + 6, 37, WOOD_OVEN_MOUTH_Y + 1, 13);
  r.box(x, 20, 56, 38, 24, 0, 'brick', 0x8a4b36);
  r.box(x, 20, 46, 32, 16, 24, 'brick', 0x8a4b36);
  r.box(x, 20, 34, 26, 12, 40, 'brick', 0x8a4b36);
  r.box(x, 37.6, 22, 1.4, 14, WOOD_OVEN_MOUTH_Y, 'charcoal', 0x120d0b);
  r.box(x, 38.2, 16, 0.6, 8, WOOD_OVEN_MOUTH_Y + 2, 'brick', 0xff7a2a);
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

function grillKitchen(r: Room, spec: GrillSpec, brand: FoodBrand): void {
  shell(r, spec.accent);
  fridge(r, -142, spec.accent);
  prepTable(r, 24, 90, 66);
  hood(r, -20, 118);
  shelf(r, 88, 56, 60, [0xf2e4c4, spec.accent, 0xf2e4c4, spec.accent]);
  menuBoards(r, -112, 112);
  spec.extras(r);
  kitchenStaff(r, brand);
}

const GRILL_SPECS = {
  'mania-picanha': {
    accent: 0xe0261b,
    extras(r: Room) {
      brickGrill(r, -20, 100);
      range(r, 51, 'pressure');
      doubleOven(r, 118);
      potRail(r, 100, 70);
      r.box(-74, 48, 68, 3, 3, 66, 'white', STEEL_DARK);
      r.box(-104, 26, 3, 46, 3, 66, 'white', STEEL_DARK);
      for (const [x, height] of [[-98, 13], [-82, 10], [-66, 15], [-50, 12]]) {
        r.box(x, 48, 2, 2, 6, 60, 'white', STEEL);
        r.box(x, 49, 10, 6, height, 58 - height, 'wood', 0xa3483a);
        r.box(x, 49, 9, 5, 2, 58, 'white', 0xf2d1a1);
      }
    },
  },
  parrilha: {
    accent: 0x5a3a22,
    extras(r: Room) {
      brickGrill(r, -22, 112);
      range(r, 52, 'stock');
      doubleOven(r, 122);
      potRail(r, 96, 60);
      for (const [x, height] of [[-94, 29], [-73, 23], [-52, 26]]) {
        r.box(x, 60, 17, 12, height, 0, 'charcoal', 0x706969);
        r.box(x, 60, 14, 9, 3, height, 'charcoal', 0x706969);
        r.box(x, 66.2, 13, 0.4, 7, height - 12, 'white', 0xbfa378);
      }
      r.box(-68, 6, 36, 8, 2, 73, 'white', STEEL_DARK);
      for (const x of [-80, -72, -64, -56]) {
        r.box(x, 8, 1.5, 1.5, 25, 69, 'white', STEEL);
        r.box(x, 8, 3, 3, 7, 62, 'wood');
      }
    },
  },
  outbaque: {
    accent: 0x7a2a1a,
    extras(r: Room) {
      brickGrill(r, -26, 84);
      range(r, 32, 'stock');
      doubleOven(r, 120);
      wineRack(r, 70);
      r.box(-85, 60, 38, 18, 33, 0, 'wood', 0x63432d);
      for (const x of [-97, -85, -73]) {
        r.box(x, 60, 7, 7, 12, 33, 'white', 0x853627);
        r.box(x, 60, 4, 4, 4, 45, 'white', TILE_WHITE);
        r.box(x, 63.7, 5, 0.4, 5, 36, 'white', 0xe9ca95);
      }
      r.box(17, 64, 15, 12, 2, 32, 'white', STEEL_DARK);
      for (const dx of [-4, 0, 4]) r.box(17 + dx, 64, 2, 9, 4, 34, 'wood', 0xae492d);
    },
  },
  madeiro: {
    accent: 0x1b1b1b,
    extras(r: Room) {
      woodOven(r, -24);
      range(r, 23, 'pressure');
      doubleOven(r, 120);
      potRail(r, 92, 60);
      for (const x of [-112, -90]) {
        r.box(x, 4, 15, 4, 14, 62, 'wood', 0xd79e61);
        r.box(x, 4, 3, 4, 24, 76, 'wood', 0xc18650);
      }
      const logRows = [[-97, -88, -79], [-92.5, -83.5], [-88]];
      for (const [row, xs] of logRows.entries()) {
        for (const x of xs) {
          r.box(x, 45, 8, 21, 7, row * 7, 'wood', 0x81502b);
          r.box(x, 55.7, 5, 0.4, 5, row * 7 + 1, 'wood', 0xe4b171);
        }
      }
      for (const [x, height] of [[12, 14], [25, 11]]) {
        r.box(x, 64, 11, 12, height, 32, 'white', 0xe2d0ac);
        r.box(x, 64, 7, 8, 2.5, 32 + height, 'white', 0xe2d0ac);
      }
    },
  },
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
  if (kitchen.kind === 'fast') fastKitchen(r, kitchen.spec, brand);
  else grillKitchen(r, kitchen.spec, brand);
}

/** Counter front colour of a food court kitchen: the brand's accent. */
export function counterTint(brand: FoodBrand): number {
  const kitchen = KITCHENS[brand];
  return kitchen.spec.accent;
}
