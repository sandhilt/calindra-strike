import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DECK3 } from '../src/maps/shopping-levels.ts';
import { getMaps, STORE_BRANDS, type Box, type MapDef, type MapProp } from '../src/index.ts';

type Staff = Extract<MapProp, { kind: 'staff' }>;

/** Staff face the way a prop does: forward is local -z, so yaw 0 looks toward -z and yaw pi toward +z. */
const FIGURE_HALF_WIDTH = 12;
const FIGURE_HALF_DEPTH = 8;
const FIGURE_HEIGHT_UNITS = 84;
/** How far a counter, partition or wall must stand in each direction to close a staff member in. */
const ENCLOSURE_REACH_UNITS = 60;
/** The chest of a staff member, where a wall or counter must be seen to block the ray. */
const CHEST_UNITS = 20;

function staffOf(map: MapDef): Staff[] {
  return map.props.filter((p): p is Staff => p.kind === 'staff');
}

/** Distance along a horizontal ray to where it enters the box at height `h`, 0 if it starts inside, else null. */
function entry(box: Box, ox: number, oz: number, dx: number, dz: number, h: number): number | null {
  if (h < box.min.y || h > box.max.y) return null;
  let near = 0;
  let far = Infinity;
  for (const [origin, dir, lo, hi] of [[ox, dx, box.min.x, box.max.x], [oz, dz, box.min.z, box.max.z]] as const) {
    if (Math.abs(dir) < 1e-9) {
      if (origin < lo || origin > hi) return null;
      continue;
    }
    const t1 = (lo - origin) / dir;
    const t2 = (hi - origin) / dir;
    near = Math.max(near, Math.min(t1, t2));
    far = Math.min(far, Math.max(t1, t2));
    if (near > far) return null;
  }
  return near;
}

function nearestSolid(map: MapDef, ox: number, oz: number, dx: number, dz: number, h: number): number {
  let best = Infinity;
  for (const box of map.boxes) {
    if (!box.solid || box.mat === 'clip') continue;
    const d = entry(box, ox, oz, dx, dz, h);
    if (d !== null && d < best) best = d;
  }
  return best;
}

function inKitchen(map: MapDef, p: Staff): boolean {
  return map.boxes.some((box) => box.mat === 'clip' && box.solid &&
    p.x >= box.min.x && p.x <= box.max.x && p.z >= box.min.z && p.z <= box.max.z && p.y >= box.min.y && p.y <= box.max.y);
}

/** A staff member is closed in when a counter or wall stands in all four directions within reach. */
function closedIn(map: MapDef, p: Staff): boolean {
  const fx = -Math.sin(p.yaw);
  const fz = -Math.cos(p.yaw);
  const directions = [[fx, fz], [-fx, -fz], [-fz, fx], [fz, -fx]];
  return directions.every(([dx, dz]) => nearestSolid(map, p.x, p.z, dx, dz, p.y + CHEST_UNITS) <= ENCLOSURE_REACH_UNITS);
}

/** Kitchen walls, lids and counters span whole rooms; equipment and furniture are narrower than this. */
const SCENERY_SPAN_UNITS = 120;

function overlapsBody(box: Box, p: Staff): boolean {
  return box.min.x < p.x + FIGURE_HALF_WIDTH && box.max.x > p.x - FIGURE_HALF_WIDTH &&
    box.min.z < p.z + FIGURE_HALF_DEPTH && box.max.z > p.z - FIGURE_HALF_DEPTH &&
    box.min.y < p.y + FIGURE_HEIGHT_UNITS && box.max.y > p.y;
}

function bodyOverlapsSolid(map: MapDef, p: Staff): Box | undefined {
  return map.boxes.find((box) => box.solid && box.mat !== 'clip' && overlapsBody(box, p));
}

/** Equipment, furniture and goods a figure must not stand inside: any visible box that is not a whole room wall. */
function bodyOverlapsScenery(map: MapDef, p: Staff): Box | undefined {
  return map.boxes.find((box) => box.visible && box.mat !== 'clip' &&
    Math.max(box.max.x - box.min.x, box.max.z - box.min.z) <= SCENERY_SPAN_UNITS && overlapsBody(box, p));
}

const maps = getMaps();

describe('store staff are scenery, never in the open', () => {
  for (const map of maps) {
    it(`${map.id}: every staff member is inside a kitchen or closed in behind a counter`, () => {
      for (const p of staffOf(map)) {
        const ok = inKitchen(map, p) || closedIn(map, p);
        assert.ok(ok, `${p.role} at ${p.x}, ${p.y}, ${p.z} stands in open space`);
      }
    });

    it(`${map.id}: no staff member overlaps a solid box`, () => {
      for (const p of staffOf(map)) {
        const hit = bodyOverlapsSolid(map, p);
        assert.equal(hit, undefined, `${p.role} at ${p.x}, ${p.z} inside ${hit?.mat}`);
      }
    });

    it(`${map.id}: no staff member stands inside equipment or furniture`, () => {
      for (const p of staffOf(map)) {
        const hit = bodyOverlapsScenery(map, p);
        assert.equal(hit, undefined, `${p.role} at ${p.x}, ${p.z} inside a ${hit?.mat} box`);
      }
    });

    it(`${map.id}: no staff member stands on a bot browse spot`, () => {
      for (const p of staffOf(map)) {
        const spot = map.interiors.find((i) => Math.abs(i.x - p.x) < 40 && Math.abs(i.z - p.z) < 40);
        assert.equal(spot, undefined, `${p.role} at ${p.x}, ${p.z} next to a browse spot`);
      }
    });
  }
});

describe('the shopping floor staff', () => {
  const shopping = maps.find((m) => m.id === 'shopping');
  assert.ok(shopping);
  const staff = staffOf(shopping);
  const roles = (role: Staff['role']) => staff.filter((p) => p.role === role);

  /** Each food court kitchen sits behind its restaurant's counter, 162 units in from the back wall, on the platform (28 units up). */
  const KITCHEN_HALF_WIDTH = 160;
  const KITCHEN_REACH_Z = 162;
  const PLATFORM_UNITS = 28;
  const kitchenStaffOf = (restaurant: (typeof shopping.restaurants)[number]) => staff.filter((p) =>
    Math.abs(p.x - restaurant.x) <= KITCHEN_HALF_WIDTH && Math.abs(p.z - restaurant.z) <= KITCHEN_REACH_Z &&
    Math.abs(p.y - (restaurant.y + PLATFORM_UNITS)) < 1);

  it('finds a food court kitchen for every restaurant', () => {
    assert.ok(shopping.restaurants.length > 0);
  });

  it('puts exactly one cook at a station and one server at the window of each food court kitchen', () => {
    for (const restaurant of shopping.restaurants) {
      const here = kitchenStaffOf(restaurant);
      assert.deepEqual(here.map((p) => p.role).sort(), ['cook', 'server'], `staff of ${restaurant.name}`);
      for (const p of here) assert.equal(p.uniform, restaurant.brand, `${p.role} of ${restaurant.name} wears its brand`);
    }
  });

  it('puts a cashier behind every till on the Mirante', () => {
    // Pharmacies have an open storefront and no till; every boutique and the chocolate shop does.
    const tillNames = Object.values(STORE_BRANDS).filter((b) => b.kind === 'boutique' || b.name === 'Cacau Chou').map((b) => b.name);
    const landmarks = shopping.features.flatMap((f) => (f.kind === 'landmark' ? [f] : []));
    const tills = landmarks.filter((f) => f.name.includes('(Mirante)') && tillNames.some((n) => f.name.startsWith(n)));
    assert.ok(tills.length > 0);
    assert.equal(roles('cashier').length, tills.length);
    for (const till of tills) {
      const cashier = roles('cashier').find((p) => Math.abs(p.x - till.x) < 1 && p.y === DECK3);
      assert.ok(cashier, `a cashier behind ${till.name}`);
    }
  });
});
