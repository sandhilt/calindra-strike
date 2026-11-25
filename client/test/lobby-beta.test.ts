import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const lobby = readFileSync(new URL('../src/ui/lobby.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('the play card displays the beta ribbon in Portuguese', () => {
  assert.match(lobby, /const form = h\('form', \{ class: 'card'[^\n]*\n\s*h\('div', \{ class: 'beta-ribbon' \}, \[h\('span', \{ text: 'beta' \}\)\]\)/);
});

test('the beta ribbon lets pointer events pass through', () => {
  assert.match(css, /\.beta-ribbon\s*\{[^}]*pointer-events:\s*none\s*;/);
});
