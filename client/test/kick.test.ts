import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPON, weaponDef } from '@calindra-strike/shared';
import { type KickState, fireKick, kickFeelFor, kickTotal, stepKick } from '../src/game/render/kick-anim.ts';

const FRAME_S = 1 / 60;
/** Viewmodel units the gun is pushed back per unit of kick, as in the viewmodel. */
const BACK_UNITS_PER_KICK = 2.4;

/** Fires a gun at its own cadence for `seconds` and returns the total kick after each frame. */
function burst(id: number, seconds: number): number[] {
  const feel = kickFeelFor(id as typeof WEAPON.LMG);
  const kick: KickState = { thump: 0, push: 0 };
  const every = weaponDef(id).fireTicks;
  const out: number[] = [];
  for (let frame = 0; frame < seconds * 60; frame++) {
    if (frame % every === 0) fireKick(kick, feel);
    stepKick(kick, feel, FRAME_S);
    out.push(kickTotal(kick));
  }
  return out;
}

test('the guns that already felt right kick as they did: a jolt per shot that falls away in a straight line', () => {
  for (const [id, perShot] of [[WEAPON.RIFLE, 0.7], [WEAPON.PISTOL, 1.1], [WEAPON.SNIPER, 1.6], [WEAPON.SHOTGUN, 1.6]] as const) {
    const feel = kickFeelFor(id);
    const kick: KickState = { thump: 0, push: 0 };
    fireKick(kick, feel);
    assert.equal(kickTotal(kick), perShot);
    stepKick(kick, feel, 0.05);
    assert.ok(Math.abs(kickTotal(kick) - (perShot - 0.35)) < 1e-9);
    for (let i = 0; i < 10; i++) fireKick(kick, feel);
    assert.equal(kickTotal(kick), 1.8, 'capped');
  }
});

test('a machine gun burst holds the gun back a little and does not pump it a full stroke twelve times a second', () => {
  const frames = burst(WEAPON.LMG, 5).slice(-60);
  const backMax = Math.max(...frames) * BACK_UNITS_PER_KICK;
  const backMin = Math.min(...frames) * BACK_UNITS_PER_KICK;
  assert.ok(backMax < 1.6, `pushed back ${backMax.toFixed(2)} units at most (it was over 4 before)`);
  assert.ok(backMin > 0.5, `still held back ${backMin.toFixed(2)} units between shots, so firing reads as sustained`);
  assert.ok(backMax - backMin < 0.6, `the shot-to-shot pump is ${(backMax - backMin).toFixed(2)} units (it was 1.4 before)`);
});

test('no frame of a machine gun burst jerks the gun by more than the jolt of one shot', () => {
  const kicks = burst(WEAPON.LMG, 5);
  const worst = Math.max(...kicks.slice(1).map((k, i) => Math.abs(k - kicks[i])));
  assert.ok(worst < 0.2, `worst frame-to-frame change is ${worst.toFixed(3)}`);
});

test('the push of a burst builds up over the first second and is gone two seconds after the trigger is released', () => {
  const feel = kickFeelFor(WEAPON.LMG);
  const kick: KickState = { thump: 0, push: 0 };
  const every = weaponDef(WEAPON.LMG).fireTicks;
  const pushAt: number[] = [];
  for (let frame = 0; frame < 180; frame++) {
    if (frame % every === 0) fireKick(kick, feel);
    stepKick(kick, feel, FRAME_S);
    pushAt.push(kick.push);
  }
  assert.ok(pushAt[59] > 2 * pushAt[4], 'it is higher after a second of fire than after the first shot');
  for (let frame = 0; frame < 120; frame++) stepKick(kick, feel, FRAME_S);
  assert.ok(kickTotal(kick) < 0.01, 'the gun has settled');
});

test('the push does not depend on the frame rate', () => {
  const feel = kickFeelFor(WEAPON.LMG);
  const at = (dt: number): number => {
    const kick: KickState = { thump: 0, push: 0.4 };
    for (let t = 0; t < 1 - 1e-9; t += dt) stepKick(kick, feel, dt);
    return kick.push;
  };
  assert.ok(Math.abs(at(1 / 30) - at(1 / 144)) < 1e-6);
});
