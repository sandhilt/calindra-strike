import { brandMat, type StoreBrand } from './brands.ts';
import type { MapBuilder } from './builder.ts';
import { LIFT_DOOR_HEIGHT_UNITS } from '../lift.ts';
import { DECK, DECK3, GALLERY_Z, LIFT_MAX_X, LIFT_MAX_Z, LIFT_MIN_X, LIFT_MIN_Z, LIFT_WALL, RAIL, ROOF, SLAB, TOP_X, X, Z } from './shopping-levels.ts';
import type { EscalatorTravel } from './types.ts';

/**
 * The top floor of Shopping Sul Rio, "Mirante": a gallery over the food court that looks out over the atrium, with a
 * supply stand in the middle. Authored for the north half inside `b.mirrored`. Two stair bays at the ends of the strip
 * (escalators between the food court deck and the top floor) and the glass lift near the middle connect it.
 */

/** Doorway in the front rail for the lift: the shaft walls stand just outside it. */
export const LIFT_GAP_HALF = 62;
const HEDGE = 66;
const BOARD = 140;
const PAINT = 0xe9edf2;

/** Where the supply stand is, on the middle of the north half of the top floor. */
export const SUPPLY_STAND = { x: 0, z: -880 } as const;

const BAY_ESCALATORS = [
  { x1: 1264, x2: 1360, travel: 'up', name: 'Escada rolante para o Mirante' },
  { x1: -1360, x2: -1264, travel: 'down', name: 'Escada rolante do Mirante' },
] satisfies readonly { x1: number; x2: number; travel: EscalatorTravel; name: string }[];
const BAY_FOOT_Z = -756;
const BAY_TOP_Z = -1076;
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

function planter(b: MapBuilder, x: number, z: number, w: number, d: number): void {
  b.block(x, z, w, d, 26, 'tile', DECK3, { tint: 0xd8d2c4 });
  b.block(x, z, w - 8, d - 8, HEDGE, 'plant', DECK3 + 26);
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

/** The stand, a low round dais with hedges that stop a bullet but not a hand, so the supply can be taken in the open. */
function supplyStand(b: MapBuilder): void {
  const { x, z } = SUPPLY_STAND;
  b.block(x, z, 104, 104, 10, 'tile', DECK3, { tint: 0x2b2f36 });
  b.deco(x - 44, DECK3 + 10, z - 44, x + 44, DECK3 + 11, z + 44, 'lime');
  for (const [dx, dz] of [[-96, -40], [96, -40], [-96, 40], [96, 40]] as const) planter(b, x + dx, z + dz, 40, 80);
  b.supply(x, DECK3, z);
  b.light(x, DECK3 + 120, z, '#b6ff4a');
  b.landmark('Suprimentos do Mirante', x, z);
}

function lounge(b: MapBuilder): void {
  b.block(0, -1090, 520, 40, 44, 'desk', DECK3, { tint: 0xe2d6bf });
  b.deco(-264, DECK3 + 44, -1112, 264, DECK3 + 48, -1068, 'white', 0x3a2a1c);
  b.deco(-240, DECK3 + 110, -1150, 240, DECK3 + 190, -1148, brandMat('cacau-chou'));
  b.landmark('Café do Mirante', 0, -1090);
  for (const x of [-840, 840]) {
    sofa(b, x, -1090, -1);
    sofa(b, x + 220, -1090, -1);
    b.block(x + 110, -1030, 60, 60, 26, 'wood', DECK3, { tint: 0xb98a58 });
  }
  b.deco(-X + 2, DECK3 + 90, -1000, -X + 4, DECK3 + 250, -820, 'logo');
  b.deco(X - 4, DECK3 + 90, -1000, X - 2, DECK3 + 250, -820, 'eitri');
}

/** Boards and planters that break the long lanes along the gallery, alternating so no straight line gets through. */
function cover(b: MapBuilder): void {
  const boards: readonly (readonly [number, number, StoreBrand])[] = [
    [-1080, -840, 'burguer-rei'], [-700, -980, 'mania-picanha'], [-430, -800, 'hew'],
    [430, -800, 'rener'], [700, -980, 'mequi'], [1080, -840, 'parrilha'],
  ];
  for (const [x, z, brand] of boards) board(b, x, z, 120, brand);
  for (const x of [-1000, -320, 320, 1000]) planter(b, x, -704, 160, 28);
  for (const [x, z] of [[-560, -880], [560, -880]] as const) planter(b, x, z, 28, 120);
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
  b.landmark(sign > 0 ? 'Escada rolante para o Mirante' : 'Escada rolante do Mirante', (x1 + x2) / 2, -860);
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
  b.lift(LIFT_MIN_X, LIFT_MIN_Z, LIFT_MAX_X, LIFT_MAX_Z, [0, DECK, DECK3]);
  b.prop({
    kind: 'lift', x: (LIFT_MIN_X + LIFT_MAX_X) / 2, z: (LIFT_MIN_Z + LIFT_MAX_Z) / 2, yaw: 0,
    width: LIFT_MAX_X - LIFT_MIN_X, depth: LIFT_MAX_Z - LIFT_MIN_Z, height: ROOF,
    stops: [{ y: 0, side: 'back' }, { y: DECK, side: 'front' }, { y: DECK3, side: 'front' }],
  });
  b.landmark('Elevador panorâmico', 0, (LIFT_MIN_Z + LIFT_MAX_Z) / 2);
}

export function topFloor(b: MapBuilder): void {
  liftShaft(b);
  b.add(-TOP_X, DECK3 - SLAB, -Z, TOP_X, DECK3, GALLERY_Z, 'tile');
  b.deco(-TOP_X, DECK3 - SLAB, GALLERY_Z, TOP_X, DECK3 - SLAB + 4, GALLERY_Z + 3);
  glassRail(b, -TOP_X, GALLERY_Z - 4, -LIFT_GAP_HALF, GALLERY_Z);
  glassRail(b, LIFT_GAP_HALF, GALLERY_Z - 4, TOP_X, GALLERY_Z);
  for (const { x1, x2, travel } of BAY_ESCALATORS) bay(b, x1, x2, travel, x1 > 0 ? 1 : -1);
  supplyStand(b);
  lounge(b);
  cover(b);
  pillars(b);
  for (const x of [-1100, -550, 550, 1100]) b.prop({ kind: 'ceilingFan', x, y: ROOF - 48, z: -880, radius: 44 });
}
