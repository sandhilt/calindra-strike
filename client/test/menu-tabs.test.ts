import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FIRST_MENU_TAB, MENU_TAB_IDS, menuTabForKey, stepMenuTab } from '../src/ui/menu-tabs.ts';

test('the menu opens on the game tab, which is the first one', () => {
  assert.equal(FIRST_MENU_TAB, MENU_TAB_IDS[0]);
});

test('stepping wraps around both ends', () => {
  assert.equal(stepMenuTab('controls', 1), 'game');
  assert.equal(stepMenuTab('game', -1), 'controls');
  assert.equal(stepMenuTab('audio', 1), 'video');
  assert.equal(stepMenuTab('video', -1), 'audio');
});

test('stepping a full lap lands where it started', () => {
  for (const id of MENU_TAB_IDS) assert.equal(stepMenuTab(id, MENU_TAB_IDS.length), id);
});

test('arrows, Home and End pick a tab', () => {
  assert.equal(menuTabForKey('ArrowRight', 'game'), 'audio');
  assert.equal(menuTabForKey('ArrowLeft', 'game'), 'controls');
  assert.equal(menuTabForKey('Home', 'aim'), 'game');
  assert.equal(menuTabForKey('End', 'aim'), 'controls');
});

test('other keys are not tab keys', () => {
  for (const key of ['Tab', 'Escape', 'Enter', ' ', 'ArrowUp', 'ArrowDown', 'a']) assert.equal(menuTabForKey(key, 'game'), null, key);
});
