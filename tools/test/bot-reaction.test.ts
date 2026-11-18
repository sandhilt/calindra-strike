import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WEAPON, type GameEvent } from '../../shared/src/index.ts';
import { reactionTrigger } from '../bot-reaction.ts';

const kill = (by: number, to: number, w: number, hs = 0): GameEvent => ({ k: 'kill', by, to, w, hs, streak: 1 });

describe('reactionTrigger', () => {
  it('maps my kills by kind', () => {
    assert.equal(reactionTrigger(kill(1, 2, WEAPON.RIFLE), 1), 'kill');
    assert.equal(reactionTrigger(kill(1, 2, WEAPON.RIFLE, 1), 1), 'headshot');
    assert.equal(reactionTrigger(kill(1, 2, WEAPON.HAMMER), 1), 'hammer');
  });

  it('maps my death but not a suicide or a stranger fight', () => {
    assert.equal(reactionTrigger(kill(2, 1, WEAPON.RIFLE), 1), 'death');
    assert.equal(reactionTrigger(kill(1, 1, WEAPON.RIFLE), 1), null);
    assert.equal(reactionTrigger(kill(2, 3, WEAPON.RIFLE), 1), null);
  });

  it('maps only my own objective events', () => {
    assert.equal(reactionTrigger({ k: 'bomb', what: 'plant', team: 0, by: 1 }, 1), 'plant');
    assert.equal(reactionTrigger({ k: 'bomb', what: 'defused', team: 1, by: 1 }, 1), 'defused');
    assert.equal(reactionTrigger({ k: 'bomb', what: 'plant', team: 0, by: 2 }, 1), null);
    assert.equal(reactionTrigger({ k: 'bomb', what: 'drop', team: 0, by: 1 }, 1), null);
    assert.equal(reactionTrigger({ k: 'flag', what: 'take', team: 0, by: 1 }, 1), 'flagTake');
    assert.equal(reactionTrigger({ k: 'flag', what: 'capture', team: 0, by: 1 }, 1), 'capture');
    assert.equal(reactionTrigger({ k: 'flag', what: 'return', team: 0, by: 1 }, 1), null);
  });
});
