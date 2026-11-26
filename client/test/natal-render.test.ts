import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { getMaps, type MapProp } from '@calindra-strike/shared';
import { buildProps } from '../src/game/render/props.ts';
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
