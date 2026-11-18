import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('text cannot be selected anywhere on screen, except in the fields people type in', () => {
  assert.match(css, /html,\s*body\s*\{[^}]*user-select:\s*none/, 'a drag across the podium or the menu must not mark text');
  assert.match(css, /html,\s*body\s*\{[^}]*-webkit-user-select:\s*none/, 'Safari needs the prefixed property');
  assert.match(css, /input,\s*textarea\s*\{[^}]*user-select:\s*text/, 'name, office code and chat still select and edit');
});
