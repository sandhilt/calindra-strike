import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { leavesOcclusion } from '../src/game/render/occlusion-filter.ts';

const mesh = (material: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);

test('solid opaque meshes stay in the occlusion pass', () => {
  assert.equal(leavesOcclusion(mesh(new THREE.MeshStandardMaterial())), false);
  assert.equal(leavesOcclusion(new THREE.Group()), false);
});

test('glow sprites, glass, decals and the sky dome leave it', () => {
  assert.equal(leavesOcclusion(new THREE.Sprite(new THREE.SpriteMaterial())), true);
  assert.equal(leavesOcclusion(mesh(new THREE.MeshStandardMaterial({ transparent: true }))), true);
  assert.equal(leavesOcclusion(mesh(new THREE.ShaderMaterial({ depthWrite: false, side: THREE.BackSide }))), true);
});

test('a mesh with several materials leaves when any of them is see-through', () => {
  const both = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial({ transparent: true })]);
  assert.equal(leavesOcclusion(both), true);
});
