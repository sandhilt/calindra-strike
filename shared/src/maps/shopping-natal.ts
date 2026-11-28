import { isBrandMat } from './brands.ts';
import { MapBuilder } from './builder.ts';
import { buildShopping } from './shopping.ts';
import { SUPPLY_STAND } from './shopping-top.ts';
import { BAY_ESCALATORS, BAY_TOP_Z, CANOPY_BOTTOM, DECK, DECK3, FACADE_Z, GALLERY_Z, RAIL, TOP_X, X, Z } from './shopping-levels.ts';
import type { MapDef, MapProp, Mat } from './types.ts';

const RED = 0xc32038;
const GREEN = 0x176448;
const PINE = 0x227b55;
// These tints identify the ribbon and its ornaments in the sign clearance test.
export const GARLAND_TINTS = [0x23613c, 0xbc2636, 0xffc45b] as const;
const GOLD = 0xffcc59;
const WHITE = 0xf2f8ff;
const BROWN = 0x9c5c36;
const BLACK = 0x25212a;
const BLUE = 0x4184c4;

/** Snow stops this far short of the solid roof on each side of the atrium (units). */
const SNOW_EDGE_UNITS = 100;
/** Particle budget for the atrium around the camera. */
const SNOW_FLAKES = 640;
const SNOW_FLOOR_Y = 4;
/** Garland height on a rail, measured from its top. */
const GARLAND_DROP = 12;
/** Gap between a lift level sign's edge and the holly hung beside it (units), so the sign face stays whole. */
const SIGN_HOLLY_GAP = 2;
/** Snowmen keep this far back from the top of the up escalator (units): its exit and the turn onto the gallery stay open. */
export const SNOWMAN_EXIT_CLEARANCE = 120;
/** Snowmen in the corner of each up escalator's landing on the Mirante: x, z and scale. Authored for the north-east bay. */
const SNOWMEN = [
  [1488, -1488, 1.2],
  [1418, -1500, 0.9],
  [1500, -1418, 0.65],
] as const;

/** True when the x extents of `boxes` together cover [from, to] without a gap. */
export function covers(boxes: readonly { min: { x: number }; max: { x: number } }[], from: number, to: number): boolean {
  let reach = from;
  for (const box of boxes.toSorted((a, b) => a.min.x - b.min.x)) {
    if (box.min.x > reach) break;
    reach = Math.max(reach, box.max.x);
  }
  return reach >= to;
}

/**
 * Every piece is `deco` (non-solid, shot through), so nothing changes for movement, bots or the nav grid.
 * The builder is replayed through `mirrored`, so the authored north half and its 180 degree turn match.
 */
function decorations(b: MapBuilder, base: MapDef): void {
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

  /** The sleigh faces +z, with two harness lines running to the reindeer. */
  function sleigh(x: number, y: number, z: number): void {
    for (const side of [-1, 1]) {
      box(x + side * 21, y, z, 5, 6, 69, GOLD);
      box(x + side * 21, y + 4, z + 34, 5, 9, 8, GOLD);
      box(x + side * 21, y + 5, z - 19, 5, 8, 8, GOLD);
      box(x + side * 21, y + 12, z - 3, 5, 21, 59, RED);
      box(x + side * 21, y + 33, z - 3, 6, 3, 59, GOLD);
      box(x + side * 21, y + 26, z + 45, 2, 2, 44, GOLD);
      box(x + side * 26, y + 26, z + 66, 16, 2, 2, GOLD);
      reindeer(x + side * 33, y, z + 81);
      box(x + side * 33, y + 21, z + 66, 3, 21, 4, RED);
    }
    box(x, y + 11, z, 45, 7, 65, RED);
    box(x, y + 18, z - 31, 45, 30, 5, RED);
    box(x, y + 18, z + 25, 45, 13, 5, RED);
    box(x, y + 18, z - 9, 38, 17, 19, RED);
    b.prop({ kind: 'santa', x, y: y + 35, z: z - 9, yaw: Math.PI, pose: 'seated' });
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

  // Ground floor: the atrium has no trees, only the lost-and-found gifts.
  gifts(-540, 0, -200);

  // The sleigh and its team share the former car's plinth.
  sleigh(860, 8, -292);
  drift(-300, 108, -440, 60, 60);

  // Food court and Mirante: a tree and Santa on each level. The food court tree stands in the corner by the rail, off the escalator approaches.
  tree(-1290, DECK, -790, 1);
  b.prop({ kind: 'santa', x: 1000, y: DECK, z: -920, yaw: Math.PI, pose: 'standing' });
  tree(-400, DECK3, -1000, 1);
  b.prop({ kind: 'santa', x: -180, y: DECK3, z: -980, yaw: Math.PI, pose: 'standing' });
  // Santa on the edge of the Mirante supply dais, turned to its gift box.
  b.prop({ kind: 'santa', x: SUPPLY_STAND.x + 66, y: DECK3 + 10, z: SUPPLY_STAND.z, yaw: Math.PI / 2, pose: 'standing' });

  // Holly beside each level sign of the lift, never over it: a fir strip with baubles and a red bow on each side.
  for (const sign of base.boxes.filter((box) => box.mat === 'brand:piso-terreo' || box.mat === 'brand:piso-1' || box.mat === 'brand:piso-mirante')) {
    if (sign.min.z > 0) continue;
    const back = sign.mat === 'brand:piso-terreo';
    // Flush with the sign, against the shaft's corner glass.
    const z = (sign.min.z + sign.max.z) / 2;
    const height = sign.max.y - sign.min.y;
    for (const x of [sign.min.x - SIGN_HOLLY_GAP - 4, sign.max.x + SIGN_HOLLY_GAP + 4]) {
      box(x, sign.min.y, z, 6, height, 2, PINE);
      for (const [i, y] of [0.2, 0.5, 0.8].entries()) box(x, sign.min.y + height * y - 2.5, z + (back ? 3 : -3), 5, 5, 4, i % 2 ? GOLD : RED, 'lamp');
      box(x, sign.max.y, z, 8, 6, 2, RED);
    }
  }

  // Snowmen in the dead-end corner of the up escalator's landing on the Mirante, on a patch of snow.
  const [up] = BAY_ESCALATORS;
  const patch = { minX: up.x1 + 4, maxX: X - 6, minZ: -Z + 6, maxZ: BAY_TOP_Z - SNOWMAN_EXIT_CLEARANCE };
  drift((patch.minX + patch.maxX) / 2, DECK3, (patch.minZ + patch.maxZ) / 2, patch.maxX - patch.minX, patch.maxZ - patch.minZ);
  for (const [x, z, scale] of SNOWMEN) b.prop({ kind: 'snowman', x, y: DECK3 + 3, z, yaw: Math.atan2(x - TOP_X, z - BAY_TOP_Z), scale });

  // Wreaths over the shop fronts. The lift doorways get none: the level signs fill the space over them.
  for (const x of [-1152, -384, 384, 1152]) wreath(x + 139, 139, FACADE_Z + 14);

  function garland(x: number, y: number, z: number, width: number): void {
    const [fir, ribbon, bell] = GARLAND_TINTS;
    box(x, y, z, width, 5, 4, fir);
    box(x, y - 4, z + 1, width * 0.7, 5, 5, fir);
    box(x, y - 8, z + 3, 14, 8, 3, ribbon);
    box(x, y - 10, z + 5, 4, 10, 3, bell);
  }

  // A garland hangs only where a fascia or wall face lies flush behind its whole width: past the end of a
  // Mirante fascia board it would float in the air beside the sign.
  const backing = base.boxes.filter((box) => box.visible && !isBrandMat(box.mat));
  function backed(x: number, y: number, face: number, width: number): boolean {
    const behind = backing.filter((box) => Math.abs(box.max.z - face) <= 1 && box.min.y <= y && box.max.y >= y);
    return covers(behind, x - width / 2, x + width / 2);
  }

  // Clear the entire width of each storefront sign, including the mirrored facade.
  // A garland that would hang over a neighbouring sign is left off: the Mirante boutiques stand close together.
  const signs = base.boxes.filter((box) => isBrandMat(box.mat));
  for (const sign of signs) {
    if (sign.max.z > FACADE_Z + 16 || sign.max.x - sign.min.x < 120) continue;
    if (![114, DECK + 110, DECK3 + 142].includes(sign.min.y)) continue;
    const foodCourt = sign.min.y === DECK + 110;
    const y = foodCourt ? DECK + 146 : sign.min.y + (sign.max.y - sign.min.y) * 0.55;
    const face = foodCourt ? sign.max.z + 1 : sign.min.z;
    const width = sign.min.y > DECK3 ? 16 : 48;
    const offset = width / 2 + 12;
    for (const x of [sign.min.x - offset, sign.max.x + offset]) {
      const clashes = signs.some((other) => other !== sign && other.min.x < x + width / 2 && other.max.x > x - width / 2 &&
        other.min.y < y + 8 && other.max.y > y - 8 && other.min.z < face + 4 && other.max.z > face - 4);
      if (!clashes && backed(x, y, face, width)) garland(x, y, face + 2, width);
    }
  }

  // Balustrades and the atrium-facing sides of the pillars on all three levels.
  for (const level of [DECK, DECK3]) {
    for (const x of [-1090, -830, -310, 310, 830, 1090]) {
      garland(x, level + RAIL - GARLAND_DROP, GALLERY_Z + 2, 156);
    }
  }
  for (const level of [0, DECK, DECK3]) {
    for (const x of [-760, -200, 200, 760]) garland(x, level + 130, -674, 38);
  }

  // Small displays along the back of the shops, clear of the doors and browse spots.
  for (const [x, y, z] of [
    [-1252, 0.5, -1500], [-484, 0.5, -1500], [484, 0.5, -1500], [1252, 0.5, -1500],
    [-1043, DECK3 + 0.5, -1480], [-830, DECK3 + 0.5, -1500],
    [-334, DECK3 + 0.5, -1500], [65, DECK3 + 0.5, -1500],
    [404, DECK3 + 0.5, -1500], [1060, DECK3 + 0.5, -1500],
  ] as const) {
    tree(x, y, z, 0.32);
    box(x + 11, y, z + 9, 8, 8, 8, RED);
    box(x + 11, y + 8, z + 9, 2, 1, 8, GOLD);
    garland(x, y + 66, -1533, 22);
  }
  // Counter displays sit behind the food court's public aisle.
  for (const x of [-1152, -384, 384, 1152]) {
    tree(x + 110, DECK + 42, -1420, 0.26);
    box(x + 97, DECK + 42, -1424, 8, 8, 8, RED);
    box(x + 97, DECK + 50, -1424, 2, 1, 8, GOLD);
  }

  // Frost at the edges and under the centre seam. Crossbars connect the two runs.
  box(0, CANOPY_BOTTOM - 3, GALLERY_Z + 5, X * 2, 3, 10, WHITE);
  box(0, CANOPY_BOTTOM - 3, -3, X * 2, 3, 6, WHITE);
  for (const [x, z, drop] of [[-1024, -310, 62], [-512, -240, 100], [512, -300, 78], [1024, -460, 120]] as const) {
    box(x, CANOPY_BOTTOM - 3, GALLERY_Z / 2 + 2, 5, 3, -GALLERY_Z - 16, WHITE);
    const starY = CANOPY_BOTTOM - drop;
    const stringBottom = starY + 15;
    box(x, stringBottom, z, 2, CANOPY_BOTTOM - 3 - stringBottom, 2, WHITE);
    star(x, starY, z, 30, drop % 4 ? GOLD : WHITE);
  }

  function swag(x1: number, x2: number, y: number, z: number, sag: number, bulbs: number): void {
    b.prop({ kind: 'twinkleLights', x: x1, y, z, x2, y2: y, z2: z, sag, bulbs });
  }

  for (const side of [-1, 1]) {
    swag(side * 232, side * 388, DECK - 18, GALLERY_Z + 4, 12, 7);
    for (const level of [DECK, DECK3]) {
      swag(side * 232, side * 388, level + RAIL, GALLERY_Z + 4, 12, 7);
    }
  }
  for (const [left, right] of [[-1024, -512], [-512, 512], [512, 1024]]) {
    swag(left, right, CANOPY_BOTTOM - 3, GALLERY_Z / 2, 24, 7);
  }
  for (const sign of signs) {
    if (sign.min.y !== 114 || sign.min.z < FACADE_Z || sign.max.z > FACADE_Z + 16) continue;
    swag(sign.min.x - 192, sign.min.x - 30, 154, FACADE_Z + 12, 16, 7);
  }

  // Gift stacks in the open atrium and at the food court tree.
  gifts(-1290, DECK, -760);
  gifts(340, 0, -40);
}

/** Props of the base map keep their place but play this station, so the variant has its own music. */
function withSeasonStation(props: readonly MapProp[]): MapProp[] {
  return props.map((p) => (p.kind === 'speaker' ? { ...p, station: 'shopping-natal' } : p));
}

/** The lift cabs wear their Christmas dress. */
function festiveLifts(props: readonly MapProp[]): MapProp[] {
  return props.map((p) => (p.kind === 'lift' ? { ...p, festive: true } : p));
}

/**
 * Shopping Sul Rio at Christmas: the base map with decoration, snow and its own radio. The base is called and
 * extended, so any change to Shopping Sul Rio shows up here.
 */
export function buildShoppingNatal(): MapDef {
  const base = buildShopping({ displayCar: false });
  const b = new MapBuilder();
  b.mirrored(() => decorations(b, base));

  return {
    ...base,
    id: 'shopping-natal',
    name: 'Shopping Sul Rio: Natal',
    subtitle: 'árvore, Papai Noel, renas e neve no átrio',
    boxes: [...base.boxes, ...b.boxes],
    lights: [...base.lights, ...b.lights],
    features: [...base.features, ...b.features],
    props: [...festiveLifts(withSeasonStation(base.props)), ...b.props],
    theme: {
      ...base.theme,
      skyTop: '#3b4c85',
      skyHorizon: '#cedcf6',
      skyBottom: '#e7efff',
      fog: '#dce8fa',
      hemiGround: '#878b9d',
      // Keep particles below the underside of the glass pane.
      snow: {
        min: { x: base.dropArea.minX, y: SNOW_FLOOR_Y, z: GALLERY_Z + SNOW_EDGE_UNITS },
        max: { x: base.dropArea.maxX, y: CANOPY_BOTTOM, z: -(GALLERY_Z + SNOW_EDGE_UNITS) },
        flakes: SNOW_FLAKES,
      },
    },
  };
}
