import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FLY_SPEED, lookBy, stepFly } from '../src/debug/fly-camera.ts';

const origin = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
const forward = { forward: 1, right: 0, up: 0, fast: false } as const;

test('fly movement follows the camera yaw and pitch', () => {
  assert.equal(stepFly(origin, forward, 1).z, -FLY_SPEED.unitsPerSecond);
  assert.equal(stepFly({ ...origin, yaw: Math.PI / 2 }, forward, 1).x, -FLY_SPEED.unitsPerSecond);
  assert.equal(stepFly({ ...origin, pitch: Math.PI / 2 }, forward, 1).y, FLY_SPEED.unitsPerSecond);
  assert.equal(stepFly({ ...origin, yaw: Math.PI / 2 }, { ...forward, forward: 0, right: 1 }, 1).z, -FLY_SPEED.unitsPerSecond);
});

test('fast diagonal flight keeps the configured speed', () => {
  const { x, y, z } = stepFly(origin, { ...forward, right: 1, up: -1, fast: true }, 0.5);
  assert.ok(y < 0);
  assert.ok(Math.abs(Math.hypot(x, y, z) - FLY_SPEED.unitsPerSecond * FLY_SPEED.fastMultiplier / 2) < 1e-9);
});

test('mouse movement follows the game signs and clamps pitch', () => {
  assert.deepEqual(lookBy(origin, 2, -1, 0.1), { ...origin, yaw: -0.2, pitch: 0.1 });
  assert.equal(lookBy(origin, 0, 100, 1).pitch, -89 * Math.PI / 180);
  assert.equal(lookBy(origin, 0, -100, 1).pitch, 89 * Math.PI / 180);
});
