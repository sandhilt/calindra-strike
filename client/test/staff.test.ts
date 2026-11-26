import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { QUALITY, QUALITY_TIERS } from '../src/game/render/quality.ts';
import { staffArmSwing } from '../src/game/render/prop-motion.ts';
import { buildProps } from '../src/game/render/props.ts';
import type { MapProp } from '@calindra-strike/shared';

const cook: MapProp = { kind: 'staff', x: 40, y: 28, z: -20, yaw: Math.PI, role: 'cook', uniform: 'kfg' };
const cashier: MapProp = { kind: 'staff', x: -60, y: 0, z: 18, yaw: Math.PI, role: 'cashier', uniform: 'pandorga' };

function instancedMeshes(group: THREE.Group): THREE.InstancedMesh[] {
  const found: THREE.InstancedMesh[] = [];
  group.traverse((object) => {
    if (object instanceof THREE.InstancedMesh) found.push(object);
  });
  return found;
}

function matrices(mesh: THREE.InstancedMesh): number[] {
  return Array.from(mesh.instanceMatrix.array);
}

test('only high and low move the staff arms, and performance keeps them still', () => {
  assert.deepEqual(QUALITY_TIERS.filter((tier) => QUALITY[tier].staffMotion), ['high', 'low']);
});

test('the swing of a staff member stays within its range and repeats', () => {
  for (const role of ['cook', 'cashier', 'server'] as const) {
    for (const side of ['left', 'right'] as const) {
      for (let t = 0; t < 10; t += 0.37) {
        const angle = staffArmSwing(t, 1.3, role, side);
        assert.ok(angle >= 0 && angle <= 1, `${role} ${side} at ${t}: ${angle}`);
      }
    }
  }
  assert.ok(Math.abs(staffArmSwing(0.5, 0.2, 'cook', 'right') - staffArmSwing(0.5 + 1.6, 0.2, 'cook', 'right')) < 1e-9);
});

test('a cashier keeps the left arm at her side while the right reaches for the till', () => {
  for (let t = 0; t < 6; t += 0.4) assert.equal(staffArmSwing(t, 0.7, 'cashier', 'left'), 0);
  const reach = Math.max(...Array.from({ length: 80 }, (_, i) => staffArmSwing(i * 0.05, 0.7, 'cashier', 'right')));
  assert.ok(reach > 0.3, 'the right arm reaches forward at some point');
});

test('staff bodies merge into one static mesh and their arms are the only instanced parts', () => {
  const view = buildProps([cook, cashier], () => undefined, QUALITY.high);
  const meshes: THREE.Mesh[] = [];
  view.group.traverse((object) => {
    if (object instanceof THREE.Mesh && !(object instanceof THREE.InstancedMesh)) meshes.push(object);
  });
  assert.equal(meshes.length, 1, 'one merged static mesh');
  assert.equal(instancedMeshes(view.group).length, 2, 'the sleeve and forearm meshes');
  for (const mesh of instancedMeshes(view.group)) assert.equal(mesh.count, 4, 'two arms per figure');
});

test('the arms swing on high and stand still on performance', () => {
  for (const [profile, moves] of [[QUALITY.high, true], [QUALITY.performance, false]] as const) {
    const view = buildProps([cook, cashier], () => undefined, profile);
    const [sleeves] = instancedMeshes(view.group);
    const before = matrices(sleeves);
    view.update(0.4, 0);
    const after = matrices(sleeves);
    assert.equal(after.some((value, i) => value !== before[i]), moves);
  }
});

test('switching the tier mid-match stops and restarts the arms', () => {
  const view = buildProps([cook], () => undefined, QUALITY.high);
  const [sleeves] = instancedMeshes(view.group);
  view.setQuality(QUALITY.performance);
  const still = matrices(sleeves);
  view.update(0.4, 0);
  assert.deepEqual(matrices(sleeves), still);
  view.setQuality(QUALITY.high);
  view.update(0.4, 0);
  assert.notDeepEqual(matrices(sleeves), still);
});
