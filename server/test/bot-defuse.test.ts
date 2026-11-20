import { it } from 'node:test';
import assert from 'node:assert/strict';
import { BOMB_DESK_SIZE_UNITS, PLAYER_RADIUS, DEFUSE_TICKS, CollisionWorld, createPlayerState, getMaps, BTN, WEAPON, FUSE_TICKS, type BombState, type ServerMsg } from '@calindra-strike/shared';
import { BotBrain, guardPatrolPoint, pickBombGoal, type BotAgent, type BotEnv } from '../src/bot.ts';
import { NavGrid } from '../src/nav.ts';
import { Game } from '../src/game.ts';

const map = getMaps()[0];
const world = new CollisionWorld(map);
const nav = new NavGrid(world, map);
const bases = map.flagBases.map((b) => ({ ...b, y: 0 }));
const places = { home: bases[0], site: bases[1], attackers: 0 };
const agent = (id: number, team: number): BotAgent => ({ id, team, alive: true, state: createPlayerState() });
function setup(bomb: BombState) {
  const carrier = agent(2, 0);
  const escort = agent(4, 0);
  const defender = agent(3, 1);
  const env: BotEnv = { world, nav, tick: 2, now: 0, mode: 'defuse', random: () => 0.5, players: [carrier, escort, defender], airdrops: [], bomb, bombPlaces: places };
  return { carrier, escort, defender, env };
}

it('attackers fetch the bomb, the carrier heads for the site, escorts follow, defenders guard the site', () => {
  const { carrier, escort, defender, env } = setup({ kind: 'home' });
  assert.deepEqual(pickBombGoal(escort, env), { ...bases[0], holdRadiusUnits: null });
  assert.deepEqual(pickBombGoal(defender, env), { ...guardPatrolPoint(bases[1], defender, env.tick), holdRadiusUnits: null });
  env.bomb = { kind: 'carried', carrier: carrier.id };
  assert.ok(pickBombGoal(carrier, env)?.holdRadiusUnits);
  assert.partialDeepStrictEqual(pickBombGoal(carrier, env), bases[1]);
  assert.partialDeepStrictEqual(pickBombGoal(escort, env), { x: carrier.state.x, y: carrier.state.y, z: carrier.state.z, holdRadiusUnits: null });
  env.bomb = { kind: 'dropped', x: 12, y: 0, z: 34, returnAtTick: 100 };
  assert.deepEqual(pickBombGoal(escort, env), { x: 12, y: 0, z: 34, holdRadiusUnits: null });
  env.mode = 'tdm';
  assert.equal(pickBombGoal(escort, env), null);
});

it('players who only wait patrol a ring around the spot instead of parking on it', () => {
  const { carrier, escort, defender, env } = setup({ kind: 'home' });
  const ringDistance = (p: { x: number; z: number } | null, c: { x: number; z: number }) => Math.round(Math.hypot(p!.x - c.x, p!.z - c.z));
  const first = pickBombGoal(defender, env);
  assert.ok(ringDistance(first, bases[1]) > 160, 'defender waits outside the plant radius');
  env.tick += 60 * 3;
  const next = pickBombGoal(defender, env);
  assert.equal(ringDistance(next, bases[1]), ringDistance(first, bases[1]));
  assert.notDeepEqual(next, first, 'defender moves to another patrol point');
  env.bomb = { kind: 'planting', carrier: carrier.id, doneAtTick: env.tick + 180 };
  const escortGoal = pickBombGoal(escort, env);
  assert.ok(ringDistance(escortGoal, carrier.state) > 160, 'escorts cover a planting carrier from around it');
  assert.notDeepEqual(escortGoal, guardPatrolPoint(carrier.state, carrier, env.tick), 'teammates spread over the ring');
  env.bomb = { kind: 'planted', x: 10, y: 0, z: 20, explodeAtTick: 999, variant: 0, defuse: null };
  const guard = pickBombGoal(escort, env);
  assert.equal(guard?.holdRadiusUnits, null);
  assert.ok(ringDistance(guard, { x: 10, z: 20 }) > 160, 'attackers guard a planted bomb from around it');
});

it('a guard walks round the ring instead of crossing the site between patrol points', () => {
  const guard = agent(3, 1);
  const anchor = bases[1];
  for (let step = 0; step < 12; step++) {
    const from = guardPatrolPoint(anchor, guard, step * 180);
    const to = guardPatrolPoint(anchor, guard, (step + 1) * 180);
    const hop = Math.hypot(to.x - from.x, to.z - from.z);
    assert.ok(hop < 300, 'patrol hop of ' + Math.round(hop) + ' units cuts across the site');
  }
});

it('defenders walk to the planted bomb and hold use next to it', () => {
  const { defender, env } = setup({ kind: 'planted', x: 10, y: 0, z: 20, explodeAtTick: 999, variant: 0, defuse: null });
  const goal = pickBombGoal(defender, env);
  assert.partialDeepStrictEqual(goal, { x: 10, y: 0, z: 20 });
  assert.ok(goal?.holdRadiusUnits);
  Object.assign(defender.state, { x: 10, y: 0, z: 20, dropping: false });
  const brain = new BotBrain(0.5);
  assert.equal(brain.think(defender, env).buttons, BTN.USE);
  Object.assign(defender.state, { x: 900, z: 900 });
  assert.equal(brain.think(defender, env).buttons & BTN.USE, 0);
});

const BUDGET_TICKS = 60 * 180;
function botGame(mapId: string) {
  let seed = 4242;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 2 ** 32; };
  const game = new Game({ maxPlayers: 2, matchMs: 600000, podiumMs: 5000, warmupMinPlayers: 2, modes: 'defuse', maps: [mapId], defuseLimit: 0, botFill: 2, botSkill: 0.5, random });
  const events: string[] = [];
  const observer = game.join('bootstrap', 0, WEAPON.RIFLE, (data) => {
    const msg = JSON.parse(data) as ServerMsg;
    if (msg.t === 'ev') for (const e of msg.e) if (e.k === 'bomb') events.push(e.what);
  });
  assert.ok(typeof observer !== 'string');
  observer.brain = new BotBrain(0.5);
  const players = [...game.players.values()];
  const attackers = (game as any).attackers as number;
  const attacker = players.find((p) => p.team === attackers);
  const defender = players.find((p) => p.team !== attackers);
  assert.ok(attacker && defender);
  return { game, events, attacker, defender };
}

it('a bot approaches an elevated desk when horizontal distance alone would make it hold use', () => {
  const { game, events, attacker, defender } = botGame('escritorio');
  attacker.alive = false;
  attacker.respawnAt = Infinity;
  Object.assign(defender.state, { x: 848, y: 0, z: 185, dropping: false, onGround: true });
  (game as unknown as { bomb: BombState }).bomb = {
    kind: 'planted', x: 790, y: 30, z: 185, explodeAtTick: game.tick + FUSE_TICKS, variant: 1, defuse: null,
  };
  game.update();
  assert.equal(defender.using, false);
  const approachBudget = FUSE_TICKS - DEFUSE_TICKS;
  for (let tick = 0; tick < approachBudget && !events.includes('defuse'); tick++) game.update();
  assert.ok(events.includes('defuse'));
});

for (const map of getMaps()) {
  it('a bot attacker takes the bomb and plants it at the site on ' + map.id, (t) => {
    const { game, events, attacker, defender } = botGame(map.id);
    defender.alive = false;
    defender.respawnAt = Infinity;
    let ticks = 0;
    while (ticks < BUDGET_TICKS && !events.includes('plant')) { game.update(); ticks++; }
    t.diagnostic(map.id + ': ticks-to-plant=' + (events.includes('plant') ? ticks : 'none'));
    assert.ok(events.includes('take'), 'bomb was never taken on ' + map.id);
    assert.ok(events.includes('plant'), 'bomb was never planted after ' + ticks + ' ticks on ' + map.id);
    assert.equal(attacker.team, (game as any).attackers);
  });

  it('a bot defender walks to a planted bomb and defuses it on ' + map.id, (t) => {
    const { game, events, attacker, defender } = botGame(map.id);
    attacker.alive = false;
    attacker.respawnAt = Infinity;
    const site = game.map.flagBases[1 - attacker.team];
    const y = game.world.groundBelow(site.x, game.map.dropHeight, site.z, 16);
    (game as any).bomb = { kind: 'planted', x: site.x, y, z: site.z, explodeAtTick: game.tick + FUSE_TICKS * 6, variant: 1, defuse: null };
    let ticks = 0;
    while (ticks < BUDGET_TICKS && !events.includes('defused')) { game.update(); ticks++; }
    t.diagnostic(map.id + ': ticks-to-defuse=' + (events.includes('defused') ? ticks : 'none'));
    assert.ok(events.includes('defuse'), 'defuse never started on ' + map.id);
    assert.ok(events.includes('defused'), 'bomb was never defused after ' + ticks + ' ticks on ' + map.id);
    assert.equal(game.teamScores[defender.team], 1);
  });
}

it('a bot approaching a solid desk diagonally defuses from the corner', () => {
  const { game, events, attacker, defender } = botGame(map.id);
  attacker.alive = false;
  attacker.respawnAt = Infinity;
  const { x, z } = game.map.flagBases[1 - attacker.team];
  const y = game.world.groundBelow(x, game.map.dropHeight, z, PLAYER_RADIUS);
  const contact = BOMB_DESK_SIZE_UNITS / 2 + PLAYER_RADIUS;
  const startOffset = contact + PLAYER_RADIUS / 2;
  Object.assign(defender.state, { x: x + startOffset, y, z: z + startOffset, dropping: false, onGround: true });
  (game as unknown as { bomb: BombState }).bomb = {
    kind: 'planted', x, y, z, explodeAtTick: game.tick + FUSE_TICKS, variant: 1, defuse: null,
  };
  const approachBudget = FUSE_TICKS - DEFUSE_TICKS;
  for (let tick = 0; tick < approachBudget && !events.includes('defuse'); tick++) game.update();
  assert.ok(events.includes('defuse'));
  assert.ok(defender.state.x >= x + contact - PLAYER_RADIUS / 4);
  assert.ok(defender.state.z >= z + contact - PLAYER_RADIUS / 4);
  for (let tick = 0; tick < DEFUSE_TICKS; tick++) game.update();
  assert.ok(events.includes('defused'));
  assert.equal(game.teamScores[defender.team], 1);
});
