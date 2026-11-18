import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { ANNOUNCER_LINES, announcer, announcerKill } from '../src/game/sound-packs/announcer.ts';
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

function recordingKit(gain = 0.9) {
  const calls: string[] = [];
  const kit = {
    ctx: { currentTime: 0 },
    master: { gain: { value: gain } },
    out: () => ({}),
    tone: () => calls.push('tone'),
    noiseBurst: () => calls.push('noise'),
    release: () => {},
  };
  return { kit: kit as unknown as Parameters<typeof announcerKill>[0], calls };
}

test('the announcer speaks an original line for every streak tier past a single kill, at the settings volume', () => {
  const { kit, calls } = recordingKit(0.45);
  const spoken: [string, number][] = [];
  const kill = announcerKill(kit, (text, volume) => spoken.push([text, volume]));
  kill(1, 'kill');
  assert.equal(spoken.length, 0, 'a single kill gets only the stinger');
  assert.ok(calls.length > 0);
  for (const sound of ['double', 'triple', 'multi', 'rampage', 'unstoppable', 'godlike'] as const) kill(2, sound);
  assert.deepEqual(spoken.map(([text]) => text), ['Dobradinha!', 'Trinca na forja!', 'Fornalha acesa!', 'Martelada geral!', 'Ninguém segura!', 'Deus da forja!']);
  assert.ok(spoken.every(([, volume]) => Math.abs(volume - 0.5) < 1e-9), 'voice volume follows the master volume');
  assert.ok(Object.values(ANNOUNCER_LINES).every((line) => line === null || line.length <= 24));
});

test('the announcer changes only kill sounds, so shots and flags sound the same as the classic pack', () => {
  const { kit } = recordingKit();
  assert.deepEqual(Object.keys(announcer.create(kit)), ['kill']);
  assert.ok(findSoundPack('announcer'));
});

test('without speech synthesis the announcer stays silent instead of failing', () => {
  const { kit, calls } = recordingKit();
  assert.doesNotThrow(() => announcer.create(kit).kill?.(5, 'rampage'));
  assert.ok(calls.length > 0, 'the stinger still plays');
});
