import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const ruleBody = (selector: string): string => {
  const at = css.indexOf(`${selector} {`);
  assert.notEqual(at, -1, `${selector} has no rule in styles.css`);
  return css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
};

test('each pause menu page scrolls on its own and the body does not', () => {
  assert.match(ruleBody('.menu-body.menu-pages'), /overflow:\s*hidden/);
  assert.match(ruleBody('.menu-pages .menu-panel'), /overflow:\s*auto/);
});

test('the body hands its pages a row that can shrink, so a page scrolls instead of being cut off', () => {
  assert.match(ruleBody('.menu-body.menu-pages'), /grid-template-rows:\s*minmax\(0,\s*1fr\)/);
});

test('the weapon viewer keeps the plain body that scrolls as one', () => {
  assert.match(ruleBody('.menu-body'), /overflow:\s*auto/);
});
