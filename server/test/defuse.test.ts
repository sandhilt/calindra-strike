import { it } from 'node:test';
import assert from 'node:assert/strict';
import { BOMB_RETURN_TICKS, BTN, DEBUG_SCENARIO_COUNT, DEFUSE_TICKS, FUSE_TICKS, PLANT_TICKS, SNAPSHOT_EVERY_TICKS, TICK_MS, WEAPON, type GameMode, type ServerMsg } from '@calindra-strike/shared';
import { Game, type ServerPlayer } from '../src/game.ts';

function setup(defuseLimit = 5, mode: GameMode = 'defuse') {
  const messages: ServerMsg[] = [];
  const game = new Game({ maxPlayers: 16, matchMs: 600000, podiumMs: 5000, warmupMinPlayers: 2, modes: mode, defuseLimit, random: () => 0.5 });
  const players: ServerPlayer[] = [];
  for (let i = 0; i < 4; i++) {
    const p = game.join('P' + i, 0, WEAPON.RIFLE, (data) => messages.push(JSON.parse(data)));
    assert.notEqual(typeof p, 'string');
    players.push(p as ServerPlayer);
  }
  const attackers = (game as any).attackers as number;
  const attacker = players.find((p) => p.team === attackers) as ServerPlayer;
  const defender = players.find((p) => p.team !== attackers) as ServerPlayer;
  return { game, players, messages, attacker, defender };
}
function place(game: Game, p: ServerPlayer, base: number, using = false) {
  const at = game.map.flagBases[base];
  Object.assign(p.state, { ...at, y: game.world.groundBelow(at.x, game.map.dropHeight, at.z, 16), dropping: false, protect: 0 });
  p.using = using;
}
function run(game: Game, ticks: number) {
  for (let i = 0; i < ticks; i++) game.update();
}
function snapshot(game: Game, messages: ServerMsg[]) {
  for (let i = 0; i < SNAPSHOT_EVERY_TICKS; i++) game.update();
  const snap = messages.findLast((m) => m.t === 'snap');
  assert.ok(snap?.t === 'snap');
  return snap;
}
const attackSite = (game: Game, attackers: number) => 1 - attackers;

/** Takes the bomb at home, plants it at the site and returns the planting tick. */
function plant(game: Game, attacker: ServerPlayer, defender: ServerPlayer) {
  const attackers = attacker.team;
  place(game, defender, attackers, false);
  defender.alive = false;
  defender.respawnAt = Infinity;
  place(game, attacker, attackers);
  game.update();
  place(game, attacker, attackSite(game, attackers), true);
  run(game, PLANT_TICKS + 1);
}

it('plants after the plant time and explodes for the attackers, then the sides swap', () => {
  const { game, attacker, defender, messages } = setup();
  const attackers = attacker.team;
  plant(game, attacker, defender);
  const snap = snapshot(game, messages);
  assert.equal(snap.bm[0], 4);
  assert.equal(snap.bm[8], attackers);
  assert.ok(snap.bm[7] >= 0 && snap.bm[7] < DEBUG_SCENARIO_COUNT);
  attacker.using = false;
  attacker.alive = false;
  attacker.respawnAt = Infinity;
  const explodeAt = snap.bm[5];
  assert.ok(explodeAt > game.now());
  while (game.now() < explodeAt - TICK_MS) game.update();
  assert.deepEqual(game.teamScores, [0, 0]);
  run(game, 2);
  assert.equal(game.teamScores[attackers], 1);
  assert.equal(game.teamScores[1 - attackers], 0);
  assert.equal((game as any).attackers, 1 - attackers);
  const after = snapshot(game, messages);
  assert.equal(after.bm[0], 0);
  assert.equal(after.bm[8], 1 - attackers);
  assert.ok(messages.some((m) => m.t === 'ev' && m.e.some((e) => e.k === 'bomb' && e.what === 'exploded' && e.team === attackers)));
  assert.equal(attacker.kills, 0);
});

it('a defender holding use scores the round for the defenders', () => {
  const { game, attacker, defender, messages } = setup();
  const attackers = attacker.team;
  plant(game, attacker, defender);
  attacker.using = false;
  attacker.alive = false;
  attacker.respawnAt = Infinity;
  defender.alive = true;
  place(game, defender, attackSite(game, attackers), true);
  game.update();
  const started = snapshot(game, messages);
  assert.equal(started.bm[1], defender.id);
  assert.ok(started.bm[6] > game.now());
  run(game, DEFUSE_TICKS);
  assert.equal(game.teamScores[1 - attackers], 1);
  assert.equal(game.teamScores[attackers], 0);
  assert.equal((game as any).attackers, 1 - attackers);
  assert.ok(messages.some((m) => m.t === 'ev' && m.e.some((e) => e.k === 'bomb' && e.what === 'defused' && e.by === defender.id)));
  assert.equal(snapshot(game, messages).bm[8], 1 - attackers);
});

it('releasing use while defusing resets the progress', () => {
  const { game, attacker, defender, messages } = setup();
  plant(game, attacker, defender);
  attacker.alive = false;
  attacker.respawnAt = Infinity;
  defender.alive = true;
  place(game, defender, attackSite(game, attacker.team), true);
  run(game, DEFUSE_TICKS - 5);
  defender.using = false;
  run(game, 2);
  assert.equal(snapshot(game, messages).bm[6], 0);
  assert.deepEqual(game.teamScores, [0, 0]);
});

it('a dead carrier drops the bomb where it fell and it returns home on time', () => {
  const { game, attacker, defender, messages } = setup();
  place(game, attacker, attacker.team);
  game.update();
  assert.deepEqual(snapshot(game, messages).bm.slice(0, 2), [1, attacker.id]);
  attacker.state.x += 120;
  (game as any).kill(attacker, defender, WEAPON.RIFLE, false);
  const dropped = snapshot(game, messages);
  assert.equal(dropped.bm[0], 3);
  assert.equal(dropped.bm[2], attacker.state.x);
  assert.equal(attacker.kills, 0);
  attacker.respawnAt = Infinity;
  run(game, BOMB_RETURN_TICKS);
  assert.equal(snapshot(game, messages).bm[0], 0);
  assert.ok(messages.some((m) => m.t === 'ev' && m.e.some((e) => e.k === 'bomb' && e.what === 'return')));
});

it('leaving the match drops a carried bomb', () => {
  const { game, attacker, messages } = setup();
  place(game, attacker, attacker.team);
  game.update();
  game.leave(attacker.id);
  assert.equal(snapshot(game, messages).bm[0], 3);
});

it('ends the match at the round limit with the winning team', () => {
  const { game, attacker, defender, messages } = setup(1);
  plant(game, attacker, defender);
  attacker.alive = false;
  attacker.respawnAt = Infinity;
  run(game, FUSE_TICKS);
  run(game, 2);
  assert.equal(game.phase, 'podium');
  const match = messages.findLast((m) => m.t === 'match');
  assert.ok(match?.t === 'match');
  assert.equal(match.match.limit, 1);
  assert.equal(match.match.winner, attacker.team);
});

it('publishes the limit and an empty bomb outside the mode', () => {
  for (const mode of ['defuse', 'ctf', 'tdm', 'ffa'] as const) {
    const { game, messages } = setup(5, mode);
    const snap = snapshot(game, messages);
    if (mode === 'defuse') assert.equal(snap.bm.length, 10);
    else assert.deepEqual(snap.bm, []);
    const match = messages.findLast((m) => m.t === 'match') ?? { t: 'match', match: (game as any).matchInfo() };
    assert.ok(match.t === 'match');
  }
});

it('uses the injected random for the planted variant', () => {
  const { game, attacker, defender, messages } = setup();
  plant(game, attacker, defender);
  assert.equal(snapshot(game, messages).bm[7], Math.floor(0.5 * DEBUG_SCENARIO_COUNT));
});

it('input use bit is read from the processed command', () => {
  const { game, attacker } = setup();
  place(game, attacker, attacker.team);
  attacker.queue.push({ seq: 1, buttons: BTN.USE, yaw: 0, pitch: 0, weapon: 0, interp: 0 });
  game.update();
  assert.equal(attacker.using, true);
  attacker.queue.push({ seq: 2, buttons: 0, yaw: 0, pitch: 0, weapon: 0, interp: 0 });
  game.update();
  assert.equal(attacker.using, false);
});
