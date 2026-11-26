import { brandMat, type StoreBrand } from './brands.ts';
import type { KioskBrand, StaffRole } from './staff.ts';
import type { MapBuilder } from './builder.ts';
import { trimSolid } from './shopping-deck-walls.ts';
import { BAY_ESCALATORS, BAY_FOOT_Z, BAY_TOP_Z, DECK, DECK3, FACADE_Z, GALLERY_Z, X } from './shopping-levels.ts';

/**
 * Cover that breaks the long clean shots of Shopping Sul Rio: ad boards in the covered gallery, a car promotion, an
 * information desk, planters, info totems, small closed kiosks and ad screens in the atrium, menu boards and hedges in
 * the food court.
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
/** An ad panel is drawn whole on each of its faces, so one thin box carries the sign on both sides of a board. */
function adPanel(b: MapBuilder, x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, brand: StoreBrand): void {
  b.deco(x1, y1, z1, x2, y2, z2, brandMat(brand));
}

/** A free-standing board across the walkway: a thin slab long in z with the same ad on both faces. */
function board(b: MapBuilder, x: number, z: number, length: number, y0: number, height: number, brand: StoreBrand, tint = PAINT): void {
  b.block(x, z, 20, length, height, 'white', y0, { tint });
  adPanel(b, x - 10.6, y0 + height * 0.4, z - length * 0.45, x + 10.6, y0 + height * 0.4 + length * 0.45, z + length * 0.45, brand);
}

/** A freestanding directory with an ad above its screen. */
function infoTotem(b: MapBuilder, x: number, z: number, brand: StoreBrand): void {
  b.block(x, z, 56, 48, 12, 'tile');
  b.block(x, z, 46, 36, 200, 'white', 12, { tint: PAINT });
  b.deco(x - 20, 60, z - 18.6, x + 20, 106, z + 18.6, 'screen');
  adPanel(b, x - 20, 118, z - 18.6, x + 20, 138, z + 18.6, brand);
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

/**
 * A red compact hatchback on a display stand. The two solids (body and cabin) are the cover; everything else is look only:
 * painted pillars and roof, glass set into the sides, bumpers, grille, lamps, mirrors and wheels rounded from two crossed boxes.
 */
function carStand(b: MapBuilder, x: number, z: number, displayCar: boolean): void {
  b.block(x, z, 300, 170, 8, 'tile', 0, { tint: 0x2b2f36 });
  if (displayCar) redHatchback(b, x, z);
  b.block(x, z - 96, 300, 14, WALL, 'white', 0, { tint: 0x1d2330 });
  adPanel(b, x - 110, 62, z - 88.6, x + 110, 62 + 110, z - 88.4, 'kfg');
  b.block(x - 140, z + 80, 10, 10, 90, 'charcoal', 8);
  b.block(x + 140, z + 80, 10, 10, 90, 'charcoal', 8);
}

function redHatchback(b: MapBuilder, x: number, z: number): void {
  const paint = 0xc4161c;
  const trim = 0x1b1d21;
  const glass = 0x2f4450;
  const zc = z + 6;
  b.block(x, zc, 140, 62, 22, 'metal', 14, { tint: paint });
  // hood sloping down to the nose and the hatch at the back
  b.deco(x + 30, 36, zc - 30, x + 70, 39, zc + 30, 'metal', paint);
  b.deco(x - 70, 36, zc - 30, x - 61, 44, zc + 30, 'metal', paint);
  b.block(x - 9, zc, 104, 52, 24, 'metal', 36, { tint: paint });
  // windshield and rear window stepped back like a rake, side glass set just proud of the cabin
  b.deco(x + 43, 37, zc - 24, x + 47, 52, zc + 24, 'glass', glass);
  b.deco(x + 38, 52, zc - 24, x + 43, 59, zc + 24, 'glass', glass);
  b.deco(x - 62, 40, zc - 24, x - 60, 57, zc + 24, 'glass', glass);
  for (const side of [-1, 1]) {
    const face = zc + side * 26;
    b.deco(x - 56, 40, face - 0.4, x - 12, 57, face + 0.4, 'glass', glass);
    b.deco(x - 8, 40, face - 0.4, x + 38, 57, face + 0.4, 'glass', glass);
    // door seam, handle and mirror
    b.deco(x - 10.5, 16, face - 0.5 + side * 5, x - 9.5, 35, face + 0.5 + side * 5, 'charcoal', trim);
    b.deco(x - 4, 31, face - 0.6 + side * 5, x + 4, 32.5, face + 0.6 + side * 5, 'metal', 0xc4cbd0);
    b.deco(x + 30, 38, face + side * 1, x + 36, 43, face + side * 6, 'metal', paint);
    // side skirt
    b.deco(x - 44, 14, face - 0.5 + side * 5, x + 44, 17, face + 0.5 + side * 5, 'charcoal', trim);
  }
  b.deco(x - 61, 60, zc - 24, x + 38, 61.5, zc + 24, 'metal', paint);
  // bumpers, grille and lamps
  b.deco(x + 70, 14, zc - 31, x + 74, 22, zc + 31, 'charcoal', trim);
  b.deco(x - 74, 14, zc - 31, x - 70, 22, zc + 31, 'charcoal', trim);
  b.deco(x + 70, 24, zc - 14, x + 71.5, 31, zc + 14, 'charcoal', trim);
  for (const side of [-1, 1]) {
    b.deco(x + 69, 29, zc + side * 23 - 6, x + 71.5, 34, zc + side * 23 + 6, 'white', 0xe7faff);
    b.deco(x - 71.5, 30, zc + side * 24 - 5, x - 69, 37, zc + side * 24 + 5, 'white', 0xe63d4b);
  }
  b.deco(x - 71.5, 24, zc - 8, x - 70, 28, zc + 8, 'white', 0xe9e9e9);
  // two crossed boxes per tyre read as round at a glance, with a wheel arch over each
  for (const wx of [-48, 50]) {
    for (const side of [-1, 1]) {
      const wheelZ = zc + side * 28;
      b.block(x + wx, wheelZ, 26, 9, 18, 'charcoal', 9);
      b.block(x + wx, wheelZ, 18, 9, 26, 'charcoal', 5);
      const hubZ = wheelZ + side * 4.6;
      b.deco(x + wx - 6, 12, hubZ - 0.5, x + wx + 6, 24, hubZ + 0.5, 'metal', 0xc4cbd0);
      b.deco(x + wx - 15, 30, wheelZ - 5, x + wx + 15, 32, wheelZ + 5, 'charcoal', trim);
    }
  }
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

/** Ad boards and benches set back into the covered promenade. */
function gallery(b: MapBuilder): void {
  kiosk(b, -1280, -880, 112, 210, 'zarra');
  kiosk(b, 860, -900, 112, 180, 'hew');
  for (const [x, brand] of [[-768, 'zarra'], [0, 'rener'], [768, 'hew']] as const) {
    const z = FACADE_Z + (x < 0 ? 208 : 232);
    board(b, x, z, 144, GALLERY_FLOOR, WALL, brand);
    bench(b, x + 64, z, 28, 96, false);
  }
  for (const [x, z] of [[-1120, -1024], [-560, -976], [160, -856], [1280, -960]] as const) {
    b.block(x, z, 220, 20, WALL, 'white', GALLERY_FLOOR, { tint: PAINT });
  }
  b.landmark('Galeria das lojas', 0, FACADE_Z + 160);
  board(b, -690, GALLERY_Z - 63, 110, GALLERY_FLOOR, WALL, 'cea');
}

/** A closed kiosk with shutters and a sign on its aisle side. */
function kiosk(b: MapBuilder, x: number, z: number, w: number, d: number, brand: StoreBrand): void {
  const front = z + d / 2;
  b.block(x, z, w, d, 136, 'white', 0, { tint: PAINT });
  b.deco(x - w / 2 - 3, 136, z - d / 2 - 3, x + w / 2 + 3, 140, front + 3, 'charcoal');
  b.deco(x - w / 2 + 8, 38, front, x + w / 2 - 8, 88, front + 2, 'metal');
  adPanel(b, x - 38, 92, front, x + 38, 130, front + 2, brand);
}

const SMALL_KIOSK = 80;
const SMALL_KIOSK_HEIGHT = 140;
const KIOSK_SCREEN_WIDTH = 56;
const KIOSK_SCREEN_HEIGHT = 28;
const KIOSK_SCREEN_Y = 72;
/** The aisle screen sits on the counter front, under the serving window. */
const KIOSK_SCREEN_Y_FRONT = 26;
/** Screens stand this far off the face they hang on, so the face never shows through them. */
const SCREEN_GAP = 0.8;
const BEZEL = 3;
const SCREEN_BODY = 0x1d2330;

/** A dark bezel on a face at `faceZ` and the ad screen prop just off it, on the side `dir` (+1 faces +z, -1 faces -z). */
function adScreenOn(b: MapBuilder, x: number, y: number, faceZ: number, dir: 1 | -1, width: number, height: number): void {
  b.deco(x - width / 2 - BEZEL, y - height / 2 - BEZEL, Math.min(faceZ, faceZ + dir * 0.5), x + width / 2 + BEZEL, y + height / 2 + BEZEL, Math.max(faceZ, faceZ + dir * 0.5), 'charcoal');
  b.prop({ kind: 'adScreen', x, y, z: faceZ + dir * SCREEN_GAP, yaw: dir > 0 ? Math.PI : 0, width, height });
}

const KIOSK_WALL = 4;
/** The serving counter stands above the 45 unit jump, like the boutique tills. */
const KIOSK_COUNTER_HEIGHT = 52;
/** The serving window runs from the counter up to the header that carries the sign. */
const KIOSK_WINDOW_TOP = 98;
const KIOSK_ROOF = 4;
/** The attendant stands this far toward the window from the kiosk's centre, so a reach brings the hands near the counter. */
const KIOSK_STAFF_FORWARD = 14;

/**
 * A small kiosk nobody can enter: solid back and side walls, a counter above jump height with a serving window over it
 * on the aisle side (+z), a header with the brand, a roof, and an invisible solid `clip` box over the whole inside, so
 * the attendant can be seen working but nobody climbs in. An ad screen hangs on the counter front and on the back wall.
 */
function smallKiosk(b: MapBuilder, x: number, z: number, brand: KioskBrand, role: StaffRole, tint: number): void {
  const half = SMALL_KIOSK / 2;
  const front = z + half;
  const body = { tint: PAINT };
  b.block(x, z - half + KIOSK_WALL / 2, SMALL_KIOSK, KIOSK_WALL, SMALL_KIOSK_HEIGHT, 'white', 0, body);
  for (const side of [-1, 1]) b.block(x + side * (half - KIOSK_WALL / 2), z, KIOSK_WALL, SMALL_KIOSK, SMALL_KIOSK_HEIGHT, 'white', 0, body);
  b.block(x, front - KIOSK_WALL / 2, SMALL_KIOSK, KIOSK_WALL, KIOSK_COUNTER_HEIGHT, 'white', 0, body);
  b.block(x, front - KIOSK_WALL / 2, SMALL_KIOSK, KIOSK_WALL, SMALL_KIOSK_HEIGHT - KIOSK_WINDOW_TOP, 'white', KIOSK_WINDOW_TOP, body);
  b.block(x, z, SMALL_KIOSK, SMALL_KIOSK, KIOSK_ROOF, 'white', SMALL_KIOSK_HEIGHT - KIOSK_ROOF, body);
  b.add(x - half, 0, z - half, x + half, SMALL_KIOSK_HEIGHT - KIOSK_ROOF, z + half, 'clip', { visible: false, shoot: true });
  b.deco(x - half - 4, SMALL_KIOSK_HEIGHT, z - half - 4, x + half + 4, SMALL_KIOSK_HEIGHT + 6, z + half + 4, 'white', tint);
  b.deco(x - half - 2, KIOSK_COUNTER_HEIGHT, front - KIOSK_WALL, x + half + 2, KIOSK_COUNTER_HEIGHT + 3, front + 8, 'wood', 0xb98a58);
  adPanel(b, x - 34, 100, front, x + 34, 134, front + 1, brand);
  adScreenOn(b, x, KIOSK_SCREEN_Y_FRONT, front, 1, KIOSK_SCREEN_WIDTH, KIOSK_SCREEN_HEIGHT);
  adScreenOn(b, x, KIOSK_SCREEN_Y + 20, z - half, -1, KIOSK_SCREEN_WIDTH, KIOSK_SCREEN_HEIGHT);
  b.prop({ kind: 'staff', x, y: 0, z: z + KIOSK_STAFF_FORWARD, yaw: Math.PI, role, uniform: brand });
}

const AD_TOTEM_WIDTH = 64;
const AD_TOTEM_DEPTH = 16;
const AD_TOTEM_HEIGHT = 190;
const AD_TOTEM_SCREEN_Y = 130;

/** A slim freestanding LED totem: a dark slab with an ad screen on each face. */
function adTotem(b: MapBuilder, x: number, z: number): void {
  b.block(x, z, AD_TOTEM_WIDTH + 12, AD_TOTEM_DEPTH + 12, 8, 'tile');
  b.block(x, z, AD_TOTEM_WIDTH, AD_TOTEM_DEPTH, AD_TOTEM_HEIGHT, 'white', 8, { tint: SCREEN_BODY });
  const width = AD_TOTEM_WIDTH - 10;
  for (const dir of [1, -1] as const) adScreenOn(b, x, AD_TOTEM_SCREEN_Y, z + (dir * AD_TOTEM_DEPTH) / 2, dir, width, width / 2);
}

function atrium(b: MapBuilder, displayCar: boolean): void {
  kiosk(b, 370, -530, 96, 120, 'cacau-chou');
  planter(b, -1376, -316, 64, 112);
  infoTotem(b, 1440, -416, 'rener');
  bench(b, 672, -64, 96, 30, true);
  carStand(b, 860, -250, displayCar);
  infoDesk(b, -300, -560);
  cart(b, 1000, -620, 'cacau-chou', 0x6a3a1c);
  cart(b, -1180, -80, 'cea', 0x0050a0);

  smallKiosk(b, -640, -120, 'bobis', 'server', 0xd9a520);
  smallKiosk(b, -1350, -470, 'travessura', 'cashier', 0x2f6f4e);
  smallKiosk(b, -110, -350, 'mequi', 'server', 0xd7263d);
  smallKiosk(b, 1340, -180, 'kfg', 'server', 0xc8102e);
  adTotem(b, -780, -330);
  adTotem(b, 220, -440);

  planter(b, -1010, -340, 200, 44);
  planter(b, 528, -150, 130, 44);
  planter(b, 820, -540, 170, 44);
  planter(b, -1180, -620, 44, 150);

  bench(b, -360, -70, 130, 30, true);
  bench(b, 380, -80, 130, 30, true);
  bench(b, 1180, -140, 30, 130, false);

  for (const [x, z, brand] of [
    [-1160, -380, 'zarra'], [-700, -600, 'hew'], [350, -360, 'travessura'],
    [1260, -560, 'amerikanas'], [-1300, -180, 'cea'], [1250, -60, 'rener'],
  ] as const) infoTotem(b, x, z, brand);
}

const MENU_BOARD_HEIGHT = 140;
const MENU_BOARD_TINT = 0xd9c7a3;
/** The menu sign is a 2:1 panel that fits between the trim's rail and its dark head, so the trim never covers it. */
const MENU_SIGN_BOTTOM = 70;
const MENU_SIGN_HEIGHT = 54;

/** A food court menu board: a tan slab long in z that wears the deck's trim like the walls and pillars, with its sign between rail and head. */
function menuBoard(b: MapBuilder, x: number, z: number, length: number, brand: StoreBrand): void {
  b.block(x, z, 20, length, MENU_BOARD_HEIGHT, 'white', DECK, { tint: MENU_BOARD_TINT });
  trimSolid(b, x, z, 20, length, MENU_BOARD_HEIGHT);
  const y1 = DECK + MENU_SIGN_BOTTOM;
  adPanel(b, x - 10.6, y1, z - MENU_SIGN_HEIGHT, x + 10.6, y1 + MENU_SIGN_HEIGHT, z + MENU_SIGN_HEIGHT, brand);
}

function foodCourt(b: MapBuilder): void {
  for (const [x, brand] of [[-600, 'mania-picanha'], [600, 'mequi']] as const) menuBoard(b, x, -795, 120, brand);
  for (const [x, z, brand] of [[-960, -1080, 'kfg'], [-384, -1232, 'outbaque'], [128, -992, 'bobis'], [784, -1224, 'madeiro']] as const) {
    menuBoard(b, x, z, 156, brand);
  }
  for (const [x, z, brand] of [[-1170, -804, 'kfg'], [-750, -736, 'outbaque'], [690, -915, 'bobis'], [1220, -844, 'madeiro']] as const) {
    menuBoard(b, x, z, 120, brand);
  }
  for (const [x, z] of [[-1120, -1240], [-464, -944], [240, -1216], [1056, -1032]] as const) {
    b.block(x, z, 192, 20, 112, 'white', DECK, { tint: PAINT });
    trimSolid(b, x, z, 192, 20, 112);
  }
  // nothing stands outside the lift doorway at x = 0
  for (const x of [-1000, -320, 320, 1000]) planter(b, x, -704, 160, 28, DECK);
}

const BIN_SIDE = 28;
const BIN_HEIGHT = 46;
/** Escalator glass sides are 6 units thick; a bin set flush against one leaves no pocket a walker could wedge into. */
const ESCALATOR_GLASS = 6;
const BIN_BESIDE_GLASS = ESCALATOR_GLASS + BIN_SIDE / 2;

const BIN_STEEL = 0xc2c8ce;
const BIN_LID_HEIGHT = 6;
const BIN_FLAP_WIDTH = 16;
const BIN_FLAP_HEIGHT = 11;

/**
 * A mall waste bin: a brushed steel body with a dark lid and a dark swing flap on every side, waist-low so it
 * blocks walking but not a shot. The body is the solid, the rest is decoration.
 */
function trashBin(b: MapBuilder, x: number, z: number, y0 = 0, width = BIN_SIDE): void {
  const half = BIN_SIDE / 2;
  const halfW = width / 2;
  const top = y0 + BIN_HEIGHT;
  b.block(x, z, width, BIN_SIDE, BIN_HEIGHT - BIN_LID_HEIGHT, 'metal', y0, { tint: BIN_STEEL });
  b.deco(x - halfW - 1, top - BIN_LID_HEIGHT, z - half - 1, x + halfW + 1, top, z + half + 1, 'charcoal');
  const flap = BIN_FLAP_WIDTH / 2;
  const flapTop = top - BIN_LID_HEIGHT - 3;
  const flapBottom = flapTop - BIN_FLAP_HEIGHT;
  b.deco(x - flap, flapBottom, z - half - 1, x + flap, flapTop, z - half, 'charcoal');
  b.deco(x - flap, flapBottom, z + half, x + flap, flapTop, z + half + 1, 'charcoal');
  b.deco(x - halfW - 1, flapBottom, z - flap, x - halfW, flapTop, z + flap, 'charcoal');
  b.deco(x + halfW, flapBottom, z - flap, x + halfW + 1, flapTop, z + flap, 'charcoal');
}

/** One bin at the foot of an atrium escalator, on its inner side against the glass. */
function escalatorBin(b: MapBuilder, x1: number, x2: number, footZ: number): void {
  const x = x1 + x2 < 0 ? x2 + BIN_BESIDE_GLASS : x1 - BIN_BESIDE_GLASS;
  trashBin(b, x, footZ + BIN_SIDE / 2);
}

/**
 * A bay escalator leaves a slit between its outer glass and the wall that is just wide enough to stand in. A bin
 * as wide as the slit, at its two ends, keeps anybody out of it.
 */
function slitBin(b: MapBuilder, x1: number, x2: number, z: number, y0: number): void {
  const [from, to] = x1 + x2 < 0 ? [-X, x1 - ESCALATOR_GLASS] : [x2 + ESCALATOR_GLASS, X];
  trashBin(b, (from + to) / 2, z, y0, to - from);
}

const ATRIUM_ESCALATORS = [{ x1: 480, x2: 576 }, { x1: -576, x2: -480 }] as const;
const ESCALATOR_FOOT_Z = -352;
const FOOD_COURT_BINS = [[-720, -870], [720, -870]] as const;

function bins(b: MapBuilder): void {
  for (const { x1, x2 } of ATRIUM_ESCALATORS) escalatorBin(b, x1, x2, ESCALATOR_FOOT_Z);
  for (const { x1, x2 } of BAY_ESCALATORS) {
    slitBin(b, x1, x2, BAY_FOOT_Z - BIN_SIDE / 2, DECK);
    slitBin(b, x1, x2, BAY_TOP_Z + BIN_SIDE / 2, DECK3);
  }
  for (const [x, z] of FOOD_COURT_BINS) trashBin(b, x, z, DECK);
}

export function coverShopping(b: MapBuilder, displayCar: boolean): void {
  gallery(b);
  atrium(b, displayCar);
  foodCourt(b);
  bins(b);
}
