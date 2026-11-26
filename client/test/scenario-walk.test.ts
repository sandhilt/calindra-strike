import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BTN, CollisionWorld, STANCE, WEAPON, applyCmd, getMap, type Cmd, type ShotInfo } from '@calindra-strike/shared';
import { tourPoints, groundAt, TOUR_EYE_HEIGHT } from '../src/benchmark/tours.ts';
import { lookDirection, shotPaths, spawnWalker, ticksDue, walkButtons, weaponRequest } from '../src/debug/scenario-walk.ts';

const cmd = (buttons: number, yaw = 0, pitch = 0): Cmd => ({ seq: 0, buttons, yaw, pitch, weapon: 0, interp: 0 });

test('held keys and buttons map to the game bits through the bindings', () => {
  const held = new Set(['KeyW', 'Space', 'ControlLeft', 'ShiftLeft', 'Mouse1']);
  assert.equal(walkButtons(held, {}), BTN.FWD | BTN.JUMP | BTN.DUCK | BTN.SPRINT | BTN.ATTACK);
  assert.equal(walkButtons(new Set(), {}), 0);
  assert.equal(walkButtons(new Set(['Space']), { jump: ['KeyJ'] }), 0, 'a custom binding replaces the default key');
  assert.equal(walkButtons(new Set(['KeyJ']), { jump: ['KeyJ'] }), BTN.JUMP);
});

test('weapon keys request the first four slots, and the wheel is left out', () => {
  assert.equal(weaponRequest('Digit1', {}), 1);
  assert.equal(weaponRequest('KeyQ', {}), 4);
  assert.equal(weaponRequest('KeyW', {}), 0);
  assert.equal(weaponRequest('WheelDown', {}), 0);
});

test('a frame turns its time into whole ticks and carries the rest', () => {
  assert.deepEqual(ticksDue(0, 1 / 60), { ticks: 1, carry: 0 });
  const half = ticksDue(0, 0.5 / 60);
  assert.equal(half.ticks, 0);
  assert.ok(Math.abs(half.carry - 0.5 / 60) < 1e-12);
  assert.equal(ticksDue(half.carry, 0.5 / 60).ticks, 1);
  assert.equal(ticksDue(0, 5).ticks, 15, 'a stalled frame is capped at a quarter second');
});

test('the listener looks where the camera looks', () => {
  const straight = lookDirection(0, 0);
  assert.ok(Math.abs(straight.x) < 1e-12 && Math.abs(straight.y) < 1e-12);
  assert.equal(straight.z, -1);
  const left = lookDirection(Math.PI / 2, 0);
  assert.ok(Math.abs(left.x + 1) < 1e-12);
  assert.ok(Math.abs(lookDirection(0, Math.PI / 2).y - 1) < 1e-12);
});

test('a walker dropped above a floor lands on it, and a jump lifts it again', () => {
  const map = getMap(0);
  const world = new CollisionWorld(map);
  const point = tourPoints(map)[0];
  const ground = groundAt(world, point);
  assert.ok(Number.isFinite(ground), 'the first tour point stands on a floor');
  const player = spawnWalker(world, point.x, point.z, 0, WEAPON.RIFLE, ground + TOUR_EYE_HEIGHT);
  assert.equal(player.dropping, false);
  for (let i = 0; i < 120; i++) applyCmd(world, player, cmd(0), 1);
  assert.equal(player.onGround, true);
  assert.ok(Math.abs(player.y - ground) < 1, `feet on the floor (${player.y} vs ${ground})`);
  applyCmd(world, player, cmd(BTN.JUMP), 1);
  assert.ok(player.vy > 0, 'jump leaves the floor');
});

test('crouch lowers the stance while the duck key is held', () => {
  const map = getMap(0);
  const world = new CollisionWorld(map);
  const point = tourPoints(map)[0];
  const player = spawnWalker(world, point.x, point.z, 0, WEAPON.RIFLE, groundAt(world, point) + TOUR_EYE_HEIGHT);
  for (let i = 0; i < 120; i++) applyCmd(world, player, cmd(0), 1);
  for (let i = 0; i < 30; i++) applyCmd(world, player, cmd(BTN.DUCK), 1);
  assert.equal(player.stance, STANCE.CROUCH);
});

test('a shot down onto the floor hits a surface whose normal faces up', () => {
  const map = getMap(0);
  const world = new CollisionWorld(map);
  const point = tourPoints(map)[0];
  const ground = groundAt(world, point);
  const shot: ShotInfo = { weapon: WEAPON.RIFLE, heavy: false, ox: point.x, oy: ground + 60, oz: point.z, dirs: [0, -1, 0], tick: 0 };
  const [path] = shotPaths(world, shot);
  const last = path.impacts.at(-1);
  assert.ok(last, 'the round stops on the floor');
  assert.equal(last.kind, 'wall');
  assert.equal(last.normal.y, 1);
  assert.ok(Math.abs(last.at.y - ground) < 1, `impact on the floor (${last.at.y} vs ${ground})`);
  assert.equal(typeof last.surface, 'string');
});

test('a shot into open sky has no impact and ends at its range', () => {
  const map = getMap(0);
  const world = new CollisionWorld(map);
  const shot: ShotInfo = { weapon: WEAPON.RIFLE, heavy: false, ox: 0, oy: 50000, oz: 0, dirs: [0, 1, 0], tick: 0 };
  const [path] = shotPaths(world, shot);
  assert.deepEqual(path.impacts, []);
  assert.ok(path.end.y > shot.oy);
});
