import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { getMaps, type Box, type MapDef, type MapProp } from '@calindra-strike/shared';
import { Parts } from '../src/game/render/prop-parts.ts';
import { addMannequinHand, addMannequinSleeve, armMatrix } from '../src/game/render/prop-models.ts';
import { ARM_REST, type ArmPose, STAFF_CYCLE_SECONDS, staffArmPose } from '../src/game/render/prop-motion.ts';

type Server = Extract<MapProp, { kind: 'staff' }> & { role: 'server' };

/** Clearance an arm keeps from every drawn box, in every pose (units, tuning value). */
const CLEARANCE_UNITS = 3;
/** Poses sampled across one work cycle of the server. */
const SAMPLES = 48;
/** A serving counter is the wide block topped by its cap, a fixed height above the staff's feet. */
const COUNTER_MIN_WIDTH_UNITS = 60;
const COUNTER_TOP_MIN_UNITS = 38;
const COUNTER_TOP_MAX_UNITS = 60;

function servers(map: MapDef): Server[] {
  return map.props.filter((p): p is Server => p.kind === 'staff' && p.role === 'server');
}

/** The counter and its cap, which the arms reach over. */
function isCounter(box: Box, p: Server): boolean {
  const top = box.max.y - p.y;
  return top >= COUNTER_TOP_MIN_UNITS && top <= COUNTER_TOP_MAX_UNITS && box.max.x - box.min.x >= COUNTER_MIN_WIDTH_UNITS;
}

/** Each arm part's world box, built from the same geometry the store mannequin draws. */
function armParts(p: Server, side: 1 | -1, pose: ArmPose): { name: string; box: THREE.Box3 }[] {
  const matrix = armMatrix(new THREE.Matrix4(), { x: p.x, y: p.y, z: p.z, yaw: p.yaw }, side, pose);
  const part = (build: (parts: Parts) => void): THREE.Box3 => {
    const parts = new Parts();
    parts.atMatrix(matrix);
    build(parts);
    const geometry = parts.merge();
    assert.ok(geometry, 'arm part has geometry');
    return new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position') as THREE.BufferAttribute);
  };
  return [
    { name: 'sleeve', box: part((parts) => addMannequinSleeve(parts, 0)) },
    { name: 'hand', box: part((parts) => addMannequinHand(parts)) },
  ];
}

function gapOn(lo1: number, hi1: number, lo2: number, hi2: number): number {
  return Math.max(0, lo2 - hi1, lo1 - hi2);
}

/** Smallest distance between an arm part's box and a map box, 0 when they touch or overlap. */
function clearance(a: THREE.Box3, b: Box): number {
  return Math.hypot(
    gapOn(a.min.x, a.max.x, b.min.x, b.max.x),
    gapOn(a.min.y, a.max.y, b.min.y, b.max.y),
    gapOn(a.min.z, a.max.z, b.min.z, b.max.z),
  );
}

/** Every pose a server goes through: rest, then one work cycle, for both arms. */
function poses(role: Server['role']): { side: 1 | -1; pose: ArmPose; label: string }[] {
  const out: { side: 1 | -1; pose: ArmPose; label: string }[] = [];
  for (const side of [1, -1] as const) {
    out.push({ side, pose: { ...ARM_REST }, label: 'rest' });
    for (let i = 0; i < SAMPLES; i++) {
      const seconds = (i / SAMPLES) * STAFF_CYCLE_SECONDS[role];
      const pose = staffArmPose({ pitch: 0, roll: 0 }, role, side, seconds, 0);
      out.push({ side, pose: { ...pose }, label: `${seconds.toFixed(2)}s` });
    }
  }
  return out;
}

const maps = getMaps();

test('a server\'s arms keep clear of every drawn box but the counter they reach over, in every pose', () => {
  const violations: string[] = [];
  let worst = { gap: Infinity, what: '' };
  for (const map of maps) {
    const drawn = map.boxes.filter((box) => box.visible && box.mat !== 'clip');
    for (const p of servers(map)) {
      const obstacles = drawn.filter((box) => !isCounter(box, p));
      for (const { side, pose, label } of poses(p.role)) {
        for (const part of armParts(p, side, pose)) {
          for (const box of obstacles) {
            const gap = clearance(part.box, box);
            if (gap < worst.gap) worst = { gap, what: `${map.id} server at ${p.x}, ${p.y}, ${p.z}, ${part.name} of side ${side} at ${label} to ${box.mat} box` };
            if (gap < CLEARANCE_UNITS && violations.length < 8) {
              violations.push(`${map.id} server at ${p.x}, ${p.y}, ${p.z}: ${part.name} (side ${side}, ${label}) is ${gap.toFixed(2)} units from a ${box.mat} box at ${box.min.x}..${box.max.x}, ${box.min.y}..${box.max.y}, ${box.min.z}..${box.max.z}`);
            }
          }
        }
      }
    }
  }
  assert.deepEqual(violations, [], `worst clearance ${worst.gap.toFixed(2)} units, ${worst.what}`);
});
