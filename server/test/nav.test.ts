import { CollisionWorld, getMaps } from '@calindra-strike/shared';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NavGrid } from '../src/nav.ts';

const [forja, escritorio] = getMaps();
const navF = new NavGrid(new CollisionWorld(forja), forja);
const navE = new NavGrid(new CollisionWorld(escritorio), escritorio);

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
});
