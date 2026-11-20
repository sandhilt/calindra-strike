import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld, DEFUSE_MS, DUCK_EYE, PLANT_MS, STAND_EYE } from '@calindra-strike/shared';
import { bombView } from '../src/game/bomb.ts';
import { bombActivity } from '../src/game/spectate/activity.ts';
import {
  CAMERA_MODES,
  CHASE_DISTANCE,
  CHASE_RISE,
  CHASE_WALL_MARGIN,
  FREE_FAST_SPEED,
  FREE_MARGIN,
  FREE_SPEED,
  NO_FREE_KEYS,
  chasePose,
  eyePose,
  freeKeysFrom,
  lookDir,
  mouseLooks,
  nextCameraMode,
  overviewPose,
  stepFreeCam,
  type FollowedPlayer,
  type RayWorld,
} from '../src/game/spectate/camera.ts';
import { scrollsPage, spectatorAction, stepTarget } from '../src/game/spectate/controls.ts';

const open: RayWorld = { trace: () => null };
const player: FollowedPlayer = { x: 100, y: 0, z: 200, yaw: 0, pitch: 0, ducked: false };

test('Space cycles first person, locked chase, free chase and free camera, then wraps', () => {
  assert.deepEqual(CAMERA_MODES, ['first', 'chase', 'orbit', 'free']);
  assert.equal(nextCameraMode('first'), 'chase');
  assert.equal(nextCameraMode('chase'), 'orbit');
  assert.equal(nextCameraMode('orbit'), 'free');
  assert.equal(nextCameraMode('free'), 'first');
  assert.deepEqual(CAMERA_MODES.filter(mouseLooks), ['orbit', 'free'], 'the mouse turns the free chase and the free camera only');
});

test('first person sits in the eyes and follows ducking', () => {
  assert.equal(eyePose(player).y, STAND_EYE);
  assert.equal(eyePose({ ...player, ducked: true }).y, DUCK_EYE);
});

test('look direction matches the player view convention', () => {
  const [fx, fy, fz] = lookDir(0, 0);
  assert.deepEqual([fx, fy, fz].map(Math.abs), [0, 0, 1]);
  assert.equal(fz, -1);
  assert.ok(lookDir(0, 0.5)[1] > 0, 'positive pitch looks up');
  assert.ok(lookDir(Math.PI / 2, 0)[0] < -0.99, 'yaw turns toward -x');
});

test('chase camera sits behind and above, looking the same way', () => {
  const pose = chasePose(player, open);
  const eye = eyePose(player);
  assert.equal(pose.yaw, player.yaw);
  assert.equal(pose.pitch, player.pitch);
  assert.ok(Math.abs(pose.x - eye.x) < 1e-9);
  assert.ok(pose.z > eye.z, 'behind a player who looks toward -z');
  assert.ok(Math.abs(pose.z - eye.z - CHASE_DISTANCE) < 1e-9);
  assert.ok(Math.abs(pose.y - eye.y - CHASE_RISE) < 1e-9);
});

test('free chase orbits the player with the mouse view and keeps looking at them', () => {
  const eye = eyePose(player);
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const pose = chasePose(player, open, { yaw, pitch: 0 });
    assert.equal(pose.yaw, yaw);
    assert.ok(Math.abs(Math.hypot(pose.x - eye.x, pose.z - eye.z) - CHASE_DISTANCE) < 1e-9, 'same distance all around');
    const [fx, , fz] = lookDir(yaw, 0);
    assert.ok((eye.x - pose.x) * fx + (eye.z - pose.z) * fz > CHASE_DISTANCE - 1e-9, 'the player is straight ahead of the camera');
  }
  const front = chasePose(player, open, { yaw: player.yaw + Math.PI, pitch: 0 });
  assert.ok(front.z < eye.z, 'swung round to face the player from the front');
});

test('chase camera swings behind a player who turns', () => {
  const east = chasePose({ ...player, yaw: -Math.PI / 2 }, open);
  assert.ok(east.x < player.x, 'looking toward +x puts the camera at lower x');
});

test('a wall pulls the chase camera in and never lets it cross', () => {
  const eye = eyePose(player);
  const calls: number[] = [];
  const wallAt = (t: number): RayWorld => ({
    trace: (ox, oy, oz, dx, dy, dz, maxDist) => {
      calls.push(maxDist);
      assert.ok(Math.abs(Math.hypot(dx, dy, dz) - 1) < 1e-9, 'ray is normalized');
      assert.deepEqual([ox, oy, oz], [eye.x, eye.y, eye.z], 'ray starts at the eye');
      return t < maxDist ? { t } : null;
    },
  });
  const distance = (p: { x: number; y: number; z: number }) => Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z);

  const pulled = chasePose(player, wallAt(60));
  assert.ok(Math.abs(distance(pulled) - (60 - CHASE_WALL_MARGIN)) < 1e-9);

  const tight = chasePose(player, wallAt(8));
  assert.ok(distance(tight) < 8, 'a wall right behind the player still leaves the camera on the near side');
  assert.ok(distance(tight) > 0);

  const far = chasePose(player, wallAt(10_000));
  assert.ok(distance(far) > CHASE_DISTANCE);
  assert.ok(calls.length === 3);
});

test('chase camera reaches walls in the real collision world', () => {
  const box = { min: { x: -500, y: 0, z: 240 }, max: { x: 500, y: 300, z: 260 }, solid: true, shootThrough: false };
  const world = new CollisionWorld({ boxes: [box] } as never);
  const behindWall = chasePose({ ...player, z: 200 }, world);
  assert.ok(behindWall.z < 240, 'camera stays in front of the wall at z=240');
});

test('free camera keys map WASD, E up, Q or C down, Shift fast', () => {
  const keys = freeKeysFrom(new Set(['KeyW', 'KeyD', 'KeyE', 'ShiftRight']));
  assert.deepEqual(keys, { forward: true, back: false, left: false, right: true, up: true, down: false, fast: true });
  assert.ok(freeKeysFrom(new Set(['KeyQ'])).down);
  assert.ok(freeKeysFrom(new Set(['KeyC'])).down);
  assert.deepEqual(freeKeysFrom(new Set(['Space'])), NO_FREE_KEYS);
});

test('free camera flies along the look direction at the right speed', () => {
  const start = { x: 0, y: 100, z: 0, yaw: 0, pitch: 0 };
  assert.equal(stepFreeCam(start, NO_FREE_KEYS, 1), start);
  const forward = stepFreeCam(start, { ...NO_FREE_KEYS, forward: true }, 0.5);
  assert.ok(Math.abs(forward.z + FREE_SPEED * 0.5) < 1e-9);
  assert.equal(forward.y, 100);
  const fast = stepFreeCam(start, { ...NO_FREE_KEYS, forward: true, fast: true }, 0.5);
  assert.ok(Math.abs(fast.z + FREE_FAST_SPEED * 0.5) < 1e-9);
  const right = stepFreeCam(start, { ...NO_FREE_KEYS, right: true }, 1);
  assert.ok(Math.abs(right.x - FREE_SPEED) < 1e-9);
  const up = stepFreeCam(start, { ...NO_FREE_KEYS, up: true }, 1);
  assert.ok(Math.abs(up.y - 100 - FREE_SPEED) < 1e-9);
  const down = stepFreeCam(start, { ...NO_FREE_KEYS, down: true }, 1);
  assert.ok(Math.abs(down.y - 100 + FREE_SPEED) < 1e-9);
});

test('free camera flies up when looking up and keeps diagonal speed', () => {
  const start = { x: 0, y: 100, z: 0, yaw: 0, pitch: Math.PI / 4 };
  const moved = stepFreeCam(start, { ...NO_FREE_KEYS, forward: true }, 1);
  assert.ok(moved.y > 100);
  const diagonal = stepFreeCam({ ...start, pitch: 0 }, { ...NO_FREE_KEYS, forward: true, right: true }, 1);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - FREE_SPEED) < 1e-9);
});

test('free camera stays inside the map margin and above the floor', () => {
  const bounds = { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 };
  const limits = { bounds, maxY: 1500 };
  const start = { x: 1000, y: 20, z: 0, yaw: -Math.PI / 2, pitch: 0 };
  const east = stepFreeCam(start, { ...NO_FREE_KEYS, forward: true, fast: true }, 10, limits);
  assert.equal(east.x, bounds.maxX + FREE_MARGIN);
  const low = stepFreeCam(start, { ...NO_FREE_KEYS, down: true }, 10, limits);
  assert.equal(low.y, 8);
  const high = stepFreeCam(start, { ...NO_FREE_KEYS, up: true, fast: true }, 10, limits);
  assert.equal(high.y, 1500);
});

test('overview pose looks down from the middle of the map', () => {
  const pose = overviewPose({ minX: 0, maxX: 400, minZ: -200, maxZ: 200 });
  assert.equal(pose.x, 200);
  assert.equal(pose.z, 0);
  assert.ok(pose.pitch < 0);
});

test('spectator keys: Space mode, arrows step, 1 and 2 pick the team, J joins', () => {
  assert.deepEqual(spectatorAction('Space'), { kind: 'mode' });
  assert.deepEqual(spectatorAction('ArrowRight'), { kind: 'next' });
  assert.deepEqual(spectatorAction('ArrowLeft'), { kind: 'prev' });
  assert.deepEqual(spectatorAction('Digit1'), { kind: 'team', team: 0 });
  assert.deepEqual(spectatorAction('Digit2'), { kind: 'team', team: 1 });
  assert.deepEqual(spectatorAction('KeyJ'), { kind: 'join' });
  assert.deepEqual(spectatorAction('Escape'), { kind: 'menu' });
  assert.equal(spectatorAction('ArrowUp'), null);
  assert.equal(spectatorAction('KeyW'), null);
  assert.ok(scrollsPage('Space') && scrollsPage('ArrowDown') && !scrollsPage('KeyW'));
});

test('stepping through players wraps both ways and recovers from a vanished target', () => {
  const ids = [3, 5, 9];
  assert.equal(stepTarget(ids, 3, 1), 5);
  assert.equal(stepTarget(ids, 9, 1), 3);
  assert.equal(stepTarget(ids, 3, -1), 9);
  assert.equal(stepTarget(ids, 5, -1), 3);
  assert.equal(stepTarget(ids, 4, 1), 3);
  assert.equal(stepTarget(ids, -1, -1), 9);
  assert.equal(stepTarget([], 3, 1), -1);
  assert.equal(stepTarget([7], 7, 1), 7);
});

const actor = (id: number) => ({ name: `p${id}`, color: '#fff' });

test('spectators see who is planting with the plant progress', () => {
  const planting = bombView([2, 7, 0, 0, 0, 0, 0, 0, 0, 20000]);
  assert.ok(planting);
  const activity = bombActivity(planting, 20000 - PLANT_MS / 2, actor);
  assert.deepEqual(activity, { kind: 'plant', label: 'p7 plantando', color: '#fff', progress: 0.5 });
});

test('spectators see who is defusing with the defuse progress', () => {
  const defusing = bombView([4, 9, 0, 0, 0, 40000, 10000, 0, 0, 0]);
  assert.ok(defusing);
  const activity = bombActivity(defusing, 10000 - DEFUSE_MS / 4, actor);
  assert.ok(activity);
  assert.equal(activity.kind, 'defuse');
  assert.equal(activity.label, 'p9 desarmando');
  assert.ok(Math.abs(activity.progress - 0.75) < 1e-9);
});

test('no activity while the bug is idle, carried or planted without a defuser', () => {
  for (const row of [[0, -1, 0, 0, 0, 0, 0, 0, 0, 0], [1, 7, 0, 0, 0, 0, 0, 0, 0, 0], [3, -1, 0, 0, 0, 0, 0, 0, 0, 0], [4, -1, 0, 0, 0, 40000, 0, 0, 0, 0]]) {
    const bomb = bombView(row);
    assert.ok(bomb);
    assert.equal(bombActivity(bomb, 1000, actor), null);
  }
});
