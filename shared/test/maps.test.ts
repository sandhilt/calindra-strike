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
