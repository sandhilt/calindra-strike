import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GITHUB_ISSUES_URL, newIssueUrl } from '../src/feedback.ts';
import { ICONS } from '../src/ui/icons.ts';

test('the feedback link points at the fork’s issues page', () => {
  assert.equal(GITHUB_ISSUES_URL, 'https://github.com/sandhilt/calindra-strike/issues');
  assert.match(ICONS.github, /^<svg viewBox="0 0 16 16"/);
});

test('a new issue carries the build and machine metadata in its body', () => {
  const url = new URL(newIssueUrl({ build: 'abc1234', protocol: 42, userAgent: 'UA/1', screen: '800x600 @2x', language: 'pt-BR' }));
  assert.equal(`${url.origin}${url.pathname}`, `${GITHUB_ISSUES_URL}/new`);
  const body = url.searchParams.get('body') ?? '';
  for (const part of ['abc1234', 'Protocolo: 42', 'UA/1', '800x600 @2x', 'pt-BR']) assert.ok(body.includes(part), part);
});
