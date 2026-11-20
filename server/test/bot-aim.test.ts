import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aimSkill, restingSway, stepSway } from '../src/bot.ts';

/** Share of ticks a bot that believes it is on target actually covers a standing target's chest (12 units wide each side). */
function chestHitShare(skill: number, distance: number): number {
  let seed = 7;
  const random = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const aim = aimSkill(skill);
  const sway = restingSway();
  const halfWidth = Math.atan2(12, distance);
  const halfHeight = Math.atan2(14, distance);
  let hits = 0;
  const ticks = 60 * 120;
  for (let i = 0; i < ticks; i++) {
    stepSway(sway, aim, 1 / 60, random);
    if (Math.abs(sway.yaw) < halfWidth && Math.abs(sway.pitch) < halfHeight) hits++;
  }
  return hits / ticks;
}

test('an average bot lands most shots up close and few from far away', () => {
  const close = chestHitShare(0.45, 400);
  const far = chestHitShare(0.45, 1500);
  assert.ok(close > 0.8, 'at 400 units ' + close.toFixed(2));
  assert.ok(far < 0.45, 'at 1500 units ' + far.toFixed(2));
});

test('a better bot is steadier at range', () => {
  assert.ok(chestHitShare(0.9, 1200) > chestHitShare(0.2, 1200));
});

test('a better bot spots enemies from farther away', () => {
  assert.ok(aimSkill(0.9).sightUnits > aimSkill(0.2).sightUnits);
});
