import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPON } from '@calindra-strike/shared';
import * as THREE from 'three';
import { buildWeapon } from '../src/game/render/weapons3d.ts';

test('both lenses of the AWP scope are the dark blue-green coated glass', () => {
  const glass: string[] = [];
  buildWeapon(WEAPON.SNIPER).group.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshPhysicalMaterial) glass.push(o.material.color.getHexString());
  });
  assert.deepEqual(glass, ['1d3a46', '1d3a46']);
});
