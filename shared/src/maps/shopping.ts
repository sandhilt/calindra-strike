import { brandMat, STORE_BRANDS, type FoodBrand, type ShopBrand } from './brands.ts';
import { MapBuilder } from './builder.ts';
import { coverShopping } from './shopping-cover.ts';
import { Room } from './room.ts';
import { buildKitchen, counterTint, KITCHEN_DEPTH, KITCHEN_FLOOR, KITCHEN_HEIGHT, KITCHEN_WIDTH } from './shopping-kitchens.ts';
import { CANOPY_BOTTOM, DECK, DECK3, DROP_HEIGHT, FACADE_Z, FOOD_CEILING, GALLERY_Z, RAIL, ROOF, ROOF_CLIP_MARGIN, SLAB, WALL, X, Z } from './shopping-levels.ts';
import { dressDeckWalls } from './shopping-deck-walls.ts';
import { dressStore, storeAccent, TILL_HEIGHT } from './shopping-stores.ts';
import { LIFT_GAP_HALF, topFloor, type MiranteShops } from './shopping-top.ts';
import type { EscalatorTravel, MapDef } from './types.ts';

/** Height of the warm glow under a shop's ceiling panels (the shop ceiling is 176). */
const STORE_LAMP_Y = 160;
/** The skydive start stays this far from the end walls, with room to steer before reaching the perimeter. */
const DROP_END_MARGIN = 208;
const STORE_XS = [-3, -1, 1, 3].map((bay) => bay * X / 4);
const STORE_PARTITIONS = [-X / 2, 0, X / 2];
const ESCALATORS = [
  { x1: 480, x2: 576, travel: 'up', name: 'Escada rolante que sobe' },
  { x1: -576, x2: -480, travel: 'down', name: 'Escada rolante que desce' },
] satisfies readonly { x1: number; x2: number; travel: EscalatorTravel; name: string }[];
const ESCALATOR_FOOT_Z = -352;
const PILLAR_XS = [-760, -200, 200, 760];
const PILLAR_Z = -696;
/** Escalator sides rise higher still: a step two cells up must not reach the top of a lower panel with a jump. */
const ESCALATOR_SIDE = 80;

/** North half first, then the south half, which is the north one turned 180 degrees. */
const FOOD_COURT: readonly (readonly FoodBrand[])[] = [
  ['kfg', 'burguer-rei', 'mania-picanha', 'parrilha'],
  ['mequi', 'outbaque', 'madeiro', 'bobis'],
];
/** The shops on each half's top floor, beside the ones on the ground floor, so every brand stands once. */
const MIRANTE_SHOPS: readonly MiranteShops[] = [
  { pharmacy: 'pague-pouco', small: 'pandorga', lounge: 'pe-leve', corner: 'linha-fina', gift: 'imaginario', large: ['samsong', 'ray-bao'] },
  { pharmacy: 'droga-raio', small: 'loccitano', lounge: 'essencia', corner: 'papel-e-cor', gift: 'toc-toque', large: ['sentauro', 'brinco-center'] },
];
const STORES: readonly (readonly ShopBrand[])[] = [
  ['zarra', 'cea', 'brenner', 'hew'],
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
      // The client draws the sides as straight panes over these stepped blockers.
      b.add(a, top, far, c, top + ESCALATOR_SIDE, near, 'glass', { shoot: true, visible: false });
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
  for (const x of STORE_PARTITIONS) b.wallZ(-Z, FACADE_Z, x, 16, DECK - SLAB, 'white');
  STORE_XS.forEach((cx, i) => {
    const brand = brands[i];
    for (const side of [-1, 1]) {
      b.add(cx + side * 112, 24, FACADE_Z - 3, cx + side * 272, 108, FACADE_Z + 3, 'glass', { shoot: true });
      b.block(cx + side * 150, -Z + 142, 120, 24, 56, 'white', 0, { tint: storeAccent(brand) });
    }
    b.deco(cx - 60, 114, FACADE_Z + 8, cx + 60, 174, FACADE_Z + 10, brandMat(brand));
    b.block(cx, -Z + 52, 140, 36, TILL_HEIGHT, 'desk');
    b.landmark(STORE_BRANDS[brand].name, cx, -Z + 152);
    dressStore(new Room(b, cx, 0, -Z), brand);
    for (const lampZ of [60, 190]) b.light(cx, STORE_LAMP_Y, -Z + lampZ, '#ffe9bd');
    b.interior(cx, 0, -Z + 142);
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
  b.landmark('Praça de alimentação', 0, -1072);
  STORE_XS.forEach((cx, i) => {
    const brand = brands[i];
    b.add(cx - KITCHEN_WIDTH / 2, DECK, -Z, cx + KITCHEN_WIDTH / 2, DECK + KITCHEN_HEIGHT, -Z + KITCHEN_DEPTH, 'clip', { visible: false, shoot: true });
    buildKitchen(new Room(b, cx, DECK + KITCHEN_FLOOR, -Z), brand);
    b.add(cx - 150, DECK, -Z + KITCHEN_DEPTH, cx + 150, DECK + 40, -Z + 132, 'white', { tint: counterTint(brand) });
    b.deco(cx - 154, DECK + 40, -Z + 92, cx + 154, DECK + 42, -Z + 136, 'white', 0xdfe3e8);
    b.deco(cx - 80, DECK + 110, -Z + KITCHEN_DEPTH, cx + 80, DECK + 190, -Z + 98, brandMat(brand));
    for (const side of [-1, 1]) b.deco(cx + side * 80, DECK + 146, -Z + KITCHEN_DEPTH, cx + side * 160, DECK + 150, -Z + 99);
    b.light(cx, DECK + 150, -Z + 152, '#ffd9a0');
    b.landmark(STORE_BRANDS[brand].name, cx, -Z + 152);
    b.restaurant(cx, DECK, -Z + 162, brand);
  });
  const tables = [
    ...[-1150, -880, -560, -200, 200, 560, 880, 1150].map((x) => [x, -Z + 272] as const),
    ...[-1136, -720, -280, 96, 496, 912].map((x) => [x, -1136] as const),
    ...[-1060, -880, -200, 200, 880, 1060].map((x) => [x, -800] as const),
  ];
  tables.forEach(([tx, tz], i) => {
    b.block(tx, tz, 64, 64, 30, 'wood', DECK);
    b.deco(tx - 36, DECK + 28, tz - 36, tx + 36, DECK + 30.4, tz + 36, 'white', TABLECLOTHS[i % TABLECLOTHS.length]);
    b.deco(tx - 4, DECK + 30.4, tz - 4, tx + 4, DECK + 40, tz + 4, 'plant');
    for (const side of [-1, 1]) b.block(tx + side * 52, tz, 22, 22, 18, 'desk', DECK, { tint: CHAIR_TINTS[i % CHAIR_TINTS.length] });
  });
  for (const x of [-1150, -880, -520, -200, 200, 520, 880, 1150]) b.prop({ kind: 'ceilingFan', x, y: FOOD_CEILING - 44, z: -870, radius: 44 });
  for (const x of STORE_PARTITIONS) booth(b, x, 0xb8452f);
  const duct = new Room(b, 0, DECK, -Z);
  duct.duct(0, 16, 2 * (X - 28), 32, 32, 142);
  for (const x of [-X + 96, ...STORE_PARTITIONS, X - 96]) duct.vent(x, 158, 32, 'front');
  dressDeckWalls(b, { kitchenXs: STORE_XS, boothXs: STORE_PARTITIONS, pillars: PILLAR_XS.map((x) => [x, PILLAR_Z] as const), brands });
}

/**
 * SHOPPING SUL RIO: a three floor mall around a fountain under a glass roof. Stores on the ground floor,
 * the food court upstairs, the Mirante gallery above it, escalators and a glass lift between them.
 * North half authored once and mirrored 180 degrees.
 */
export function buildShopping({ displayCar = true } = {}): MapDef {
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
  b.sealOutside(X, Z);

  fountain(b);

  let half = 0;
  b.mirrored(() => {
    // ducts along the end walls, high above the atrium, fed by a riser from the roof units over the wall top
    b.duct(-X, 340, -520, -X + 30, 380, -120);
    b.duct(-X, 380, -340, -X + 24, WALL, -300);
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
    for (const px of PILLAR_XS) {
      b.block(px, PILLAR_Z, 40, 40, DECK - SLAB, 'white');
      b.block(px, PILLAR_Z, 40, 40, FOOD_CEILING - DECK, 'white', DECK);
    }
    b.prop({ kind: 'speaker', x: PILLAR_XS[0], y: 72, z: PILLAR_Z + 28, yaw: 0, station: 'shopping' });
    b.prop({ kind: 'speaker', x: PILLAR_XS[3], y: DECK + 72, z: PILLAR_Z + 28, yaw: 0, station: 'shopping' });
    topFloor(b, MIRANTE_SHOPS[half]);

    // glass roof over the atrium: light comes in, airdrops and skydivers fall through
    b.deco(-X, CANOPY_BOTTOM, GALLERY_Z, X, CANOPY_BOTTOM + 4, 0, 'glass');

    for (const { x1, x2, travel, name } of ESCALATORS) {
      escalator(b, x1, x2, travel);
      b.landmark(name, (x1 + x2) / 2, -520);
    }

    storefronts(b, STORES[half]);
    foodCourt(b, FOOD_COURT[half]);

    // atrium: an ATM and a planter
    b.block(1000, -360, 40, 32, 72, 'metal');
    b.add(990, 40, -376, 1010, 60, -375, 'screen', { solid: false });
    b.block(-300, -440, 48, 48, 36, 'charcoal');
    b.block(-300, -440, 72, 72, 72, 'plant', 36, { solid: false, shoot: true });

    b.deco(-X, 120, -560, -X + 2, 280, -400, 'logo');
    b.deco(-X, 100, -300, -X + 2, 260, -140, 'eitri');

    coverShopping(b, displayCar);

    b.point(0, -480);
    b.point(-1150, -200);
    b.point(300, -250);
    b.point(1400, -320);
    half++;
  });

  return {
    id: 'shopping',
    name: 'Shopping Sul Rio',
    subtitle: 'escada rolante, chafariz e praça de alimentação',
    bounds: { minX: -X, maxX: X, minZ: -Z, maxZ: Z },
    dropArea: { minX: -X + DROP_END_MARGIN, maxX: X - DROP_END_MARGIN, minZ: -600, maxZ: 600 },
    defuseSite: { x: 0, y: 0, z: 0 },
    defuseBases: [{ x: -1090, y: DECK3, z: -1020 }, { x: 1090, y: DECK3, z: 1020 }],
    flagBases: [{ x: -1000, z: -480 }, { x: 1000, z: 480 }],
    dropHeight: DROP_HEIGHT,
    airdropPoints: b.points,
    restaurants: b.restaurants,
    floors: [{ y: 0, name: 'térreo' }, { y: DECK, name: 'praça de alimentação' }, { y: DECK3, name: 'Mirante' }],
    lifts: b.lifts,
    supplies: b.supplies,
    interiors: b.interiors,
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
