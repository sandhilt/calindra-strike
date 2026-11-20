import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld, getMaps, MapBuilder, createPlayerState, eyeHeight } from '../../shared/src/index.ts';
import { scene } from '../mcp/scene.ts';
import { relative, renderView, welcome, type ViewSpray } from '../mcp/view.ts';

function ordered(items: readonly { distance: number | null }[]) {
  assert.deepEqual(items.map((p) => p.distance), items.map((p) => p.distance).toSorted((a, b) => (a ?? Infinity) - (b ?? Infinity)));
}
for (const map of getMaps()) test(`${map.id} scene ordering, caps and map knowledge`, () => {
  const self = createPlayerState();
  self.x = 600; self.z = -600;
  const sprays: ViewSpray[] = Array.from({ length: 12 }, (_, id) => ({ id, by: String(id), x: 600 + 20 * id, y: 64, z: -600, nx: 0, ny: 0, nz: 1 }));
  const result = scene(new CollisionWorld(map), map, self, sprays, relative(self));
  for (const list of [result.cover, result.doors, result.landmarks, result.sprays]) ordered(list);
  assert.ok(result.cover.length <= 8);
  assert.ok(result.doors.filter((f) => f.kind !== 'stairs').length <= 4);
  assert.ok(result.doors.filter((f) => f.kind === 'stairs').length <= 2);
  assert.equal(result.landmarks.length, 6);
  assert.equal(result.sprays.length, 6);
  assert.deepEqual(result.landmarks.map((p) => p.name), map.features.filter((f) => f.kind === 'landmark')
    .toSorted((a, b) => (relative(self)(a).distance ?? 0) - (relative(self)(b).distance ?? 0)).slice(0, 6).map((f) => f.name));
});

test('crosshair hit, face normal, spray and cover occlusion', () => {
  const b = new MapBuilder();
  b.block(0, -100, 300, 20, 200, 'concrete');
  b.block(0, -200, 40, 40, 60, 'crate');
  b.block(100, 0, 40, 40, 60, 'wood');
  const map = { ...getMaps()[0], id: 'scene-test', boxes: b.boxes, features: b.features };
  const world = new CollisionWorld(map), self = createPlayerState();
  const spray = { id: 2, by: 'agent', x: 0, y: eyeHeight(self), z: -90, nx: 0, ny: 0, nz: 1 };
  const result = scene(world, map, self, [spray], relative(self));
  assert.deepEqual(result.facing, { distance: 90, point: [0, eyeHeight(self), -90], normal: [0, 0, 1], kind: 'wall', mat: 'concrete', spray: { by: 'agent' } });
  assert.equal(result.cover.some((c) => c.mat === 'crate'), false);
  assert.ok(result.cover.some((c) => c.mat === 'concrete'));
  assert.ok(result.cover.some((c) => c.mat === 'wood'));
  assert.equal(scene(world, map, self, [{ ...spray, nx: 1, nz: 0 }], relative(self)).facing?.spray, undefined);
  self.pitch = -Math.PI / 2;
  assert.equal(scene(world, map, self, [], relative(self)).facing, null);
});

test('scene caps are exercised in a dense map and ranges exclude distant entities', () => {
  const b = new MapBuilder();
  for (let i = 0; i < 12; i++) {
    b.block(-300 + i * 50, -300, 30, 30, 40, 'crate');
    b.wallX(i * 40, i * 40 + 30, -500, 4, 100, 'concrete', [{ from: i * 40, to: i * 40 + 30, bottom: 0, top: 100 }]);
    b.stairs(i * 40, i * 40 + 20, 100, 140, '+z', 32, 'concrete');
  }
  b.block(0, -1000, 40, 40, 40, 'metal');
  const map = { ...getMaps()[0], id: 'dense', boxes: b.boxes, features: b.features };
  const self = createPlayerState();
  const result = scene(new CollisionWorld(map), map, self, [{ id: 1, by: 'far', x: 2000, y: 0, z: 0, nx: 0, ny: 1, nz: 0 }], relative(self));
  assert.equal(result.cover.length, 8);
  assert.equal(result.cover.some((c) => c.mat === 'metal'), false);
  assert.equal(result.doors.filter((f) => f.kind === 'door').length, 4);
  assert.equal(result.doors.filter((f) => f.kind === 'stairs').length, 2);
  assert.deepEqual(result.sprays, []);
});

test('renderView only builds a scene with a living grounded snapshot and world', () => {
  const v = welcome({ t: 'welcome', id: 1, time: 0, match: { phase: 'live', mode: 'ffa', map: 0, endsAt: 100, teams: [], limit: 0 }, roster: [], token: '', maxPlayers: 10, spectator: null, ready: { kind: 'confirmed' }, idleKickMs: null, idleKickWarmupMs: null });
  const read = (world?: CollisionWorld) => JSON.parse(JSON.stringify(renderView(v, { kind: 'idle' }, undefined, world)));
  const world = new CollisionWorld(getMaps()[0]);
  assert.equal(read(world).scene, null);
  assert.deepEqual(v.sprays, []);
  v.self = createPlayerState();
  assert.equal(read().scene, null);
  assert.deepEqual(read(world).scene, JSON.parse(JSON.stringify(scene(world, world.map, v.self, [], relative(v.self)))));
  v.self.dropping = true;
  assert.equal(read(world).scene, null);
  v.self.dropping = false; v.self.health = 0;
  assert.equal(read(world).scene, null);
});
