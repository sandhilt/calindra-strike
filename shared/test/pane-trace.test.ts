import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld, getMaps, surfaceOf } from '../src/index.ts';

const shopping = getMaps().find((map) => map.id === 'shopping');
assert.ok(shopping);
const world = new CollisionWorld(shopping);
const pane = shopping.boxes.find((b) => b.visible && b.shootThrough && b.solid && b.mat === 'glass');
assert.ok(pane);
const cx = (pane.min.x + pane.max.x) / 2;
const cy = (pane.min.y + pane.max.y) / 2;
const cz = (pane.min.z + pane.max.z) / 2;
const alongX = pane.max.x - pane.min.x < pane.max.z - pane.min.z;
const ox = alongX ? pane.min.x - 4 : cx;
const oz = alongX ? cz : pane.min.z - 4;
const dx = alongX ? 1 : 0;
const dz = alongX ? 0 : 1;

describe('tracePane', () => {
  it('rings off a glass pane that bullets fly through', () => {
    const hit = world.tracePane(ox, cy, oz, dx, 0, dz, 64);
    assert.ok(hit, 'the pane is found');
    assert.ok(Math.abs(hit.t - 4) < 0.01, 'at its face');
    assert.equal(surfaceOf(hit.mat), 'glass');
  });

  it('ignores a pane past where the round stops', () => {
    assert.equal(world.tracePane(ox, cy, oz, dx, 0, dz, 2), null);
  });

  it('leaves the bullet trace unchanged', () => {
    const wall = world.trace(ox, cy, oz, dx, 0, dz, 4096);
    assert.ok(!wall || wall.t > 4, 'the round flies on through the glass');
  });

  it('finds the fountain water', () => {
    const hit = world.tracePane(0, 300, 0, 0, -1, 0, 400);
    assert.ok(hit);
    assert.equal(hit.mat, 'water');
  });
});
