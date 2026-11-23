import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTROLS, CONTROL_SECTIONS } from '../src/ui/controls-list.ts';
import { ICONS } from '../src/ui/icons.ts';

test('every control row has a registered icon, keys and a label', () => {
  for (const row of CONTROLS) {
    assert.ok(row.icon in ICONS, `unknown icon ${row.icon}`);
    assert.ok(row.keys.trim().length > 0);
    assert.ok(row.label.trim().length > 0);
  }
});

test('every control section has a registered icon and at least one row', () => {
  for (const section of CONTROL_SECTIONS) {
    assert.ok(section.icon in ICONS, `unknown icon ${section.icon}`);
    assert.ok(CONTROLS.some((r) => r.section === section.id), `empty section ${section.id}`);
  }
  for (const row of CONTROLS) assert.ok(CONTROL_SECTIONS.some((s) => s.id === row.section));
});

test('the controls table keeps the keys the lobby always listed', () => {
  const byKeys = new Map(CONTROLS.map((r) => [r.keys, r.label]));
  const expected: [string, string][] = [
    ['WASD', 'mover'],
    ['Espaço', 'pular'],
    ['Ctrl', 'agachar / mergulhar'],
    ['Shift', 'correr'],
    ['Shift + Ctrl', 'deslizar'],
    ['← →', 'inclinar'],
    ['Ctrl Ctrl', 'deitar (dois toques) · ↓'],
    ['Alt', 'andar em silêncio'],
    ['1 2 3', 'armas · Q última'],
    ['R', 'recarregar'],
    ['E', 'plantar / desarmar o bug'],
    ['Mouse 2', 'mirar (segurar) · luneta da AWP'],
    ['Tab', 'placar · Y chat'],
  ];
  for (const [keys, label] of expected) assert.equal(byKeys.get(keys), label);
});

test('icons are 24 grid or weapon silhouettes, all non-empty svg', () => {
  for (const [name, markup] of Object.entries(ICONS)) {
    assert.match(markup, /^<svg viewBox="0 0 \d+ \d+"/, name);
    assert.ok(markup.endsWith('</svg>'), name);
  }
});

test('the headshot and weapon icons the feed and the pause menu draw are registered', () => {
  for (const name of ['headshot', 'rifle', 'smg', 'shotgun'] as const) assert.match(ICONS[name], /^<svg /, name);
});
