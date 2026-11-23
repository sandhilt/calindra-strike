import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld, getMaps } from '../../shared/src/index.ts';
import { NavGrid } from '../../server/src/nav.ts';
import { measureSightlines } from '../sightlines.ts';

function measure(id: string) {
  const map = getMaps().find((m) => m.id === id);
  assert.ok(map);
  const world = new CollisionWorld(map);
  return measureSightlines(world, new NavGrid(world, map), map);
}

describe('sightlines', () => {
  it('measures the same numbers twice', () => {
    assert.deepEqual(measure('forja'), measure('forja'));
  });

  // Before the cover: 50.2% of pairs clear, 38.0% over 800 units, lane p90 1994. Raise these only on purpose.
  it('keeps Shopping Sul Rio free of long clean shots', () => {
    const s = measure('shopping');
    assert.ok(s.clearPairs <= 0.25, `${(s.clearPairs * 100).toFixed(1)}% of pairs have a clear line`);
    assert.ok(s.longClearPairs <= 0.16, `${(s.longClearPairs * 100).toFixed(1)}% of pairs have a clear line over 800 units`);
    assert.ok(s.laneP90 <= 1500, `lane p90 is ${Math.round(s.laneP90)} units`);
  });
});
