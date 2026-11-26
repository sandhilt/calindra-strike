import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getMaps, type MapDef } from '../src/index.ts';

function screensOf(map: MapDef) {
  return map.props.flatMap((p) => (p.kind === 'adScreen' ? [p] : []));
}

describe('Shopping Sul Rio ad screens', () => {
  for (const id of ['shopping', 'shopping-natal']) {
    const map = getMaps().find((m) => m.id === id);
    assert.ok(map);
    const screens = screensOf(map);

    it(`${id} has screens in mirrored pairs`, () => {
      assert.ok(screens.length >= 8, `${screens.length} screens`);
      for (const s of screens) {
        assert.ok(screens.some((o) => Math.abs(o.x + s.x) < 1e-6 && Math.abs(o.z + s.z) < 1e-6 && o.y === s.y), `no mirror for ${s.x},${s.z}`);
      }
    });

    it(`${id} hangs every screen on the face of a solid body`, () => {
      for (const s of screens) {
        // the screen faces local -z turned by yaw: its back points the other way, into the body
        const backX = Math.sin(s.yaw) * 3;
        const backZ = Math.cos(s.yaw) * 3;
        const px = s.x + backX;
        const pz = s.z + backZ;
        const body = map.boxes.some((b) => b.solid && px >= b.min.x && px <= b.max.x && pz >= b.min.z && pz <= b.max.z && s.y > b.min.y && s.y < b.max.y);
        assert.ok(body, `screen at ${s.x},${s.y},${s.z} hangs on nothing`);
      }
    });
  }
});
