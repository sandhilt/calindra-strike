import assert from 'node:assert/strict';
import { it } from 'node:test';
import { formatCountdown } from '../src/ui/countdown.ts';

it('formats countdown seconds as minutes and two-digit seconds', () => {
  assert.equal(formatCountdown(90), '1:30');
  assert.equal(formatCountdown(60), '1:00');
  assert.equal(formatCountdown(9), '0:09');
  assert.equal(formatCountdown(0), '0:00');
});
