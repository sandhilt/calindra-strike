import { CollisionWorld, getMaps } from '@calindra-strike/shared';
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
      const p = route(navS, [0, 0, side * 450], [0, 192, side * 860]);
      assert.notEqual(p, null);
      assert.equal(p!.at(-1)!.y, 192);
      for (let i = 1; i < p!.length; i++) assert.ok(p![i].y - p![i - 1].y <= 40, 'no edge rises more than a jump');
    }
  });

  it('comes back down from each food court counter by an escalator, never through the floor', () => {
    for (const r of shopping.restaurants) {
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
      const up = route(navS, [0, 192, side * 880], [0, 384, side * 880]);
      assert.notEqual(up, null);
      assert.equal(up!.at(-1)!.y >= 384, true);
      for (let i = 1; i < up!.length; i++) assert.ok(up![i].y - up![i - 1].y <= 40, 'no edge rises more than a jump');
      assert.ok(up!.some((n) => n.y > 192 && n.y < 384), 'passes the bay escalator steps');
      const down = route(navS, [0, 384, side * 880], [0, 192, side * 800]);
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

  it('walks into a mall store through its door', () => {
    const p = route(navS, [0, 0, -450], [-352, 0, -1000]);
    assert.notEqual(p, null);
    assert.equal(p!.every((n) => n.y < 1), true);
  });
});
