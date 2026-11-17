import { it } from 'node:test';
import assert from 'node:assert/strict';
import { BTN, CollisionWorld, createPlayerState, getMaps, spawnState, WEAPON, applyCmd, CTF_ENGAGE_DISTANCE_UNITS } from '@calindra-strike/shared';
import { BotBrain, hasLineOfSight, ctfCombatStance, type BotAgent, type BotEnv } from '../src/bot.ts';
import { NavGrid } from '../src/nav.ts';

it('CTF combat stance preserves carriers, close duels and defenders', () => {
  for (const distance of [0, CTF_ENGAGE_DISTANCE_UNITS, CTF_ENGAGE_DISTANCE_UNITS + 1, 2600]) {
    assert.equal(ctfCombatStance('carrier', distance), 'advance');
    assert.equal(ctfCombatStance('defender', distance), 'duel');
    assert.equal(ctfCombatStance('attacker', distance), distance > CTF_ENGAGE_DISTANCE_UNITS ? 'advance' : 'duel');
  }
});

function setup() {
  const map = getMaps()[0];
  const world = new CollisionWorld(map);
  const nav = new NavGrid(world, map);
  const base = map.flagBases[0];
  const self: BotAgent = { id: 6, team: 0, alive: true, state: createPlayerState() };
  spawnState(self.state, base.x, 0, base.z, 0, WEAPON.RIFLE);
  Object.assign(self.state, { ...base, y: 0, dropping: false, yaw: 0, onGround: true });
  const enemy: BotAgent = { id: 7, team: 1, alive: true, state: createPlayerState() };
  Object.assign(enemy.state, { ...base, z: base.z - 100, y: 0, dropping: false });
  const teammates = [0, 2, 4].map(id => ({ id, team: 0, alive: true, state: createPlayerState() }));
  const env: BotEnv = { world, nav, tick: 0, now: 0, mode: 'ctf', random: () => 0.5,
    players: [...teammates, self, enemy], airdrops: [], flags: [{ kind: 'home' }, { kind: 'home' }], flagBases: map.flagBases.map(b => ({ ...b, y: 0 })) };
  return { self, enemy, env };
}

it('carrier closes distance to home while an enemy remains visible and still fires', () => {
  const { self, enemy, env } = setup();
  const base = env.flagBases![0];
  self.state.z += 300;
  self.state.yaw = -Math.PI / 2;
  enemy.state.z = self.state.z;
  enemy.state.x = self.state.x + 100;
  env.flags = [{ kind: 'home' }, { kind: 'carried', carrier: self.id }];
  const brain = new BotBrain(1);
  const before = Math.hypot(self.state.x - base.x, self.state.z - base.z);
  let attacks = 0;
  for (let tick = 0; tick < 60; tick++) {
    env.tick = tick;
    assert.ok(hasLineOfSight(env.world, self.state.x, self.state.y + 64, self.state.z, enemy.state));
    const cmd = brain.think(self, env);
    assert.ok(cmd.buttons & (BTN.FWD | BTN.BACK | BTN.LEFT | BTN.RIGHT));
    if (cmd.buttons & BTN.ATTACK) attacks++;
    applyCmd(env.world, self.state, cmd, 1);
  }
  const after = Math.hypot(self.state.x - base.x, self.state.z - base.z);
  assert.ok(after < before - 100, `distance ${before} -> ${after}`);
  assert.ok(attacks > 0);
});

it('defender duels exactly like TDM and FFA, without objective movement while firing', () => {
  const defender = setup();
  const tdm = setup();
  const ffa = setup();
  tdm.env.mode = 'tdm';
  ffa.env.mode = 'ffa';
  // Keep the perception candidates identical: in FFA everybody else is an enemy.
  for (const fixture of [defender, tdm, ffa]) fixture.env.players = [fixture.self, fixture.enemy];
  // Restore the defender role with dead teammates outside perception range.
  for (const fixture of [defender, tdm, ffa]) {
    fixture.env.players = [...fixture.env.players, ...[0, 2, 4].map(id => ({ id, team: 0, alive: false, state: createPlayerState() }))];
  }
  const brains = [new BotBrain(1), new BotBrain(1), new BotBrain(1)];
  let attacks = 0;
  for (let tick = 0; tick < 180; tick++) {
    const commands = [defender, tdm, ffa].map((fixture, i) => {
      fixture.env.tick = tick;
      return brains[i].think(fixture.self, fixture.env);
    });
    assert.deepEqual(commands[0], commands[1]);
    assert.deepEqual(commands[1], commands[2]);
    if (commands[0].buttons & BTN.ATTACK) {
      attacks++;
      assert.equal(commands[0].buttons & (BTN.FWD | BTN.BACK | BTN.LEFT | BTN.RIGHT), 0);
    }
  }
  assert.ok(attacks > 0);
});
