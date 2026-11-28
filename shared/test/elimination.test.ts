import assert from 'node:assert/strict';
import { it } from 'node:test';
import { canStartEliminationRound, eliminationOutcome, eliminationTimeoutOutcome } from '../src/elimination.ts';

it('requires two ready players and an elapsed join deadline', () => {
  const waiting = { kind: 'waiting', number: 0, startsAt: 30_000 } as const;
  assert.equal(canStartEliminationRound(waiting, 2, 29_999), false);
  assert.equal(canStartEliminationRound(waiting, 2, 30_000), true);
  assert.equal(canStartEliminationRound(waiting, 1, 30_001), false);
  assert.equal(canStartEliminationRound({ kind: 'waiting', number: 0 }, 2, 0), true);
});

it('ends a round only when at most one group survives', () => {
  assert.equal(eliminationOutcome([1, 1, 0]), undefined);
  assert.equal(eliminationOutcome([0, 0]), 0);
  assert.equal(eliminationOutcome([42]), 42);
  assert.equal(eliminationOutcome([]), null);
});

it('awards a timed-out round only to the group with strictly the most survivors', () => {
  assert.equal(eliminationTimeoutOutcome([1, 2, 3]), null);
  assert.equal(eliminationTimeoutOutcome([42]), 42);
  assert.equal(eliminationTimeoutOutcome([0, 1, 0]), 0);
  assert.equal(eliminationTimeoutOutcome([1, 0, 1]), 1);
  assert.equal(eliminationTimeoutOutcome([1, 0]), null);
  assert.equal(eliminationTimeoutOutcome([]), null);
});
