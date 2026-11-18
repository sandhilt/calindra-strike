import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RADIO_VOICE, createSpeaker, type SpeechEngine } from '../src/game/speech.ts';

class FakeUtterance {
  text: string;
  lang = '';
  pitch = 0;
  rate = 0;
  volume = 0;
  voice: unknown = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

/** Plays queued utterances one at a time like a real synthesizer; `finish()` ends the current one. */
function fakeEngine() {
  const queue: FakeUtterance[] = [];
  let cancels = 0;
  const synth = {
    get speaking() {
      return queue.length > 0;
    },
    getVoices: () => [{ lang: 'en-US' }, { lang: 'pt-BR' }],
    speak: (u: FakeUtterance) => {
      queue.push(u);
      if (queue.length === 1) u.onstart?.();
    },
    cancel: () => {
      cancels++;
      queue.length = 0;
    },
  };
  const finish = () => {
    const done = queue.shift();
    done?.onend?.();
    queue[0]?.onstart?.();
  };
  const engine = { synth, Utterance: FakeUtterance } as unknown as SpeechEngine;
  return { engine, queue, finish, cancels: () => cancels };
}

const ANNOUNCER = { lang: 'pt-BR', pitch: 0.5, rate: 0.95 } as const;

test('a speaker uses its voice profile, the pt voice and the given volume', () => {
  const { engine, queue } = fakeEngine();
  createSpeaker(RADIO_VOICE, 'radio', engine)('Me cobre!', 0.4);
  const u = queue[0];
  assert.deepEqual([u.text, u.lang, u.pitch, u.rate, u.volume], ['Me cobre!', 'pt-BR', RADIO_VOICE.pitch, RADIO_VOICE.rate, 0.4]);
  assert.deepEqual(u.voice, { lang: 'pt-BR' });
});

test('without an engine a speaker is silent instead of failing', () => {
  assert.doesNotThrow(() => createSpeaker(RADIO_VOICE, 'radio', null)('oi', 1));
});

test('a new radio line replaces the radio line being read', () => {
  const { engine, queue } = fakeEngine();
  const radio = createSpeaker(RADIO_VOICE, 'radio', engine);
  radio('um', 1);
  radio('dois', 1);
  assert.deepEqual(queue.map((u) => u.text), ['dois']);
});

test('a kill announcement replaces whatever is being read, as before', () => {
  const { engine, queue } = fakeEngine();
  const radio = createSpeaker(RADIO_VOICE, 'radio', engine);
  const announcer = createSpeaker(ANNOUNCER, 'announcer', engine);
  radio('me cobre', 1);
  announcer('Dobradinha!', 1);
  assert.deepEqual(queue.map((u) => u.text), ['Dobradinha!']);
  announcer('Trinca na forja!', 1);
  assert.deepEqual(queue.map((u) => u.text), ['Trinca na forja!']);
});

test('a radio line never cuts an announcement mid-word and plays right after it', () => {
  const { engine, queue, finish, cancels } = fakeEngine();
  const radio = createSpeaker(RADIO_VOICE, 'radio', engine);
  const announcer = createSpeaker(ANNOUNCER, 'announcer', engine);
  announcer('Fornalha acesa!', 1);
  const cancelsBefore = cancels();
  radio('vai, vai, vai', 1);
  assert.equal(cancels(), cancelsBefore, 'the radio did not cancel');
  assert.deepEqual(queue.map((u) => u.text), ['Fornalha acesa!', 'vai, vai, vai']);
  finish();
  assert.deepEqual(queue.map((u) => u.text), ['vai, vai, vai']);
});

test('only one radio line waits behind an announcement, so lines do not pile up', () => {
  const { engine, queue } = fakeEngine();
  const radio = createSpeaker(RADIO_VOICE, 'radio', engine);
  const announcer = createSpeaker(ANNOUNCER, 'announcer', engine);
  announcer('Ninguém segura!', 1);
  radio('um', 1);
  radio('dois', 1);
  assert.deepEqual(queue.map((u) => u.text), ['Ninguém segura!', 'um']);
});

test('after the announcement ends, radio lines replace each other again', () => {
  const { engine, queue, finish } = fakeEngine();
  const radio = createSpeaker(RADIO_VOICE, 'radio', engine);
  const announcer = createSpeaker(ANNOUNCER, 'announcer', engine);
  announcer('Deus da forja!', 1);
  finish();
  radio('um', 1);
  radio('dois', 1);
  assert.deepEqual(queue.map((u) => u.text), ['dois']);
});
