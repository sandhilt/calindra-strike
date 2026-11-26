import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.ts';
import type { GameMode } from '@calindra-strike/shared';

const BASE = { maxPlayers: 8, matchMs: 60000, podiumMs: 5000, warmupMinPlayers: 2, modes: ['tdm', 'ffa', 'ctf'] as GameMode[], maps: ['forja', 'escritorio'] };

function firstMatch(firstRotation?: number) {
  const game = new Game({ ...BASE, firstRotation });
  const g = game as unknown as { mapIndex: number; mode: GameMode };
  return { map: g.mapIndex, mode: g.mode, combos: game.combos };
}

describe('first match of the rotation', () => {
  it('plays the first entry when no start is drawn', () => {
    const { map, mode, combos } = firstMatch();
    assert.deepEqual({ map, mode }, combos[0]);
  });

  it('plays the drawn entry, wrapping past the end of the rotation', () => {
    const { combos } = firstMatch();
    for (let start = 0; start < combos.length * 2; start++) {
      const { map, mode } = firstMatch(start);
      assert.deepEqual({ map, mode }, combos[start % combos.length]);
    }
  });
});
