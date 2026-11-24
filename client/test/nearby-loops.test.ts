import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMap } from '@calindra-strike/shared';
import { AMBIENT_VOICES } from '../src/game/audio.ts';
import { MAX_AMBIENT_LOOPS, NearbyLoops, ambientEmitters, nearestEmitters, type Emitter } from '../src/game/nearby-loops.ts';

function airEmitters(xs: number[]): Emitter[] {
  return xs.map((x) => ({ x, y: 0, z: 0, voice: 'air', within: 420 }));
}

test('only nearby emitters are selected, in distance order', () => {
  const emitters = airEmitters([0, 100, 200, 300, 900]);
  assert.deepEqual(nearestEmitters(emitters, { x: 90, y: 0, z: 0 }), [1, 0, 2, 3]);
  assert.deepEqual(nearestEmitters(emitters, { x: 5000, y: 0, z: 0 }), []);
});

test('the five nearest audible emitters qualify by their individual radii', () => {
  const emitters: Emitter[] = [
    { x: 20, y: 0, z: 0, voice: 'wood', within: 19 },
    { x: 640, y: 0, z: 0, voice: 'water', within: 640 },
    ...airEmitters([410, 300, 200, 100]),
    { x: 650, y: 0, z: 0, voice: 'water', within: 640 },
  ];
  const origin = { x: 0, y: 0, z: 0 };
  assert.deepEqual(nearestEmitters(emitters, origin), [5, 4, 3, 2, 1]);
  assert.deepEqual(nearestEmitters([...emitters, ...airEmitters([400])], origin), [5, 4, 3, 7, 2]);
});

test('a kitchen is heard on its own floor only, the fountain across floors', () => {
  const kitchen: Emitter = { x: 0, y: 248, z: 0, voice: 'fryer', within: 380, sameFloor: true };
  const fountain: Emitter = { x: 0, y: 108, z: 0, voice: 'water', within: 640 };
  assert.deepEqual(nearestEmitters([kitchen], { x: 100, y: 248, z: 0 }), [0], 'on the deck');
  assert.deepEqual(nearestEmitters([kitchen], { x: 100, y: 56, z: 0 }), [], 'in the shop below');
  assert.deepEqual(nearestEmitters([kitchen], { x: 100, y: 440, z: 0 }), [], 'on the Mirante above');
  assert.deepEqual(nearestEmitters([fountain], { x: 100, y: 440, z: 0 }), [0], 'the fountain carries up the open atrium');
});

test('loops start nearby, refresh on schedule, and stop on dispose', () => {
  const emitters = airEmitters([0, 100, 200, 300, 350, 400, 1000]);
  const live = new Set<number>();
  const loops = new NearbyLoops(emitters, (at) => {
    live.add(at.x);
    return { stop: () => live.delete(at.x) };
  });
  loops.update(1, { x: 0, y: 0, z: 0 });
  assert.deepEqual([...live], [0, 100, 200, 300, 350]);
  assert.equal(live.size, MAX_AMBIENT_LOOPS);
  loops.update(0.125, { x: 1000, y: 0, z: 0 });
  assert.deepEqual([...live], [0, 100, 200, 300, 350]);
  loops.update(0.125, { x: 1000, y: 0, z: 0 });
  assert.deepEqual([...live], [1000]);
  loops.dispose();
  assert.equal(live.size, 0);
});

test('Shopping emits air, fountain water, fan hum and each cooking voice at its prop', () => {
  const { props } = getMap(2);
  const vents = props.filter((prop) => prop.kind === 'vent');
  const fountains = props.filter((prop) => prop.kind === 'fountain');
  const cooks = props.filter((prop) => prop.kind === 'cook');
  const fans = props.filter((prop) => prop.kind === 'ceilingFan');
  const emitters = ambientEmitters(props);
  assert.ok(fans.length > 0);
  assert.deepEqual(emitters.filter(({ voice }) => voice === 'fan'),
    fans.map(({ x, y, z }) => ({ x, y, z, voice: 'fan', within: 210, sameFloor: true })));
  assert.ok(vents.length > 0);
  assert.equal(fountains.length, 1);
  assert.deepEqual(new Set(cooks.map(({ voice }) => voice)), new Set(['boil', 'fryer', 'griddle', 'charcoal', 'wood']));
  assert.equal(emitters.length, vents.length + fountains.length + cooks.length + fans.length);
  assert.deepEqual(emitters.filter(({ voice }) => voice === 'air'),
    vents.map(({ x, y, z }) => ({ x, y, z, voice: 'air', within: 420 })));
  assert.deepEqual(emitters.filter(({ voice }) => voice === 'water'),
    fountains.map(({ x, y, z }) => ({ x, y, z, voice: 'water', within: 640 })));
  assert.deepEqual(emitters.filter(({ voice }) => voice !== 'air' && voice !== 'water' && voice !== 'fan'),
    cooks.map(({ x, y, z, voice }) => ({ x, y, z, voice, within: 380, sameFloor: true })));
});

test('a map without ambient props has no emitters', () => {
  assert.deepEqual(ambientEmitters(getMap(0).props), []);
});

test('fan hum shares the loop budget and stays on the floor under the blades', () => {
  const fans = ambientEmitters(Array.from({ length: 8 }, (_, x) => ({
    kind: 'ceilingFan', x, y: 340, z: 0, radius: 44,
  })));
  const active = new Set<Emitter>();
  const loops = new NearbyLoops(fans, (emitter) => {
    active.add(emitter);
    return { stop: () => active.delete(emitter) };
  });
  loops.update(1, { x: 0, y: 224, z: 0 });
  assert.deepEqual([...active], fans.slice(0, MAX_AMBIENT_LOOPS));
  loops.update(1, { x: 0, y: 416, z: 0 });
  assert.equal(active.size, 0);
  loops.update(1, { x: 0, y: 32, z: 0 });
  assert.equal(active.size, 0);
});

test('ambient beds are about 25–33% softer and fan hum has the lowest gain', () => {
  const previous = { air: 0.07, water: 0.10, fryer: 0.11, griddle: 0.10, charcoal: 0.10, wood: 0.09 };
  for (const [voice, gain] of Object.entries(previous)) {
    assert.ok(voice in AMBIENT_VOICES);
    const current = AMBIENT_VOICES[voice as keyof typeof previous].gain;
    assert.ok(current / gain >= 0.67 && current / gain <= 0.75, voice);
  }
  const { fan, boil, ...otherVoices } = AMBIENT_VOICES;
  assert.ok(boil.gain > fan.gain);
  assert.ok(Object.values(otherVoices).every(({ gain }) => gain > fan.gain));
});
