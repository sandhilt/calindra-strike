import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld, ESCALATOR_SPEED_UNITS, PLAYER_RADIUS, TICK_RATE, WEAPON, applyCmd, createPlayerState, escalatorDrift, getMap, spawnState } from '../src/index.ts';

const map = getMap(2);
const world = new CollisionWorld(map);
const escalators = map.props.flatMap((p) => (p.kind === 'escalator' ? [p] : []));
const idle = { seq: 0, buttons: 0, yaw: 0, pitch: 0, weapon: 0, interp: 0 };

function standAt(x: number, z: number, ceiling: number) {
  const s = createPlayerState();
  spawnState(s, x, world.groundBelow(x, ceiling, z, PLAYER_RADIUS), z, 0, WEAPON.RIFLE);
  s.onGround = true;
  return s;
}

function idleFor(s: ReturnType<typeof createPlayerState>, ticks: number): void {
  for (let i = 0; i < ticks; i++) applyCmd(world, s, { ...idle, seq: i }, 1);
}

describe('escalator', () => {
  it('has the eight escalators of Shopping Sul Rio to test', () => {
    assert.equal(escalators.length, 8);
  });

  for (const e of escalators) {
    it(`carries a player standing still ${e.travel} on the one at ${e.x},${e.z} (y ${e.y})`, () => {
      const mid = e.length / 2;
      const s = standAt(e.x + e.dirX * mid, e.z + e.dirZ * mid, e.y + e.height + 40);
      const along = () => (s.x - e.x) * e.dirX + (s.z - e.z) * e.dirZ;
      const startAlong = along();
      const startY = s.y;
      idleFor(s, 2 * TICK_RATE);
      const moved = (along() - startAlong) * (e.travel === 'up' ? 1 : -1);
      const expected = 2 * ESCALATOR_SPEED_UNITS;
      assert.ok(moved > expected * 0.7 && moved < expected * 1.3, `moved ${moved.toFixed(1)} units along it, expected about ${expected}`);
      const rose = (s.y - startY) * (e.travel === 'up' ? 1 : -1);
      assert.ok(rose > 10, `height changed by ${rose.toFixed(1)} the wrong way or not at all`);
      assert.equal(s.onGround, true);
    });
  }

  it('does not move a player standing on the open floor', () => {
    const s = standAt(0, -200, 100);
    const [x, z] = [s.x, s.z];
    idleFor(s, TICK_RATE);
    assert.ok(Math.hypot(s.x - x, s.z - z) < 0.01);
  });

  it('leaves a player in the air alone and releases one past the top', () => {
    const e = escalators[0];
    const x = e.x + e.dirX * (e.length / 2);
    const z = e.z + e.dirZ * (e.length / 2);
    const y = world.groundBelow(x, e.y + e.height + 40, z, PLAYER_RADIUS);
    assert.notEqual(escalatorDrift(map, { x, y, z, onGround: true }), null);
    assert.equal(escalatorDrift(map, { x, y, z, onGround: false }), null);
    assert.equal(escalatorDrift(map, { x: e.x + e.dirX * (e.length + 4), y, z: e.z + e.dirZ * (e.length + 4), onGround: true }), null);
    assert.equal(escalatorDrift(map, { x: e.x - e.dirX * 4, y: e.y, z: e.z - e.dirZ * 4, onGround: true }), null);
  });

  it('does not carry a player standing beside it or on the floor above or below it', () => {
    const e = escalators[0];
    const mid = e.length / 2;
    const side = e.width / 2 + 24;
    const x = e.x + e.dirX * mid - e.dirZ * side;
    const z = e.z + e.dirZ * mid + e.dirX * side;
    assert.equal(escalatorDrift(map, { x, y: e.y, z, onGround: true }), null);
    const cx = e.x + e.dirX * mid;
    const cz = e.z + e.dirZ * mid;
    assert.equal(escalatorDrift(map, { x: cx, y: e.y + e.height + 200, z: cz, onGround: true }), null);
  });
});
