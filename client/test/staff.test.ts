import assert from 'node:assert/strict';
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

/** Positions and colours of everything the props draw, with a count of instanced meshes. */
function drawn(props: readonly MapProp[]): { positions: number[]; colors: number[]; instanced: number } {
  const view = buildProps(props, () => undefined, QUALITY.high);
  const out = { positions: [] as number[], colors: [] as number[], instanced: 0 };
  view.group.traverse((object) => {
    if (object instanceof THREE.InstancedMesh) out.instanced++;
    else if (object instanceof THREE.Mesh) {
      out.positions.push(...Array.from(object.geometry.getAttribute('position').array as ArrayLike<number>));
      const color = object.geometry.getAttribute('color');
      if (color) out.colors.push(...Array.from(color.array as ArrayLike<number>));
    }
  });
  return out;
}

test('a staff member is drawn exactly as the store mannequin in its uniform', () => {
  assert.deepEqual(drawn([cook, cashier]), drawn([asMannequin(cook), asMannequin(cashier)]));
});

test('staff add no instanced or moving parts', () => {
  assert.equal(drawn([cook, cashier]).instanced, 0);
});
