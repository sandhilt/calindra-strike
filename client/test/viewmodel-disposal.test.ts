import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WEAPON } from '@calindra-strike/shared';
import * as THREE from 'three';
import { ViewModel } from '../src/game/render/viewmodel.ts';
import { buildWeapon } from '../src/game/render/weapons3d.ts';

type Resource = THREE.BufferGeometry | THREE.Material | THREE.Texture;

function resources(root: THREE.Object3D): Set<Resource> {
  const found = new Set<Resource>();
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) found.add(object.geometry);
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Sprite)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      found.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) found.add(value);
      }
    }
  });
  return found;
}

test('viewmodel swaps release owned resources once and preserve shared resources', (t) => {
  const noop = () => {};
  const context = {
    translate: noop, createRadialGradient: () => ({ addColorStop: noop }),
    rotate: noop, beginPath: noop, moveTo: noop, lineTo: noop, fill: noop, arc: noop,
  };
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => ({ getContext: () => context }) },
  });
  t.after(() => Reflect.deleteProperty(globalThis, 'document'));

  const view = new ViewModel('#ffffff', 'high');
  const selections = [
    [WEAPON.RIFLE, 'standard'],
    [WEAPON.HAMMER, 'standard'],
    [WEAPON.RIFLE, 'standard'],
    [WEAPON.MGL, 'standard'],
    [WEAPON.MGL, 'carrapeta'],
    [WEAPON.LMG, 'standard'],
  ] as const;
  const shared = new Set(selections.flatMap(([id, skin]) => {
    const first = resources(buildWeapon(id, 1, skin).group);
    const second = resources(buildWeapon(id, 1, skin).group);
    return [...first].filter((resource) => second.has(resource));
  }));
  const events = new Map<Resource, number>();
  const observe = (resource: Resource) => {
    if (events.has(resource)) return;
    events.set(resource, 0);
    resource.addEventListener('dispose', () => events.set(resource, (events.get(resource) ?? 0) + 1));
  };

  let previous = new Set<Resource>();
  let expectedGeometryEvents = 0;
  for (const [id, skin] of selections) {
    view.setWeapon(id, skin);
    const current = resources(view.scene);
    for (const resource of current) observe(resource);
    for (const resource of previous) {
      if (!shared.has(resource) && !current.has(resource) && resource instanceof THREE.BufferGeometry) {
        expectedGeometryEvents++;
      }
    }
    previous = current;
  }

  const geometryEvents = [...events].filter(([resource]) => resource instanceof THREE.BufferGeometry)
    .reduce((sum, [, count]) => sum + count, 0);
  t.diagnostic(`Swap geometry disposal events: ${geometryEvents}/${expectedGeometryEvents}`);
  assert.equal(geometryEvents, expectedGeometryEvents);
  for (const [resource, count] of events) {
    assert.equal(count, shared.has(resource) || previous.has(resource) ? 0 : 1, `${resource.uuid}`);
  }

  view.setQuality('performance');
  view.setWeapon(WEAPON.LMG);
  const rebuilt = resources(view.scene);
  assert.ok([...previous].some((resource) => !rebuilt.has(resource)));
  for (const resource of rebuilt) observe(resource);
  for (const resource of previous) {
    assert.equal(events.get(resource), shared.has(resource) || rebuilt.has(resource) ? 0 : 1, resource.uuid);
  }

  view.dispose();
  assert.equal(resources(view.scene).size, 0);
  for (const [resource, count] of events) {
    assert.equal(count, shared.has(resource) ? 0 : 1, resource.uuid);
  }
});
