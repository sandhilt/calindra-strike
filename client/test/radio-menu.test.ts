import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RADIO_MENUS, radioLineAt } from '@calindra-strike/shared';
import { radioMenuKey } from '../src/game/radio-menu.ts';

test('Z, X, V, B and N open their menu only while the player can use the radio', () => {
  for (const menu of RADIO_MENUS) {
    assert.deepEqual(radioMenuKey(null, menu.key, true), { open: menu.id, consumed: true });
    assert.deepEqual(radioMenuKey(null, menu.key, false), { open: null, consumed: false }, `${menu.key} is ignored while chatting or spectating`);
  }
  assert.deepEqual(RADIO_MENUS.map((m) => m.key), ['KeyZ', 'KeyX', 'KeyV', 'KeyB', 'KeyN']);
});

test('another menu key switches menus and the same key closes', () => {
  assert.deepEqual(radioMenuKey('comandos', 'KeyX', true), { open: 'grupo', consumed: true });
  assert.deepEqual(radioMenuKey('grupo', 'KeyX', true), { open: null, consumed: true });
});

test('Escape and 0 close the menu', () => {
  for (const code of ['Escape', 'Digit0', 'Numpad0']) assert.deepEqual(radioMenuKey('respostas', code, true), { open: null, consumed: true }, code);
});

test('digits pick a line, close the menu and are consumed so they do not switch weapons', () => {
  for (const code of ['Digit1', 'Numpad1']) {
    assert.deepEqual(radioMenuKey('comandos', code, true), { open: null, consumed: true, pick: radioLineAt('comandos', 1)?.id });
  }
  assert.equal(radioMenuKey('respostas', 'Digit9', true).pick, radioLineAt('respostas', 9)?.id);
  assert.equal(radioMenuKey('calindra', 'Digit9', true).pick, 49);
  assert.equal(radioMenuKey('calindra-2', 'Digit2', true).pick, 52);
});

test('a digit past the end of the menu is swallowed and leaves the menu open', () => {
  assert.deepEqual(radioMenuKey('calindra-2', 'Digit3', true), { open: 'calindra-2', consumed: true });
  assert.deepEqual(radioMenuKey('comandos', 'Digit9', true), { open: 'comandos', consumed: true });
});

test('with the menu closed, digits and other keys are left to weapon switching and movement', () => {
  for (const code of ['Digit1', 'Digit3', 'KeyQ', 'KeyW', 'Escape', 'Digit0']) assert.equal(radioMenuKey(null, code, true).consumed, false, code);
});

test('with a menu open, movement keys still pass through', () => {
  for (const code of ['KeyW', 'KeyA', 'Space', 'KeyQ', 'KeyG']) assert.deepEqual(radioMenuKey('grupo', code, true), { open: 'grupo', consumed: false }, code);
});
