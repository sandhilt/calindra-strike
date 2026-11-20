import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PRIMARY_CHOICES } from '@calindra-strike/shared';
import { weaponMenuKey } from '../src/game/weapon-menu.ts';

test('digits pick the weapons in menu order, on the row and the numpad', () => {
  PRIMARY_CHOICES.forEach((id, i) => {
    assert.equal(weaponMenuKey('Digit' + (i + 1)), id);
    assert.equal(weaponMenuKey('Numpad' + (i + 1)), id);
  });
});

test('a digit past the last line, zero and other keys pick nothing', () => {
  for (const code of ['Digit' + (PRIMARY_CHOICES.length + 1), 'Digit0', 'Numpad0', 'KeyW', 'Enter', 'Escape']) {
    assert.equal(weaponMenuKey(code), null, code);
  }
});
