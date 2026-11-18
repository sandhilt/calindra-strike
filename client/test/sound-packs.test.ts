import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { ANNOUNCER_LINES, announceStreak } from '../src/game/sound-packs/announcer.ts';
import { DEFAULT_SOUND_PACK, SOUND_PACKS, findSoundPack, isSoundPackId } from '../src/game/sound-packs/index.ts';
import { loadSettings } from '../src/settings.ts';

const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
afterEach(() => {
  if (storage) Object.defineProperty(globalThis, 'localStorage', storage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});
function saved(value: unknown): void {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => JSON.stringify(value) },
  });
}
test('sound pack ids are unique and non-empty, and the default is registered', () => {
  const ids = SOUND_PACKS.map((pack) => pack.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(id.trim().length > 0);
  assert.ok(findSoundPack(DEFAULT_SOUND_PACK));
});
test('lookup and validation accept only registered ids', () => {
  for (const pack of SOUND_PACKS) {
    assert.equal(findSoundPack(pack.id), pack);
    assert.equal(isSoundPackId(pack.id), true);
  }
  assert.equal(findSoundPack('unknown'), undefined);
  for (const value of ['unknown', '', null, undefined, 1, {}, ['classic']]) {
    assert.equal(isSoundPackId(value), false);
  }
});
test('settings preserve each registered sound pack', () => {
  for (const pack of SOUND_PACKS) {
    saved({ soundPack: pack.id });
    assert.equal(loadSettings().soundPack, pack.id);
  }
});
test('settings fall back for unknown or non-string sound packs', () => {
  for (const soundPack of ['unknown', '', null, 1, false, {}, ['sound-new']]) {
    saved({ soundPack });
    assert.equal(loadSettings().soundPack, DEFAULT_SOUND_PACK);
  }
});
test('old saved settings without a sound pack use the default', () => {
  saved({ volume: 0.4 });
  const settings = loadSettings();
  assert.equal(settings.soundPack, DEFAULT_SOUND_PACK);
  assert.equal(settings.volume, 0.4);
});

test('the announcer speaks an original line for every streak tier past a single kill, at the given volume', () => {
  const spoken: [string, number][] = [];
  const speak = (text: string, volume: number) => spoken.push([text, volume]);
  announceStreak('kill', speak, 0.5);
  assert.equal(spoken.length, 0, 'a single kill stays silent');
  for (const sound of ['double', 'triple', 'multi', 'rampage', 'unstoppable', 'godlike'] as const) announceStreak(sound, speak, 0.5);
  assert.deepEqual(spoken.map(([text]) => text), ['Dobradinha!', 'Trinca na forja!', 'Fornalha acesa!', 'Martelada geral!', 'Ninguém segura!', 'Deus da forja!']);
  assert.ok(spoken.every(([, volume]) => volume === 0.5));
  assert.ok(Object.values(ANNOUNCER_LINES).every((line) => line === null || line.length <= 24));
});

test('the announcer is a separate switch, not a sound pack', () => {
  assert.equal(findSoundPack('announcer'), undefined);
  saved({});
  assert.equal(loadSettings().announcer, false, 'off by default');
  saved({ soundPack: 'sound-new', announcer: true });
  assert.deepEqual([loadSettings().soundPack, loadSettings().announcer], ['sound-new', true], 'any pack with the voice');
  saved({ soundPack: 'classic', announcer: false });
  assert.equal(loadSettings().announcer, false);
});

test('whoever picked the old announcer pack keeps the voice on top of the classic pack', () => {
  saved({ soundPack: 'announcer' });
  const settings = loadSettings();
  assert.equal(settings.soundPack, DEFAULT_SOUND_PACK);
  assert.equal(settings.announcer, true);
});
