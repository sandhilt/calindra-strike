import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DECK3 } from '../src/maps/shopping-levels.ts';
import { getMaps, STORE_BRANDS, type Box, type MapDef, type MapProp, MALL_JANITOR, STAFF_UNIFORMS, staffOutfit } from '../src/index.ts';

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

/** How far a staff member's feet may sit from the solid floor players walk on (tuning value, units). */
const FEET_TO_FLOOR_UNITS = 4;

/** Top of the highest solid floor under (x, z) at or below height y: the level players stand on there. */
function walkableFloor(map: MapDef, x: number, z: number, y: number): number {
  let top = -Infinity;
  for (const box of map.boxes) {
    if (!box.solid || box.mat === 'clip') continue;
    if (x < box.min.x || x > box.max.x || z < box.min.z || z > box.max.z) continue;
    if (box.max.y <= y + FEET_TO_FLOOR_UNITS && box.max.y > top) top = box.max.y;
  }
  return top;
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

    it(`${map.id}: every staff member stands on the floor players walk on, so they are as tall as a player`, () => {
      for (const p of staffOf(map)) {
        const floor = walkableFloor(map, p.x, p.z, p.y);
        assert.ok(Math.abs(p.y - floor) <= FEET_TO_FLOOR_UNITS, `${p.role} at ${p.x}, ${p.z} has feet at ${p.y}, floor at ${floor}`);
        const knee = p.y + FEET_TO_FLOOR_UNITS + 1;
        const buried = map.boxes.find((box) => box.visible && box.mat !== 'clip' && p.x > box.min.x && p.x < box.max.x &&
          p.z > box.min.z && p.z < box.max.z && box.min.y < knee && box.max.y > knee);
        assert.equal(buried, undefined, `${p.role} at ${p.x}, ${p.z} has legs buried in a ${buried?.mat} box`);
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

  /** Each food court kitchen sits behind its restaurant's counter, 162 units in from the back wall; its staff stand on the deck. */
  const KITCHEN_HALF_WIDTH = 160;
  const KITCHEN_REACH_Z = 162;
  const kitchenStaffOf = (restaurant: (typeof shopping.restaurants)[number]) => staff.filter((p) =>
    Math.abs(p.x - restaurant.x) <= KITCHEN_HALF_WIDTH && Math.abs(p.z - restaurant.z) <= KITCHEN_REACH_Z &&
    Math.abs(p.y - restaurant.y) < 1);

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

  /** How far a register's screen may stand from the server or cashier who works it (tuning value). */
  const REGISTER_REACH_UNITS = 40;
  /** The register's screen sits on the counter, between waist and head height of the figure. */
  const REGISTER_MIN_UNITS = 8;
  const REGISTER_MAX_UNITS = 72;

  /** A register screen stands on or against the register's dark body (within 1 unit), never in the air. */
  const restsOnCharcoal = (screen: Box) => shopping.boxes.some((body) => body.mat === 'charcoal' &&
    screen.min.y >= body.min.y && screen.min.y <= body.max.y + 0.01 &&
    body.min.x - 1 <= screen.max.x && body.max.x + 1 >= screen.min.x && body.min.z - 1 <= screen.max.z && body.max.z + 1 >= screen.min.z);

  it('gives every food court server and every cashier a register on the counter within reach', () => {
    const workers = staff.filter((p) => p.role === 'server' || p.role === 'cashier');
    assert.ok(workers.length > 0);
    for (const p of workers) {
      const register: Box | undefined = shopping.boxes.find((box) => box.mat === 'screen' &&
        Math.hypot((box.min.x + box.max.x) / 2 - p.x, (box.min.z + box.max.z) / 2 - p.z) <= REGISTER_REACH_UNITS &&
        box.min.y >= p.y + REGISTER_MIN_UNITS && box.max.y <= p.y + REGISTER_MAX_UNITS && restsOnCharcoal(box));
      assert.ok(register, `${p.role} at ${p.x}, ${p.z} has a register within ${REGISTER_REACH_UNITS} units`);
      assert.equal(overlapsBody(register, p), false, `the register of the ${p.role} at ${p.x}, ${p.z} clips into them`);
    }
  });

  it('puts a cashier behind every till on the Mirante', () => {
    const tillNames = Object.values(STORE_BRANDS).filter((b) => b.kind === 'boutique' || b.name === 'Cacau Chou').map((b) => b.name);
    // Pharmacies have an open storefront and no till; every boutique does.
    const tillNames = Object.values(STORE_BRANDS).filter((b) => b.kind === 'boutique').map((b) => b.name);
    const landmarks = shopping.features.flatMap((f) => (f.kind === 'landmark' ? [f] : []));
    const tills = landmarks.filter((f) => f.name.includes('(Mirante)') && tillNames.some((n) => f.name.startsWith(n)));
    assert.ok(tills.length > 0);
    for (const till of tills) {
      const cashier = roles('cashier').find((p) => Math.abs(p.x - till.x) < 1 && p.y === DECK3);
      assert.ok(cashier, `a cashier behind ${till.name}`);
    }
  });

  /** Ground floor stores and the Mirante pharmacies share `dressStore`: a cashier and a till mate behind the counter. */
  const STORE_CREW_X = 34;
  const landmarks = shopping.features.flatMap((f) => (f.kind === 'landmark' ? [f] : []));
  const shopNames = Object.values(STORE_BRANDS).filter((b) => b.kind === 'shop').map((b) => b.name);
  const stores = landmarks.filter((f) => shopNames.some((n) => f.name.startsWith(n)) && !f.name.startsWith('Cacau Chou (Mirante)'));

  it('puts a cashier and a till mate behind the counter of every store and Mirante pharmacy', () => {
    assert.ok(stores.length >= 10, `found ${stores.length} stores`);
    for (const store of stores) {
      const crew = staff.filter((p) => Math.abs(Math.abs(p.x - store.x) - STORE_CREW_X) < 1 && Math.abs(p.z - store.z) < 160);
      assert.equal(crew.length, 2, `crew of ${store.name}`);
      assert.ok(crew.some((p) => p.role === 'cashier'), `cashier at ${store.name}`);
    }
  });

  it('staffs pharmacies with pharmacists and the stores with sellers, stockers and cleaners', () => {
    for (const role of ['seller', 'stocker', 'pharmacist', 'cleaner'] as const) assert.ok(roles(role).length > 0, role);
    for (const p of roles('pharmacist')) assert.ok(p.uniform === 'droga-raio' || p.uniform === 'pague-pouco');
  });
});

describe('staff uniforms', () => {
  it('dresses cooks in a white chef jacket in the brand colour and everyone else in the brand polo', () => {
    assert.equal(staffOutfit('kfg', 'cook').top, 0xf5f5f5);
    assert.equal(staffOutfit('kfg', 'cook').trim, STAFF_UNIFORMS.kfg.top);
    assert.equal(staffOutfit('mania-picanha', 'cook').trim, STAFF_UNIFORMS['mania-picanha'].trim);
    assert.deepEqual(staffOutfit('kfg', 'server'), STAFF_UNIFORMS.kfg);
    assert.deepEqual(staffOutfit('pandorga', 'cashier'), STAFF_UNIFORMS.pandorga);
  });

  it('puts pharmacists in a white lab coat, stockers in work denim and every cleaner in the mall uniform', () => {
    assert.equal(staffOutfit('droga-raio', 'pharmacist').top, 0xfafafa);
    assert.equal(staffOutfit('droga-raio', 'pharmacist').trim, STAFF_UNIFORMS['droga-raio'].top);
    assert.equal(staffOutfit('amerikanas', 'stocker').top, STAFF_UNIFORMS.amerikanas.top);
    assert.notEqual(staffOutfit('amerikanas', 'stocker').legs, STAFF_UNIFORMS.amerikanas.legs);
    assert.deepEqual(staffOutfit('riachuela', 'cleaner'), MALL_JANITOR);
    assert.deepEqual(staffOutfit('travessura', 'cleaner'), MALL_JANITOR);
    assert.deepEqual(staffOutfit('zarra', 'seller'), STAFF_UNIFORMS.zarra);
  });
});
