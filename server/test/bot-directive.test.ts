import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CollisionWorld,
  getMap,
  createPlayerState,
  spawnState,
  applyCmd,
  WEAPON,
  BTN,
} from '@calindra-strike/shared';
import { BotBrain, type BotAgent, type BotEnv } from '../src/bot.ts';
import { NavGrid } from '../src/nav.ts';

function fixture() {
  const map = getMap(0);
  const world = new CollisionWorld(map);
  const nav = new NavGrid(world, map);
  let seed = 12345;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const state = createPlayerState();
  spawnState(state, 500, 0, -600, 0, WEAPON.RIFLE);
  state.dropping = false;
  state.onGround = true;
  const self: BotAgent = { id: 1, team: 0, alive: true, state };
  const players = [self];
  const env: BotEnv = { world, nav, random, players, airdrops: [], tick: 0, now: 0, mode: 'tdm' };
  return { self, env, players };
}

test('goto reaches the Forja warehouse and retains its arrival status', () => {
  const { self, env } = fixture();
  const brain = new BotBrain(1);
  brain.setDirective({ kind: 'goto', x: 960, y: 0, z: -1100 });
  for (env.tick = 1; env.tick <= 1800 && !brain.arrived; env.tick++) {
    applyCmd(env.world, self.state, brain.think(self, env), 1);
  }
  assert.ok(brain.arrived);
  assert.equal(brain.think(self, env).buttons & BTN.FWD, 0);
});

test('a bot that reached its goal still reloads an empty weapon', () => {
  const { self, env } = fixture();
  self.state.mag[self.state.weapon] = 0;
  self.state.reserve[self.state.weapon] = 90;
  const brain = new BotBrain(1);
  brain.setDirective({ kind: 'goto', x: self.state.x, y: self.state.y, z: self.state.z });
  env.tick = 1;
  brain.think(self, env);
  assert.ok(brain.arrived);
  env.tick = 2;
  assert.ok(brain.think(self, env).buttons & BTN.RELOAD);
});

test('engage aims and fires only toward the named enemy, then ends for a teammate', () => {
  const { self, env, players } = fixture();
  function peer(id: number, team: number, x: number, z: number): BotAgent {
    const state = createPlayerState();
    spawnState(state, x, 0, z, 0, WEAPON.RIFLE);
    state.dropping = false;
    return { id, team, alive: true, state };
  }
  const target = peer(2, 1, 500, -800);
  players.push(target, peer(3, 1, 650, -600), peer(4, 0, 450, -600));
  const brain = new BotBrain(1);
  brain.setDirective({ kind: 'engage', targetId: target.id });
  let shots = 0;
  for (env.tick = 1; env.tick < 120; env.tick++) {
    const cmd = brain.think(self, env);
    if (cmd.buttons & BTN.ATTACK) {
      shots++;
      const expected = Math.atan2(-(target.state.x - self.state.x), -(target.state.z - self.state.z));
      assert.ok(Math.abs(cmd.yaw - expected) < 0.1);
    }
    applyCmd(env.world, self.state, cmd, 1);
  }
  assert.ok(shots > 0);
  assert.ok(players.every((p) => p.state.health === 100));
  players[1] = { ...target, team: 0 };
  brain.think(self, env);
  assert.ok(brain.directiveEnded);
});

test('explicit null preserves autonomous behavior for the same random stream', () => {
  const a = fixture();
  const b = fixture();
  const first = new BotBrain(0.7);
  const second = new BotBrain(0.7);
  second.setDirective(null);
  for (let tick = 1; tick < 240; tick++) {
    a.env.tick = b.env.tick = tick;
    const cmd = first.think(a.self, a.env);
    assert.deepEqual(cmd, second.think(b.self, b.env));
    applyCmd(a.env.world, a.self.state, cmd, 1);
    applyCmd(b.env.world, b.self.state, cmd, 1);
  }
});
