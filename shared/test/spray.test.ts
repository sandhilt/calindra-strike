import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld, MapBuilder, SPRAY_RANGE, eyeHeight, getMaps, sprayPlacement } from '../src/index.ts';
import { closeTo } from './helpers.ts';

const b = new MapBuilder();
b.add(-200, -20, -200, 200, 0, 200, 'ground');
b.add(-200, 0, -100, 200, 180, -90, 'ground');
b.add(-100, 0, -80, -90, 180, 200, 'ground');
const world = new CollisionWorld({ ...getMaps()[0], boxes: b.boxes });
const state = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, ducked: false };

describe('sprayPlacement', () => {
  it('hits the wall along the shot direction with its outward normal', () => {
    assert.deepEqual(sprayPlacement(world, state, SPRAY_RANGE), { x: 0, y: eyeHeight(state), z: -90, nx: 0, ny: 0, nz: 1 });
    const hit = sprayPlacement(world, { ...state, yaw: Math.PI / 2, ducked: true }, SPRAY_RANGE);
    assert.ok(hit);
    closeTo(hit.x, -90);
    closeTo(hit.z, 0);
    closeTo(hit.y, eyeHeight({ ducked: true }));
    assert.deepEqual([hit.nx, hit.ny, hit.nz], [1, 0, 0]);
  });

  it('does not hit beyond range or when looking at the sky', () => {
    assert.equal(sprayPlacement(world, state, 80), null);
    assert.equal(sprayPlacement(world, { ...state, pitch: Math.PI / 2 }, SPRAY_RANGE), null);
  });

  it('positive pitch looks up and negative pitch hits the floor', () => {
    const hit = sprayPlacement(world, { ...state, pitch: -Math.PI / 2 }, SPRAY_RANGE);
    assert.ok(hit);
    closeTo(hit.y, 0);
    assert.deepEqual([hit.nx, hit.ny, hit.nz], [0, 1, 0]);
  });
});
