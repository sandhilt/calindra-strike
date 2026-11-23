import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld, STAND_HEIGHT, getMaps, describeBox, MapBuilder } from '../src/index.ts';

for (const map of getMaps()) {
  describe(`map ${map.id}`, () => {
    const world = new CollisionWorld(map);

    it('places separated flag bases on open ground in their team halves', () => {
      assert.equal(map.flagBases.length, 2);
      assert.ok(map.flagBases[0].z <= -150);
      assert.ok(map.flagBases[1].z >= 150);
      assert.ok(Math.hypot(map.flagBases[0].x - map.flagBases[1].x, map.flagBases[0].z - map.flagBases[1].z) >= 1800);
      for (const base of map.flagBases) {
        const y = world.groundBelow(base.x, map.dropHeight, base.z, 16);
        assert.equal(y, 0);
        assert.equal(world.hullOverlaps(base.x, y + 0.1, base.z, STAND_HEIGHT), false);
      }
    });

    it('sets the travel direction of every escalator', () => {
      for (const prop of map.props) {
        if (prop.kind === 'escalator') assert.ok(prop.travel === 'up' || prop.travel === 'down');
      }
    });

    it('has well formed boxes', () => {
      for (const b of map.boxes) {
        assert.ok(b.max.x > b.min.x, "b.max.x > b.min.x");
        assert.ok(b.max.y > b.min.y, "b.max.y > b.min.y");
        assert.ok(b.max.z > b.min.z, "b.max.z > b.min.z");
      }
    });

    it('drops airdrops onto open, reachable floor', () => {
      assert.ok(map.airdropPoints.length >= 5, "map.airdropPoints.length >= 5");
      for (const p of map.airdropPoints) {
        const y = world.groundBelow(p.x, map.dropHeight, p.z, 22);
        assert.ok(y >= 0, "y >= 0");
        assert.ok(y < 200, "y < 200");
        assert.equal(world.hullOverlaps(p.x, y + 0.1, p.z, STAND_HEIGHT), false);
      }
    });

    it('keeps the skydive start altitude clear', () => {
      const a = map.dropArea;
      for (let x = a.minX; x <= a.maxX; x += 97) {
        for (let z = a.minZ; z <= a.maxZ; z += 97) {
          assert.equal(world.hullOverlaps(x, map.dropHeight, z, STAND_HEIGHT), false);
        }
      }
    });

    it('keeps the drop area inside the walls', () => {
      const a = map.dropArea;
      const b = map.bounds;
      assert.ok(a.minX > b.minX, "a.minX > b.minX");
      assert.ok(a.maxX < b.maxX, "a.maxX < b.maxX");
      assert.ok(a.minZ > b.minZ, "a.minZ > b.minZ");
      assert.ok(a.maxZ < b.maxZ, "a.maxZ < b.maxZ");
    });
  });
}

for (const map of getMaps()) {
  it(`${map.id} has bounded, unique landmarks and semantic geometry`, () => {
    const landmarks = map.features.filter((f) => f.kind === 'landmark');
    assert.ok(landmarks.length > 0);
    assert.equal(new Set(landmarks.map((f) => f.name)).size, landmarks.length);
    for (const f of landmarks) {
      assert.ok(f.x >= map.bounds.minX && f.x <= map.bounds.maxX);
      assert.ok(f.z >= map.bounds.minZ && f.z <= map.bounds.maxZ);
    }
    for (const kind of ['door', 'stairs']) assert.ok(map.features.some((f) => f.kind === kind));
    assert.ok(map.features.some((f) => f.kind === 'window') || map.boxes.some((b) => describeBox(b)?.kind === 'window'));
    assert.ok(map.boxes.some((b) => b.stair));
    for (const b of map.boxes.filter((b) => b.stair)) assert.equal(describeBox(b), null);
  });
}

it('builder transforms features and disambiguates final quadrants', () => {
  const b = new MapBuilder();
  b.landmark('Centro', 0, 0);
  b.rotated(() => {
    b.landmark('Sala', 100, -200);
    b.wallX(0, 100, -200, 16, 100, 'concrete', [{ from: 20, to: 60, bottom: 0, top: 80 }]);
    b.wallZ(-100, 0, 200, 16, 100, 'concrete', [{ from: -60, to: -20, bottom: 20, top: 80 }]);
    b.stairs(0, 100, -200, -100, '+x', 64, 'concrete');
  });
  assert.deepEqual(b.features.filter((f) => f.kind === 'landmark').map((f) => f.name),
    ['Centro', 'Sala (NE)', 'Sala (SE)', 'Sala (SO)', 'Sala (NO)']);
  assert.partialDeepStrictEqual(b.features.find((f) => f.kind === 'door'), { x: 40, z: -200, width: 40 });
  assert.partialDeepStrictEqual(b.features.filter((f) => f.kind === 'door')[1], { x: 200, z: 40 });
  assert.partialDeepStrictEqual(b.features.find((f) => f.kind === 'stairs'), { x: 50, z: -150, width: 100, height: 64 });
});

const OUTFIT = { top: 0xff0000, legs: 0x0000ff, trim: 0xffffff, dress: false };

it('builder turns props with the half being replayed, and escalators hide their collision steps', () => {
  const b = new MapBuilder();
  b.mirrored(() => {
    b.prop({ kind: 'mannequin', x: 100, y: 0, z: -300, yaw: 0, outfit: OUTFIT });
    b.prop({ kind: 'vent', x: 10, y: 50, z: -20, yaw: Math.PI, width: 44, height: 30 });
    b.escalator(480, 576, -672, -352, '-z', 192, 'down');
  });
  assert.equal(b.props.length, 6);
  assert.partialDeepStrictEqual(b.props[0], { kind: 'mannequin', x: 100, z: -300, yaw: 0 });
  assert.partialDeepStrictEqual(b.props[3], { kind: 'mannequin', x: -100, z: 300, yaw: -Math.PI });
  assert.partialDeepStrictEqual(b.props[1], { kind: 'vent', x: 10, z: -20, yaw: Math.PI });
  assert.partialDeepStrictEqual(b.props[4], { kind: 'vent', x: -10, z: 20, yaw: 0 });
  assert.partialDeepStrictEqual(b.props[2], { kind: 'escalator', travel: 'down', x: 528, z: -352, dirX: 0, dirZ: -1, length: 320, width: 96, height: 192 });
  assert.partialDeepStrictEqual(b.props[5], { kind: 'escalator', travel: 'down', x: -528, z: 352, dirX: 0, dirZ: 1, length: 320 });
  assert.ok(b.boxes.length > 0);
  assert.ok(b.boxes.every((box) => box.solid && !box.visible && box.stair));
});

describe('the shopping map props', () => {
  const shopping = getMaps().find((m) => m.id === 'shopping');
  assert.ok(shopping);
  const world = new CollisionWorld(shopping);

  it('repeat the shared fixtures in point symmetric pairs, since the south half is the north one turned 180 degrees', () => {
    // A store's own ceiling fans belong to its brand: the store facing it across the mall is another brand, so they have no twin.
    // Store fans hang below the food court floor, the mall's own fans hang above the deck.
    const insideAStore = (p: { y: number; z: number }) => Math.abs(p.z) > 880 && p.y < 192;
    const shared = shopping.props.filter((p) => (p.kind === 'ceilingFan' && !insideAStore(p)) || p.kind === 'escalator' || p.kind === 'vent' || p.kind === 'lift');
    const key = (kind: string, x: number, z: number) => `${kind}@${Math.round(x)},${Math.round(z)}`;
    const seen = new Set(shared.map((p) => key(p.kind, p.x, p.z)));
    assert.ok(shared.length > 20);
    for (const p of shared) assert.ok(seen.has(key(p.kind, -p.x, -p.z)), `${p.kind} at ${p.x},${p.z} has no twin`);
  });

  it('draws every kind the map is meant to show', () => {
    const kinds = new Set(shopping.props.map((p) => p.kind));
    for (const kind of ['ceilingFan', 'mannequin', 'clothesRack', 'escalator', 'fountain', 'vent', 'lift'] as const) assert.ok(kinds.has(kind), kind);
  });

  it('has one ascending and one descending escalator between each pair of floors in each half', () => {
    const escalators = shopping.props.filter((p) => p.kind === 'escalator');
    assert.deepEqual(escalators.map(({ x, y, z, travel }) => ({ x, y, z, travel })), [
      { x: 1312, y: 192, z: -756, travel: 'up' },
      { x: -1312, y: 192, z: -756, travel: 'down' },
      { x: 528, y: 0, z: -352, travel: 'up' },
      { x: -528, y: 0, z: -352, travel: 'down' },
      { x: -1312, y: 192, z: 756, travel: 'up' },
      { x: 1312, y: 192, z: 756, travel: 'down' },
      { x: -528, y: 0, z: 352, travel: 'up' },
      { x: 528, y: 0, z: 352, travel: 'down' },
    ]);
  });

  it('keeps the props inside the walls', () => {
    for (const p of shopping.props) {
      assert.ok(p.x > shopping.bounds.minX && p.x < shopping.bounds.maxX, `${p.kind} x`);
      assert.ok(p.z > shopping.bounds.minZ && p.z < shopping.bounds.maxZ, `${p.kind} z`);
    }
  });

  it('keeps nobody out of reach of a kitchen window but inside the kitchen', () => {
    for (const r of shopping.restaurants) {
      const back = r.z + Math.sign(r.z) * 100;
      assert.equal(world.hullOverlaps(r.x, r.y + 0.1, back, STAND_HEIGHT), true, 'the kitchen behind the counter is solid');
      assert.equal(world.hullOverlaps(r.x, r.y + 0.1, r.z, STAND_HEIGHT), false, 'the counter front is open floor');
    }
  });
});
