import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import * as THREE from 'three';
import { QUALITY } from '../src/game/render/quality.ts';
import { buildProps } from '../src/game/render/props.ts';
import { staffOutfit, type MapProp } from '@calindra-strike/shared';

type Staff = Extract<MapProp, { kind: 'staff' }>;

const cook: Staff = { kind: 'staff', x: 40, y: 28, z: -20, yaw: Math.PI, role: 'cook', uniform: 'kfg' };
const cashier: Staff = { kind: 'staff', x: -60, y: 0, z: 18, yaw: Math.PI, role: 'cashier', uniform: 'pandorga' };

function asMannequin(s: Staff): MapProp {
  return { kind: 'mannequin', x: s.x, y: s.y, z: s.z, yaw: s.yaw, outfit: staffOutfit(s.uniform, s.role) };
}

/** Every drawn triangle corner as a rounded "x,y,z|r,g,b" key, with instanced parts placed by their instance matrices. */
function corners(group: THREE.Object3D): string[] {
  const out: string[] = [];
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  const m = new THREE.Matrix4();
  const key = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const position = object.geometry.getAttribute('position');
    const color = object.geometry.getAttribute('color');
    const instances = object instanceof THREE.InstancedMesh ? object.count : 1;
    for (let k = 0; k < instances; k++) {
      if (object instanceof THREE.InstancedMesh) object.getMatrixAt(k, m);
      else m.identity();
      const tint = new THREE.Color(1, 1, 1);
      if (object instanceof THREE.InstancedMesh && object.instanceColor) object.getColorAt(k, tint);
      for (let i = 0; i < position.count; i++) {
        v.fromBufferAttribute(position, i).applyMatrix4(m);
        c.fromBufferAttribute(color, i).multiply(tint);
        out.push(`${key(v.x)},${key(v.y)},${key(v.z)}|${key(c.r)},${key(c.g)},${key(c.b)}`);
      }
    }
  });
  return out.toSorted();
}

function instanced(group: THREE.Object3D): THREE.InstancedMesh[] {
  const out: THREE.InstancedMesh[] = [];
  group.traverse((o) => {
    if (o instanceof THREE.InstancedMesh) out.push(o);
  });
  return out;
}

function matrices(group: THREE.Object3D): number[] {
  return instanced(group).flatMap((mesh) => Array.from(mesh.instanceMatrix.array));
}

test('a staff member at rest is drawn exactly as the store mannequin in its uniform', () => {
  const staff = buildProps([cook, cashier], () => undefined, QUALITY.performance);
  const mannequins = buildProps([asMannequin(cook), asMannequin(cashier)], () => undefined, QUALITY.performance);
  assert.deepEqual(corners(staff.group), corners(mannequins.group));
});

test('staff arms are two instanced meshes, one sleeve and one forearm per arm, whatever the number of staff', () => {
  const view = buildProps([cook, cashier], () => undefined, QUALITY.high);
  assert.deepEqual(instanced(view.group).map((mesh) => mesh.count), [4, 4]);
});

test('store mannequins add no instanced or moving parts', () => {
  const view = buildProps([asMannequin(cook)], () => undefined, QUALITY.high);
  assert.equal(instanced(view.group).length, 0);
});

test('staff work on high and low, and hold the rest pose on performance', () => {
  for (const tier of ['high', 'low', 'performance'] as const) {
    const view = buildProps([cook, cashier], () => undefined, QUALITY[tier]);
    const rest = matrices(view.group);
    view.update(0.4, 0);
    assert.equal(matrices(view.group).join() !== rest.join(), tier !== 'performance', tier);
  }
});

test('switching to performance mid-match puts the arms back at rest', () => {
  const view = buildProps([cook], () => undefined, QUALITY.high);
  const rest = matrices(view.group);
  view.update(0.4, 0);
  view.setQuality(QUALITY.performance);
  assert.deepEqual(matrices(view.group), rest);
});

/**
 * The store mannequin as d0e329b drew it, before its arms were split off to move: sha256 of its sorted vertex
 * positions (rounded to 0.01) and its bounds, for a kfg cook at (40, 28, -20) turned 2.5 rad. Captured from that
 * commit's `addMannequin`, so a change to the shared arm model that moves the rest pose fails here.
 */
const BEFORE_ARMS_MOVED = {
  sha256: '028f9250d000cc9d7cf7e44eda7de5e854ca560b3dd798d5a7f005ca7db50abe',
  vertices: 768,
  min: [22.11, 28, -35.7],
  max: [57.89, 104.5, -4.3],
};

function positionDigest(group: THREE.Object3D): { sha256: string; vertices: number; min: number[]; max: number[] } {
  const keys = corners(group).map((k) => k.split('|')[0]);
  const box = new THREE.Box3();
  for (const k of keys) box.expandByPoint(new THREE.Vector3(...k.split(',').map(Number)));
  const round = (v: THREE.Vector3) => v.toArray().map((n) => Math.round(n * 100) / 100);
  return { sha256: createHash('sha256').update(keys.join('\n')).digest('hex'), vertices: keys.length, min: round(box.min), max: round(box.max) };
}

test('the store mannequin and a staff member at rest keep the geometry they had before the arms could move', () => {
  const turned: Staff = { ...cook, yaw: 2.5 };
  for (const tier of ['high', 'performance'] as const) {
    assert.deepEqual(positionDigest(buildProps([asMannequin(turned)], () => undefined, QUALITY[tier]).group), BEFORE_ARMS_MOVED, `mannequin ${tier}`);
  }
  assert.deepEqual(positionDigest(buildProps([turned], () => undefined, QUALITY.performance).group), BEFORE_ARMS_MOVED, 'staff');
});
