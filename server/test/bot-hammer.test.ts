import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BTN, CollisionWorld, MapBuilder, WEAPON, applyCmd, createPlayerState, getMaps, spawnState } from '@calindra-strike/shared';
import { BotBrain, type BotAgent, type BotEnv } from '../src/bot.ts';
import { NavGrid } from '../src/nav.ts';

function arena() {
  const builder = new MapBuilder();
  builder.add(-512, -32, -512, 512, 0, 512, 'ground');
  const map = { ...getMaps()[0], boxes: builder.boxes };
  const world = new CollisionWorld(map);
  function agent(id: number, z: number): BotAgent {
    const state = createPlayerState();
    spawnState(state, 0, 0, z, 0, WEAPON.RIFLE);
    state.dropping = false;
    state.onGround = true;
    return { id, team: id, alive: true, state };
  }
  const self = agent(0, 0);
  const enemy = agent(1, -150);
  const env: BotEnv = {
    world, nav: new NavGrid(world, map), players: [self, enemy],
    airdrops: [], mode: 'tdm', random: () => 0.5, tick: 0, now: 0,
  };
  return { brain: new BotBrain(0.5), self, enemy, env };
}

test('a bot charges at 150 units after taking damage and respawns calm', () => {
  const { brain, self, env } = arena();
  assert.equal(brain.think(self, env).weapon, 0);
  env.tick++;
  self.state.health -= 40;
  const cmd = brain.think(self, env);
  assert.equal(cmd.weapon, 3);
  assert.ok(cmd.buttons & BTN.FWD);
  assert.equal(cmd.buttons & BTN.ATTACK2, 0);
  brain.reset();
  env.tick = 6;
  assert.equal(brain.think(self, env).weapon, 0);
});

test('reload and manual control defer a rush, then a retreat waits for the swing and falls back to pistol', () => {
  const { brain, self, enemy, env } = arena();
  brain.think(self, env);
  self.state.health -= 40;
  env.tick++;
  self.state.reload = 10;
  assert.equal(brain.think(self, env).weapon, 0);
  self.state.reload = 0;
  env.manualWeaponControl = true;
  assert.equal(brain.think(self, env).weapon, 0);
  env.manualWeaponControl = false;
  const rush = brain.think(self, env);
  assert.equal(rush.weapon, 3);
  applyCmd(env.world, self.state, rush, self.id);
  assert.equal(self.state.weapon, WEAPON.HAMMER);
  self.state.mag[self.state.primary] = 0;
  self.state.reserve[self.state.primary] = 0;
  enemy.state.z = -350;
  self.state.nextFire = self.state.tick + 1;
  assert.equal(brain.think(self, env).weapon, 0);
  self.state.tick++;
  assert.equal(brain.think(self, env).weapon, 2);
});

test('a bot uses light swings and allows a brief gap before holstering the hammer', () => {
  const { brain, self, enemy, env } = arena();
  brain.think(self, env);
  self.state.health -= 40;
  enemy.state.z = -65;
  let swung = false;
  for (env.tick = 1; env.tick <= 60 && !swung; env.tick++) {
    const shot = applyCmd(env.world, self.state, brain.think(self, env), self.id);
    if (shot?.weapon !== WEAPON.HAMMER) continue;
    assert.equal(shot.heavy, false);
    swung = true;
  }
  assert.ok(swung);
  env.players = [self];
  self.state.nextFire = self.state.tick;
  assert.equal(brain.think(self, env).weapon, 0);
  env.tick += 30;
  assert.equal(brain.think(self, env).weapon, 1);
});

test('a bot keeps its gun while holding USE to plant', () => {
  const { brain, self, env } = arena();
  const site = { x: 0, y: 0, z: 0 };
  env.mode = 'defuse';
  env.bomb = { kind: 'carried', carrier: self.id };
  env.bombPlaces = { home: site, site, attackers: self.team };
  brain.think(self, env);
  self.state.health -= 40;
  env.tick++;
  const cmd = brain.think(self, env);
  assert.equal(cmd.weapon, 0);
  assert.ok(cmd.buttons & BTN.USE);
  assert.equal(cmd.buttons & BTN.FWD, 0);
});
