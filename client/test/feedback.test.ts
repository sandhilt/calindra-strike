import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEEDBACK_URL, GITHUB_URL } from '../src/feedback.ts';
import { ICONS } from '../src/ui/icons.ts';

test('feedback link opens a prefilled new issue on the repo', () => {
  const url = new URL(FEEDBACK_URL);
  assert.equal(url.origin + url.pathname, 'https://github.com/sandhilt/calindra-strike/issues/new');
  assert.equal(url.searchParams.get('title'), 'Feedback: movimento experimental');
  const body = url.searchParams.get('body') ?? '';
  for (const word of ['correr', 'fôlego', 'deslizar', 'inclinar', 'deitar', 'navegador']) assert.ok(body.includes(word), word);
});

test('the lobby GitHub button points at the repo the feedback issues go to', () => {
  assert.equal(GITHUB_URL, 'https://github.com/sandhilt/calindra-strike');
  assert.ok(FEEDBACK_URL.startsWith(`${GITHUB_URL}/issues/new?`));
  assert.match(ICONS.github, /^<svg viewBox="0 0 16 16"/);
});
