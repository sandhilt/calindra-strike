import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeBox, MapBuilder, type Box } from '../src/index.ts';
function box(w: number, h: number, d: number, y = 0): Box {
  const b = new MapBuilder();
  b.block(0, 0, w, d, h, 'crate', y);
  return b.boxes[0];
}
test('scenery thresholds and exclusions', () => {
  for (const extra of [{ visible: false }, { solid: false }, { stair: true as const }]) {
    assert.equal(describeBox({ ...box(64, 72, 64), ...extra }), null);
  }
  assert.equal(describeBox(box(100, 32, 100, -32)), null);
  assert.equal(describeBox(box(64, 23, 64)), null);
  assert.deepEqual(describeBox(box(64, 24, 64)), { kind: 'cover', coverFor: null });
  assert.deepEqual(describeBox(box(64, 35, 64)), { kind: 'cover', coverFor: null });
  assert.deepEqual(describeBox(box(64, 36, 64)), { kind: 'cover', coverFor: 'crouch' });
  assert.deepEqual(describeBox(box(64, 72, 64)), { kind: 'cover', coverFor: 'stand' });
  assert.equal(describeBox(box(96, 72, 64))?.kind, 'wall');
  assert.equal(describeBox(box(24, 72, 64))?.kind, 'wall');
  assert.equal(describeBox(box(96, 24, 96, 64))?.kind, 'platform');
  assert.equal(describeBox(box(96, 24, 96, 63))?.kind, 'cover');
  assert.equal(describeBox({ ...box(24, 72, 64), mat: 'glass' })?.kind, 'window');
});
