import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { getMaps, type MapProp } from '@calindra-strike/shared';
import { buildProps } from '../src/game/render/props.ts';
import { twinkleLevel } from '../src/game/render/prop-motion.ts';
import { QUALITY } from '../src/game/render/quality.ts';
import { signMaterial } from '../src/game/render/store-signs.ts';

test('both Santa poses share the existing static scenery mesh on performance', () => {
  const natal = getMaps().find((map) => map.id === 'shopping-natal');
  assert.ok(natal);
  const models = natal.props.filter((prop) => prop.kind === 'santa');
  assert.ok(models.some((prop) => prop.pose === 'seated'));
  assert.ok(models.some((prop) => prop.pose === 'standing'));
  const rack: MapProp = { kind: 'clothesRack', x: 0, y: 0, z: 0, yaw: 0, length: 64, palette: [0xcc4422] };
  const meshOf = (props: readonly MapProp[]) => {
    const view = buildProps(props, () => undefined, QUALITY.performance);
    const meshes: THREE.Mesh[] = [];
    view.group.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object);
    });
    assert.equal(meshes.length, 1);
    return meshes[0];
  };
  const rackMesh = meshOf([rack]);
  const combined = meshOf([rack, ...models]);
  assert.ok(combined.geometry.getAttribute('position').count > rackMesh.geometry.getAttribute('position').count);
  assert.equal(combined.geometry.getAttribute('position').count, combined.geometry.getAttribute('color').count);
});

test('the Christmas KFG sign adds a hat while the ordinary KFG sign keeps its drawing', (t) => {
  const noop = () => {};
  const hats: number[][] = [];
  const context = {
    fillRect: noop, beginPath: noop, arc: noop, fill: noop, stroke: noop, moveTo: noop, lineTo: noop,
    quadraticCurveTo: noop, closePath: noop, measureText: () => ({ width: 100 }), fillText: noop, strokeText: noop,
    roundRect: (...args: number[]) => hats.push(args),
  };
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => ({ getContext: () => context }) },
  });
  t.after(() => Reflect.deleteProperty(globalThis, 'document'));

  signMaterial('kfg');
  assert.deepEqual(hats, []);
  signMaterial('kfg', true);
  assert.deepEqual(hats, [[49, 59, 110, 16, 8]]);
});

test('the four twinkle patterns vary over time and repeat for the same bulb and clock', () => {
  const history = (index: number) => Array.from({ length: 120 }, (_, frame) => twinkleLevel(index, frame / 60));
  const patterns = [0, 1, 2, 3].map(history);
  for (const pattern of patterns) {
    assert.ok(pattern.every((level) => level >= 0 && level <= 1));
    assert.ok(new Set(pattern).size > 1);
  }
  assert.equal(new Set(patterns.map((pattern) => pattern.join(','))).size, 4);
  assert.deepEqual([0, 1, 2, 3].map(history), patterns);
  assert.notDeepEqual(history(0), history(4));
  assert.notDeepEqual(history(1), history(5));
});

test('the Natal bulbs, glow and wire are built and disposed with high graphics', () => {
  const natal = getMaps().find(({ id }) => id === 'shopping-natal');
  assert.ok(natal);
  const strands = natal.props.filter((prop) => prop.kind === 'twinkleLights');
  const view = buildProps(strands, () => undefined, QUALITY.low);
  const draws = () => view.group.getObjectsByProperty('isMesh', true)
    .concat(view.group.getObjectsByProperty('isPoints', true));
  assert.equal(draws().length, 0);
  view.setQuality(QUALITY.performance);
  assert.equal(draws().length, 0);
  view.setQuality(QUALITY.high);
  const [wire, bulbs, glow] = draws();
  assert.equal(draws().length, 3);
  assert.ok(bulbs instanceof THREE.InstancedMesh);
  assert.ok(glow instanceof THREE.Points && glow.material instanceof THREE.PointsMaterial && glow.material.map);
  assert.ok(wire instanceof THREE.Mesh);
  assert.equal(bulbs.count, strands.reduce((sum, strand) => sum + strand.bulbs, 0));
  assert.equal(glow.geometry.getAttribute('position').count, bulbs.count);
  const levels = bulbs.geometry.getAttribute('twinkle');
  view.update(0, 60);
  assert.ok(Math.abs(levels.getX(2) - twinkleLevel(2, 1)) < 1e-6);
  assert.equal(glow.geometry.getAttribute('twinkle').array, levels.array);
  let disposed = 0;
  glow.material.map.addEventListener('dispose', () => { disposed++; });
  view.setQuality(QUALITY.low);
  assert.equal(draws().length, 0);
  assert.equal(disposed, 1);
  view.setQuality(QUALITY.high);
  assert.equal(draws().length, 3);
  assert.equal(buildProps([], () => undefined, QUALITY.high).group.getObjectsByProperty('isPoints', true).length, 0);
});
