import assert from 'node:assert/strict';
import { it } from 'node:test';
import { eliminationOutcome } from '../src/elimination.ts';

it('ends a round only when at most one group survives', () => {
  assert.equal(eliminationOutcome([1, 1, 0]), undefined);
  assert.equal(eliminationOutcome([0, 0]), 0);
  assert.equal(eliminationOutcome([42]), 42);
  assert.equal(eliminationOutcome([]), null);
});
