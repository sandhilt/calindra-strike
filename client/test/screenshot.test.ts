import assert from 'node:assert/strict';
import { test } from 'node:test';
import { screenshotName } from '../src/screenshot.ts';

test('a screenshot is named after the local time it was taken, zero padded', () => {
  assert.equal(screenshotName(new Date(2026, 0, 5, 9, 3, 7)), 'calindra-strike-2026-01-05_09-03-07.png');
});
