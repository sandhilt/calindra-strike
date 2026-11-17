import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Game, pickVoteOptions } from '../src/game.ts';
import type { GameMode } from '@calindra-strike/shared';

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
