import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GITHUB_ISSUES_URL } from '../src/feedback.ts';
import { ICONS } from '../src/ui/icons.ts';

test('the feedback link points at the fork’s issues page', () => {
  assert.equal(GITHUB_ISSUES_URL, 'https://github.com/sandhilt/calindra-strike/issues');
  assert.match(ICONS.github, /^<svg viewBox="0 0 16 16"/);
});
