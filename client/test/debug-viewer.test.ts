import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPRINT_SPEED_MULT, WEAPON, weaponDef } from '@calindra-strike/shared';
import { KONAMI_CODE, sequenceMatcher } from '../src/easter-egg.ts';
import { formatPlacement, placementFor } from '../src/game/render/weapon-placement.ts';
import { autoFireShots, previewMovementSpeed, reloadTotal, scrubTo, startReload, stepReload, type ReloadScrub } from '../src/debug/weapon-debug.ts';

const feed = (match: (code: string) => boolean, codes: readonly string[]) => codes.map(match);

test('the Konami code opens it, once, and only when typed in full and in order', () => {
  const match = sequenceMatcher(KONAMI_CODE);
  const hits = feed(match, KONAMI_CODE);
  assert.deepEqual(hits.slice(0, -1).every((hit) => !hit), true, 'nothing before the last key');
  assert.equal(hits.at(-1), true);
  assert.deepEqual(feed(match, KONAMI_CODE).at(-1), true, 'it can be typed again');
});

test('a wrong key starts over, and a repeated first key still counts as a start', () => {
  const match = sequenceMatcher(KONAMI_CODE);
  assert.equal(feed(match, ['ArrowUp', 'ArrowUp', 'ArrowDown', 'KeyX', ...KONAMI_CODE.slice(4)]).some(Boolean), false, 'a stray key breaks it');
  assert.equal(feed(match, ['ArrowUp', 'ArrowUp', 'ArrowUp', ...KONAMI_CODE.slice(1)]).at(-1), true, 'an extra up at the start does not swallow the attempt');
  assert.equal(feed(match, ['KeyB', 'KeyA', 'ArrowUp', 'ArrowDown']).some(Boolean), false);
});

test('every weapon has a placement, and it prints as the line to paste back', () => {
  for (const id of Object.values(WEAPON)) {
    const p = placementFor(id);
    assert.ok(p.scale > 0);
    assert.equal(p.position.length, 3);
    assert.equal(p.rotation.length, 3);
  }
  assert.equal(formatPlacement(placementFor(WEAPON.RIFLE)), '{ position: [6, -6.4, -13], rotation: [0, 0.045, 0], scale: 0.62 }');
  assert.equal(formatPlacement({ position: [1.23456, 0, -2], rotation: [0.1, 0.2, 0.30001], scale: 0.5 }), '{ position: [1.235, 0, -2], rotation: [0.1, 0.2, 0.3], scale: 0.5 }');
});

const fresh = (): ReloadScrub => ({ elapsed: -1, playing: false, speed: 1, loop: false });

test('a reload plays at the speed asked for, then stops or loops', () => {
  const total = reloadTotal(weaponDef(WEAPON.RIFLE), 0);
  assert.ok(total > 0);
  const r = fresh();
  startReload(r);
  stepReload(r, 1, total);
  assert.equal(Math.round(r.elapsed), 60, 'one second is sixty ticks');
  const slow = { ...fresh(), speed: 0.5 };
  startReload(slow);
  stepReload(slow, 1, total);
  assert.equal(Math.round(slow.elapsed), 30);
  stepReload(r, total / 60 + 1, total);
  assert.deepEqual([r.elapsed, r.playing], [-1, false], 'it stops at the end');
  const loop = { ...fresh(), loop: true };
  startReload(loop);
  stepReload(loop, (total + 10) / 60, total);
  assert.equal(Math.round(loop.elapsed), 10, 'it starts over with what is left');
  assert.ok(loop.playing);
});

test('scrubbing holds the reload on one pose and a weapon without a reload has nothing to play', () => {
  const total = reloadTotal(weaponDef(WEAPON.LMG), 0);
  const r = { ...fresh(), playing: true, elapsed: 5 };
  scrubTo(r, 0.5, total);
  assert.deepEqual([r.elapsed, r.playing], [total / 2, false]);
  stepReload(r, 5, total);
  assert.equal(r.elapsed, total / 2, 'paused, so it does not move');
  scrubTo(r, 3, total);
  assert.equal(r.elapsed, total, 'clamped to the end');
  assert.equal(reloadTotal(weaponDef(WEAPON.HAMMER), 0), 0);
  const shotgun = weaponDef(WEAPON.SHOTGUN);
  assert.ok(reloadTotal(shotgun, shotgun.mag) > reloadTotal(shotgun, 1), 'more shells take longer');
});

test('holding the trigger fires at the weapon cadence, without losing the fraction between frames', () => {
  const lmg = weaponDef(WEAPON.LMG);
  const carry = { ticks: 0 };
  let shots = 0;
  for (let frame = 0; frame < 60; frame++) shots += autoFireShots(carry, 1 / 60, lmg.fireTicks);
  assert.equal(shots, 60 / lmg.fireTicks, 'one second of frames is one second of shots');
  const slowFrames = { ticks: 0 };
  let total = 0;
  for (let frame = 0; frame < 10; frame++) total += autoFireShots(slowFrames, 0.1, lmg.fireTicks);
  assert.equal(total, 60 / lmg.fireTicks, 'the same at a few frames per second');
});

test('running in the viewer overrides walking and previews sprint speed', () => {
  assert.equal(previewMovementSpeed(false, false), 0);
  const walk = previewMovementSpeed(true, false);
  assert.ok(walk > 0);
  assert.equal(previewMovementSpeed(false, true), walk * SPRINT_SPEED_MULT);
  assert.equal(previewMovementSpeed(true, true), previewMovementSpeed(false, true));
});
