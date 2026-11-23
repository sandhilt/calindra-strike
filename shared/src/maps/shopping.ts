import { brandMat, STORE_BRANDS, type FoodBrand, type ShopBrand } from './brands.ts';
import { MapBuilder } from './builder.ts';
import { coverShopping } from './shopping-cover.ts';
import { Room } from './room.ts';
import { buildKitchen, counterTint, KITCHEN_DEPTH, KITCHEN_FLOOR, KITCHEN_HEIGHT, KITCHEN_WIDTH } from './shopping-kitchens.ts';
import { DECK, DROP_HEIGHT, FACADE_Z, FOOD_CEILING, GALLERY_Z, RAIL, ROOF, SLAB, WALL, X, Z } from './shopping-levels.ts';
import { dressStore, storeAccent } from './shopping-stores.ts';
import { LIFT_GAP_HALF, topFloor } from './shopping-top.ts';
import type { EscalatorTravel, MapDef } from './types.ts';

/** The out-of-bounds column over the solid roof reaches this far above the skydive altitude (units). */
const ROOF_CLIP_MARGIN = 256;
const STORE_XS = [-1056, -352, 352, 1056] as const;
const ESCALATORS = [
  { x1: 480, x2: 576, travel: 'up', name: 'Escada rolante que sobe' },
  { x1: -576, x2: -480, travel: 'down', name: 'Escada rolante que desce' },
] satisfies readonly { x1: number; x2: number; travel: EscalatorTravel; name: string }[];
const ESCALATOR_FOOT_Z = -352;
/** Escalator sides rise higher still: a step two cells up must not reach the top of a lower panel with a jump. */
const ESCALATOR_SIDE = 80;

/** North half first, then the south half, which is the north one turned 180 degrees. */
const FOOD_COURT: readonly (readonly FoodBrand[])[] = [
  ['kfg', 'burguer-rei', 'mania-picanha', 'parrilha'],
  ['mequi', 'outbaque', 'madeiro', 'bobis'],
];
const STORES: readonly (readonly ShopBrand[])[] = [
  ['zarra', 'cea', 'rener', 'hew'],
  ['cacau-chou', 'amerikanas', 'riachuela', 'travessura'],
];

/** Escalator rising toward -z from the atrium floor to the food court, with glass sides and a dark handrail. The client moves the steps. */
function escalator(b: MapBuilder, x1: number, x2: number, travel: EscalatorTravel): void {
  b.escalator(x1, x2, GALLERY_Z, ESCALATOR_FOOT_Z, '-z', DECK, travel);
  const steps = Math.ceil(DECK / 16);
  const depth = (ESCALATOR_FOOT_Z - GALLERY_Z) / steps;
  for (let i = 0; i < steps; i++) {
    const top = (DECK * (i + 1)) / steps;
    const near = ESCALATOR_FOOT_Z - depth * i;
    const far = near - depth;
    for (const [a, c] of [[x1 - 6, x1], [x2, x2 + 6]] as const) {
      b.add(a, top, far, c, top + ESCALATOR_SIDE, near, 'glass', { shoot: true });
      b.deco(a - 2, top + ESCALATOR_SIDE, far, c + 2, top + ESCALATOR_SIDE + 4, near, 'charcoal');
    }
  }
}

function fountain(b: MapBuilder): void {
  const R = 160;
  const T = 24;
  b.add(-R, 0, -R, R, 36, -R + T, 'tile');
  b.add(-R, 0, R - T, R, 36, R, 'tile');
  b.add(-R, 0, -R + T, -R + T, 36, R - T, 'tile');
  b.add(R - T, 0, -R + T, R, 36, R - T, 'tile');
  b.deco(-R + T, 24, -R + T, R - T, 28, R - T, 'water');
  b.block(0, 0, 72, 72, 96, 'tile');
  b.block(0, 0, 168, 168, 10, 'tile', 96);
  b.deco(-76, 106, -76, 76, 108, 76, 'water');
  b.prop({ kind: 'fountain', x: 0, y: 108, z: 0, radius: 76 });
  b.deco(-R, 36, -R, R, 38, -R + 3, 'lime');
  b.deco(-R, 36, R - 3, R, 38, R, 'lime');
  b.light(0, 220, 0, '#8fe3ff');
  b.landmark('Chafariz', 0, 0);
}

function storefronts(b: MapBuilder, brands: readonly ShopBrand[]): void {
  const openings = STORE_XS.flatMap((cx) => [
    { from: cx - 272, to: cx - 112, bottom: 24, top: 108 },
    { from: cx - 80, to: cx + 80, bottom: 0, top: 112 },
    { from: cx + 112, to: cx + 272, bottom: 24, top: 108 },
  ]);
  b.wallX(-X, X, FACADE_Z, 16, DECK - SLAB, 'white', openings);
  for (const x of [-704, 0, 704]) b.wallZ(-Z, FACADE_Z, x, 16, DECK - SLAB, 'white');
  STORE_XS.forEach((cx, i) => {
    const brand = brands[i];
    for (const side of [-1, 1]) {
      b.add(cx + side * 112, 24, FACADE_Z - 3, cx + side * 272, 108, FACADE_Z + 3, 'glass', { shoot: true });
      b.block(cx + side * 150, -1010, 120, 24, 56, 'white', 0, { tint: storeAccent(brand) });
    }
    b.deco(cx - 60, 114, FACADE_Z + 8, cx + 60, 174, FACADE_Z + 10, brandMat(brand));
    b.block(cx, -1100, 140, 36, 40, 'desk');
    b.landmark(STORE_BRANDS[brand].name, cx, -1000);
    dressStore(new Room(b, cx, 0, -Z), brand);
  });
}

const TABLECLOTHS = [0xc8102e, 0xf1ece0, 0x1f5fbf, 0xf1ece0] as const;
const CHAIR_TINTS = [0xd9a05b, 0xb86a3a, 0xe0b878, 0x9a5a30] as const;

/** A booth in the alcove between two kitchens: two benches facing each other across a table. */
function booth(b: MapBuilder, x: number, tint: number): void {
  const back = -Z;
  b.block(x, back + 14, 110, 24, 18, 'white', DECK, { tint });
  b.deco(x - 55, DECK + 18, back, x + 55, DECK + 58, back + 6, 'white', tint);
  b.block(x, back + 99, 110, 24, 18, 'white', DECK, { tint });
  b.deco(x - 55, DECK + 18, back + 105, x + 55, DECK + 50, back + 111, 'white', tint);
  b.block(x, back + 56, 70, 40, 30, 'wood', DECK);
  b.deco(x - 38, DECK + 28, back + 34, x + 38, DECK + 30.4, back + 78, 'white', 0xf1ece0);
  b.deco(x - 4, DECK + 30.4, back + 52, x + 4, DECK + 40, back + 60, 'plant');
}

function foodCourt(b: MapBuilder, brands: readonly FoodBrand[]): void {
  b.landmark('Praça de alimentação', 0, -860);
  STORE_XS.forEach((cx, i) => {
    const brand = brands[i];
    b.add(cx - KITCHEN_WIDTH / 2, DECK, -Z, cx + KITCHEN_WIDTH / 2, DECK + KITCHEN_HEIGHT, -Z + KITCHEN_DEPTH, 'clip', { visible: false, shoot: true });
    buildKitchen(new Room(b, cx, DECK + KITCHEN_FLOOR, -Z), brand);
    b.add(cx - 150, DECK, -1056, cx + 150, DECK + 40, -1020, 'white', { tint: counterTint(brand) });
    b.deco(cx - 154, DECK + 40, -1060, cx + 154, DECK + 42, -1016, 'white', 0xdfe3e8);
    b.deco(cx - 80, DECK + 110, -1056, cx + 80, DECK + 190, -1054, brandMat(brand));
    for (const side of [-1, 1]) b.deco(cx + side * 80, DECK + 146, -1056, cx + side * 160, DECK + 150, -1053);
    b.light(cx, DECK + 150, -1000, '#ffd9a0');
    b.landmark(STORE_BRANDS[brand].name, cx, -1000);
    b.restaurant(cx, DECK, -990);
  });
  const tables = [
    ...[-1150, -880, -560, -200, 200, 560, 880, 1150].map((x) => [x, -940] as const),
    ...[-1150, -880, -200, 200, 880, 1150].map((x) => [x, -800] as const),
  ];
  tables.forEach(([tx, tz], i) => {
    b.block(tx, tz, 64, 64, 30, 'wood', DECK);
    b.deco(tx - 36, DECK + 28, tz - 36, tx + 36, DECK + 30.4, tz + 36, 'white', TABLECLOTHS[i % TABLECLOTHS.length]);
    b.deco(tx - 4, DECK + 30.4, tz - 4, tx + 4, DECK + 40, tz + 4, 'plant');
    for (const side of [-1, 1]) b.block(tx + side * 52, tz, 22, 22, 18, 'desk', DECK, { tint: CHAIR_TINTS[i % CHAIR_TINTS.length] });
  });
  for (const x of [-1150, -880, -560, -200, 200, 560, 880, 1150]) b.prop({ kind: 'ceilingFan', x, y: FOOD_CEILING - 44, z: -870, radius: 44 });
  for (const x of [-704, 0, 704]) booth(b, x, 0xb8452f);
  const duct = new Room(b, 0, DECK, -Z);
  duct.box(0, 16, 2 * 1380, 32, 36, 126, 'white', 0xc9ced6);
  for (const x of [-1312, -704, 0, 704, 1312]) duct.vent(x, 144, 32, 'front');
}

/**
 * SHOPPING SUL RIO: a three floor mall around a fountain under a glass roof. Stores on the ground floor,
 * the food court upstairs, the Mirante gallery above it, escalators and a glass lift between them.
 * North half authored once and mirrored 180 degrees.
 */
export function buildShopping(): MapDef {
  const b = new MapBuilder();

  b.add(-X - 64, -32, -Z - 64, X + 64, 0, Z + 64, 'tile');
  b.add(-X - 32, 0, -Z - 32, X, WALL, -Z, 'white');
  b.add(X, 0, -Z - 32, X + 32, WALL, Z, 'white');
  b.add(-X, 0, Z, X + 32, WALL, Z + 32, 'white');
  b.add(-X - 32, 0, -Z, -X, WALL, Z + 32, 'white');
  b.add(-X - 32, WALL, -Z - 32, X + 32, 3200, -Z, 'clip', { visible: false, shoot: true });
  b.add(-X - 32, WALL, Z, X + 32, 3200, Z + 32, 'clip', { visible: false, shoot: true });
  b.add(X, WALL, -Z, X + 32, 3200, Z, 'clip', { visible: false, shoot: true });
  b.add(-X - 32, WALL, -Z, -X, 3200, Z, 'clip', { visible: false, shoot: true });

  fountain(b);

  let half = 0;
  b.mirrored(() => {
    // ducts along the end walls, high above the atrium
    b.deco(-X, 340, -520, -X + 30, 380, -120, 'white', 0xc9ced6);
    b.prop({ kind: 'vent', x: -X + 30, y: 360, z: -420, yaw: -Math.PI / 2, width: 44, height: 30 });
    b.prop({ kind: 'vent', x: -X + 30, y: 360, z: -220, yaw: -Math.PI / 2, width: 44, height: 30 });

    // food court floor slab, its railing and the roof over the top floor
    b.add(-X, DECK - SLAB, -Z, X, DECK, GALLERY_Z, 'tile');
    b.deco(-X, DECK - SLAB, GALLERY_Z, X, DECK - SLAB + 4, GALLERY_Z + 3);
    for (const [a, c] of [[-X, -576], [-480, -LIFT_GAP_HALF], [LIFT_GAP_HALF, 480], [576, X]] as const) {
      b.add(a, DECK, GALLERY_Z - 4, c, DECK + RAIL, GALLERY_Z, 'glass', { shoot: true });
      b.deco(a, DECK + RAIL, GALLERY_Z - 5, c, DECK + RAIL + 4, GALLERY_Z + 1, 'charcoal');
    }
    b.add(-X, ROOF, -Z, X, ROOF + SLAB, GALLERY_Z, 'white');
    // the roof top is outside the mall and nobody can walk there from the floor, so a glider hits the side of this column instead of landing
    b.add(-X, ROOF + SLAB, -Z, X, DROP_HEIGHT + ROOF_CLIP_MARGIN, GALLERY_Z, 'clip', { visible: false, shoot: true });
    for (const px of [-760, -200, 200, 760]) {
      b.block(px, -696, 40, 40, DECK - SLAB, 'white');
      b.block(px, -696, 40, 40, FOOD_CEILING - DECK, 'white', DECK);
    }
    topFloor(b);

    // glass roof over the atrium: light comes in, airdrops and skydivers fall through
    b.deco(-X, ROOF + 8, GALLERY_Z, X, ROOF + 12, 0, 'glass');
    for (const z of [-512, -256]) b.deco(-X, ROOF + 4, z, X, ROOF + 8, z + 8, 'charcoal');
    for (const x of [-1024, -512, 0, 512, 1024]) b.deco(x, ROOF + 4, GALLERY_Z, x + 8, ROOF + 8, 0, 'charcoal');

    for (const { x1, x2, travel, name } of ESCALATORS) {
      escalator(b, x1, x2, travel);
      b.landmark(name, (x1 + x2) / 2, -520);
    }

    storefronts(b, STORES[half]);
    foodCourt(b, FOOD_COURT[half]);

    // atrium: a kiosk, an ATM, a planter and a bench
    b.block(-800, -320, 128, 64, 40, 'wood');
    b.deco(-800 - 64, 40, -320 - 32, -800 + 64, 44, -320 + 32);
    b.add(-830, 40, -300, -770, 76, -296, 'screen', { solid: false });
    b.landmark('Quiosque', -800, -320);
    b.block(1000, -360, 40, 32, 72, 'metal');
    b.add(990, 40, -376, 1010, 60, -375, 'screen', { solid: false });
    b.block(-300, -440, 48, 48, 36, 'charcoal');
    b.block(-300, -440, 72, 72, 72, 'plant', 36, { solid: false, shoot: true });
    b.block(220, -440, 120, 32, 18, 'wood');

    b.deco(-X, 120, -560, -X + 2, 280, -400, 'logo');
    b.deco(-X, 100, -300, -X + 2, 260, -140, 'eitri');

    coverShopping(b);

    b.point(0, -480);
    b.point(-1150, -200);
    b.point(300, -250);
    half++;
  });

  return {
    id: 'shopping',
    name: 'Shopping Sul Rio',
    subtitle: 'escada rolante, chafariz e praça de alimentação',
    bounds: { minX: -X, maxX: X, minZ: -Z, maxZ: Z },
    dropArea: { minX: -1300, maxX: 1300, minZ: -600, maxZ: 600 },
    flagBases: [{ x: -1000, z: -480 }, { x: 1000, z: 480 }],
    dropHeight: DROP_HEIGHT,
    airdropPoints: b.points,
    restaurants: b.restaurants,
    lifts: b.lifts,
    supplies: b.supplies,
    boxes: b.boxes,
    features: b.features,
    lights: b.lights,
    props: b.props,
    theme: {
      skyTop: '#2f78d8',
      skyHorizon: '#cfe8ff',
      skyBottom: '#f2f7ff',
      fog: '#e4efff',
      fogNear: 1800,
      fogFar: 6500,
      sun: '#fff3dd',
      sunIntensity: 3,
      sunDir: { x: 0.2, y: 0.92, z: 0.25 },
      hemiSky: '#f1f6ff',
      hemiGround: '#8a8173',
      hemiIntensity: 1.5,
    },
  };
}
