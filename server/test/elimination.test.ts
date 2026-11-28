import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
  ELIMINATION_JOIN_MS, ELIMINATION_PAUSE_MS, ELIMINATION_ROUND_MS, ELIMINATION_WIN_ROUNDS, LEAD_ANNOUNCEMENT_INTERVAL_MS,
  RESPAWN_TICKS, SNAPSHOT_EVERY_TICKS, TICK_MS, WEAPON, type GameMode, type ServerMsg,
} from '@calindra-strike/shared';
import { Game } from '../src/game.ts';

const JOIN_TICKS = Math.round(ELIMINATION_JOIN_MS / TICK_MS);

function setup(mode: GameMode, warmupMinPlayers = 2, requireReady = false) {
  const game = new Game({ maxPlayers: 8, matchMs: 180_000, podiumMs: 5000, warmupMinPlayers, modes: mode, maps: ['forja'], requireReady });
  const messages: ServerMsg[] = [];
  function join(name: string) {
    const player = game.join(name, 0, WEAPON.RIFLE, data => {
      if (name === 'A') messages.push(JSON.parse(data));
    });
    assert.ok(typeof player !== 'string');
    return player;
  }
  function run(ticks: number) {
    for (let i = 0; i < ticks; i++) game.update();
  }
  function snapshot() {
    run(SNAPSHOT_EVERY_TICKS);
    return messages.findLast(m => m.t === 'snap')?.el;
  }
  return { game, join, run, snapshot, messages };
}

it('starts LMS at the join deadline with players who confirm during the window', () => {
  const { game, join, run, snapshot } = setup('lms', 2, true);
  const a = join('A');
  const b = join('B');
  game.ready(a);
  game.ready(b);
  assert.deepEqual(snapshot(), {
    kind: 'waiting', number: 0, startsAt: ELIMINATION_JOIN_MS, alive: 0, teamsAlive: null,
  });
  const arrivalTick = Math.round(20_000 / TICK_MS);
  run(arrivalTick - SNAPSHOT_EVERY_TICKS);
  const c = join('C');
  assert.equal(c.ready.kind, 'pending');
  game.ready(c);

  run(JOIN_TICKS - arrivalTick - 1);
  assert.equal(game['eliminationSnapshot']()?.kind, 'waiting');
  assert.ok([a, b, c].every(p => !p.alive));
  run(1);
  assert.deepEqual(game['eliminationSnapshot'](), {
    kind: 'playing', number: 1, endsAt: ELIMINATION_JOIN_MS + ELIMINATION_ROUND_MS, alive: 3, teamsAlive: null,
  });
  assert.ok([a, b, c].every(p => p.alive));
});

it('opens a fresh join window when the round pause ends with one ready player', () => {
  const { game, join, run } = setup('lms');
  const a = join('A');
  const b = join('B');
  run(JOIN_TICKS);
  game['kill'](b, a, WEAPON.RIFLE, false);
  run(1);
  game.leave(b.id);
  run(Math.round(ELIMINATION_PAUSE_MS / TICK_MS));
  const startsAt = game.now() + ELIMINATION_JOIN_MS;
  run(JOIN_TICKS - 1);
  assert.partialDeepStrictEqual(game['eliminationSnapshot'](), { kind: 'waiting', number: 1, startsAt, alive: 0 });
  const c = join('C');
  assert.equal(c.alive, false);
  run(1);
  assert.partialDeepStrictEqual(game['eliminationSnapshot'](), { kind: 'playing', number: 2, alive: 2 });
});

it('keeps LMS casualties and late arrivals out until the next round and ends at the goal', () => {
  const { game, join, run, snapshot, messages } = setup('lms', 3);
  const a = join('A');
  const b = join('B');
  const c = join('C');
  run(JOIN_TICKS);
  const late = join('Late');
  assert.equal(late.alive, false);
  assert.deepEqual(snapshot(), { kind: 'playing', number: 1, endsAt: ELIMINATION_JOIN_MS + ELIMINATION_ROUND_MS, alive: 3, teamsAlive: null });

  game['kill'](b, a, WEAPON.RIFLE, false);
  run(RESPAWN_TICKS + 1);
  assert.equal(b.alive, false);
  assert.equal(a.points, 0);
  game['kill'](c, a, WEAPON.RIFLE, false);
  assert.partialDeepStrictEqual(snapshot(), { kind: 'pause', winner: a.id, alive: 1 });
  assert.equal(a.points, 1);
  assert.ok(messages.some(m => m.t === 'ev' && m.e.some(e => e.k === 'lead' && e.what === 'takes' && e.leader === a.id)));

  for (let round = 2; round <= ELIMINATION_WIN_ROUNDS; round++) {
    run(Math.ceil(ELIMINATION_PAUSE_MS / TICK_MS));
    assert.partialDeepStrictEqual(snapshot(), { kind: 'playing', number: round, alive: 4, teamsAlive: null });
    for (const other of [b, c, late]) game['kill'](other, a, WEAPON.RIFLE, false);
    run(2);
  }
  assert.equal(game.phase, 'podium');
  const match = messages.findLast(m => m.t === 'match')?.match;
  assert.equal(match?.winner, a.id);
  assert.equal(match?.results?.[0].points, ELIMINATION_WIN_ROUNDS);
});

it('scores Gincana once when the last opponent is eliminated, even with several winning teammates', () => {
  const { game, join, run, snapshot } = setup('gincana', 4);
  const a = join('A');
  const others = [join('B'), join('C'), join('D')];
  const opponents = others.filter(p => p.team !== a.team);
  run(JOIN_TICKS);
  assert.deepEqual(snapshot()?.teamsAlive, [2, 2]);
  game['kill'](opponents[0], a, WEAPON.RIFLE, false);
  assert.equal(snapshot()?.kind, 'playing');
  assert.deepEqual(game.teamScores, [0, 0]);
  game['kill'](opponents[1], a, WEAPON.RIFLE, false);
  assert.partialDeepStrictEqual(snapshot(), { kind: 'pause', winner: a.team, alive: 2 });
  assert.equal(game.teamScores[a.team], 1);
  assert.equal(snapshot()?.kind, 'pause');
  assert.equal(game.teamScores[a.team], 1);
});

it('announces the current team leader after the cooldown and then reminds while it holds', () => {
  const { game, join, run, messages } = setup('tdm');
  join('A');
  join('B');
  const interval = Math.ceil(LEAD_ANNOUNCEMENT_INTERVAL_MS / TICK_MS);
  const leads = () => messages.flatMap(m => m.t === 'ev' ? m.e.filter(e => e.k === 'lead') : []);
  game.teamScores[0] = 1;
  run(1);
  game.teamScores[1] = 2;
  run(interval - 1);
  assert.deepEqual(leads(), [{ k: 'lead', what: 'takes', leader: 0 }]);
  run(1);
  run(interval);
  assert.deepEqual(leads().slice(1), [{ k: 'lead', what: 'takes', leader: 1 }, { k: 'lead', what: 'continues', leader: 1 }]);
});

it('scores a timed-out Gincana round once for the team with more survivors', () => {
  const { game, join, run, snapshot } = setup('gincana', 4);
  const a = join('A');
  const opponent = [join('B'), join('C'), join('D')].find(p => p.team !== a.team);
  assert.ok(opponent);
  run(JOIN_TICKS);
  game['kill'](opponent, a, WEAPON.RIFLE, false);

  run(Math.round(ELIMINATION_ROUND_MS / TICK_MS) - 1);
  assert.equal(game['eliminationSnapshot']()?.kind, 'playing');
  assert.equal(game.teamScores[a.team], 0);
  run(1);
  assert.deepEqual(snapshot(), {
    kind: 'pause', number: 1, winner: a.team, nextAt: ELIMINATION_JOIN_MS + ELIMINATION_ROUND_MS + ELIMINATION_PAUSE_MS,
    alive: 3, teamsAlive: a.team === 0 ? [2, 1] : [1, 2],
  });
  assert.equal(snapshot()?.kind, 'pause');
  assert.equal(game.teamScores[a.team], 1);
});

it('draws an LMS round with two survivors at the deadline and restarts after the pause', () => {
  const { game, join, run } = setup('lms');
  const a = join('A');
  const b = join('B');

  run(JOIN_TICKS + Math.round(ELIMINATION_ROUND_MS / TICK_MS));
  assert.partialDeepStrictEqual(game['eliminationSnapshot'](), { kind: 'pause', winner: null, alive: 2 });
  assert.equal(a.points, 0);
  assert.equal(b.points, 0);
  run(Math.round(ELIMINATION_PAUSE_MS / TICK_MS) - 1);
  assert.equal(game['eliminationSnapshot']()?.kind, 'pause');
  run(1);
  assert.deepEqual(game['eliminationSnapshot'](), {
    kind: 'playing', number: 2, endsAt: game.now() + ELIMINATION_ROUND_MS, alive: 2, teamsAlive: null,
  });
});

it('awards the last survivor the round on the timeout tick', () => {
  const { game, join, run } = setup('lms');
  const a = join('A');
  const b = join('B');

  run(JOIN_TICKS + Math.round(ELIMINATION_ROUND_MS / TICK_MS) - 1);
  game['kill'](b, a, WEAPON.RIFLE, false);
  run(1);
  assert.equal(game.now(), ELIMINATION_JOIN_MS + ELIMINATION_ROUND_MS);
  assert.partialDeepStrictEqual(game['eliminationSnapshot'](), { kind: 'pause', winner: a.id });
  assert.equal(a.points, 1);
});

it('kicks an idle survivor but keeps a late arrival waiting for the next round', () => {
  const kicks: number[] = [];
  const game = new Game({
    maxPlayers: 8, matchMs: 120_000, podiumMs: 5000, warmupMinPlayers: 3, modes: 'lms',
    maps: ['forja'], idleKickMs: 1000, onKick: id => kicks.push(id),
  });
  const players = ['A', 'B', 'Idle'].map(name => game.join(name, 0, WEAPON.RIFLE, () => {}));
  for (let i = 0; i < JOIN_TICKS; i++) game.update();
  assert.deepEqual(kicks, []);
  const [a, b, idle] = players;
  const late = game.join('Late', 0, WEAPON.RIFLE, () => {});
  assert.ok(typeof a !== 'string' && typeof b !== 'string' && typeof idle !== 'string' && typeof late !== 'string');
  assert.equal(idle.alive, true);
  assert.equal(late.alive, false);
  for (const p of [a, b]) {
    game.input(p, [{ seq: 1, buttons: 0, yaw: 1, pitch: 0, weapon: 0, interp: 0 }]);
  }
  for (let i = 0; i < Math.ceil(1000 / TICK_MS); i++) game.update();
  assert.deepEqual(kicks, [idle.id]);
  assert.equal(game['eliminationSnapshot']()?.kind, 'playing');
});

it('does not kick a player who is dead in the round for the time they spend waiting for it to end', () => {
  const IDLE_MS = 30_000;
  const kicks: number[] = [];
  const game = new Game({ maxPlayers: 8, matchMs: 600_000, podiumMs: 5000, warmupMinPlayers: 3, modes: 'lms', maps: ['forja'], idleKickMs: IDLE_MS, onKick: (id) => kicks.push(id) });
  const join = (name: string) => {
    const player = game.join(name, 0, WEAPON.RIFLE, () => {});
    assert.ok(typeof player !== 'string');
    return player;
  };
  const [a, b, c] = ['A', 'B', 'C'].map(join);
  const look = (p: typeof a, yaw: number) => game.input(p, [{ seq: p.lastSeq + 1, buttons: 0, yaw, pitch: 0, weapon: 0, interp: 0 }]);
  const run = (ms: number) => { for (let i = 0; i < Math.ceil(ms / TICK_MS); i++) game.update(); };
  run(ELIMINATION_JOIN_MS);
  game['kill'](b, a, WEAPON.RIFLE, false);
  run(RESPAWN_TICKS * TICK_MS + 100);
  assert.equal(b.alive, false);
  for (let s = 1; s <= 45; s++) {
    look(a, s / 10);
    look(c, s / 10);
    run(1_000);
  }
  assert.deepEqual(kicks, [], 'B has only been dead, waiting for the round to end');
  game['kill'](c, a, WEAPON.RIFLE, false);
  run(ELIMINATION_PAUSE_MS + 1_000);
  assert.equal(b.alive, true, 'the next round brought B back');
  assert.deepEqual(kicks, [], 'the time spent dead does not count against B in the new round');
});

it('starts every player\'s idle clock over when a round begins', () => {
  const IDLE_MS = 10_000;
  const kicks: number[] = [];
  const game = new Game({ maxPlayers: 8, matchMs: 600_000, podiumMs: 5000, warmupMinPlayers: 3, modes: 'lms', maps: ['forja'], idleKickMs: IDLE_MS, onKick: (id) => kicks.push(id) });
  const [survivor, b, c] = ['A', 'B', 'C'].map((name) => {
    const player = game.join(name, 0, WEAPON.RIFLE, () => {});
    assert.ok(typeof player !== 'string');
    return player;
  });
  const run = (ms: number) => { for (let i = 0; i < Math.ceil(ms / TICK_MS); i++) game.update(); };
  run(ELIMINATION_JOIN_MS);
  assert.equal(game['eliminationSnapshot']()?.kind, 'playing');
  run(5_000);
  game['kill'](b, survivor, WEAPON.RIFLE, false);
  game['kill'](c, survivor, WEAPON.RIFLE, false);
  run(ELIMINATION_PAUSE_MS + 1_000);
  assert.equal(game['eliminationSnapshot']()?.kind, 'playing', 'the next round has started');
  assert.deepEqual(kicks, [], 'the survivor was idle through the round and the pause, not through the new round');
});
