import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AUDIBLE_INTENSITY, HEARING_REF_UNITS, SURFACE_OF, anglesToward, dirFromAngles, getMaps, heardIntensity, surfaceOf } from '../src/index.ts';

describe('heardIntensity', () => {
  it('is full volume inside the reference distance and falls off beyond it', () => {
    assert.equal(heardIntensity(0, 260), 1);
    assert.equal(heardIntensity(260, 260), 1);
    assert.ok(heardIntensity(520, 260) < 1 && heardIntensity(1040, 260) < heardIntensity(520, 260));
  });

  it('follows the browser inverse-distance curve with a rolloff of 1.1', () => {
    assert.ok(Math.abs(heardIntensity(1000, 200) - 200 / (200 + 1.1 * 800)) < 1e-12);
  });

  it('puts a rifle shot under the audible floor a few thousand units away', () => {
    assert.ok(heardIntensity(600, HEARING_REF_UNITS.shot) > AUDIBLE_INTENSITY);
    assert.ok(heardIntensity(3000, HEARING_REF_UNITS.shot) < AUDIBLE_INTENSITY);
  });
});

describe('anglesToward', () => {
  it('looks along the direction dirFromAngles gives back', () => {
    const from = { x: 10, y: 56, z: -30 };
    for (const to of [{ x: 200, y: 0, z: -300 }, { x: -50, y: 120, z: 90 }, { x: 10, y: 0, z: -330 }]) {
      const { yaw, pitch } = anglesToward(from, to);
      const d = dirFromAngles(yaw, pitch);
      const length = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
      assert.ok(Math.abs(d.x - (to.x - from.x) / length) < 1e-9 && Math.abs(d.y - (to.y - from.y) / length) < 1e-9 && Math.abs(d.z - (to.z - from.z) / length) < 1e-9);
    }
  });

  it('faces north for a point at -z and looks down at the floor', () => {
    const { yaw, pitch } = anglesToward({ x: 0, y: 56, z: 0 }, { x: 0, y: 0, z: -100 });
    assert.ok(Math.abs(yaw) < 1e-12);
    assert.ok(pitch < 0);
  });
});

describe('surfaces', () => {
  it('give every material a surface, and every map box one it can sound as', () => {
    for (const map of getMaps()) for (const box of map.boxes) assert.ok(surfaceOf(box.mat), `${map.id} ${box.mat}`);
    assert.equal(new Set(Object.values(SURFACE_OF)).size, 13);
  });
});
