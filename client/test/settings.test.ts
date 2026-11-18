import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSettings } from '../src/settings.ts';

const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
afterEach(() => {
  if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});
function saved(value: unknown): void {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => JSON.stringify(value) } });
}

test('the radio voice is on by default and stays off once a player mutes it', () => {
  saved({});
  assert.equal(loadSettings().radioVoice, true);
  saved({ radioVoice: false });
  assert.equal(loadSettings().radioVoice, false);
  saved({ radioVoice: 'no' });
  assert.equal(loadSettings().radioVoice, true, 'garbage falls back to the default');
});
