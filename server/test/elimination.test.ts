import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
  ELIMINATION_PAUSE_MS, ELIMINATION_WIN_ROUNDS, LEAD_ANNOUNCEMENT_INTERVAL_MS,
  RESPAWN_TICKS, SNAPSHOT_EVERY_TICKS, TICK_MS, WEAPON, type GameMode, type ServerMsg,
} from '@calindra-strike/shared';
import { Game } from '../src/game.ts';

function setup(mode: GameMode, warmupMinPlayers = 2) {
  const game = new Game({ maxPlayers: 8, matchMs: 120_000, podiumMs: 5000, warmupMinPlayers, modes: mode, maps: ['forja'] });
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

it('keeps LMS casualties and late arrivals out until the next round and ends at the goal', () => {
  const { game, join, run, snapshot, messages } = setup('lms', 3);
  const a = join('A');
  const b = join('B');
  const c = join('C');
  const late = join('Late');
  assert.equal(late.alive, false);
  assert.deepEqual(snapshot(), { kind: 'playing', number: 1, alive: 3, teamsAlive: null });

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
    assert.deepEqual(snapshot(), { kind: 'playing', number: round, alive: 4, teamsAlive: null });
    for (const other of [b, c, late]) game['kill'](other, a, WEAPON.RIFLE, false);
    run(2);
  }
  assert.equal(game.phase, 'podium');
  const match = messages.findLast(m => m.t === 'match')?.match;
  assert.equal(match?.winner, a.id);
  assert.equal(match?.results?.[0].points, ELIMINATION_WIN_ROUNDS);
});

it('scores Gincana once when the last opponent is eliminated, even with several winning teammates', () => {
  const { game, join, snapshot } = setup('gincana', 4);
  const a = join('A');
  const others = [join('B'), join('C'), join('D')];
  const opponents = others.filter(p => p.team !== a.team);
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
