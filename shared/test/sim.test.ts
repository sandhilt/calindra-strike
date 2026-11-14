import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { closeTo } from './helpers.ts';
import {
  BTN,
  CollisionWorld,
  type Cmd,
  JUMP_SPEED,
  type MapDef,
  MapBuilder,
  WEAPON,
  applyCmd,
  cloneState,
  computeSpread,
  createPlayerState,
  getMaps,
  packState,
  spawnState,
  unpackState,
  weaponDef,
} from '../src/index.ts';

function testMap(build: (b: MapBuilder) => void): CollisionWorld {
  const b = new MapBuilder();
  b.add(-4000, -32, -4000, 4000, 0, 4000, 'ground');
  build(b);
  const map: MapDef = {
    ...getMaps()[0],
    boxes: b.boxes,
  };
  return new CollisionWorld(map);
}

function grounded(world: CollisionWorld, x = 0, z = 0, primary: 2 | 3 | 4 = WEAPON.RIFLE) {
  const s = createPlayerState();
  spawnState(s, x, 0.1, z, 0, primary);
  s.dropping = false;
  s.pitch = 0;
  // settle on the floor
  run(world, s, 10, 0);
  return s;
}

let seq = 0;
function run(world: CollisionWorld, s: ReturnType<typeof createPlayerState>, ticks: number, buttons: number, yaw = 0, weapon = 0) {
  const shots = [];
  for (let i = 0; i < ticks; i++) {
    const cmd: Cmd = { seq: seq++, buttons, yaw, pitch: 0, weapon: i === 0 ? weapon : 0, interp: 0 };
    const shot = applyCmd(world, s, cmd, 7);
    if (shot) shots.push(shot);
  }
  return shots;
}

describe('movement', () => {
  it('accelerates to the weapon max speed and no further on flat ground', () => {
    const w = testMap(() => {});
    const s = grounded(w);
    run(w, s, 120, BTN.FWD);
    const speed = Math.hypot(s.vx, s.vz);
    assert.ok(speed > 215, "speed > 215");
    assert.ok(speed <= weaponDef(WEAPON.RIFLE).speed + 0.01, "speed <= weaponDef(WEAPON.RIFLE).speed + 0.01");
    assert.ok(s.z < -200, "s.z < -200"); // yaw 0 looks toward -Z
    assert.equal(s.onGround, true);
  });

  it('runs faster with the hammer out than with a pistol or rifle', () => {
    const w = testMap(() => {});
    const s = grounded(w);
    run(w, s, 150, BTN.FWD, 0, 3);
    assert.equal(s.weapon, WEAPON.HAMMER);
    const speed = Math.hypot(s.vx, s.vz);
    assert.ok(speed > weaponDef(WEAPON.PISTOL).speed + 20, "speed > weaponDef(WEAPON.PISTOL).speed + 20");
    assert.ok(speed <= weaponDef(WEAPON.HAMMER).speed + 0.01, "speed <= weaponDef(WEAPON.HAMMER).speed + 0.01");
    run(w, s, 150, BTN.FWD, 0, 2);
    assert.equal(s.weapon, WEAPON.PISTOL);
    assert.ok(Math.hypot(s.vx, s.vz) <= weaponDef(WEAPON.PISTOL).speed + 0.01, "Math.hypot(s.vx, s.vz) <= weaponDef(WEAPON.PISTOL).speed + 0.01");
  });

  it('stops at walls without penetrating them', () => {
    const w = testMap((b) => b.add(-200, 0, -300, 200, 200, -280, 'concrete'));
    const s = grounded(w);
    run(w, s, 240, BTN.FWD);
    assert.ok(s.z - 16 >= -280 - 0.001, "s.z - 16 >= -280 - 0.001");
    assert.ok(s.z - 16 < -279, "s.z - 16 < -279");
  });

  it('slides along walls when moving diagonally', () => {
    const w = testMap((b) => b.add(-2000, 0, -100, 2000, 200, -80, 'concrete'));
    const s = grounded(w);
    run(w, s, 120, BTN.FWD | BTN.RIGHT);
    assert.ok(s.x > 100, "s.x > 100");
  });

  it('climbs stairs made of 16 unit steps', () => {
    const w = testMap((b) => {
      b.stairs(-80, 80, -300, -108, '-z', 96, 'concrete');
      b.add(-80, 0, -600, 80, 96, -300, 'concrete');
    });
    const s = grounded(w);
    run(w, s, 150, BTN.FWD);
    assert.ok(s.y > 95, "s.y > 95");
    assert.ok(s.z < -300, "s.z < -300");
  });

  it('jumps about 45 units high', () => {
    const w = testMap(() => {});
    const s = grounded(w);
    let maxY = 0;
    run(w, s, 1, BTN.JUMP);
    assert.ok(s.vy > 0, "s.vy > 0");
    for (let i = 0; i < 60; i++) {
      run(w, s, 1, 0);
      maxY = Math.max(maxY, s.y);
    }
    assert.ok(maxY > 42, "maxY > 42");
    assert.ok(maxY < 48, "maxY < 48");
    assert.ok(JUMP_SPEED > 0, "JUMP_SPEED > 0");
  });

  it('needs a crouch-jump to reach a 56 unit ledge', () => {
    const build = (b: MapBuilder) => b.add(-200, 0, -800, 200, 56, -300, 'crate');
    const attempt = (duck: boolean) => {
      const w = testMap(build);
      const s = grounded(w);
      // run-up until ~40 units from the ledge
      let guard = 0;
      while (s.z - 16 > -300 + 40 && guard++ < 300) run(w, s, 1, BTN.FWD);
      run(w, s, 1, BTN.JUMP | BTN.FWD);
      run(w, s, 8, BTN.FWD);
      run(w, s, 40, BTN.FWD | (duck ? BTN.DUCK : 0));
      run(w, s, 30, BTN.FWD);
      return s.y;
    };
    assert.ok(attempt(false) < 1, "attempt(false) < 1");
    assert.ok(attempt(true) > 55, "attempt(true) > 55");
  });

  it('skydives down and lands with spawn protection', () => {
    const w = testMap(() => {});
    const s = createPlayerState();
    spawnState(s, 0, 1100, 0, 0, WEAPON.RIFLE);
    let t = 0;
    while (s.dropping && t < 600) {
      run(w, s, 1, BTN.FWD);
      t++;
    }
    assert.equal(s.dropping, false);
    assert.ok(t < 5 * 60, "t < 5 * 60");
    assert.ok(s.y < 1, "s.y < 1");
    assert.ok(s.protect > 0, "s.protect > 0");
  });
});

describe('determinism', () => {
  it('replaying the same commands from a packed snapshot reproduces the state', () => {
    const w = new CollisionWorld(getMaps()[0]);
    const s = grounded(w, 600, 600);
    const cmds: Cmd[] = [];
    for (let i = 0; i < 180; i++) {
      const b = (i % 40 < 30 ? BTN.FWD : BTN.LEFT) | (i % 50 === 10 ? BTN.JUMP : 0) | (i > 100 && i % 3 === 0 ? BTN.ATTACK : 0);
      cmds.push({ seq: i, buttons: b, yaw: i * 0.02, pitch: 0.1, weapon: 0, interp: 0 });
    }
    const snap = packState(s);
    const a = cloneState(s);
    for (const c of cmds) applyCmd(w, a, c, 3);
    const b = createPlayerState();
    unpackState(snap, b);
    for (const c of cmds) applyCmd(w, b, c, 3);
    closeTo(b.x, a.x, 2);
    closeTo(b.y, a.y, 2);
    closeTo(b.z, a.z, 2);
    assert.deepEqual(b.mag, a.mag);
  });
});

describe('weapons', () => {
  it('fires the rifle on cadence, empties the mag and reloads', () => {
    const w = testMap(() => {});
    const s = grounded(w);
    const def = weaponDef(WEAPON.RIFLE);
    const shots = run(w, s, def.fireTicks * 30, BTN.ATTACK);
    assert.equal(shots.length, 30);
    assert.equal(s.mag[WEAPON.RIFLE], 0);
    run(w, s, 2, BTN.ATTACK);
    assert.ok(s.reload > 0, "s.reload > 0");
    run(w, s, def.reloadTicks + 2, 0);
    assert.equal(s.mag[WEAPON.RIFLE], 30);
    assert.equal(s.reserve[WEAPON.RIFLE], 60);
  });

  it('semi-automatic pistol needs a re-press', () => {
    const w = testMap(() => {});
    const s = grounded(w);
    run(w, s, 1, 0, 0, 2);
    run(w, s, 60, 0);
    const held = run(w, s, 60, BTN.ATTACK);
    assert.equal(held.length, 1);
  });

  it('is accurate standing still and inaccurate while running', () => {
    const w = testMap(() => {});
    const s = grounded(w);
    const still = computeSpread(s);
    run(w, s, 90, BTN.FWD);
    const running = computeSpread(s);
    assert.ok(still < 0.01, "still < 0.01");
    assert.ok(running > still * 10, "running > still * 10");
  });

  it('shotgun fires 9 pellets with the same seed on both sides', () => {
    const w = testMap(() => {});
    const a = grounded(w, 0, 0, WEAPON.SHOTGUN);
    const b = cloneState(a);
    const sa = applyCmd(w, a, { seq: 1, buttons: BTN.ATTACK, yaw: 0, pitch: 0, weapon: 0, interp: 0 }, 42);
    const sb = applyCmd(w, b, { seq: 1, buttons: BTN.ATTACK, yaw: 0, pitch: 0, weapon: 0, interp: 0 }, 42);
    assert.equal(sa?.dirs.length, 27);
    assert.deepEqual(sa?.dirs, sb?.dirs);
  });
});
