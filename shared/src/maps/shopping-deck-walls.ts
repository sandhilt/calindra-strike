import { brandMat, type FoodBrand } from './brands.ts';
import type { MapBuilder } from './builder.ts';
import { BAY_FOOT_Z, BAY_TOP_Z, DECK, FOOD_CEILING, GALLERY_Z, X, Z } from './shopping-levels.ts';

/**
 * Finish of the food court's walls: end walls, back wall alcoves and the pillars. Everything is a thin
 * non-solid layer laid on the bare wall, so it costs a few boxes and changes nothing for movement or nav.
 * Authored for the north half, inside `b.mirrored`.
 */

/** A wall face: the plane it stands in, the way the room lies from it, and which axis the wall runs along. */
interface Face {
  readonly runsAlong: 'x' | 'z';
  readonly at: number;
  readonly inward: 1 | -1;
}

const BASEBOARD_HEIGHT = 12;
const WAINSCOT_TOP = 62;
const RAIL_HEIGHT = 4;
const CORNICE_HEIGHT = 14;
const PAINT_TOP = FOOD_CEILING - DECK - CORNICE_HEIGHT;
const PILASTER_WIDTH = 16;
const POSTER_Y0 = 94;
const POSTER_WIDTH = 112;
const POSTER_HEIGHT = POSTER_WIDTH / 2;
const POSTER_FRAME = 5;

const CREAM = 0xeadfc6;
const TERRACOTTA = 0x8d3b2a;
const DARK = 0x2a2522;
const OAK = 0x6b4a32;

/** Layer depths off the wall, in units: each one a little deeper than the one under it so faces never fight. */
const DEPTH = { paint: 1.5, wainscot: 2.5, rail: 4, pilaster: 5, cornice: 7, baseboard: 4, frame: 3, poster: 4 } as const;

/** A box lying on a face between two depths, along the wall from `a1` to `a2` and from `y1` to `y2` over the deck. */
function layer(b: MapBuilder, f: Face, a1: number, a2: number, y1: number, y2: number, depth: number, mat: Parameters<MapBuilder['deco']>[6], tint?: number): void {
  const d = f.at + f.inward * depth;
  const [lo, hi] = [DECK + y1, DECK + y2];
  if (f.runsAlong === 'z') b.deco(Math.min(f.at, d), lo, a1, Math.max(f.at, d), hi, a2, mat, tint);
  else b.deco(a1, lo, Math.min(f.at, d), a2, hi, Math.max(f.at, d), mat, tint);
}

function poster(b: MapBuilder, f: Face, center: number, y0: number, brand: FoodBrand): void {
  const half = POSTER_WIDTH / 2;
  layer(b, f, center - half - POSTER_FRAME, center + half + POSTER_FRAME, y0 - POSTER_FRAME, y0 + POSTER_HEIGHT + POSTER_FRAME, DEPTH.frame, 'white', DARK);
  layer(b, f, center - half, center + half, y0, y0 + POSTER_HEIGHT, DEPTH.poster, brandMat(brand));
}

/** Paint, a wainscot with a rail, a baseboard and a cornice over the stretch of wall between `a1` and `a2`. */
function dressWall(b: MapBuilder, f: Face, a1: number, a2: number): void {
  layer(b, f, a1, a2, BASEBOARD_HEIGHT, PAINT_TOP, DEPTH.paint, 'white', CREAM);
  layer(b, f, a1, a2, BASEBOARD_HEIGHT, WAINSCOT_TOP, DEPTH.wainscot, 'white', TERRACOTTA);
  layer(b, f, a1, a2, WAINSCOT_TOP, WAINSCOT_TOP + RAIL_HEIGHT, DEPTH.rail, 'wood', OAK);
  layer(b, f, a1, a2, 0, BASEBOARD_HEIGHT, DEPTH.baseboard, 'charcoal');
  layer(b, f, a1, a2, FOOD_CEILING - DECK - CORNICE_HEIGHT, FOOD_CEILING - DECK, DEPTH.cornice, 'white', DARK);
}

/** The skirt sits this far behind the pilaster, so where they overlap their front faces are not on one plane. */
const PILASTER_SKIRT_SETBACK = 0.5;

function pilaster(b: MapBuilder, f: Face, center: number): void {
  const half = PILASTER_WIDTH / 2;
  layer(b, f, center - half, center + half, BASEBOARD_HEIGHT, PAINT_TOP, DEPTH.pilaster, 'white', 0xd7c9a8);
  layer(b, f, center - half - 2, center + half + 2, BASEBOARD_HEIGHT, WAINSCOT_TOP, DEPTH.pilaster - PILASTER_SKIRT_SETBACK, 'white', 0x6f2c1f);
}

/** The open stretch of an end wall between the stair bay and the atrium edge; the bay's own wall is the Mirante's. */
const END_FROM = BAY_TOP_Z + 4;
const END_TO = GALLERY_Z - 8;
/** Pilasters and posters alternate along the stretch where the escalator does not hide the wall. */
const END_PILASTERS = [BAY_FOOT_Z - 4, -810, END_TO - PILASTER_WIDTH / 2];
const END_POSTER_ZS = [-875, -745];

function endWalls(b: MapBuilder, brands: readonly FoodBrand[]): void {
  const faces: readonly Face[] = [{ runsAlong: 'z', at: -X, inward: 1 }, { runsAlong: 'z', at: X, inward: -1 }];
  faces.forEach((f, side) => {
    dressWall(b, f, END_FROM, END_TO);
    for (const z of END_PILASTERS) pilaster(b, f, z);
    END_POSTER_ZS.forEach((z, i) => poster(b, f, z, POSTER_Y0, brands[(2 * side + i) % brands.length]));
  });
}

/** The back wall shows only in the alcoves between kitchens; each gets the finish and a poster over its booth. */
const KITCHEN_HALF_WIDTH = 160;
function backWall(b: MapBuilder, kitchenXs: readonly number[], boothXs: readonly number[], brands: readonly FoodBrand[]): void {
  const f: Face = { runsAlong: 'x', at: -Z, inward: 1 };
  boothXs.forEach((x, i) => {
    const from = kitchenXs[i] + KITCHEN_HALF_WIDTH;
    const to = kitchenXs[i + 1] - KITCHEN_HALF_WIDTH;
    dressWall(b, f, from, to);
    pilaster(b, f, from + PILASTER_WIDTH / 2);
    pilaster(b, f, to - PILASTER_WIDTH / 2);
    poster(b, f, x, POSTER_Y0 - 28, brands[i + 1]);
  });
}

const TRIM_COLLAR = 3;

/** A free-standing solid on the deck wears the same trim as the walls: dark foot, terracotta skirt, rail, dark head. */
export function trimSolid(b: MapBuilder, x: number, z: number, width: number, depth: number, height: number): void {
  const [rx, rz] = [width / 2 + TRIM_COLLAR, depth / 2 + TRIM_COLLAR];
  const ring = (y1: number, y2: number, mat: Parameters<MapBuilder['deco']>[6], tint?: number): void => {
    b.deco(x - rx, DECK + y1, z - rz, x + rx, DECK + y2, z + rz, mat, tint);
  };
  const headHeight = Math.min(CORNICE_HEIGHT, height - WAINSCOT_TOP - RAIL_HEIGHT);
  ring(0, BASEBOARD_HEIGHT, 'charcoal');
  ring(BASEBOARD_HEIGHT, WAINSCOT_TOP, 'white', TERRACOTTA);
  ring(WAINSCOT_TOP, WAINSCOT_TOP + RAIL_HEIGHT, 'wood', OAK);
  ring(height - headHeight, height, 'white', DARK);
}

const PILLAR_SIDE = 40;

export function dressDeckWalls(b: MapBuilder, o: { kitchenXs: readonly number[]; boothXs: readonly number[]; pillars: readonly (readonly [number, number])[]; brands: readonly FoodBrand[] }): void {
  endWalls(b, o.brands);
  backWall(b, o.kitchenXs, o.boothXs, o.brands);
  for (const [x, z] of o.pillars) trimSolid(b, x, z, PILLAR_SIDE, PILLAR_SIDE, FOOD_CEILING - DECK);
}
