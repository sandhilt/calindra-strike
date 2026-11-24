import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPON, WEAPONS, reloadCursor, weaponDef } from '@calindra-strike/shared';
import { ReloadPlayback } from '../src/game/reload-playback.ts';
import { RESTING_RELOAD_POSE, reloadPose, boltCyclePose } from '../src/game/render/reload-anim.ts';
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

test('the Azeitadora drum opens, stays open while loading and closes to lock', () => {
  const timing = weaponDef(WEAPON.MGL).reloadTiming;
  assert.ok(timing?.kind === 'magazine');
  const { outTicks, inTicks, boltTicks } = timing;
  const poseAt = (ticks: number) => reloadPose(reloadCursor(timing, ticks, 0), WEAPON.MGL);
  assert.equal(poseAt(0).cover, 0);
  assert.equal(poseAt(outTicks * 0.9).cover, 1);
  assert.equal(poseAt(outTicks + inTicks / 2).cover, 1);
  assert.equal(poseAt(outTicks + inTicks + boltTicks / 2).cover, 0);
  assert.deepEqual(poseAt(outTicks + inTicks + boltTicks), RESTING_RELOAD_POSE);
});

test('the Azeitadora reload tips the rounds out of the open drum, then spins it while the fresh ones go in', () => {
  const timing = weaponDef(WEAPON.MGL).reloadTiming;
  assert.ok(timing?.kind === 'magazine');
  const { outTicks, inTicks } = timing;
  const poseAt = (ticks: number) => reloadPose(reloadCursor(timing, ticks, 0), WEAPON.MGL);
  assert.equal(poseAt(0).drumDump, 0, 'nothing falls before the drum is open');
  assert.equal(poseAt(outTicks * 0.99).drumDump > 0.9, true, 'every round has fallen by the end of the out phase');
  assert.equal(poseAt(outTicks * 0.99).drumFill, -1);
  const early = poseAt(outTicks + inTicks * 0.2);
  const late = poseAt(outTicks + inTicks * 0.8);
  assert.ok(early.drumFill < late.drumFill && late.drumFill < 1, 'the drum fills as it turns');
  assert.ok(early.drumTurn < late.drumTurn, 'and keeps turning');
  assert.equal(RESTING_RELOAD_POSE.drumFill, -1);
  assert.equal(RESTING_RELOAD_POSE.drumDump, -1);
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

test('the AWP throws a spent cartridge while the bolt is drawn back, and none is in the air before or after', () => {
  const samples = Array.from({ length: 200 }, (_, i) => boltCyclePose(i / 200)).filter((p) => p !== null);
  const flying = samples.filter((p) => p.casing >= 0);
  assert.ok(flying.length > 20, 'the cartridge stays in the air long enough to be seen');
  assert.ok(flying.every((p) => p.casing >= 0 && p.casing < 1));
  const first = samples.findIndex((p) => p.casing >= 0);
  const lastFlight = samples.findLastIndex((p) => p.casing >= 0);
  assert.ok(samples[first].boltPull > 0, 'it leaves once the bolt is moving back');
  assert.ok(samples.slice(0, first).every((p) => p.casing === -1) && samples.slice(lastFlight + 1).every((p) => p.casing === -1));
  assert.ok(flying.every((p, i) => i === 0 || p.casing >= flying[i - 1].casing), 'it only moves on');
  assert.equal(RESTING_RELOAD_POSE.casing, -1);
  assert.equal(reloadPose({ phase: 'out', t: 0.5, shell: 0 }, WEAPON.SNIPER).casing, -1, 'a reload throws no cartridge');
});

test('between AWP shots the gun rolls, the bolt is lifted, drawn back and pushed home, then it settles', () => {
  assert.equal(boltCyclePose(-0.1), null);
  assert.equal(boltCyclePose(1), null, 'idle once the gun can fire again');
  const start = boltCyclePose(0);
  assert.ok(start && start.boltPull === 0 && start.boltLift === 0 && start.tilt === 0, 'the kick plays before the bolt moves');
  const samples = Array.from({ length: 100 }, (_, i) => boltCyclePose(i / 100)).filter((p) => p !== null);
  const firstLift = samples.findIndex((p) => p.boltLift > 0.5);
  const firstPull = samples.findIndex((p) => p.boltPull > 0.5);
  assert.ok(firstLift >= 0 && firstPull > firstLift, 'the handle is lifted before it is drawn back');
  assert.ok(samples.some((p) => p.tilt > 0.4), 'the gun rolls to show the action');
  const end = boltCyclePose(0.99);
  assert.ok(end && end.boltPull < 0.01 && end.boltLift < 0.01 && end.tilt < 0.05, 'bolt home and gun back by the end');
  assert.ok(end && end.boltHand === 0, 'the hand is back on the grip by the end');
  assert.ok(
    samples.every((p) => p.boltLift < 0.01 || p.boltHand > 0.99),
    'the hand holds the handle whenever it is off its rest',
  );
});

test('at the end of an AWP reload the shooting hand takes the bolt, works it and returns to the grip', () => {
  const timing = weaponDef(WEAPON.SNIPER).reloadTiming;
  assert.ok(timing?.kind === 'magazine');
  const boltStart = timing.outTicks + timing.inTicks;
  const at = (tick: number) => reloadPose(reloadCursor(timing, tick, 0));
  assert.equal(at(timing.outTicks * 0.5).boltHand, 0, 'on the grip while the magazine comes out');
  for (let tick = boltStart; tick < boltStart + timing.boltTicks; tick++) {
    const pose = at(tick);
    assert.ok(pose.boltLift < 0.01 || pose.boltHand > 0.99, `hand on the handle while it moves (tick ${tick})`);
  }
  assert.ok(at(boltStart + timing.boltTicks - 1).boltHand < 0.01, 'back on the grip when the reload ends');
});

for (const weapon of [WEAPON.PISTOL, WEAPON.RIFLE]) {
  test(`${weaponDef(weapon).name} clears the magazine, seats the spare and works the action`, () => {
    const timing = weaponDef(weapon).reloadTiming;
    assert.ok(timing?.kind === 'magazine');
    const { outTicks, inTicks, boltTicks } = timing;
    const at = (tick: number) => reloadPose(reloadCursor(timing, tick, 0), weapon);

    const releasing = at(outTicks * 0.51);
    assert.ok(releasing.tilt > 0.95);
    assert.equal(releasing.magGone, false);
    assert.ok(releasing.magDrop > 0);
    const removed = at(outTicks * 0.8);
    assert.equal(removed.magGone, true);
    assert.ok(removed.spareLift > 0.6);
    if (weapon === WEAPON.RIFLE) {
      assert.ok(releasing.magPitch > 0.4, 'rock the floorplate away while the top is still near the well');
      assert.ok(removed.sparePitch > 0.4, 'present the new magazine at an angle');
    } else {
      assert.equal(releasing.magPitch, 0, 'the pistol magazine falls down the grip axis');
    }

    const seated = at(outTicks + inTicks * 0.75);
    assert.ok(seated.spareVisible);
    assert.equal(seated.spareLift, 0);
    assert.equal(seated.sparePitch, 0);
    assert.ok(seated.seatKick > 0);
    assert.equal(seated.boltPull, 0);

    const rack = at(outTicks + inTicks + boltTicks * 0.4);
    assert.equal(rack.spareLift, 0);
    assert.ok(rack.boltPull > 0.95);
    assert.equal(rack.supportBolt, 1);
    assert.equal(rack.hand, 1);
    assert.equal(at(outTicks + inTicks + boltTicks * 0.6).boltPull, 0);
    assert.deepEqual(at(outTicks + inTicks + boltTicks), RESTING_RELOAD_POSE);
  });
}
