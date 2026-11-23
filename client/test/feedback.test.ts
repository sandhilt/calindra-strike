import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEEDBACK_URL } from '../src/feedback.ts';

test('feedback link opens a prefilled new issue on the repo', () => {
  const url = new URL(FEEDBACK_URL);
  assert.equal(url.origin + url.pathname, 'https://github.com/sandhilt/calindra-strike/issues/new');
  assert.equal(url.searchParams.get('title'), 'Feedback: movimento experimental');
  const body = url.searchParams.get('body') ?? '';
  for (const word of ['correr', 'fôlego', 'deslizar', 'inclinar', 'deitar', 'navegador']) assert.ok(body.includes(word), word);
});
