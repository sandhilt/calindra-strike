import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld, getMaps, onDuct, surfaceOf } from '../src/index.ts';

const shopping = getMaps().find((map) => map.id === 'shopping');
assert.ok(shopping);
const ducts = shopping.boxes.filter((b) => b.duct);

describe('air conditioning ducts', () => {
  it('are sheet metal you walk under but cannot shoot through', () => {
    assert.ok(ducts.length > 0);
    for (const d of ducts) {
      assert.equal(surfaceOf(d.mat), 'metal');
      assert.equal(d.solid, false);
      assert.equal(d.shootThrough, false);
    }
  });

  it('stop a round and report the hit as on a duct', () => {
    const world = new CollisionWorld(shopping);
    const hit = world.trace(-1200, 360, -320, -1, 0, 0, 1000);
    assert.ok(hit);
    assert.equal(surfaceOf(hit.mat), 'metal');
    assert.ok(onDuct(shopping, -1200 - hit.t, 360, -320));
    assert.equal(onDuct(shopping, 0, 20, 0), false);
  });

  it('hang the atrium ducts from a riser instead of floating on the wall', () => {
    for (const d of ducts.filter((b) => b.min.y === 340)) {
      const riser = ducts.find((r) => r.min.y === d.max.y && r.min.z >= d.min.z && r.max.z <= d.max.z && Math.abs(r.min.x - d.min.x) < 1e-6 || r.min.y === d.max.y && r.min.z >= d.min.z && r.max.z <= d.max.z && Math.abs(r.max.x - d.max.x) < 1e-6);
      assert.ok(riser, `duct at z ${d.min.z} has a riser`);
    }
  });
});
