import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BTN, CollisionWorld, STAND_HEIGHT, WEAPON, applyCmd, cloneState, createPlayerState, getMaps, spawnState } from '@calindra-strike/shared';
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

/** Nav surfaces stop at this height, so a landing above it is invisible to the test above. Same value as MAX_SURFACE in nav.ts. */
const NAV_CEILING_UNITS = 600;

for (const map of getMaps()) {
  describe(`gliders on the highest solids of ${map.id}`, () => {
    it('can always walk off a solid that stands above the nav grid, instead of being stranded up there', () => {
      const world = new CollisionWorld(map);
      const tall = map.boxes.filter((b) => b.solid && b.mat !== 'clip' && b.max.y >= NAV_CEILING_UNITS);
      let checked = 0;
      for (const box of tall) {
        const x = (box.min.x + box.max.x) / 2;
        const z = (box.min.z + box.max.z) / 2;
        if (world.hullOverlaps(x, map.dropHeight, z, STAND_HEIGHT)) continue;
        const glider = createPlayerState();
        spawnState(glider, x, map.dropHeight, z, 0, WEAPON.RIFLE);
        for (let i = 0; i < 60 * 20 && glider.dropping; i++) applyCmd(world, glider, { seq: i, buttons: 0, yaw: 0, pitch: 0, weapon: 0, interp: 0 }, 1);
        if (glider.y < NAV_CEILING_UNITS) continue;
        checked++;
        const escapes = [0, 1, 2, 3].map((quarter) => {
          const walker = cloneState(glider);
          for (let i = 0; i < 60 * 6; i++) applyCmd(world, walker, { seq: i, buttons: BTN.FWD, yaw: (quarter * Math.PI) / 2, pitch: 0, weapon: 0, interp: 0 }, 1);
          return walker.y < NAV_CEILING_UNITS - 20;
        });
        assert.ok(escapes.some(Boolean), `a glider landing on the ${box.mat} box at ${x},${z} (top ${box.max.y}) cannot get off it`);
      }
      if (map.id === 'shopping') assert.ok(checked >= 4, 'the shaft walls were checked: ' + checked);
    });
  });
}

/** How far past the outermost tall wall a point is, 0 when it is inside. */
function outsideBy(map: ReturnType<typeof getMaps>[number], x: number, z: number): number {
  const walls = map.boxes.filter((b) => b.solid && b.mat !== 'clip' && b.max.y >= 200);
  const edgeX = Math.max(...walls.map((b) => b.max.x));
  const edgeZ = Math.max(...walls.map((b) => b.max.z));
  return Math.max(Math.abs(x) - edgeX, Math.abs(z) - edgeZ, 0);
}

for (const map of getMaps()) {
  describe(`outside the walls of ${map.id}`, () => {
    it('has no floor a player can stand on beyond the outermost wall', () => {
      const world = new CollisionWorld(map);
      const standable: string[] = [];
      for (const axis of ['x', 'z'] as const) for (const sign of [-1, 1]) for (let reach = 0; reach <= 160; reach += 4) {
        const edge = Math.max(...map.boxes.filter((b) => b.solid && b.mat !== 'clip' && b.max.y >= 200).map((b) => (axis === 'x' ? b.max.x : b.max.z)));
        const p = sign * (edge + reach);
        const x = axis === 'x' ? p : 0;
        const z = axis === 'z' ? p : 0;
        const ground = world.groundBelow(x, map.dropHeight, z, PLAYER_HALF_UNITS);
        if (ground > -50 && !world.hullOverlaps(x, ground, z, STAND_HEIGHT)) standable.push(`${axis}=${p}`);
      }
      assert.deepEqual(standable.slice(0, 6), [], `${standable.length} standing spots outside the walls`);
    });

    it('keeps a glider steered at each wall inside the map', () => {
      const world = new CollisionWorld(map);
      for (const yaw of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
        const glider = createPlayerState();
        const near = Math.min(map.bounds.maxX, map.bounds.maxZ) - 160;
        spawnState(glider, 0, map.dropHeight, 0, yaw, WEAPON.RIFLE);
        glider.x = Math.sin(yaw) === 0 ? 0 : -Math.sign(Math.sin(yaw)) * 0;
        for (let i = 0; i < 60 * 40; i++) applyCmd(world, glider, { seq: i, buttons: BTN.FWD, yaw, pitch: 0, weapon: 0, interp: 0 }, 1);
        assert.equal(outsideBy(map, glider.x, glider.z), 0, `a glider steered at yaw ${yaw.toFixed(2)} ended outside at ${Math.round(glider.x)},${Math.round(glider.z)} (floor ${near})`);
      }
    });
  });
}
