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

test('the gun is on the right by default and moves to the left only for an explicit true', () => {
  saved({});
  assert.equal(loadSettings().leftHanded, false);
  saved({ leftHanded: true });
  assert.equal(loadSettings().leftHanded, true);
  for (const bad of ['yes', 1, null]) {
    saved({ leftHanded: bad });
    assert.equal(loadSettings().leftHanded, false, String(bad));
  }
});

test('music volume defaults, preserves mute and clamps finite saved values', () => {
  for (const [musicVolume, expected] of [
    [undefined, 0.5], ['0.2', 0.5], [null, 0.5], [0, 0], [0.3, 0.3], [-0.1, 0], [1.1, 1],
  ]) {
    saved({ musicVolume });
    assert.equal(loadSettings().musicVolume, expected);
  }
});
