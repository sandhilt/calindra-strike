import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { CTF_RETURN_TICKS, TEAMS, TICK_MS } from '@calindra-strike/shared';
import { FlagsView } from '../src/game/render/flags.ts';

test('the CTF backpack rests on the floor, follows the torso, and returns to the drop point', () => {
  const base = { x: 10, y: 20, z: 30, team: 0 };
  const view = new FlagsView([base]);
  const [backpack, marker, countdown] = view.group.children;
  assert.ok(backpack instanceof THREE.Group);
  assert.ok(countdown instanceof THREE.Mesh);
  assert.equal(backpack.children.length, 3);
  const [shell] = backpack.children;
  assert.ok(shell instanceof THREE.Mesh && shell.material instanceof THREE.MeshStandardMaterial);
  assert.equal(shell.material.color.getHexString(), new THREE.Color(TEAMS[0].color).getHexString());

  const back = new THREE.Group();
  back.position.set(100, 30, -50);
  back.rotation.set(-0.4, Math.PI / 2, 0);
  const carrierBack = (id: number) => id === 7 ? back : undefined;
  view.update([{ ...base, state: 'home' }], 0, carrierBack);
  assert.equal(new THREE.Box3().setFromObject(backpack).min.y, base.y);
  assert.equal(countdown.visible, false);

  const carried = { ...base, state: 'carried', carrier: 7 } as const;
  view.update([carried], 0, carrierBack);
  assert.equal(backpack.parent, back);
  assert.ok(backpack.position.z > 0);
  assert.deepEqual(view.position(0)?.toArray(), back.localToWorld(backpack.position.clone()).toArray());
  assert.equal(marker.visible, true);

  view.update([carried], 0, () => undefined);
  assert.equal(backpack.visible, false);

  const drop = { ...base, x: 70, y: 40, z: 90, state: 'dropped', returnAt: CTF_RETURN_TICKS * TICK_MS } as const;
  view.update([drop], drop.returnAt / 2, carrierBack);
  assert.equal(backpack.parent, view.group);
  assert.equal(backpack.visible, true);
  assert.deepEqual(view.position(0)?.toArray(), [70, 40, 90]);
  assert.equal(countdown.visible, true);
  assert.equal(countdown.scale.x, 0.5);

  view.update([carried], 0, carrierBack);
  let disposed = false;
  shell.geometry.addEventListener('dispose', () => { disposed = true; });
  view.dispose();
  assert.equal(back.children.length, 0);
  assert.equal(disposed, true);
});
