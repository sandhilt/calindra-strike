import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { getMaps, type MapProp } from '@calindra-strike/shared';
import { QUALITY } from '../src/game/render/quality.ts';
import { buildProps } from '../src/game/render/props.ts';

const snowman: MapProp = { kind: 'snowman', x: 100, y: 384, z: -1400, yaw: 0.5, scale: 1 };
const lift = getMaps().find((m) => m.id === 'shopping')?.props.find((p) => p.kind === 'lift');

function meshes(props: readonly MapProp[], tick = 0): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const view = buildProps(props, () => undefined, QUALITY.performance);
  view.update(0, tick);
  view.group.traverse((o) => {
    if (o instanceof THREE.Mesh) out.push(o);
  });
  return out;
}

test('snowmen join the static props mesh, with nothing instanced or moving', () => {
  const drawn = meshes([snowman, { ...snowman, x: -100, scale: 0.6 }]);
  assert.equal(drawn.length, 1);
  assert.ok(!(drawn[0] instanceof THREE.InstancedMesh));
  const box = new THREE.Box3().setFromBufferAttribute(drawn[0].geometry.getAttribute('position') as THREE.BufferAttribute);
  assert.ok(box.min.y >= 384 - 0.01 && box.max.y > 384 + 70 && box.max.y < 384 + 90);
});

test('a festive lift cab carries one merged decoration mesh inside its footprint', () => {
  assert.ok(lift && lift.kind === 'lift');
  const plain = meshes([lift]);
  const festive = meshes([{ ...lift, festive: true }]);
  assert.equal(festive.length, plain.length + 1);
  // The cab's own parts are plain boxes; the decoration is the one vertex-coloured mesh that rides in a cab.
  const decor = festive.find((m) => m.geometry.getAttribute('color') && m.parent?.parent?.parent);
  assert.ok(decor);
  const box = new THREE.Box3().setFromBufferAttribute(decor.geometry.getAttribute('position') as THREE.BufferAttribute);
  assert.ok(box.min.x > -lift.width / 2 && box.max.x < lift.width / 2);
  assert.ok(box.min.z > -lift.depth / 2 && box.max.z < lift.depth / 2);
  assert.ok(box.min.y >= -0.01);
  // Doorways at the front and back stay clear: the decoration sits along the side walls only.
  assert.ok(box.min.x < -lift.width / 2 + 20 && box.max.x > lift.width / 2 - 20);
  // Every piece hugs a side wall, so none stands in a doorway's middle.
  const pos = decor.geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) assert.ok(Math.abs(pos.getX(i)) > lift.width / 2 - 20, 'piece off the side walls');
});

test('the cab decoration rides with the cab', () => {
  assert.ok(lift && lift.kind === 'lift');
  const heights = [0, 600, 1200, 1800].map((tick) => {
    const decor = meshes([{ ...lift, festive: true }], tick).find((m) => m.geometry.getAttribute('color') && m.parent?.parent?.parent);
    assert.ok(decor);
    decor.updateWorldMatrix(true, false);
    return new THREE.Vector3().setFromMatrixPosition(decor.matrixWorld).y;
  });
  assert.ok(new Set(heights).size > 1, `decoration height ${heights}`);
});
