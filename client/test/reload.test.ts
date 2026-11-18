import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPON, WEAPONS, reloadCursor, weaponDef } from '@calindra-strike/shared';
import { ReloadPlayback } from '../src/game/reload-playback.ts';
import { RESTING_RELOAD_POSE, reloadPose } from '../src/game/render/reload-anim.ts';
import { playReloadCue } from '../src/game/reload-sounds.ts';
import type { SoundKit } from '../src/game/sound-packs/types.ts';

test('a rifle reload fires clip out, clip in and bolt once each, in order', () => {
  const playback = new ReloadPlayback();
  const def = weaponDef(WEAPON.RIFLE);
  playback.begin(def, 0, 1000);
  assert.deepEqual(playback.due(1000), []);
  const heard: string[] = [];
  for (let tick = 1000; tick <= 1000 + def.reloadTicks; tick++) heard.push(...playback.due(tick));
  assert.deepEqual(heard, ['out', 'in', 'bolt']);
  assert.deepEqual(playback.due(5000), []);
});

test('a shotgun reload sounds once per shell and pumps at the end', () => {
  const playback = new ReloadPlayback();
  const def = weaponDef(WEAPON.SHOTGUN);
  playback.begin(def, 3, 0);
  assert.equal(playback.shells, 3);
  const heard = playback.due(10_000);
  assert.deepEqual(heard, ['shell', 'shell', 'shell', 'pump']);
});

test('progress and elapsed are -1 outside a reload and end() stops the cues', () => {
  const playback = new ReloadPlayback();
  const def = weaponDef(WEAPON.PISTOL);
  assert.equal(playback.elapsed(0), -1);
  assert.equal(playback.progress(0), -1);
  playback.begin(def, 0, 100);
  assert.equal(playback.progress(100 + def.reloadTicks / 2), 0.5);
  playback.end();
  assert.equal(playback.active, false);
  assert.deepEqual(playback.due(100 + def.reloadTicks), []);
});

test('following another player starts on the flag, restarts on a weapon change and stops when it drops', () => {
  const playback = new ReloadPlayback();
  const rifle = weaponDef(WEAPON.RIFLE);
  playback.follow(false, rifle, 0);
  assert.equal(playback.active, false);
  playback.follow(true, rifle, 10);
  assert.equal(playback.elapsed(40), 30);
  playback.follow(true, rifle, 40);
  assert.equal(playback.elapsed(40), 30, 'a steady flag does not restart the reload');
  playback.follow(true, weaponDef(WEAPON.SMG), 50);
  assert.equal(playback.elapsed(50), 0);
  playback.follow(false, rifle, 60);
  assert.equal(playback.active, false);
});

test('the pose is at rest outside a reload and moves the magazine and bolt inside it', () => {
  assert.equal(reloadPose(null), RESTING_RELOAD_POSE);
  const rifle = weaponDef(WEAPON.RIFLE);
  const timing = rifle.reloadTiming;
  assert.ok(timing?.kind === 'magazine');
  const at = (tick: number) => reloadPose(reloadCursor(timing, tick, 0));
  assert.equal(at(timing.outTicks * 0.2).magGone, false);
  assert.equal(at(timing.outTicks - 1).magGone, true);
  assert.equal(at(timing.outTicks - 1).spareVisible, true);
  assert.ok(at(timing.outTicks * 0.8).magDrop > 0.5);
  const seated = at(timing.outTicks + timing.inTicks - 1);
  assert.ok(seated.spareLift < 0.05);
  const racking = at(timing.outTicks + timing.inTicks + timing.boltTicks * 0.35);
  assert.ok(racking.boltPull > 0.9);
  assert.equal(at(timing.outTicks + timing.inTicks + timing.boltTicks - 1).boltPull < 0.01, true);
});

test('the shotgun pose shows one shell going in per step and a pump at the end', () => {
  const timing = weaponDef(WEAPON.SHOTGUN).reloadTiming;
  assert.ok(timing?.kind === 'shells');
  const at = (tick: number) => reloadPose(reloadCursor(timing, tick, 2));
  const firstShell = at(timing.startTicks + timing.shellTicks * 0.5);
  assert.equal(firstShell.shellVisible, true);
  assert.ok(firstShell.shellLift > 0 && firstShell.shellLift < 1);
  assert.equal(at(timing.startTicks + timing.shellTicks * 0.95).shellVisible, false);
  const secondShell = at(timing.startTicks + timing.shellTicks * 1.5);
  assert.equal(secondShell.shellVisible, true);
  assert.ok(at(timing.startTicks + timing.shellTicks * 2 + timing.pumpTicks * 0.45).boltPull > 0.9);
});

test('every reloadable weapon has a synthesized sound for each of its cues', () => {
  const calls: string[] = [];
  const node = {} as AudioNode;
  const kit = {
    ctx: { currentTime: 1 },
    out: () => node,
    noiseBurst: () => calls.push('noise'),
    tone: () => calls.push('tone'),
    release: () => {},
  } as unknown as SoundKit;
  for (const def of WEAPONS) {
    if (!def.reloadTiming) continue;
    const cues = def.reloadTiming.kind === 'magazine' ? (['out', 'in', 'bolt'] as const) : (['shell', 'pump'] as const);
    for (const cue of cues) {
      calls.length = 0;
      playReloadCue(kit, def.id, cue, null);
      assert.ok(calls.length >= 2, `${def.name} ${cue} makes sound`);
    }
  }
  calls.length = 0;
  playReloadCue(kit, WEAPON.HAMMER, 'out', null);
  assert.equal(calls.length, 0);
});
