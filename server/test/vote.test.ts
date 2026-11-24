import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Game, pickVoteOptions } from '../src/game.ts';
import { TICK_RATE, WEAPON, type GameMode, type ServerMsg } from '@calindra-strike/shared';

const MATCH_COUNT_PER_SWEEP = 12;
const SEEDS = 200;

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

type Combo = { map: number; mode: GameMode };

function votesFor(modes: GameMode[], maps: string[], seed: number, step: number) {
  const game = new Game({
    maxPlayers: 8, matchMs: 60000, podiumMs: 5000, warmupMinPlayers: 2, modes, maps, random: seeded(seed),
  });
  const internals = game as unknown as { rotationIndex: number; applyRotation(): void; buildVote(): void; voteOptions: Combo[]; mapIndex: number; mode: GameMode };
  internals.rotationIndex = step;
  internals.applyRotation();
  internals.buildVote();
  const next = game.combos[(step + 1) % game.combos.length];
  return { options: internals.voteOptions, current: { map: internals.mapIndex, mode: internals.mode }, next, game };
}

describe('end-of-match vote options', () => {
  it('offers every enabled mode, never the current match', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (let step = 0; step < MATCH_COUNT_PER_SWEEP; step++) {
        const { options, current } = votesFor(['tdm', 'ffa', 'ctf'], ['forja', 'escritorio'], seed, step);
        assert.deepEqual(new Set(options.map((o) => o.mode)), new Set(['tdm', 'ffa', 'ctf']));
        assert.equal(options.some((o) => o.map === current.map && o.mode === current.mode), false);
      }
    }
  });

  it('keeps the rotation default as option 0', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (let step = 0; step < MATCH_COUNT_PER_SWEEP; step++) {
        const { options, next } = votesFor(['tdm', 'ffa', 'ctf'], ['forja', 'escritorio'], seed, step);
        assert.deepEqual(options[0], next);
      }
    }
  });

  it('still gives three distinct options with two modes', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const { options } = votesFor(['tdm', 'ffa'], ['forja', 'escritorio'], seed, 0);
      assert.equal(new Set(options.map((o) => `${o.mode}@${o.map}`)).size, 3);
      assert.deepEqual(new Set(options.map((o) => o.mode)), new Set(['tdm', 'ffa']));
    }
  });

  it('varies only by map with a single mode', () => {
    const { options } = votesFor(['ffa'], ['forja', 'escritorio'], 1, 0);
    assert.equal(options.every((o) => o.mode === 'ffa'), true);
    assert.equal(options.length, 1);
  });
});

describe('pickVoteOptions', () => {
  it('fills leftover slots from what is left once every mode is offered', () => {
    const pool: Combo[] = [
      { map: 0, mode: 'tdm' }, { map: 1, mode: 'tdm' }, { map: 0, mode: 'ffa' }, { map: 1, mode: 'ffa' },
    ];
    const options = pickVoteOptions(pool, pool[0], 3, () => 0);
    assert.equal(options.length, 3);
    assert.equal(new Set(options).size, 3);
    assert.equal(options[1].mode, 'ffa');
  });
});

describe('in-round vote', () => {
  function liveGame(voteWindowMs: number) {
    const inbox: ServerMsg[] = [];
    const game = new Game({
      maxPlayers: 8, matchMs: 300_000, podiumMs: 5000, warmupMinPlayers: 2, modes: ['tdm', 'ffa', 'ctf'], maps: ['forja', 'escritorio'],
      random: seeded(7), voteWindowMs,
    });
    const join = (name: string, record = false) => {
      const player = game.join(name, 0, WEAPON.RIFLE, (data) => { if (record) inbox.push(JSON.parse(data)); });
      assert.ok(typeof player !== 'string');
      return player;
    };
    const first = join('First', true);
    const second = join('Second');
    game.startMatch();
    const run = (seconds: number) => { for (let i = 0; i < seconds * TICK_RATE; i++) game.update(); };
    const info = () => game['matchInfo']();
    return { game, first, second, run, info, inbox };
  }

  it('opens for the first two minutes of a live match, closes, and keeps the votes for the podium', () => {
    const { game, first, second, run, info, inbox } = liveGame(120_000);
    const open = info().vote;
    assert.ok(open && open.options.length > 1 && open.closesAt && open.closesAt > game.now());
    assert.ok(game.vote(first, 1), 'a vote inside the window counts');
    run(100);
    assert.ok(game.vote(second, 1));
    assert.deepEqual(info().vote?.counts, open.options.map((_, i) => (i === 1 ? 2 : 0)));
    run(21);
    assert.equal(info().vote, undefined, 'the panel is gone after two minutes');
    assert.equal(game.vote(first, 2), null, 'and a late vote is ignored');
    assert.ok(inbox.some((m) => m.t === 'match' && m.match.phase === 'live' && m.match.vote === undefined), 'clients are told it closed');
    game['endMatch']();
    const podium = info().vote;
    assert.deepEqual(podium?.counts, open.options.map((_, i) => (i === 1 ? 2 : 0)), 'the votes carry over to the podium');
    assert.equal(podium?.closesAt, undefined);
    assert.ok(game.vote(first, 2), 'the podium keeps voting open');
    game['nextMap']();
    assert.ok(open.options.length > 2);
  });

  it('the option with the most votes becomes the next map and mode', () => {
    const { game, first, second, run } = liveGame(120_000);
    const options = game['voteOptions'] as { map: number; mode: GameMode }[];
    run(5);
    game.vote(first, 2);
    game.vote(second, 2);
    game['endMatch']();
    game['nextMap']();
    assert.deepEqual({ map: game['mapIndex'], mode: game['mode'] }, options[2]);
  });

  it('is off with a window of zero: the podium builds the vote as before', () => {
    const { game, first, run, info } = liveGame(0);
    run(5);
    assert.equal(info().vote, undefined);
    assert.equal(game.vote(first, 0), null);
    game['endMatch']();
    assert.ok(info().vote && info().vote!.options.length > 1);
  });

  it('is not open in the warmup', () => {
    const game = new Game({ maxPlayers: 8, matchMs: 60_000, podiumMs: 5000, warmupMinPlayers: 3, modes: ['tdm', 'ffa'], maps: ['forja'], random: seeded(3) });
    const player = game.join('Solo', 0, WEAPON.RIFLE, () => {});
    assert.ok(typeof player !== 'string');
    assert.equal(game.vote(player, 0), null);
  });
});
