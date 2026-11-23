import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeTo } from './helpers.ts';
import { traceNoSightsWeapon } from './ads-trace.ts';
import {
  BTN,
  AIR_ACCELERATE,
  AIR_WISHSPEED_CAP,
  BUNNYJUMP_MAX_FACTOR,
  CollisionWorld,
  type MapDef,
  MapBuilder,
  PRONE_SPREAD_MULT,
  SPRINT_OUT_TICKS,
  STANCE,
  TICK_DT,
  WEAPON,
  type WeaponId,
  applyCmd,
  computeSpread,
  createPlayerState,
  getMaps,
  giveWeapon,
  maxSpeedFor,
  packState,
  spawnState,
  unpackState,
  weaponDef,
} from '../src/index.ts';

const ADS_WEAPONS: readonly WeaponId[] = [WEAPON.PISTOL, WEAPON.RIFLE, WEAPON.SMG, WEAPON.SHOTGUN, WEAPON.LMG];

function flatWorld(): CollisionWorld {
  const b = new MapBuilder();
  b.add(-4000, -32, -4000, 4000, 0, 4000, 'ground');
  const map: MapDef = { ...getMaps()[0], boxes: b.boxes };
  return new CollisionWorld(map);
}

const w = flatWorld();
let seq = 0;
type State = ReturnType<typeof createPlayerState>;

function tick(s: State, buttons = 0, n = 1, weapon = 0) {
  const shots = [];
  for (let i = 0; i < n; i++) {
    const shot = applyCmd(w, s, { seq: seq++, buttons, yaw: 0, pitch: 0, weapon, interp: 0 }, 9);
    if (shot) shots.push(shot);
  }
  return shots;
}

/** A grounded player holding `weapon`, deploy finished. */
function player(weapon: WeaponId): State {
  const s = createPlayerState();
  spawnState(s, 0, 0.1, 0, 0, WEAPON.RIFLE);
  s.dropping = false;
  giveWeapon(s, weapon);
  tick(s, 0, weaponDef(weapon).deployTicks + 2);
  return s;
}

const speedOf = (s: State): number => Math.hypot(s.vx, s.vz);

describe('aim down sights', () => {
  for (const id of ADS_WEAPONS) {
    const def = weaponDef(id);

    it(`${def.name}: holding the aim button raises the sights and slows to the aim speed`, () => {
      const s = player(id);
      tick(s, BTN.FWD, 90);
      closeTo(speedOf(s), def.speed, 0);
      tick(s, BTN.FWD | BTN.ATTACK2, 90);
      assert.equal(s.aiming, true);
      assert.equal(s.zoom, 0, 'the aim never goes through the scope zoom');
      closeTo(speedOf(s), def.ads!.speed, 0);
      assert.equal(maxSpeedFor(s), def.ads!.speed);
    });

    it(`${def.name}: letting go ends the aim on that command`, () => {
      const s = player(id);
      tick(s, BTN.ATTACK2);
      assert.equal(s.aiming, true);
      tick(s, 0);
      assert.equal(s.aiming, false);
      assert.equal(maxSpeedFor(s), def.speed);
    });
  }

  it('does not drop the aim when firing', () => {
    const s = player(WEAPON.RIFLE);
    const shots = tick(s, BTN.ATTACK2 | BTN.ATTACK, 30);
    assert.ok(shots.length > 1);
    assert.equal(s.aiming, true);
  });

  it('pressing the aim button ends a sprint the way firing does', () => {
    const s = player(WEAPON.RIFLE);
    const run = BTN.FWD | BTN.SPRINT;
    tick(s, run, 30);
    assert.equal(s.sprinting, true);
    const before = s.tick;
    tick(s, run | BTN.ATTACK2);
    assert.equal(s.sprinting, false);
    assert.equal(s.aiming, true);
    assert.ok(s.nextFire >= before + 1 + SPRINT_OUT_TICKS, 'the sprint-out delay applies');
    tick(s, run | BTN.ATTACK2, 30);
    assert.equal(s.sprinting, false, 'held aim keeps the sprint off');
    assert.equal(s.aiming, true);
  });

  it('a sprint ended by ATTACK2 costs the same sprint-out delay as one ended by ATTACK', () => {
    const run = BTN.FWD | BTN.SPRINT;
    const viaAim = player(WEAPON.RIFLE);
    const viaFire = player(WEAPON.RIFLE);
    tick(viaAim, run, 30);
    tick(viaFire, run, 30);
    tick(viaAim, run | BTN.ATTACK2);
    tick(viaFire, run | BTN.ATTACK);
    assert.equal(viaAim.nextFire, viaFire.nextFire);
    assert.equal(viaAim.stamina, viaFire.stamina);
  });

  it('drops during a reload and comes back by itself while the button is held', () => {
    const s = player(WEAPON.RIFLE);
    tick(s, BTN.ATTACK, 2);
    tick(s, 0, 20);
    tick(s, BTN.ATTACK2);
    assert.equal(s.aiming, true);
    tick(s, BTN.ATTACK2 | BTN.RELOAD);
    assert.equal(s.reload, weaponDef(WEAPON.RIFLE).reloadTicks);
    assert.equal(s.aiming, false);
    tick(s, BTN.ATTACK2, s.reload - 1);
    assert.equal(s.reload, 1);
    assert.equal(s.aiming, false);
    assert.equal(tick(s, BTN.ATTACK2 | BTN.ATTACK).length, 1);
    assert.equal(s.reload, 0);
    assert.equal(s.aiming, true);
  });

  it('stays down after a reload when the button was let go', () => {
    const s = player(WEAPON.SMG);
    tick(s, BTN.ATTACK, 2);
    tick(s, BTN.ATTACK2 | BTN.RELOAD);
    tick(s, 0, weaponDef(WEAPON.SMG).reloadTicks + 2);
    assert.equal(s.reload, 0);
    assert.equal(s.aiming, false);
  });

  it('drops while the gun deploys and comes back when the button is still held', () => {
    const s = player(WEAPON.RIFLE);
    tick(s, BTN.ATTACK2);
    assert.equal(s.aiming, true);
    tick(s, BTN.ATTACK2, 1, 2);
    assert.equal(s.weapon, WEAPON.PISTOL);
    assert.equal(s.deploy, weaponDef(WEAPON.PISTOL).deployTicks - 1);
    assert.equal(s.aiming, false);
    tick(s, BTN.ATTACK2, s.deploy - 1);
    assert.equal(s.deploy, 1);
    assert.equal(s.aiming, false);
    assert.equal(tick(s, BTN.ATTACK2 | BTN.ATTACK).length, 1);
    assert.equal(s.deploy, 0);
    assert.equal(s.aiming, true);
  });

  it('uses hip movement until the weapon tick finishes the reload or deploy', () => {
    for (const timer of ['reload', 'deploy'] as const) {
      const s = player(WEAPON.RIFLE);
      s[timer] = 1;
      const hip = structuredClone(s);
      tick(s, BTN.FWD | BTN.ATTACK2);
      tick(hip, BTN.FWD);
      assert.equal(s[timer], 0);
      assert.equal(s.aiming, true);
      assert.equal(speedOf(s), speedOf(hip));
      tick(s, BTN.FWD | BTN.ATTACK2, 60);
      tick(hip, BTN.FWD, 60);
      assert.ok(speedOf(s) < speedOf(hip));
    }
  });

  it('aims and fires on the same command that interrupts a shotgun reload', () => {
    const s = player(WEAPON.SHOTGUN);
    s.mag[s.weapon]--;
    tick(s, BTN.RELOAD | BTN.ATTACK2);
    assert.ok(s.reload > 1);
    assert.equal(s.aiming, false);
    assert.equal(tick(s, BTN.ATTACK | BTN.ATTACK2).length, 1);
    assert.equal(s.reload, 0);
    assert.equal(s.aiming, true);
  });

  it('uses ADS speed for the bunnyhop cap and air acceleration', () => {
    const s = player(WEAPON.RIFLE);
    const speed = weaponDef(s.weapon).ads!.speed;
    s.vx = weaponDef(s.weapon).speed * BUNNYJUMP_MAX_FACTOR;
    tick(s, BTN.JUMP | BTN.ATTACK2);
    assert.equal(s.onGround, false);
    closeTo(s.vx, speed * BUNNYJUMP_MAX_FACTOR * 0.65, 9);
    s.vz = 40;
    tick(s, BTN.FWD | BTN.ATTACK2);
    closeTo(40 - s.vz, Math.min(AIR_WISHSPEED_CAP + 40, AIR_ACCELERATE * speed * TICK_DT), 9);
  });

  it('crouching, lying down, sliding, leaning and jumping keep the aim', () => {
    const s = player(WEAPON.RIFLE);
    tick(s, BTN.ATTACK2 | BTN.DUCK, 10);
    assert.equal(s.stance, STANCE.CROUCH);
    assert.equal(s.aiming, true);
    tick(s, BTN.ATTACK2 | BTN.LEAN_LEFT, 10);
    assert.equal(s.aiming, true);
    tick(s, BTN.ATTACK2 | BTN.PRONE, 3);
    tick(s, BTN.ATTACK2, 20);
    assert.equal(s.aiming, true);
    const j = player(WEAPON.RIFLE);
    tick(j, BTN.ATTACK2 | BTN.JUMP, 5);
    assert.equal(j.onGround, false);
    assert.equal(j.aiming, true);
    const slide = player(WEAPON.RIFLE);
    tick(slide, BTN.FWD | BTN.SPRINT, 30);
    const hipSlide = structuredClone(slide);
    tick(slide, BTN.FWD | BTN.DUCK | BTN.ATTACK2);
    tick(hipSlide, BTN.FWD | BTN.DUCK);
    assert.ok(slide.slide > 0);
    assert.equal(slide.aiming, true);
    assert.equal(speedOf(slide), speedOf(hipSlide));
  });

  it('the dropping skydiver never aims', () => {
    const s = createPlayerState();
    spawnState(s, 0, 600, 0, 0, WEAPON.RIFLE);
    tick(s, BTN.ATTACK2, 5);
    assert.equal(s.dropping, true);
    assert.equal(s.aiming, false);
  });

  it('spawning, picking up a gun, switching and reloading clear the aim', () => {
    const s = player(WEAPON.RIFLE);
    tick(s, BTN.ATTACK2);
    assert.equal(s.aiming, true);
    giveWeapon(s, WEAPON.SMG);
    assert.equal(s.aiming, false);
    s.aiming = true;
    spawnState(s, 0, 600, 0, 0, WEAPON.RIFLE);
    assert.equal(s.aiming, false);
  });

  it('multiplies the spread by the weapon aim factor and leaves the recoil alone', () => {
    for (const id of ADS_WEAPONS) {
      const s = player(id);
      const hip = computeSpread(s);
      s.aiming = true;
      closeTo(computeSpread(s), hip * weaponDef(id).ads!.spreadMult, 9);
    }
    const aimed = player(WEAPON.RIFLE);
    const hip = player(WEAPON.RIFLE);
    tick(aimed, BTN.ATTACK2 | BTN.ATTACK, 20);
    tick(hip, BTN.ATTACK, 20);
    assert.equal(aimed.recoil, hip.recoil);
    assert.equal(aimed.mag[WEAPON.RIFLE], hip.mag[WEAPON.RIFLE]);
  });

  it('normalises moving spread against ADS speed before applying stance and ADS multipliers', () => {
    const s = player(WEAPON.RIFLE);
    const { spread, ads } = weaponDef(s.weapon);
    assert.ok(ads);
    s.vx = ads.speed * 0.67;
    const hip = computeSpread(s);
    s.aiming = true;
    const moving = (spread.base + spread.move * 0.5) * ads.spreadMult;
    closeTo(computeSpread(s), moving, 9);
    assert.ok(hip < spread.base + spread.move * 0.5);
    s.stance = STANCE.CROUCH;
    closeTo(computeSpread(s), moving * spread.duckMult, 9);
    s.stance = STANCE.PRONE;
    closeTo(computeSpread(s), moving * spread.duckMult * PRONE_SPREAD_MULT, 9);
  });
});

describe('weapons without sights', () => {
  it('the AWP keeps its scope cycle: ATTACK2 zooms and never aims', () => {
    const s = player(WEAPON.SNIPER);
    tick(s, BTN.ATTACK2);
    tick(s, 0);
    assert.equal(s.zoom, 1);
    assert.equal(s.aiming, false);
    assert.equal(maxSpeedFor(s), 150);
  });

  it('the hammer keeps its heavy swing and never aims', () => {
    const s = player(WEAPON.HAMMER);
    const [first, second] = tick(s, BTN.ATTACK2, 61);
    assert.equal(first.heavy, true);
    assert.equal(second.heavy, true);
    assert.equal(second.tick - first.tick, 60);
    assert.equal(s.aiming, false);
    const [primary, nextPrimary] = tick(player(WEAPON.HAMMER), BTN.ATTACK | BTN.ATTACK2, 28);
    assert.equal(primary.heavy, false);
    assert.equal(nextPrimary.tick - primary.tick, 27);
  });

  it('holding ATTACK2 does not stop an AWP or hammer sprint', () => {
    for (const id of [WEAPON.SNIPER, WEAPON.HAMMER]) {
      const s = player(id);
      tick(s, BTN.FWD | BTN.SPRINT, 30);
      assert.equal(s.sprinting, true);
      tick(s, BTN.FWD | BTN.SPRINT | BTN.ATTACK2, 5);
      assert.equal(s.aiming, false);
    }
  });

  // Hashes of a long walk, scope, fire, sprint, reload and jump trace, recorded on the code before aim down sights existed.
  const BEFORE_ADS = {
    [WEAPON.SNIPER]: 'dfd0d06b309e29907684686861d0189118ca87b5accdf9456fbc699d98763e86',
    [WEAPON.HAMMER]: '31865ef170ff3bd228946b2bcedc6bd7b47c7a3ba1ab1957d44504516976636a',
  } as const;
  for (const id of [WEAPON.SNIPER, WEAPON.HAMMER] as const) {
    it(`the ${weaponDef(id).name} trace (position, speed, zoom, spread, shot directions) is byte for byte what it was`, () => {
      const trace = traceNoSightsWeapon(id);
      const rows = JSON.parse(trace) as unknown[][];
      assert.ok(rows.some((r) => r[14] !== null), 'the trace includes shots');
      if (id === WEAPON.SNIPER) assert.ok(rows.some((r) => (r[5] as number) > 0), 'the trace includes the scope');
      assert.equal(createHash('sha256').update(trace).digest('hex'), BEFORE_ADS[id]);
    });
  }
});

describe('prediction', () => {
  it('a client that took the server state mid-aim stays in step with it', () => {
    const server = player(WEAPON.RIFLE);
    tick(server, BTN.ATTACK2 | BTN.FWD, 12);
    assert.equal(server.aiming, true);
    const client = createPlayerState();
    unpackState(packState(server), client);
    assert.equal(client.aiming, true);
    const script = [BTN.ATTACK2 | BTN.FWD, BTN.ATTACK2 | BTN.FWD | BTN.ATTACK, BTN.FWD | BTN.RELOAD, BTN.ATTACK2 | BTN.FWD, 0];
    for (const buttons of script) {
      tick(server, buttons, 25);
      tick(client, buttons, 25);
      assert.equal(client.aiming, server.aiming, 'aiming');
      assert.deepEqual(client.mag, server.mag);
      assert.partialDeepStrictEqual(client, { reload: server.reload, deploy: server.deploy, nextFire: server.nextFire, recoil: server.recoil, sprinting: server.sprinting });
      closeTo(client.x, server.x, 1);
      closeTo(speedOf(client), speedOf(server), 1);
    }
  });

  it('round-trips the aiming flag through packState without disturbing its neighbours', () => {
    const a = createPlayerState();
    Object.assign(a, { aiming: true, attack2Held: true, duckHeld: true, onGround: true });
    const b = createPlayerState();
    unpackState(packState(a), b);
    assert.partialDeepStrictEqual(b, { aiming: true, attack2Held: true, duckHeld: true, onGround: true, attackHeld: false });
    a.aiming = false;
    unpackState(packState(a), b);
    assert.equal(b.aiming, false);
    assert.equal(b.attack2Held, true);
  });
});
