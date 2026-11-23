import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GITHUB_URL } from '../src/feedback.ts';
import { ICONS } from '../src/ui/icons.ts';

test('the lobby GitHub button points at the repo', () => {
  assert.equal(GITHUB_URL, 'https://github.com/sandhilt/calindra-strike');
  assert.match(ICONS.github, /^<svg viewBox="0 0 16 16"/);
});
