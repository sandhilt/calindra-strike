import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld, STAND_HEIGHT, getMaps } from '@calindra-strike/shared';
import { NavGrid } from '../src/nav.ts';

const PLAYER_HALF_UNITS = 16;

/** Ids of the nodes from which `target` can be reached on foot (walk, step, jump up, drop down). */
function nodesThatReach(nav: NavGrid, target: number): Set<number> {
  const incoming = new Map<number, number[]>();
  for (const n of nav.nodes) for (const e of n.edges) incoming.set(e.to, [...(incoming.get(e.to) ?? []), n.id]);
  const seen = new Set([target]);
  const queue = [target];
  for (let i = 0; i < queue.length; i++) {
    for (const from of incoming.get(queue[i]) ?? []) {
      if (seen.has(from)) continue;
      seen.add(from);
      queue.push(from);
    }
  }
  return seen;
}

for (const map of getMaps()) {
  describe(`landing on ${map.id}`, () => {
    it('leaves no surface a glider can land on and never get off, so nobody is stuck out of play', () => {
      const world = new CollisionWorld(map);
      const nav = new NavGrid(world, map);
      const base = map.flagBases[0];
      const start = nav.nearest(base.x, 0, base.z);
      assert.ok(start);
      const canWalkToBase = nodesThatReach(nav, start.id);
      const stranded = nav.nodes
        .filter((n) => !canWalkToBase.has(n.id))
        // a glider cannot be inside a solid, so a node under a clip column is never a landing spot
        .filter((n) => !world.hullOverlaps(n.x, map.dropHeight, n.z, STAND_HEIGHT))
        .filter((n) => Math.abs(world.groundBelow(n.x, map.dropHeight, n.z, PLAYER_HALF_UNITS) - n.y) < 1)
        .map((n) => `${n.x},${n.y},${n.z}`);
      assert.deepEqual(stranded.slice(0, 8), [], `${stranded.length} landing spots with no way back to the floor`);
    });
  });
}
