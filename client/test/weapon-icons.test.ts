import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS } from '@calindra-strike/shared';
import * as THREE from 'three';
import { ICON_HEIGHT_PX, ICON_MAX_WIDTH_PX, cropBounds, iconDisplaySize } from '../src/game/render/weapon-icons.ts';
import { buildWeapon } from '../src/game/render/weapons3d.ts';

const rgba = (width: number, height: number, filled: readonly [number, number][]): Uint8ClampedArray => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (const [x, y] of filled) data[(y * width + x) * 4 + 3] = 255;
  return data;
};

test('cropBounds is the tight box of the opaque pixels', () => {
  const data = rgba(8, 6, [[2, 1], [5, 3], [3, 4]]);
  assert.deepEqual(cropBounds(data, 8, 6), { x: 2, y: 1, width: 4, height: 4 });
});

test('cropBounds ignores faint antialiasing and reports an empty image as null', () => {
  const data = rgba(4, 4, []);
  data[3] = 3;
  assert.equal(cropBounds(data, 4, 4), null);
});

test('icons share one height, and a very long gun is narrowed to the width cap', () => {
  assert.deepEqual(iconDisplaySize(1), { width: ICON_HEIGHT_PX, height: ICON_HEIGHT_PX });
  assert.equal(iconDisplaySize(3).height, ICON_HEIGHT_PX);
  const long = iconDisplaySize(10);
  assert.equal(long.width, ICON_MAX_WIDTH_PX);
  assert.ok(long.height < ICON_HEIGHT_PX);
});

test('every weapon has a model with something to draw, so every weapon gets an icon', () => {
  for (const def of WEAPONS) {
    const group = buildWeapon(def.id).group;
    group.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
    assert.ok(size.y > 0 && size.z > 0, `${def.tag} has no model to bake an icon from`);
  }
});
