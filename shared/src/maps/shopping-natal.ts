import { LIFT_DOOR_HEIGHT_UNITS, type Lift } from '../lift.ts';
import { MapBuilder } from './builder.ts';
import { buildShopping } from './shopping.ts';
import { DECK, DECK3, FACADE_Z, GALLERY_Z, LIFT_WALL, RAIL, ROOF } from './shopping-levels.ts';
import type { MapDef, MapProp, Mat } from './types.ts';

const RED = 0xc32038;
const GREEN = 0x176448;
const PINE = 0x227b55;
const GOLD = 0xffcc59;
const WHITE = 0xf2f8ff;
const BROWN = 0x9c5c36;
const BLACK = 0x25212a;
const SKIN = 0xf3ba95;
const BLUE = 0x4184c4;

/** Snow stops this far short of the solid roof on each side of the atrium (units). */
const SNOW_EDGE_UNITS = 100;
/** Particle budget for the atrium around the camera. */
const SNOW_FLAKES = 640;
const SNOW_FLOOR_Y = 4;
/** Garland height on the Mirante rail, measured from the rail top. */
const GARLAND_DROP = 12;

/**
 * Every piece is `deco` (non-solid, shot through), so nothing changes for movement, bots or the nav grid.
 * The builder is replayed through `mirrored`, so the authored north half and its 180 degree turn match.
 */
function decorations(b: MapBuilder, northLift: Lift): void {
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, tint: number, mat: Mat = 'white') =>
    b.deco(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, mat, tint);

  function star(x: number, y: number, z: number, size: number, tint: number): void {
    box(x, y - size / 2, z, size / 3, size, size / 3, tint, 'lamp');
    box(x, y - size / 6, z, size, size / 3, size / 3, tint, 'lamp');
    box(x, y - size / 6, z, size / 3, size / 3, size, tint, 'lamp');
  }

  function tree(x: number, y: number, z: number, scale: number): void {
    box(x, y, z, 14 * scale, 22 * scale, 14 * scale, BROWN);
    for (let tier = 0; tier < 5; tier++) {
      const width = (78 - tier * 13) * scale;
      const bottom = y + (16 + tier * 15) * scale;
      box(x, bottom, z, width, 15 * scale, width, tier % 2 ? PINE : GREEN);
      box(x, bottom + 13 * scale, z, width - 2 * scale, 2 * scale, width - 2 * scale, WHITE);
      for (const side of [-1, 1]) {
        box(x + side * width / 4, bottom + 5 * scale, z + side * width / 2, 5 * scale, 5 * scale, 5 * scale, tier % 2 ? GOLD : RED, 'lamp');
        box(x + side * width / 2, bottom + 8 * scale, z - side * width / 4, 5 * scale, 5 * scale, 5 * scale, tier % 2 ? RED : GOLD, 'lamp');
      }
    }
    star(x, y + 96 * scale, z, 18 * scale, GOLD);
  }

  function santa(x: number, y: number, z: number): void {
    for (const side of [-1, 1]) {
      box(x + side * 9, y, z + 4, 14, 8, 22, BLACK);
      box(x + side * 9, y + 8, z, 13, 20, 15, RED);
      box(x + side * 21, y + 29, z + 3, 10, 24, 13, RED);
      box(x + side * 21, y + 26, z + 4, 10, 5, 13, WHITE);
    }
    box(x, y + 26, z, 33, 29, 22, RED);
    box(x, y + 26, z, 34, 4, 23, WHITE);
    box(x, y + 35, z, 34, 6, 23, BLACK);
    box(x, y + 35, z + 12, 8, 6, 2, GOLD);
    box(x, y + 55, z, 20, 18, 18, SKIN);
    box(x, y + 49, z + 10, 18, 13, 7, WHITE);
    for (const side of [-1, 1]) box(x + side * 5, y + 66, z + 9, 2, 2, 2, BLACK);
    box(x, y + 71, z, 24, 5, 22, WHITE);
    box(x, y + 76, z - 2, 19, 9, 17, RED);
    box(x + 5, y + 85, z - 4, 10, 6, 10, RED);
    box(x + 9, y + 89, z - 4, 7, 7, 7, WHITE);
  }

  function reindeer(x: number, y: number, z: number): void {
    box(x, y + 21, z, 24, 22, 45, BROWN);
    box(x, y + 33, z + 19, 14, 23, 15, BROWN);
    box(x, y + 52, z + 25, 18, 14, 23, BROWN);
    box(x, y + 53, z + 38, 9, 8, 7, RED, 'lamp');
    box(x, y + 34, z - 24, 9, 8, 8, WHITE);
    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) {
        box(x + side * 8, y, z + end * 15, 8, 4, 9, BLACK);
        box(x + side * 8, y + 4, z + end * 15, 6, 20, 7, BROWN);
      }
      box(x + side * 7, y + 63, z + 18, 4, 18, 4, GOLD);
      box(x + side * 11, y + 73, z + 18, 10, 4, 4, GOLD);
      box(x + side * 15, y + 73, z + 18, 4, 12, 4, GOLD);
      box(x + side * 10, y + 59, z + 22, 3, 3, 3, BLACK);
    }
  }

  function gifts(x: number, y: number, z: number): void {
    for (const [dx, dz, size, tint] of [[-12, 0, 23, RED], [12, 4, 18, GREEN], [-11, 0, 12, BLUE]] as const) {
      const bottom = size === 12 ? y + 23 : y;
      box(x + dx, bottom, z + dz, size, size, size, tint);
      box(x + dx, bottom, z + dz, 4, size + 1, size + 1, GOLD);
      box(x + dx, bottom, z + dz, size + 1, size + 1, 4, GOLD);
    }
  }

  /** A sleigh on its runners, facing +x, with its load of gifts. */
  function sleigh(x: number, z: number): void {
    for (const side of [-1, 1]) {
      box(x + side * 21, 2, z + 5, 5, 6, 84, GOLD);
      box(x + side * 21, 6, z + 44, 5, 10, 6, GOLD);
      box(x + side * 21, 15, z - 3, 5, 21, 63, RED);
      box(x + side * 21, 36, z - 3, 6, 3, 63, GOLD);
    }
    box(x, 9, z, 45, 7, 68, RED);
    box(x, 16, z - 32, 45, 30, 5, RED);
    gifts(x, 16, z - 4);
  }

  function wreath(x: number, y: number, z: number): void {
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      box(x + Math.cos(angle) * 15, y + Math.sin(angle) * 15 - 4, z, 9, 9, 5, i % 3 ? GREEN : PINE);
    }
    box(x, y - 18, z + 3, 15, 7, 3, RED);
  }

  /** Thin white snow on a top surface at height y, covering w by d. */
  function drift(x: number, y: number, z: number, w: number, d: number): void {
    box(x, y, z, w, 3, d, WHITE);
  }

  // Ground floor: the tree by the fountain and the lost-and-found tree with its gifts.
  tree(-640, 0, -240, 1.45);
  b.light(-640, 139, -240, '#ffd27c');
  b.landmark('Árvore de Natal', -640, -240);
  gifts(-540, 0, -200);
  tree(-240, 0, 240, 1);

  // Santa and the reindeer beside the car on display, the sleigh behind them.
  santa(640, 0, -160);
  reindeer(790, 0, -70);
  reindeer(850, 0, -40);
  sleigh(960, -60);
  drift(860, 68, -250, 110, 40);
  drift(-300, 108, -440, 60, 60);

  // Food court and Mirante: a tree and Santa on each level.
  tree(-1000, DECK, -900, 1);
  santa(1000, DECK, -920);
  tree(-400, DECK3, -1000, 1);
  santa(-180, DECK3, -980);

  // Wreaths over the shop fronts and the lift doorways.
  for (const x of [-1152, -384, 384, 1152]) wreath(x, 129, FACADE_Z + 12);
  for (const door of northLift.doors) {
    const onGround = door.y === 0;
    wreath(0, door.y + LIFT_DOOR_HEIGHT_UNITS + 22, onGround ? northLift.maxZ + LIFT_WALL + 3 : GALLERY_Z - LIFT_WALL - 6);
  }

  // Garlands with red bows along the Mirante rail, on the atrium side of the glass.
  const railZ = GALLERY_Z + 5;
  for (const x of [-1090, -830, -570, -310, 310, 570, 830, 1090]) {
    const y = DECK3 + RAIL - GARLAND_DROP;
    box(x, y, railZ, 174, 6, 5, GREEN);
    box(x, y - 5, railZ + 1, 100, 6, 6, GREEN);
    box(x, y - 10, railZ + 4, 22, 11, 4, RED);
    box(x, y - 15, railZ + 6, 7, 17, 4, GOLD);
  }

  // Stars hung from the glass canopy on strings.
  for (const [x, z, drop] of [[-1024, -310, 62], [-512, -240, 100], [512, -300, 78], [1024, -460, 120]] as const) {
    box(x, ROOF - drop, z, 2, drop + 4, 2, WHITE);
    star(x, ROOF - drop, z, 30, drop % 4 ? GOLD : WHITE);
  }

  // Gift stacks in the open atrium and at the food court tree.
  gifts(-1020, DECK, -1000);
  gifts(340, 0, -40);
}

/** Props of the base map keep their place but play this station, so the variant has its own music. */
function withSeasonStation(props: readonly MapProp[]): MapProp[] {
  return props.map((p) => (p.kind === 'speaker' ? { ...p, station: 'shopping-natal' } : p));
}

/**
 * Shopping Sul Rio at Christmas: the base map with decoration, snow and its own radio. The base is called and
 * extended, so any change to Shopping Sul Rio shows up here.
 */
export function buildShoppingNatal(): MapDef {
  const base = buildShopping();
  const northLift = base.lifts.find((l) => l.minZ < 0);
  if (!northLift) throw new Error('Shopping Sul Rio has no north lift to decorate');
  const b = new MapBuilder();
  b.mirrored(() => decorations(b, northLift));

  return {
    ...base,
    id: 'shopping-natal',
    name: 'Shopping Sul Rio: Natal',
    subtitle: 'árvore, Papai Noel, renas e neve no átrio',
    boxes: [...base.boxes, ...b.boxes],
    lights: [...base.lights, ...b.lights],
    features: [...base.features, ...b.features],
    props: withSeasonStation(base.props),
    theme: {
      ...base.theme,
      skyTop: '#3b4c85',
      skyHorizon: '#cedcf6',
      skyBottom: '#e7efff',
      fog: '#dce8fa',
      hemiGround: '#878b9d',
      // The glass canopy is shot through and open to the sky, so snow falls under it and never above it.
      snow: {
        min: { x: base.dropArea.minX, y: SNOW_FLOOR_Y, z: GALLERY_Z + SNOW_EDGE_UNITS },
        max: { x: base.dropArea.maxX, y: ROOF, z: -(GALLERY_Z + SNOW_EDGE_UNITS) },
        flakes: SNOW_FLAKES,
      },
    },
  };
}
