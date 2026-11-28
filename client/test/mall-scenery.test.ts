import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { BLACK_FRIDAY_DISCOUNT_PERCENT, getMaps, SALE_SLOT_MS, saleOn, TICK_MS, type MapProp } from '@calindra-strike/shared';
import * as THREE from 'three';
import { buildProps } from '../src/game/render/props.ts';
import { QUALITY } from '../src/game/render/quality.ts';

function captureCanvas(t: TestContext) {
  const labels: string[] = [];
  let canvases = 0;
  const noop = () => {};
  const ctx = {
    save: noop, restore: noop, scale: noop, translate: noop,
    fillRect: noop, beginPath: noop, roundRect: noop, fill: noop,
    fillText: (label: string) => labels.push(label),
  };
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => {
      canvases++;
      return { getContext: () => ctx };
    } },
  });
  t.after(() => Reflect.deleteProperty(globalThis, 'document'));
  return { labels, canvasCount: () => canvases };
}

const map = getMaps().find(({ id }) => id === 'shopping');
assert.ok(map);

test('easels and bins share the scenery mesh and use one printed atlas per kind', (t) => {
  const art = captureCanvas(t);
  const props = map.props.filter(({ kind }) => kind === 'saleEasel' || kind === 'recycleBin');
  const { group } = buildProps(props, () => undefined, QUALITY.performance);
  const meshes = group.children.filter((child) => child instanceof THREE.Mesh);
  assert.equal(meshes.length, 3);
  const [solid, easels, bins] = meshes;
  assert.ok(solid.geometry.getAttribute('color'));
  assert.equal(easels.geometry.getAttribute('position').count, props.filter(({ kind }) => kind === 'saleEasel').length * 8);
  assert.equal(bins.geometry.getAttribute('position').count, props.filter(({ kind }) => kind === 'recycleBin').length * 8);
  assert.equal(art.canvasCount(), 2);
  for (const label of ['PROMOÇÃO', '-30%', 'ORGÂNICO', 'SOBRA DE ALIMENTOS', 'RECICLÁVEL', '♻', 'PAPEL', 'PLÁSTICO', 'METAL', 'VIDRO']) {
    assert.ok(art.labels.includes(label), label);
  }
});

test('one ribbon mesh draws exactly the eligible storefronts for each server slot on every tier', (t) => {
  const art = captureCanvas(t);
  const props = map.props.filter((p): p is Extract<MapProp, { kind: 'saleRibbon' }> => p.kind === 'saleRibbon');
  const empty = buildProps([], () => undefined, QUALITY.performance);
  assert.ok(!empty.group.getObjectByName('sale-ribbons'));
  assert.equal(art.canvasCount(), 0);

  const view = buildProps(props, () => undefined, QUALITY.performance);
  const meshes = view.group.children.filter((child) => child instanceof THREE.InstancedMesh);
  assert.equal(meshes.length, 1);
  const [mesh] = meshes;
  assert.equal(art.canvasCount(), 1);
  assert.deepEqual(art.labels, ['BLACK FRIDAY', `${BLACK_FRIDAY_DISCOUNT_PERCENT}% OFF`]);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  for (const slot of [0, 1, 2, 0]) {
    const ms = slot * SALE_SLOT_MS;
    view.update(0, ms / TICK_MS);
    const expected = props.filter(({ brand }) => saleOn(brand, ms)).map(({ x, y, z }) => [x, y, z]);
    const drawn = Array.from({ length: mesh.count }, (_, i) => {
      mesh.getMatrixAt(i, matrix);
      return position.setFromMatrixPosition(matrix).toArray();
    });
    assert.deepEqual(drawn, expected);
    const version = mesh.instanceMatrix.version;
    view.update(0, ms / TICK_MS + 1);
    assert.equal(mesh.instanceMatrix.version, version);
    for (const quality of Object.values(QUALITY)) view.setQuality(quality);
    assert.equal(mesh.count, expected.length);
  }
});
