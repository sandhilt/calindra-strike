import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BTN,
  CollisionWorld,
  type Cmd,
  MapBuilder,
  type MapDef,
  RELOAD_TIMING,
  WEAPON,
  WEAPONS,
  applyCmd,
  cloneState,
  createPlayerState,
  getMaps,
  giveWeapon,
  setHalvedAmmo,
  packState,
  reloadCues,
  reloadCursor,
  reloadTotalTicks,
  spawnState,
  unpackState,
  weaponDef,
} from '../src/index.ts';

function flatWorld(): CollisionWorld {
  const b = new MapBuilder();
  b.add(-4000, -32, -4000, 4000, 0, 4000, 'ground');
  const map: MapDef = { ...getMaps()[0], boxes: b.boxes };
  return new CollisionWorld(map);
}

const world = flatWorld();
let seq = 0;

function step(s: ReturnType<typeof createPlayerState>, buttons: number) {
  const cmd: Cmd = { seq: seq++, buttons, yaw: 0, pitch: 0, weapon: 0, interp: 0 };
  return applyCmd(world, s, cmd, 7);
}

function idle(s: ReturnType<typeof createPlayerState>, ticks: number): void {
  for (let i = 0; i < ticks; i++) step(s, 0);
}

function ready(primary: 2 | 3 | 4) {
  const s = createPlayerState();
  spawnState(s, 0, 0.1, 0, 0, primary);
  s.dropping = false;
  idle(s, 120);
  return s;
}

describe('reload timing table', () => {
  it('derives every weapon reloadTicks from its phases', () => {
    for (const def of WEAPONS) {
      const timing = RELOAD_TIMING[def.id];
      assert.equal(def.reloadTiming, timing);
      assert.equal(def.reloadTicks, timing ? reloadTotalTicks(timing, def.mag) : 0);
    }
    assert.equal(weaponDef(WEAPON.HAMMER).reloadTicks, 0);
  });

  it('keeps the reload durations the game shipped with', () => {
    const ticks = Object.fromEntries(WEAPONS.map((d) => [d.id, d.reloadTicks]));
    assert.deepEqual(ticks, {
      [WEAPON.HAMMER]: 0,
      [WEAPON.PISTOL]: 130,
      [WEAPON.RIFLE]: 150,
      [WEAPON.SMG]: 125,
      [WEAPON.SHOTGUN]: 180,
      [WEAPON.SNIPER]: 150,
      [WEAPON.LMG]: 280,
      [WEAPON.MGL]: 155,
    });
  });

  it('walks a magazine reload through out, in and bolt', () => {
    const t = RELOAD_TIMING[WEAPON.RIFLE];
    assert.ok(t?.kind === 'magazine');
    assert.equal(reloadCursor(t, -1, 0), null);
    assert.deepEqual(reloadCursor(t, 0, 0), { phase: 'out', t: 0, shell: 0 });
    assert.equal(reloadCursor(t, t.outTicks, 0)?.phase, 'in');
    assert.equal(reloadCursor(t, t.outTicks + t.inTicks, 0)?.phase, 'bolt');
    assert.equal(reloadCursor(t, reloadTotalTicks(t, 0), 0), null);
  });

  it('walks a shell reload through start, one step per shell and the pump', () => {
    const t = RELOAD_TIMING[WEAPON.SHOTGUN];
    assert.ok(t?.kind === 'shells');
    assert.equal(reloadCursor(t, 0, 3)?.phase, 'start');
    assert.deepEqual(reloadCursor(t, t.startTicks + t.shellTicks * 2, 3), { phase: 'shell', t: 0, shell: 2 });
    assert.equal(reloadCursor(t, t.startTicks + t.shellTicks * 3, 3)?.phase, 'pump');
    assert.equal(reloadCursor(t, reloadTotalTicks(t, 3), 3), null);
  });

  it('puts every cue inside the reload and in order', () => {
    for (const def of WEAPONS) {
      const t = def.reloadTiming;
      if (!t) continue;
      const cues = reloadCues(t, def.mag);
      assert.ok(cues.length >= 3, `${def.name} has cues`);
      cues.forEach((c, i) => {
        assert.ok(c.tick > 0 && c.tick < reloadTotalTicks(t, def.mag), `${def.name} cue ${c.cue} inside the reload`);
        if (i > 0) assert.ok(c.tick > cues[i - 1].tick, `${def.name} cues ascend`);
      });
    }
    const shells = reloadCues(RELOAD_TIMING[WEAPON.SHOTGUN]!, 4).map((c) => c.cue);
    assert.deepEqual(shells, ['shell', 'shell', 'shell', 'shell', 'pump']);
  });
});

describe('magazine reload', () => {
  it('keeps the rounds left in the old magazine', () => {
    const s = ready(WEAPON.RIFLE);
    const def = weaponDef(WEAPON.RIFLE);
    s.mag[WEAPON.RIFLE] = 11;
    step(s, BTN.RELOAD);
    assert.equal(s.reload, def.reloadTicks);
    idle(s, def.reloadTicks);
    assert.equal(s.mag[WEAPON.RIFLE], 30);
    assert.equal(s.reserve[WEAPON.RIFLE], 90 - 19);
  });

  it('does not reload a full magazine or an empty reserve', () => {
    const s = ready(WEAPON.RIFLE);
    step(s, BTN.RELOAD);
    assert.equal(s.reload, 0);
    s.mag[WEAPON.RIFLE] = 5;
    s.reserve[WEAPON.RIFLE] = 0;
    step(s, BTN.RELOAD);
    assert.equal(s.reload, 0);
  });

  it('cannot fire while the magazine is swapped', () => {
    const s = ready(WEAPON.RIFLE);
    s.mag[WEAPON.RIFLE] = 20;
    step(s, BTN.RELOAD);
    assert.equal(step(s, BTN.ATTACK), null);
    assert.ok(s.reload > 0);
  });
});

describe('shotgun shell reload', () => {
  const def = weaponDef(WEAPON.SHOTGUN);
  const timing = RELOAD_TIMING[WEAPON.SHOTGUN];
  assert.ok(timing?.kind === 'shells');

  it('loads one shell per step and ends after the pump', () => {
    const s = ready(WEAPON.SHOTGUN);
    s.mag[WEAPON.SHOTGUN] = 4;
    const reserve = s.reserve[WEAPON.SHOTGUN];
    const seen: number[] = [];
    step(s, BTN.RELOAD);
    seen.push(s.mag[WEAPON.SHOTGUN]);
    const total = timing.startTicks + 3 * timing.shellTicks + timing.pumpTicks;
    let ticks = 1;
    let lastMag = s.mag[WEAPON.SHOTGUN];
    const loadedAt: number[] = [];
    while (s.reload > 0) {
      step(s, 0);
      ticks++;
      if (s.mag[WEAPON.SHOTGUN] !== lastMag) {
        loadedAt.push(ticks);
        lastMag = s.mag[WEAPON.SHOTGUN];
      }
    }
    assert.equal(ticks, total + 1);
    assert.equal(s.mag[WEAPON.SHOTGUN], def.mag);
    assert.equal(s.reserve[WEAPON.SHOTGUN], reserve - 3);
    assert.deepEqual(loadedAt, [
      timing.startTicks + timing.shellTicks + 1,
      timing.startTicks + 2 * timing.shellTicks + 1,
      timing.startTicks + 3 * timing.shellTicks + 1,
    ]);
  });

  it('a full empty reload takes the shipped reloadTicks', () => {
    const s = ready(WEAPON.SHOTGUN);
    s.mag[WEAPON.SHOTGUN] = 0;
    step(s, BTN.RELOAD);
    let ticks = 1;
    while (s.reload > 0) {
      step(s, 0);
      ticks++;
    }
    assert.equal(ticks, def.reloadTicks + 1);
    assert.equal(s.mag[WEAPON.SHOTGUN], def.mag);
  });

  it('stops at the reserve and still pumps once', () => {
    const s = ready(WEAPON.SHOTGUN);
    s.mag[WEAPON.SHOTGUN] = 0;
    s.reserve[WEAPON.SHOTGUN] = 2;
    step(s, BTN.RELOAD);
    let ticks = 1;
    while (s.reload > 0) {
      step(s, 0);
      ticks++;
    }
    assert.equal(ticks, timing.startTicks + 2 * timing.shellTicks + timing.pumpTicks + 1);
    assert.equal(s.mag[WEAPON.SHOTGUN], 2);
    assert.equal(s.reserve[WEAPON.SHOTGUN], 0);
  });

  it('firing interrupts the reload and keeps the shells already loaded', () => {
    const s = ready(WEAPON.SHOTGUN);
    s.mag[WEAPON.SHOTGUN] = 2;
    step(s, BTN.RELOAD);
    idle(s, timing.startTicks + timing.shellTicks + 2);
    assert.equal(s.mag[WEAPON.SHOTGUN], 3);
    assert.ok(s.reload > 0);
    const reserve = s.reserve[WEAPON.SHOTGUN];
    const shot = step(s, BTN.ATTACK);
    assert.ok(shot, 'the shotgun fires mid-reload');
    assert.equal(s.reload, 0);
    assert.equal(s.mag[WEAPON.SHOTGUN], 2);
    assert.equal(s.reserve[WEAPON.SHOTGUN], reserve);
    idle(s, timing.shellTicks * 3);
    assert.equal(s.mag[WEAPON.SHOTGUN], 2, 'no shell appears after the interruption');
  });

  it('cannot interrupt an empty magazine, and a held trigger does not interrupt', () => {
    const s = ready(WEAPON.SHOTGUN);
    s.mag[WEAPON.SHOTGUN] = 0;
    step(s, BTN.RELOAD);
    assert.equal(step(s, BTN.ATTACK), null);
    assert.ok(s.reload > 0);

    const held = ready(WEAPON.SHOTGUN);
    held.mag[WEAPON.SHOTGUN] = 4;
    step(held, BTN.ATTACK);
    step(held, BTN.ATTACK | BTN.RELOAD);
    assert.ok(held.reload > 0);
    step(held, BTN.ATTACK);
    assert.ok(held.reload > 0, 'a trigger held since before the reload does not cancel it');
  });

  it('switching weapons cancels the reload', () => {
    const s = ready(WEAPON.SHOTGUN);
    s.mag[WEAPON.SHOTGUN] = 1;
    step(s, BTN.RELOAD);
    applyCmd(world, s, { seq: seq++, buttons: 0, yaw: 0, pitch: 0, weapon: 2, interp: 0 }, 7);
    assert.equal(s.reload, 0);
    assert.equal(s.mag[WEAPON.SHOTGUN], 1);
  });

  it('is deterministic and survives the wire round trip mid reload', () => {
    const a = ready(WEAPON.SHOTGUN);
    a.mag[WEAPON.SHOTGUN] = 1;
    step(a, BTN.RELOAD);
    idle(a, 47);
    const b = createPlayerState();
    unpackState(packState(a), b);
    const c = cloneState(a);
    for (let i = 0; i < 200; i++) {
      step(b, 0);
      step(c, 0);
    }
    assert.deepEqual(b.mag, c.mag);
    assert.equal(b.reload, c.reload);
    assert.equal(b.reload, 0);
  });
});

it('predicts halved Azeitadora reloads with infinite reserve and restores capacity without refilling', () => {
  const s = ready(WEAPON.RIFLE);
  giveWeapon(s, WEAPON.MGL);
  s.infiniteMgl = true;
  setHalvedAmmo(s, true);
  assert.equal(s.mag[WEAPON.MGL], 3);
  assert.equal(s.reserve[WEAPON.MGL], 3);
  assert.equal(s.mag[WEAPON.PISTOL], Math.ceil(weaponDef(WEAPON.PISTOL).mag / 2));

  const predicted = createPlayerState();
  s.mag[WEAPON.MGL] = 0;
  unpackState(packState(s), predicted);
  idle(predicted, predicted.deploy + 1);
  step(predicted, BTN.RELOAD);
  idle(predicted, weaponDef(WEAPON.MGL).reloadTicks);
  assert.equal(predicted.mag[WEAPON.MGL], 3);
  assert.equal(predicted.reserve[WEAPON.MGL], 3);

  setHalvedAmmo(predicted, false);
  assert.equal(predicted.mag[WEAPON.MGL], 3);
  step(predicted, BTN.RELOAD);
  idle(predicted, weaponDef(WEAPON.MGL).reloadTicks);
  assert.equal(predicted.mag[WEAPON.MGL], 6);
  assert.equal(predicted.reserve[WEAPON.MGL], 3);
});

it('depletes the Azeitadora reserve when it comes from an airdrop', () => {
  const s = ready(WEAPON.RIFLE);
  giveWeapon(s, WEAPON.MGL);
  idle(s, s.deploy + 1);
  s.mag[WEAPON.MGL] = 0;
  step(s, BTN.RELOAD);
  idle(s, weaponDef(WEAPON.MGL).reloadTicks);
  assert.equal(s.mag[WEAPON.MGL], 6);
  assert.equal(s.reserve[WEAPON.MGL], 0);
});
