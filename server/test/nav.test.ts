import { BOMB_SITE_RADIUS_UNITS, CollisionWorld, getMaps, inBombReach } from '@calindra-strike/shared';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NavGrid } from '../src/nav.ts';

const [forja, escritorio, shopping] = getMaps();
const navF = new NavGrid(new CollisionWorld(forja), forja);
const navE = new NavGrid(new CollisionWorld(escritorio), escritorio);
const navS = new NavGrid(new CollisionWorld(shopping), shopping);

function route(nav: NavGrid, a: [number, number, number], b: [number, number, number]) {
  const s = nav.nearest(...a);
  const g = nav.nearest(...b);
  assert.ok(s);
  assert.ok(g);
  return nav.findPath(s!, g!);
}

describe('NavGrid', () => {
  it('builds a reasonably sized graph', () => {
    assert.ok(navF.nodes.length > 3000, "Expected navF.nodes.length > 3000");
    assert.ok(navE.nodes.length > 2000, "Expected navE.nodes.length > 2000");
  });

  it('climbs the anvil stairs to the top of the center platform', () => {
    const p = route(navF, [900, 0, 300], [0, 96, -150]);
    assert.notEqual(p, null);
    assert.equal(p!.at(-1)!.y, 96);
    // no single edge rises more than a jump
    for (let i = 1; i < p!.length; i++) assert.ok(p![i].y - p![i - 1].y <= 40, "Expected p![i].y - p![i - 1].y <= 40");
  });

  it('walks through a warehouse door to the inside', () => {
    const p = route(navF, [500, 0, -600], [960, 0, -1100]);
    assert.notEqual(p, null);
    assert.equal(p!.every((n) => n.y < 1), true);
  });

  it('uses the crate jump chain to get on top of the container', () => {
    const p = route(navF, [700, 0, -300], [1040, 104, -512]);
    assert.notEqual(p, null);
    assert.equal(p!.at(-1)!.y, 104);
    assert.equal(p!.some((n) => n.y === 40 || n.y === 72), true);
  });

  it('gets down from a skydive-only perch', () => {
    const p = route(navF, [288, 232, -1312], [0, 0, -600]);
    assert.notEqual(p, null);
  });

  it('reaches the office mezzanine via its stairs', () => {
    const p = route(navE, [-200, 0, -300], [-900, 128, -940]);
    assert.notEqual(p, null);
    assert.equal(p!.at(-1)!.y, 128);
  });

  it('rides an escalator from the mall atrium up to each food court', () => {
    for (const side of [-1, 1]) {
      // the up escalator of each half is the east one in the north and the west one in the south
      const p = route(navS, [-side * 528, 0, side * 300], [-side * 528, 192, side * 860]);
      assert.notEqual(p, null);
      assert.equal(p!.at(-1)!.y, 192);
      assert.ok(p!.some((n) => n.y > 0 && n.y < 192), 'passes the escalator steps');
      for (let i = 1; i < p!.length; i++) assert.ok(p![i].y - p![i - 1].y <= 40, 'no edge rises more than a jump');
    }
  });

  it('comes back down from each food court counter by an escalator, never through the floor', () => {
    for (const r of shopping.restaurants) {
      assert.equal(navS.nearest(r.x, r.y, r.z)?.y, r.y, "the counter has a walkable node on the food court");
      for (const base of shopping.flagBases) {
        const p = route(navS, [r.x, r.y, r.z], [base.x, 0, base.z]);
        assert.notEqual(p, null);
        assert.equal(p!.at(-1)!.y, 0);
        assert.ok(p!.some((n) => n.y > 0 && n.y < 192), 'passes the escalator steps');
      }
    }
  });

  it('climbs from the food court to the Mirante and back by the stair bays, one escalator step at a time', () => {
    for (const side of [-1, 1]) {
      const up = route(navS, [-side * 1120, 192, side * 744], [-side * 1120, 384, side * 744]);
      assert.notEqual(up, null);
      assert.equal(up!.at(-1)!.y >= 384, true);
      for (let i = 1; i < up!.length; i++) assert.ok(up![i].y - up![i - 1].y <= 40, 'no edge rises more than a jump');
      assert.ok(up!.some((n) => n.y > 192 && n.y < 384), 'passes the bay escalator steps');
      const down = route(navS, [side * 1120, 384, side * 744], [side * 1120, 192, side * 744]);
      assert.notEqual(down, null);
      assert.equal(down!.at(-1)!.y, 192);
    }
  });

  it('reaches the Mirante from the base of each team without leaving the walkable floors', () => {
    for (const base of shopping.flagBases) {
      for (const side of [-1, 1]) {
        const p = route(navS, [base.x, 0, base.z], [0, 384, side * 880]);
        assert.notEqual(p, null);
        assert.equal(p!.some((n) => n.y >= 384), true);
      }
    }
  });

  it('connects both ground bases and the fountain to each Mirante laptop home', () => {
    assert.ok(shopping.defuseBases);
    const site = shopping.defuseSite;
    assert.ok(site);
    const groundStart = navS.nearest(shopping.flagBases[0].x, 0, shopping.flagBases[0].z);
    assert.ok(groundStart);
    const reachable = navS.reachableFrom(groundStart);
    for (const base of shopping.defuseBases) {
      assert.ok(reachable.every(node => node.y >= base.y || !inBombReach(node, base, BOMB_SITE_RADIUS_UNITS)),
        'plant radius stays clear of reachable surfaces on lower floors');
      for (const ground of shopping.flagBases) {
        const path = route(navS, [ground.x, 0, ground.z], [base.x, base.y, base.z]);
        assert.equal(path?.at(-1)?.y, base.y);
        assert.ok(path?.some(node => node.y > 192 && node.y < 384), 'route uses a Mirante escalator');
      }
      const viaLift = route(navS, [0, 384, Math.sign(base.z) * 760], [base.x, base.y, base.z]);
      assert.equal(viaLift?.at(-1)?.y, base.y);
      assert.ok(viaLift?.every(node => node.y >= base.y), 'base is walkable directly from the top lift exit');
    }
    const basin: [number, number, number] = [site.x, site.y, site.z + 96];
    for (const home of shopping.defuseBases) {
      const base: [number, number, number] = [home.x, home.y, home.z];
      assert.equal(route(navS, base, basin)?.at(-1)?.y, site.y);
      assert.equal(route(navS, basin, base)?.at(-1)?.y, home.y);
    }
  });

  it('rides the glass lift between the atrium and the Mirante, in both directions, with one lift edge each way', () => {
    for (const side of [-1, 1]) {
      for (const [from, to] of [
        [[0, 0, side * 520], [0, 384, side * 800]],
        [[0, 384, side * 760], [0, 0, side * 450]],
      ] as const) {
        const start = navS.nearest(from[0], from[1], from[2]);
        assert.ok(start);
        const p = route(navS, [...from], [...to]);
        assert.ok(p);
        const edges = p.map((n, i) => navS.edgeBetween(i === 0 ? start : p[i - 1], n));
        assert.equal(edges.filter((e) => e?.lift).length, 1, 'one ride');
      }
    }
  });

  it('never lets a walker jump or drop into or out of a shaft between floors', () => {
    const [lift] = shopping.lifts;
    for (const n of navS.nodes) {
      const inside = (x: number, z: number) => x > lift.minX && x < lift.maxX && z > lift.minZ && z < lift.maxZ;
      for (const e of n.edges) {
        const m = navS.nodes[e.to];
        if (e.lift || (!inside(n.x, n.z) && !inside(m.x, m.z))) continue;
        assert.ok(Math.abs(m.y - n.y) <= 18, 'edge ' + [n.x, n.y, n.z] + ' to ' + [m.x, m.y, m.z] + ' climbs or falls in the shaft');
      }
    }
  });

  it('walks down the candy aisle of the Amerikanas store', () => {
    const landmark = shopping.features.find((f) => f.kind === 'landmark' && f.name === 'Amerikanas');
    assert.ok(landmark);
    const north = landmark.z < 0;
    // The aisle runs along room x 232 at depth 216 on the bot grid; the south half is the north one turned 180 degrees.
    const aisle: [number, number, number] = north ? [landmark.x + 232, 0, shopping.bounds.minZ + 216] : [landmark.x - 232, 0, shopping.bounds.maxZ - 216];
    const p = route(navS, [0, 0, north ? -450 : 450], aisle);
    assert.notEqual(p, null);
    const end = p!.at(-1)!;
    assert.ok(Math.hypot(end.x - aisle[0], end.z - aisle[2]) < 30, 'ends in the aisle');
    assert.equal(p!.every((n) => n.y < 1), true);
  });

  it('walks into a mall store through its door', () => {
    const p = route(navS, [0, 0, -450], [-384, 0, shopping.bounds.minZ + 152]);
    assert.notEqual(p, null);
    assert.equal(p!.every((n) => n.y < 1), true);
  });
});
