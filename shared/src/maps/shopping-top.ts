import { brandMat, STORE_BRANDS, type ShopBrand, type StoreBrand } from './brands.ts';
import type { MapBuilder } from './builder.ts';
import { LIFT_DOOR_HEIGHT_UNITS } from '../lift.ts';
import { BAY_ESCALATORS, BAY_FOOT_Z, BAY_TOP_Z, DECK, DECK3, FACADE_Z, GALLERY_Z, LIFT_MAX_X, LIFT_MAX_Z, LIFT_MIN_X, LIFT_MIN_Z, LIFT_WALL, RAIL, ROOF, SLAB, TOP_X, X, Z } from './shopping-levels.ts';
import { Room } from './room.ts';
import { dressStore, storeAccent, STORE_HALF_WIDTH } from './shopping-stores.ts';
import type { EscalatorTravel } from './types.ts';

/**
 * The top floor of Shopping Sul Rio, "Mirante": a gallery over the food court that looks out over the atrium, with a
 * supply stand in the middle. Authored for the north half inside `b.mirrored`. Two stair bays at the ends of the strip
 * (escalators between the food court deck and the top floor) and the glass lift near the middle connect it.
 */

/** Doorway in the front rail for the lift: the shaft walls stand just outside it. */
export const LIFT_GAP_HALF = 62;
/** Landing under the cab's floor at each upper stop (the cab's floor tops out half a unit above the stop, so the two never share a surface). */
const LANDING_THICKNESS = 4;
const HOPPABLE_HEDGE = 10;
const LOW_HEDGE = 22;
const BOARD = 104;
const PAINT = 0xe9edf2;

/** Where the supply stand is, on the middle of the north half of the top floor. */
export const SUPPLY_STAND = { x: 0, z: -880 } as const;

const ESCALATOR_SIDE = 80;

/** Escalator climbing toward -z from the deck to the top floor, with glass sides and a dark handrail. */
export function bayEscalator(b: MapBuilder, x1: number, x2: number, travel: EscalatorTravel): void {
  b.escalator(x1, x2, BAY_TOP_Z, BAY_FOOT_Z, '-z', DECK3 - DECK, travel, 'metal', DECK);
  const steps = Math.ceil((DECK3 - DECK) / 16);
  const depth = (BAY_FOOT_Z - BAY_TOP_Z) / steps;
  for (let i = 0; i < steps; i++) {
    const top = DECK + ((DECK3 - DECK) * (i + 1)) / steps;
    const near = BAY_FOOT_Z - depth * i;
    const far = near - depth;
    for (const [a, c] of [[x1 - 6, x1], [x2, x2 + 6]] as const) {
      b.add(a, top, far, c, top + ESCALATOR_SIDE, near, 'glass', { shoot: true });
      b.deco(a - 2, top + ESCALATOR_SIDE, far, c + 2, top + ESCALATOR_SIDE + 4, near, 'charcoal');
    }
  }
}

function glassRail(b: MapBuilder, x1: number, z1: number, x2: number, z2: number): void {
  b.add(x1, DECK3, z1, x2, DECK3 + RAIL, z2, 'glass', { shoot: true });
  b.deco(x1 - 1, DECK3 + RAIL, z1 - 1, x2 + 1, DECK3 + RAIL + 4, z2 + 1, 'charcoal');
}

function planter(b: MapBuilder, x: number, z: number, w: number, d: number, hedge = HOPPABLE_HEDGE): void {
  b.block(x, z, w, d, 26, 'tile', DECK3, { tint: 0xd8d2c4 });
  b.block(x, z, w - 8, d - 8, hedge, 'plant', DECK3 + 26);
}

function board(b: MapBuilder, x: number, z: number, length: number, brand: StoreBrand): void {
  b.block(x, z, 20, length, BOARD, 'white', DECK3, { tint: PAINT });
  b.deco(x - 10.6, DECK3 + BOARD * 0.4, z - length * 0.45, x + 10.6, DECK3 + BOARD * 0.4 + length * 0.45, z + length * 0.45, brandMat(brand));
}

/** A lounge sofa with its back to `back` (-1 toward -z, 1 toward +z). */
function sofa(b: MapBuilder, x: number, z: number, back: -1 | 1): void {
  b.block(x, z, 150, 54, 24, 'sofa', DECK3);
  b.block(x, z + back * 22, 150, 10, 46, 'sofa', DECK3 + 24);
  for (const side of [-1, 1]) b.block(x + side * 70, z, 10, 54, 40, 'sofa', DECK3 + 24);
}

/** The stand, a low dais with waist-high planters beside it that a crouching player hides behind: strong to take, but in the open. */
function supplyStand(b: MapBuilder): void {
  const { x, z } = SUPPLY_STAND;
  b.block(x, z, 104, 104, 10, 'tile', DECK3, { tint: 0x2b2f36 });
  for (const [dx, dz] of [[-96, -40], [96, -40], [-96, 40], [96, 40]] as const) planter(b, x + dx, z + dz, 40, 80, LOW_HEDGE);
  b.supply(x, DECK3, z);
  b.light(x, DECK3 + 120, z, '#b6ff4a');
  b.landmark('Suprimentos do Mirante', x, z);
}

function lounge(b: MapBuilder): void {
  b.block(0, -Z + 62, 520, 40, 44, 'desk', DECK3, { tint: 0xe2d6bf });
  b.deco(-264, DECK3 + 44, -Z + 40, 264, DECK3 + 48, -Z + 84, 'white', 0x3a2a1c);
  b.deco(-240, DECK3 + 110, -Z + 2, 240, DECK3 + 190, -Z + 4, brandMat('cacau-chou'));
  b.landmark('Café do Mirante', 0, -Z + 62);
  b.interior(0, DECK3, -Z + 122);
  const x = 912;
  sofa(b, x, -Z + 62, -1);
  sofa(b, x + 220, -Z + 62, -1);
  b.block(x + 110, -Z + 122, 60, 60, 26, 'wood', DECK3, { tint: 0xb98a58 });
  for (const [x, z, brand] of [[-1120, -1184, 'zarra'], [-320, -1248, 'cea'], [320, -1344, 'hew'], [1120, -1216, 'rener']] as const) {
    board(b, x, z, 168, brand);
  }
  sofa(b, 510, -1140, 1);
  sofa(b, 880, -1210, -1);
  b.block(696, -1160, 100, 60, 26, 'wood', DECK3);
  b.interior(696, DECK3, -1090);
  b.deco(-TOP_X, DECK3, -Z, TOP_X, DECK3 + 96, -Z + 2, 'white', 0xbfd8d0);
  b.deco(-TOP_X, DECK3 + 96, -Z, TOP_X, DECK3 + 100, -Z + 3, 'charcoal');
  for (const [x, brand] of [[-1000, 'zarra'], [560, 'travessura'], [1000, 'hew']] as const) {
    b.deco(x - 90, DECK3 + 120, -Z, x + 90, DECK3 + 200, -Z + 2, brandMat(brand));
  }
  for (const x of [-1000, -500, 0, 500, 1000]) b.deco(x - 120, ROOF - 3, -Z + 40, x + 120, ROOF, -700, 'white', 0xfff6df);
  b.deco(-X + 2, DECK3 + 90, -1000, -X + 4, DECK3 + 250, -820, 'logo');
  b.deco(X - 4, DECK3 + 90, -1000, X - 2, DECK3 + 250, -820, 'eitri');
}

/** Short ad panels interrupt standing sightlines, with low planters between them. */
function cover(b: MapBuilder): void {
  const boards: readonly (readonly [number, number, StoreBrand])[] = [
    [-1080, -822, 'burguer-rei'], [-576, -780, 'hew'],
    [-304, -974, 'cea'], [430, -800, 'rener'], [304, -990, 'amerikanas'],
    [680, -980, 'mequi'], [1080, -832, 'parrilha'],
  ];
  for (const [x, z, brand] of boards) board(b, x, z, 108, brand);
  for (const [x, z] of [[-1000, -704], [-320, -704], [320, -704], [1000, -704]] as const) {
    planter(b, x, z, 118, 36, 58);
  }
  for (const [x, z] of [[-880, -780], [560, -880], [880, -780]] as const) {
    planter(b, x, z, 28, 120, 66);
  }
  for (const x of [-250, 250]) {
    planter(b, x, -780, 28, 88);
  }
}

/** Pillars that carry the roof; the food court ones below carry this slab. */
function pillars(b: MapBuilder): void {
  for (const px of [-760, -200, 200, 760]) b.block(px, -696, 40, 40, ROOF - DECK3, 'white', DECK3);
}

function bay(b: MapBuilder, x1: number, x2: number, travel: EscalatorTravel, sign: 1 | -1): void {
  bayEscalator(b, x1, x2, travel);
  const inner = sign * TOP_X;
  const wall = sign * X;
  b.add(Math.min(inner, wall), DECK, -Z, Math.max(inner, wall), DECK3, BAY_TOP_Z, 'tile', { tint: 0xd8d2c4 });
  b.landmark(sign > 0 ? 'Escada rolante para o Mirante' : 'Escada rolante do Mirante', (x1 + x2) / 2, BAY_FOOT_Z - 104);
  const [lo, hi] = sign > 0 ? [inner - 4, inner] : [inner, inner + 4];
  glassRail(b, lo, GALLERY_Z, hi, BAY_TOP_Z);
  for (const [a, c] of sign > 0 ? [[TOP_X, x1 - 6], [x2 + 6, X]] as const : [[-X, x1 - 6], [x2 + 6, -TOP_X]] as const) {
    glassRail(b, a, BAY_TOP_Z - 4, c, BAY_TOP_Z);
  }
}

/**
 * The glass lift: a shaft of glass walls against the atrium edge, the field that carries riders, and the prop that
 * draws the cab. Ground floor riders get in from the atrium; the doorways of the food court and the Mirante open
 * onto their floors across the edge, where the rails leave a gap.
 */
function liftShaft(b: MapBuilder): void {
  const doorTop = LIFT_DOOR_HEIGHT_UNITS;
  const wall = (x1: number, z1: number, x2: number, z2: number, y1: number, y2: number): void => b.add(x1, y1, z1, x2, y2, z2, 'glass', { shoot: true });
  const x0 = LIFT_MIN_X - LIFT_WALL;
  const x1 = LIFT_MAX_X + LIFT_WALL;
  const zFront = LIFT_MIN_Z - LIFT_WALL;
  const zBack = LIFT_MAX_Z + LIFT_WALL;
  wall(x0, zFront, LIFT_MIN_X, zBack, 0, ROOF);
  wall(LIFT_MAX_X, zFront, x1, zBack, 0, ROOF);
  wall(x0, LIFT_MAX_Z, x1, zBack, doorTop, ROOF);
  wall(x0, zFront, x1, LIFT_MIN_Z, 0, DECK);
  wall(x0, zFront, x1, LIFT_MIN_Z, DECK + doorTop, DECK3);
  wall(x0, zFront, x1, LIFT_MIN_Z, DECK3 + doorTop, ROOF);
  b.deco(x0 - 2, ROOF, zFront - 2, x1 + 2, ROOF + 4, zBack + 2, 'charcoal');
  // A solid landing at each upper stop, so the doorway never opens onto an empty shaft while the cab is elsewhere. The cab carries riders through it.
  for (const stop of [DECK, DECK3]) b.add(LIFT_MIN_X, stop - LANDING_THICKNESS, LIFT_MIN_Z, LIFT_MAX_X, stop, LIFT_MAX_Z, 'tile');
  b.lift(LIFT_MIN_X, LIFT_MIN_Z, LIFT_MAX_X, LIFT_MAX_Z, [0, DECK, DECK3]);
  b.prop({
    kind: 'lift', x: (LIFT_MIN_X + LIFT_MAX_X) / 2, z: (LIFT_MIN_Z + LIFT_MAX_Z) / 2, yaw: 0,
    width: LIFT_MAX_X - LIFT_MIN_X, depth: LIFT_MAX_Z - LIFT_MIN_Z, height: ROOF,
    stops: [{ y: 0, side: 'back' }, { y: DECK, side: 'front' }, { y: DECK3, side: 'front' }],
  });
  b.landmark('Elevador panorâmico', 0, (LIFT_MIN_Z + LIFT_MAX_Z) / 2);
}

/** The pharmacy's middle: it fills the gallery's north-west corner between the lounge and the escalator bay. */
const PHARMACY_X = -730;
const PHARMACY_HEIGHT = 176;
const PHARMACY_LAMP_Y = 160;

const PHARMACY_WHITE = 0xeef2f6;
const PHARMACY_BLUE = 0x1f4fa8;
const PHARMACY_GREEN = 0x2f9e44;
const SIGN_WIDTH = 180;
/** Height of the doorway under the lintel; the full shop width stays walkable below it. */
const DOORWAY_HEIGHT = 132;
const LINTEL_TRIM = 14;
const COUNTER_DEPTH = 142;
const COUNTER_HEIGHT = 56;
const WALL_FACE = STORE_HALF_WIDTH - 6;
const POSTER_DEPTHS = [44, 178, 236] as const;

/** A green cross of three adjoining rectangles (so no two faces share a plane), on a plane facing +z at `z` (centred on x, y). */
function crossFacingFront(b: MapBuilder, x: number, y: number, z: number, arm: number): void {
  const bar = arm / 3;
  b.deco(x - bar / 2, y + bar / 2, z, x + bar / 2, y + arm / 2, z + 1, 'white', PHARMACY_GREEN);
  b.deco(x - arm / 2, y - bar / 2, z, x + arm / 2, y + bar / 2, z + 1, 'white', PHARMACY_GREEN);
  b.deco(x - bar / 2, y - arm / 2, z, x + bar / 2, y - bar / 2, z + 1, 'white', PHARMACY_GREEN);
}

/** The same cross on a side wall, facing the shop's middle. */
function crossFacingMiddle(b: MapBuilder, x1: number, x2: number, y: number, z: number, arm: number): void {
  const bar = arm / 3;
  b.deco(x1, y + bar / 2, z - bar / 2, x2, y + arm / 2, z + bar / 2, 'white', PHARMACY_GREEN);
  b.deco(x1, y - bar / 2, z - arm / 2, x2, y + bar / 2, z + arm / 2, 'white', PHARMACY_GREEN);
  b.deco(x1, y - arm / 2, z - bar / 2, x2, y - bar / 2, z + bar / 2, 'white', PHARMACY_GREEN);
}

/** Brand sign on a lintel across the open entrance, clear of the doorway below it. */
function pharmacyFacade(b: MapBuilder, cx: number, brand: ShopBrand): void {
  const z = FACADE_Z + 8;
  const half = STORE_HALF_WIDTH + 8;
  const signBottom = DECK3 + DOORWAY_HEIGHT + 10;
  b.deco(cx - half, DECK3 + DOORWAY_HEIGHT, z, cx + half, signBottom + SIGN_WIDTH / 2 + LINTEL_TRIM, z + 2, 'white', PHARMACY_WHITE);
  b.deco(cx - half, DECK3 + DOORWAY_HEIGHT, z + 2, cx + half, DECK3 + DOORWAY_HEIGHT + 6, z + 3, 'white', PHARMACY_BLUE);
  b.deco(cx - SIGN_WIDTH / 2, signBottom, z + 2, cx + SIGN_WIDTH / 2, signBottom + SIGN_WIDTH / 2, z + 4, brandMat(brand));
  for (const side of [-1, 1]) crossFacingFront(b, cx + side * 140, signBottom + SIGN_WIDTH / 4, z + 2, 44);
}

/** A dispensing counter with a worktop, a front panel in the brand colour and a cross, instead of one flat slab. */
function pharmacyCounter(b: MapBuilder, x: number, brand: ShopBrand): void {
  const z = -Z + COUNTER_DEPTH;
  const width = 120;
  b.block(x, z, width, 24, COUNTER_HEIGHT, 'white', DECK3, { tint: PHARMACY_WHITE });
  const frontZ = z + 12;
  const top = DECK3 + COUNTER_HEIGHT;
  b.deco(x - width / 2 - 2, top, z - 14, x + width / 2 + 2, top + 3, frontZ + 3, 'white', 0xcfd6de);
  b.deco(x - width / 2 + 6, DECK3 + 8, frontZ, x + width / 2 - 6, top - 8, frontZ + 1, 'white', storeAccent(brand));
  crossFacingFront(b, x, DECK3 + COUNTER_HEIGHT / 2, frontZ + 1, 26);
}

/** Posters, a tinted band and a baseboard along both side walls. */
function pharmacySideWalls(b: MapBuilder, cx: number): void {
  const poster = { width: 44, bottom: 96, height: 62 };
  for (const side of [-1, 1]) {
    const inner = cx + side * WALL_FACE;
    const outer = inner + side * 3;
    const lo = Math.min(inner, outer);
    const hi = Math.max(inner, outer);
    b.deco(lo, DECK3, -Z + 8, hi, DECK3 + 10, FACADE_Z - 8, 'white', PHARMACY_BLUE);
    b.deco(lo, DECK3 + 78, -Z + 8, hi, DECK3 + 90, FACADE_Z - 8, 'white', PHARMACY_BLUE);
    for (const depth of POSTER_DEPTHS) {
      const z = -Z + depth;
      b.deco(lo, DECK3 + poster.bottom, z - poster.width / 2, hi, DECK3 + poster.bottom + poster.height, z + poster.width / 2, 'white', PHARMACY_WHITE);
      crossFacingMiddle(b, inner - side * 1, inner, DECK3 + poster.bottom + poster.height / 2, z, 30);
    }
  }
}

/** A rug and a stripe leading from the entrance to the counters. */
function pharmacyFloor(b: MapBuilder, cx: number): void {
  b.deco(cx - 120, DECK3 + 1, -Z + 168, cx + 120, DECK3 + 2, -Z + 258, 'white', 0x9fb4cf);
  b.deco(cx - 110, DECK3 + 2, -Z + 176, cx + 110, DECK3 + 3, -Z + 250, 'white', PHARMACY_BLUE);
  b.deco(cx - 100, DECK3 + 3, -Z + 184, cx + 100, DECK3 + 4, -Z + 242, 'white', 0xdfe8f2);
  b.deco(cx - 14, DECK3 + 1, -Z + 70, cx + 14, DECK3 + 2, -Z + 168, 'white', 0x9fb4cf);
}

/** An open storefront with short returns framing the pharmacy displays. */
function pharmacyShop(b: MapBuilder, brand: ShopBrand): void {
  const cx = PHARMACY_X;
  const edge = STORE_HALF_WIDTH + 8;
  const returnWidth = 64;
  for (const side of [-1, 1]) {
    const wallX = cx + side * edge;
    b.wallZ(-Z, FACADE_Z, wallX, 16, PHARMACY_HEIGHT, 'white', [], DECK3);
    b.block(wallX - side * returnWidth / 2, FACADE_Z, returnWidth, 16, PHARMACY_HEIGHT, 'white', DECK3);
    pharmacyCounter(b, cx + side * 150, brand);
  }
  b.block(cx, -Z + 52, 140, 36, 40, 'desk', DECK3);
  dressStore(new Room(b, cx, DECK3, -Z), brand);
  pharmacyFacade(b, cx, brand);
  pharmacySideWalls(b, cx);
  pharmacyFloor(b, cx);
  b.light(cx - 250, DECK3 + PHARMACY_LAMP_Y, -Z + 220, '#ffe9bd');
  b.interior(cx, DECK3, -Z + 142);
  b.landmark(`${STORE_BRANDS[brand].name} (Mirante)`, cx, -Z + 152);
}

export function topFloor(b: MapBuilder, pharmacy: ShopBrand): void {
  liftShaft(b);
  b.add(-TOP_X, DECK3 - SLAB, -Z, TOP_X, DECK3, GALLERY_Z, 'tile');
  b.deco(-TOP_X, DECK3 - SLAB, GALLERY_Z, TOP_X, DECK3 - SLAB + 4, GALLERY_Z + 3);
  glassRail(b, -TOP_X, GALLERY_Z - 4, -LIFT_GAP_HALF, GALLERY_Z);
  glassRail(b, LIFT_GAP_HALF, GALLERY_Z - 4, TOP_X, GALLERY_Z);
  for (const { x1, x2, travel } of BAY_ESCALATORS) bay(b, x1, x2, travel, x1 > 0 ? 1 : -1);
  for (const [x, z] of [[-1104, -706], [-480, -722], [304, -706], [912, -722], [-352, -1120], [720, -1280]] as const) {
    b.block(x, z, 200, 20, BOARD, 'white', DECK3, { tint: PAINT });
  }
  supplyStand(b);
  lounge(b);
  pharmacyShop(b, pharmacy);
  cover(b);
  pillars(b);
  for (const x of [-1100, 550, 1100]) b.prop({ kind: 'ceilingFan', x, y: ROOF - 48, z: -880, radius: 44 });
}
