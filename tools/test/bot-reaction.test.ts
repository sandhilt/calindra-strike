import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WEAPON, type GameEvent } from '../../shared/src/index.ts';
import { DeathStreaks, fellLow, reactionsTo, reactionTrigger, type Table } from '../bot-reaction.ts';

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

describe('reactionsTo', () => {
  const table: Table = {
    me: 1,
    names: new Map([[1, 'bot Me'], [2, 'bot Ally'], [3, 'Foe'], [4, 'Other foe']]),
    teams: new Map([[1, 0], [2, 0], [3, 1], [4, 1]]),
  };
  const streakKill = (by: number, to: number, streak: number): GameEvent => ({ k: 'kill', by, to, w: WEAPON.RIFLE, hs: 0, streak });

  it('cheers an ally on a streak and complains about a foe on one', () => {
    const streaks = new DeathStreaks();
    assert.deepEqual(reactionsTo(streakKill(2, 3, 3), table, streaks), [{ channel: 'chat', trigger: 'killStreakAlly', about: 'bot Ally' }]);
    assert.deepEqual(reactionsTo(streakKill(3, 2, 5), table, streaks), [{ channel: 'chat', trigger: 'killStreakFoe', about: 'Foe' }]);
    assert.deepEqual(reactionsTo(streakKill(3, 2, 2), table, streaks), []);
  });

  it('counts deaths without a kill in between and calls out the fourth', () => {
    const streaks = new DeathStreaks();
    for (let i = 0; i < 3; i++) assert.deepEqual(reactionsTo(streakKill(3, 2, 1), table, streaks), []);
    assert.deepEqual(reactionsTo(streakKill(3, 2, 1), table, streaks), [{ channel: 'chat', trigger: 'deathStreakAlly', about: 'bot Ally' }]);
    // A kill breaks the run: four more deaths are needed.
    reactionsTo(streakKill(2, 3, 1), table, streaks);
    for (let i = 0; i < 3; i++) assert.deepEqual(reactionsTo(streakKill(3, 2, 1), table, streaks), []);
    assert.equal(reactionsTo(streakKill(3, 2, 1), table, streaks).length, 1);
  });

  it('teases a foe who keeps dying and does not comment on the bot itself', () => {
    const streaks = new DeathStreaks();
    for (let i = 0; i < 3; i++) reactionsTo(streakKill(1, 4, 1), table, streaks);
    const fourth = reactionsTo(streakKill(1, 4, 1), table, streaks);
    assert.deepEqual(fourth.slice(0, 1), [{ channel: 'chat', trigger: 'deathStreakFoe', about: 'Other foe' }]);
    const mine = new DeathStreaks();
    for (let i = 0; i < 4; i++) reactionsTo(streakKill(3, 1, 3), table, mine);
    assert.ok(reactionsTo(streakKill(3, 1, 3), table, mine).every((r) => r.trigger !== 'deathStreakAlly' && r.trigger !== 'killStreakAlly'));
  });

  it('calls the radio for my own kill and for a plant on either side', () => {
    const streaks = new DeathStreaks();
    assert.deepEqual(reactionsTo(streakKill(1, 3, 1), table, streaks), [
      { channel: 'radio', trigger: 'enemyDown' }, { channel: 'chat', trigger: 'kill' },
    ]);
    assert.deepEqual(reactionsTo({ k: 'bomb', what: 'plant', team: 0, by: 2 }, table, streaks), [{ channel: 'radio', trigger: 'plantAttack' }]);
    assert.deepEqual(reactionsTo({ k: 'bomb', what: 'plant', team: 1, by: 3 }, table, streaks), [{ channel: 'radio', trigger: 'plantDefense' }]);
  });

  it('forgets a player who leaves', () => {
    const streaks = new DeathStreaks();
    for (let i = 0; i < 3; i++) reactionsTo(streakKill(3, 2, 1), table, streaks);
    reactionsTo({ k: 'leave', id: 2 }, table, streaks);
    assert.deepEqual(reactionsTo(streakKill(3, 2, 1), table, streaks), []);
  });

  it('notices health falling into the low range once', () => {
    assert.equal(fellLow(80, 35), true);
    assert.equal(fellLow(35, 20), false);
    assert.equal(fellLow(50, 0), false);
  });
});
