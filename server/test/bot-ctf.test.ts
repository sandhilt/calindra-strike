import { it } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld, createPlayerState, getMaps, BTN, WEAPON, type ServerMsg } from '@calindra-strike/shared';
import { BotBrain, pickCtfGoal, type BotAgent, type BotEnv } from '../src/bot.ts';
import { NavGrid } from '../src/nav.ts';
import { Game } from '../src/game.ts';

const map = getMaps()[0];
const world = new CollisionWorld(map);
const nav = new NavGrid(world, map);
const bases = map.flagBases.map(b => ({ ...b, y: 0 }));
const agent = (id: number, team: number): BotAgent => ({ id, team, alive: true, state: createPlayerState() });
function setup() {
  const self = agent(2, 0);
  const defender = agent(6, 0);
  const fillers = [agent(4, 0), agent(5, 0)];
  const enemy = agent(3, 1);
  const env: BotEnv = { world, nav, tick: 2, now: 0, mode: 'ctf', random: () => 0.5, players: [self, ...fillers, defender, enemy], airdrops: [], flags: [{ kind: 'home' }, { kind: 'home' }], flagBases: bases };
  return { self, defender, fillers, enemy, env };
}
it('CTF carriers return their dropped flag before heading home', () => {
  const { self, defender, env } = setup();
  const dropped = { kind: 'dropped', x: 12, y: 0, z: 34, returnAtTick: 100 } as const;
  env.flags = [dropped, { kind: 'carried', carrier: self.id }];
  assert.deepEqual(pickCtfGoal(self, env), dropped);
  env.flags = [{ kind: 'home' }, { kind: 'carried', carrier: self.id }];
  assert.deepEqual(pickCtfGoal(self, env), bases[0]);
  env.flags = [dropped, { kind: 'carried', carrier: self.id }];
  assert.deepEqual(pickCtfGoal(defender, env), dropped);
});
it('CTF attackers seek enemy home/dropped flags and defenders guard or chase carriers', () => {
  const { self, defender, fillers, enemy, env } = setup();
  assert.deepEqual(pickCtfGoal(self, env), bases[1]);
  assert.deepEqual(pickCtfGoal(defender, env), bases[0]);
  env.flags = [{ kind: 'carried', carrier: enemy.id }, { kind: 'dropped', x: 12, y: 0, z: 34, returnAtTick: 100 }];
  assert.deepEqual(pickCtfGoal(self, env), env.flags[1]);
  assert.deepEqual(pickCtfGoal(defender, env), enemy.state);
  env.flags = [{ kind: 'carried', carrier: enemy.id }, { kind: 'carried', carrier: self.id }];
  assert.deepEqual(pickCtfGoal(self, env), enemy.state);
  env.players = [self, ...fillers, defender];
  assert.deepEqual(pickCtfGoal(defender, env), bases[0]);
  env.mode = 'tdm';
  assert.equal(pickCtfGoal(self, env), null);
});
it('visible enemy engagement still wins over CTF navigation', () => {
  const { self, enemy, env } = setup();
  Object.assign(self.state, { ...bases[0], dropping: false, yaw: 0 });
  Object.assign(enemy.state, { ...bases[0], z: bases[0].z - 100, dropping: false });
  const brain = new BotBrain(1);
  let attacked = false;
  for (let tick = 2; tick < 120; tick++) {
    env.tick = tick;
    const cmd = brain.think(self, env);
    if (cmd.buttons & BTN.ATTACK) attacked = true;
  }
  assert.ok(attacked);
  // Combat discards the path; navigation must not wait for its old repath deadline.
  const navigation = brain as unknown as { repathAt: number };
  assert.equal(navigation.repathAt, 0);
});

const CAPTURE_BUDGET_TICKS = 60 * 180;
for (const map of getMaps()) {
  it('nav reaches each CTF base from the opposite spawn half on ' + map.id, () => {
    const world = new CollisionWorld(map);
    const nav = new NavGrid(world, map);
    for (const base of map.flagBases) {
      const start = nav.nodes.find(n => n.y === 0 && (base.z < 0 ? n.z >= 150 : n.z <= -150));
      const end = nav.nearest(base.x, 0, base.z);
      assert.ok(start && end);
      assert.ok(nav.findPath(start, end));
    }
  });
  for (const population of [2, 8]) it(`${population} bots ${population === 2 ? 'capture' : 'take the enemy flag'} within three simulated minutes on ${map.id}`, t => {
    let seed = 12345;
    const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 2 ** 32; };
    const game = new Game({ maxPlayers: population, matchMs: 240000, podiumMs: 5000, warmupMinPlayers: 2, modes: 'ctf', maps: [map.id], ctfLimit: 0, botFill: population, botSkill: 0.5, random });
    let taken = false;
    const observer = game.join('bootstrap', 0, WEAPON.RIFLE, data => {
      const msg = JSON.parse(data) as ServerMsg;
      if (msg.t === 'ev' && msg.e.some(e => e.k === 'flag' && e.what === 'take')) taken = true;
    });
    assert.ok(typeof observer !== 'string');
    // Bootstrap through join, then give every player the real bot brain.
    observer.brain = new BotBrain(0.5);
    let ticks = 0;
    // Bot-only 4v4 rarely captures (carriers die to the other side); 2 bots prove the full chain, 8 prove the objective is pursued.
    const done = () => (population === 2 ? game.teamScores.some(score => score > 0) : taken);
    while (ticks < CAPTURE_BUDGET_TICKS && !done()) { game.update(); ticks++; }
    t.diagnostic(`${map.id} (${population} bots): ticks-to-goal=${done() ? ticks : 'none'}; budget=${CAPTURE_BUDGET_TICKS}`);
    assert.ok(done(), `${population === 2 ? 'No capture' : 'No flag taken'} after ${ticks} ticks on ${map.id}`);
  });
}

it('carried flag snapshot coordinates follow the carrier rather than the enemy base', () => {
  const messages: ServerMsg[] = [];
  const game = new Game({ maxPlayers: 2, matchMs: 120000, podiumMs: 5000, warmupMinPlayers: 2, modes: 'ctf', random: () => 0.4 });
  const carrier = game.join('carrier', 0, WEAPON.RIFLE, data => messages.push(JSON.parse(data)));
  game.join('enemy', 0, WEAPON.RIFLE, () => {});
  assert.ok(typeof carrier !== 'string');
  const base = game.map.flagBases[1 - carrier.team];
  Object.assign(carrier.state, { ...base, y: 0, dropping: false });
  game.update();
  carrier.state.x += 200;
  for (let i = 0; i < 3; i++) game.update();
  const snap = messages.findLast(m => m.t === 'snap');
  assert.ok(snap?.t === 'snap');
  assert.deepEqual(snap.fl[1 - carrier.team].slice(0, 5), [1, carrier.id, carrier.state.x, 0, carrier.state.z]);
});
