import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld, getMap, createPlayerState, RF_ALIVE } from '../../shared/src/index.ts';
import { perceive } from '../mcp/perception.ts';
import type { Peer } from '../mcp/view.ts';

const world = new CollisionWorld(getMap(0));
function fixture() {
  const self = createPlayerState();
  Object.assign(self, { x: -300, y: 0, z: 0, health: 100, dropping: false });
  const enemy: Peer = {
    id: 2, name: 'enemy', team: 1, enemy: true, alive: true,
    x: 300, y: 0, z: 0, yaw: 0, pitch: 0, flags: RF_ALIVE, weapon: 2, lean: 0,
  };
  return { self, enemy };
}

test('Forja perception respects walls, open sight, hearing and teams', () => {
  const { self, enemy } = fixture();
  assert.equal(perceive([enemy], self, world, new Map(), 0).peers.length, 0);
  self.z = enemy.z = -600;
  assert.equal(perceive([enemy], self, world, new Map(), 0).peers[0].via, 'sight');
  self.z = enemy.z = 0;
  self.x = -150;
  enemy.x = 150;
  assert.equal(perceive([enemy], self, world, new Map(), 0).peers[0].via, 'sound');
  enemy.enemy = false;
  assert.equal(perceive([enemy], self, world, new Map(), 0).peers[0].via, 'team');
});

test('dead and dropping observers see no enemies; omniscient passes all peers', () => {
  const { self, enemy } = fixture();
  self.dropping = true;
  assert.deepEqual(perceive([enemy], self, world, new Map(), 0).peers, []);
  assert.deepEqual(perceive([enemy], null, world, new Map(), 0).peers, []);
  assert.equal(perceive([enemy], self, world, new Map(), 0, true).peers.length, 1);
});

test('memory records perceived positions, expires, prunes missing/dead peers and caps size', () => {
  const { self, enemy } = fixture();
  self.z = enemy.z = -600;
  const seen = perceive([enemy], self, world, new Map(), 100).lastSeen;
  assert.deepEqual(seen.get(2), { x: 300, y: 0, z: -600, time: 100 });
  self.z = enemy.z = 0;
  assert.equal(perceive([enemy], self, world, seen, 10099).lastSeen.size, 1);
  assert.equal(perceive([enemy], self, world, seen, 10100).lastSeen.size, 0);
  assert.equal(perceive([], self, world, seen, 200).lastSeen.size, 0);
  assert.equal(perceive([{ ...enemy, alive: false }], self, world, seen, 200).lastSeen.size, 0);
  const many = Array.from({ length: 80 }, (_, id) => ({ ...enemy, id }));
  assert.equal(perceive(many, self, world, new Map(), 0, true).lastSeen.size, 64);
});
