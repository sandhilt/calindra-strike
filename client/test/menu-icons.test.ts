import assert from 'node:assert/strict';
import test from 'node:test';
import { controlRows, CONTROL_SECTIONS } from '../src/ui/controls-list.ts';
import { ACTIONS, ACTION_IDS } from '../src/game/bindings.ts';
import { ICONS } from '../src/ui/icons.ts';

test('control groups have registered icons and contain actions', () => {
  for (const section of CONTROL_SECTIONS) {
    assert.ok(section.icon in ICONS, section.icon);
    assert.ok(ACTION_IDS.some((id) => ACTIONS[id].group === section.id), section.id);
  }
  for (const id of ACTION_IDS) assert.ok(CONTROL_SECTIONS.some((section) => section.id === ACTIONS[id].group));
});

test('gesture rows use current bindings and contextual shortcuts are marked fixed', () => {
  const movement = controlRows({ sprint: ['KeyU'], crouch: ['Mouse3'] }, 'movimento');
  assert.partialDeepStrictEqual(movement, [
    { keys: 'U + Mouse 3', label: 'deslizar' },
    { keys: 'Mouse 3', label: 'deitar (dois toques)' },
  ]);
  assert.ok(controlRows({}, 'interface').every((row) => row.keys && row.label.includes('(fixo)')));
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
