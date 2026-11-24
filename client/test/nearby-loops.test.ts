import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMap } from '@calindra-strike/shared';
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

test('Shopping emits air, fountain water, and each authored cooking voice at its prop', () => {
  const { props } = getMap(2);
  const vents = props.filter((prop) => prop.kind === 'vent');
  const fountains = props.filter((prop) => prop.kind === 'fountain');
  const cooks = props.filter((prop) => prop.kind === 'cook');
  const emitters = ambientEmitters(props);
  assert.ok(vents.length > 0);
  assert.equal(fountains.length, 1);
  assert.deepEqual(new Set(cooks.map(({ voice }) => voice)), new Set(['fryer', 'griddle', 'charcoal', 'wood']));
  assert.equal(emitters.length, vents.length + fountains.length + cooks.length);
  assert.deepEqual(emitters.filter(({ voice }) => voice === 'air'),
    vents.map(({ x, y, z }) => ({ x, y, z, voice: 'air', within: 420 })));
  assert.deepEqual(emitters.filter(({ voice }) => voice === 'water'),
    fountains.map(({ x, y, z }) => ({ x, y, z, voice: 'water', within: 640 })));
  assert.deepEqual(emitters.filter(({ voice }) => voice !== 'air' && voice !== 'water'),
    cooks.map(({ x, y, z, voice }) => ({ x, y, z, voice, within: 380 })));
});

test('a map without ambient props has no emitters', () => {
  assert.deepEqual(ambientEmitters(getMap(0).props), []);
});
