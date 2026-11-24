import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BTN, CollisionWorld, STAMINA_MAX, TICK_RATE, WEAPON, applyCmd, createPlayerState, getMap, spawnState } from '../src/index.ts';

const map = getMap(1);
const world = new CollisionWorld(map);

function sprint(x: number, z: number, yaw: number, seconds: number) {
  const s = createPlayerState();
  spawnState(s, x, 0, z, yaw, WEAPON.RIFLE);
  s.dropping = false;
  s.onGround = true;
  for (let t = 0; t < seconds * TICK_RATE; t++) applyCmd(world, s, { seq: t, buttons: BTN.FWD | BTN.SPRINT, yaw, pitch: 0, weapon: 0, interp: 0 }, 1);
  return s;
}

describe('sprinting against a wall', () => {
  it('costs no stamina and never leaves the player winded', () => {
    const settled = sprint(0, map.bounds.maxZ - 80, Math.PI, 2);
    assert.ok(Math.hypot(settled.vx, settled.vz) < 1, 'the wall stops the player');
    const later = sprint(0, map.bounds.maxZ - 80, Math.PI, 12);
    assert.ok(Math.abs(later.stamina - settled.stamina) < 0.01, `stamina went from ${settled.stamina.toFixed(1)} to ${later.stamina.toFixed(1)} while stuck against the wall`);
    assert.equal(later.winded, false);
    assert.ok(later.stamina > 0);
  });

  it('still drains stamina while the sprint really runs', () => {
    const s = sprint(0, 0, 0, 1);
    assert.ok(s.stamina < STAMINA_MAX - 10, `stamina only fell to ${s.stamina.toFixed(1)} after a second of running`);
  });
});
