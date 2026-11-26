import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { StaffRole } from '@calindra-strike/shared';
import { STAFF_CYCLE_SECONDS, staffArmPose, type ArmPose } from '../src/game/render/prop-motion.ts';

const ROLES: readonly StaffRole[] = ['cook', 'cashier', 'server'];
const SIDES = [1, -1] as const;

function pose(role: StaffRole, side: 1 | -1, seconds: number, seed = 0): ArmPose {
  return staffArmPose({ pitch: 0, roll: 0 }, role, side, seconds, seed);
}

function samples(role: StaffRole, side: 1 | -1): ArmPose[] {
  return Array.from({ length: 64 }, (_, i) => pose(role, side, (i / 64) * STAFF_CYCLE_SECONDS[role]));
}

test('every role repeats its work cycle', () => {
  for (const role of ROLES) for (const side of SIDES) {
    const t = 0.37;
    const a = pose(role, side, t);
    const b = pose(role, side, t + STAFF_CYCLE_SECONDS[role] * 3);
    assert.ok(Math.abs(a.pitch - b.pitch) < 1e-9 && Math.abs(a.roll - b.roll) < 1e-9, `${role} ${side}`);
  }
});

test('arms stay in front of the body and never swing behind or over the head', () => {
  for (const role of ROLES) for (const side of SIDES) for (const p of samples(role, side)) {
    assert.ok(p.pitch >= 0 && p.pitch <= 1.4, `${role} pitch ${p.pitch}`);
    assert.ok(Math.abs(p.roll) <= 0.6, `${role} roll ${p.roll}`);
  }
});

test('each role moves its working arm', () => {
  for (const role of ROLES) {
    const right = samples(role, 1);
    const spread = (key: keyof ArmPose) => Math.max(...right.map((p) => p[key])) - Math.min(...right.map((p) => p[key]));
    assert.ok(spread('pitch') + spread('roll') > 0.3, role);
  }
});

test('a server reaches over the counter and draws back each cycle', () => {
  const pitches = samples('server', 1).map((p) => p.pitch);
  assert.ok(Math.max(...pitches) > 1.2);
  assert.ok(Math.min(...pitches) < 0.4);
});

test('the seed shifts the cycle so neighbours do not move in step', () => {
  assert.notDeepEqual(pose('cashier', 1, 0.2, 0), pose('cashier', 1, 0.2, 0.5));
});
