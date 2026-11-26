import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BTN, CollisionWorld, LIFT_CLOCK_SLACK_TICKS, LIFT_STOP_WAIT_TICKS, MapBuilder, WEAPON,
  applyCmd, createPlayerState, getMaps, liftCab, liftDoorOpen, packState, spawnState, unpackState, type Cmd, type Lift, type MapDef,
} from '../src/index.ts';

const LIFT: Lift = { minX: -56, maxX: 56, minZ: 100, maxZ: 212, stops: [0, 192, 384], doors: [] };

function shaftWorld(): CollisionWorld {
  const b = new MapBuilder();
  b.add(-2000, -32, -2000, 2000, 0, 2000, 'ground');
  for (const side of [-1, 1]) b.add(side > 0 ? 56 : -62, 0, 94, side > 0 ? 62 : -56, 600, 218, 'glass');
  b.add(-62, 0, 94, 62, 600, 100, 'glass');
  b.add(-62, 0, 212, 62, 600, 218, 'glass');
  const map: MapDef = { ...getMaps()[0], boxes: b.boxes, lifts: [LIFT] };
  return new CollisionWorld(map);
}

/**
 * Runs a rider through two full cab cycles, each command on the lift tick `clock(i)` gives, and returns the first command
 * after which the rider is not on the cab floor (or -1).
 */
function rideWithClock(clock: (i: number) => number, buttons: (i: number) => number = () => 0): number {
  const world = shaftWorld();
  const s = createPlayerState();
  world.liftTick = clock(0);
  spawnState(s, 0, 0.1, 156, 0, WEAPON.RIFLE);
  s.dropping = false;
  const period = 4 * LIFT_STOP_WAIT_TICKS + 4 * 77;
  for (let i = 0; i < 2 * period; i++) {
    world.liftTick = clock(i);
    const cmd: Cmd = { seq: i, buttons: buttons(i), yaw: 0, pitch: 0, weapon: 0, interp: 0 };
    applyCmd(world, s, cmd, 1);
    if (Math.abs(s.y - liftCab(LIFT, world.liftTick).y) > 0.01) return i;
  }
  return -1;
}

describe('a rider in the cab never falls down the shaft', () => {
  it('on a steady clock', () => assert.equal(rideWithClock((i) => i), -1));
  it('when the command clock repeats a tick and then skips one', () => assert.equal(rideWithClock((i) => i - (i % 7 === 3 ? 1 : 0)), -1));
  it('when the command clock steps back a tick (client clock correction)', () => assert.equal(rideWithClock((i) => i - (i % 13 === 5 ? 2 : 0)), -1));
  it('when the command clock jumps a few ticks ahead', () => assert.equal(rideWithClock((i) => i + (i % 17 === 4 ? 5 : 0)), -1));
  it('when the server switches between the command clock and its own across the slack', () =>
    assert.equal(rideWithClock((i) => i + (i % 2 ? LIFT_CLOCK_SLACK_TICKS + 1 : 0)), -1));
});

describe('the ride is a state, not a distance', () => {
  it('when every command is 3 server ticks on and the command clock swings from 12 behind to 12 ahead', () =>
    assert.equal(rideWithClock((i) => 30 + 3 * i + (i % 2 ? LIFT_CLOCK_SLACK_TICKS : -LIFT_CLOCK_SLACK_TICKS)), -1));

  it('does not snap a player standing in the shaft to a cab on another floor', () => {
    const world = shaftWorld();
    const s = createPlayerState();
    spawnState(s, 0, 0.1, 156, 0, WEAPON.RIFLE);
    s.dropping = false;
    const waitsAtMiddle = LIFT_STOP_WAIT_TICKS + 77 + 10;
    assert.equal(liftCab(LIFT, waitsAtMiddle).y, 192);
    for (let i = 0; i < 40; i++) {
      world.liftTick = waitsAtMiddle + (i % 2 ? 12 : -12);
      applyCmd(world, s, { seq: i, buttons: 0, yaw: 0, pitch: 0, weapon: 0, interp: 0 }, 1);
      if (liftCab(LIFT, world.liftTick).y > 40) assert.ok(s.y < 1, `snapped up to ${s.y} at command ${i}`);
    }
  });
});

describe('a rider at a doorway edge of Shopping Sul Rio', () => {
  const map = getMaps().find((m) => m.lifts.length > 0);
  assert.ok(map);
  const lift = map.lifts[1];

  /** Stands a rider with their hull half over the landing at `stop`, when the cab is waiting there, and runs `cmds` commands. */
  function edgeRide(stop: number, clock: (i: number) => number, buttons: (i: number) => number = () => 0): { fell: number; inSolid: number } {
    const world = new CollisionWorld(map!);
    let arrive = 0;
    while (!(liftCab(lift, arrive).moving === 0 && liftCab(lift, arrive).y === stop)) arrive++;
    const s = createPlayerState();
    spawnState(s, 0, stop, lift.maxZ - 6, 0, WEAPON.RIFLE);
    s.dropping = false;
    let fell = -1;
    let inSolid = -1;
    for (let i = 0; i < 500; i++) {
      world.liftTick = arrive + 2 + clock(i);
      applyCmd(world, s, { seq: i, buttons: buttons(i), yaw: 0, pitch: 0, weapon: 0, interp: 0 }, 1);
      const inShaft = s.x > lift.minX && s.x < lift.maxX && s.z > lift.minZ && s.z < lift.maxZ;
      if (fell < 0 && inShaft && Math.abs(s.y - liftCab(lift, world.liftTick).y) > 0.01) fell = i;
      if (inSolid < 0 && world.hullOverlaps(s.x, s.y + 0.01, s.z, 72)) inSolid = i;
    }
    return { fell, inSolid };
  }

  for (const stop of [192, 384]) {
    it(`rides the cab away from the ${stop} landing instead of staying on the slab edge`, () =>
      assert.deepEqual(edgeRide(stop, (i) => i), { fell: -1, inSolid: -1 }));
    it(`walks deeper into the shaft from the ${stop} landing after the cab left without falling`, () =>
      assert.deepEqual(edgeRide(stop, (i) => i, (i) => (i > 120 ? BTN.FWD : 0)), { fell: -1, inSolid: -1 }));
    it(`never stands in a solid at the ${stop} doorway on a jumpy clock`, () =>
      assert.deepEqual(edgeRide(stop, (i) => i + (i % 5 === 2 ? -LIFT_CLOCK_SLACK_TICKS : i % 5 === 4 ? LIFT_CLOCK_SLACK_TICKS : 0)), { fell: -1, inSolid: -1 }));
  }

  it('cannot walk through a shut door its hull already overlaps from the landing', () => {
    const world = new CollisionWorld(map!);
    let shut = 0;
    while (!(liftCab(lift, shut).moving !== 0 && liftCab(lift, shut).y > 250)) shut++;
    const s = createPlayerState();
    spawnState(s, 0, 192, lift.maxZ + 10, 0, WEAPON.RIFLE);
    s.dropping = false;
    for (let i = 0; i < 60; i++) {
      world.liftTick = shut + i;
      applyCmd(world, s, { seq: i, buttons: BTN.FWD, yaw: 0, pitch: 0, weapon: 0, interp: 0 }, 1);
    }
    assert.ok(s.z > lift.maxZ, `walked into the empty shaft to z ${s.z}`);
    assert.equal(s.y, 192);
  });
});

describe('prediction and server agree on a ride', () => {
  it('a client that takes the server state mid-ride replays the next commands to the same place', () => {
    const server = shaftWorld();
    const client = shaftWorld();
    const s = createPlayerState();
    spawnState(s, 0, 0.1, 156, 0, WEAPON.RIFLE);
    s.dropping = false;
    const clock = (i: number): number => 3 * i + (i % 2 ? LIFT_CLOCK_SLACK_TICKS : -LIFT_CLOCK_SLACK_TICKS);
    const cmd = (i: number): Cmd => ({ seq: i, buttons: 0, yaw: 0, pitch: 0, weapon: 0, interp: 0 });
    for (let i = 0; i < 70; i++) {
      server.liftTick = clock(i);
      applyCmd(server, s, cmd(i), 1);
    }
    const predicted = createPlayerState();
    unpackState(packState(s), predicted);
    assert.equal(predicted.lift, s.lift);
    for (let i = 70; i < 140; i++) {
      server.liftTick = clock(i);
      applyCmd(server, s, cmd(i), 1);
      client.liftTick = clock(i);
      applyCmd(client, predicted, cmd(i), 1);
      assert.equal(predicted.y, s.y, `command ${i}`);
    }
    assert.equal(s.y, liftCab(LIFT, clock(139)).y);
  });
});

describe('boarding through a Mirante doorway', () => {
  const map = getMaps().find((m) => m.lifts.length > 0);
  assert.ok(map);
  const lift = map.lifts[1];
  const door = lift.doors.find((d) => d.y === 384);
  assert.ok(door);
  let lastOpen = 1;
  while (!(liftDoorOpen(lift, door, lastOpen) && !liftDoorOpen(lift, door, lastOpen + 1))) lastOpen++;

  function board(z: number, vz: number, buttons: number, clock: (i: number) => number): number {
    const world = new CollisionWorld(map!);
    const s = createPlayerState();
    world.liftTick = clock(0);
    spawnState(s, 0, 384, z, 0, WEAPON.RIFLE);
    s.dropping = false;
    s.onGround = true;
    s.vz = vz;
    for (let i = 0; i < 120; i++) {
      world.liftTick = clock(i);
      applyCmd(world, s, { seq: i, buttons: i < 10 ? buttons : 0, yaw: 0, pitch: 0, weapon: 0, interp: 0 }, 1);
      const inShaft = s.z < lift.maxZ && s.z > lift.minZ;
      if (inShaft && i > 0 && s.y < 383 && Math.abs(s.y - liftCab(lift, world.liftTick).y) > 0.01) return i;
    }
    return -1;
  }

  /** Walks (or crouch-jumps) in from the landing, starting at every tick of the last moments the doorway is open. */
  const fromEveryStart = (buttons: number, jump: number): number[] =>
    [...Array(40).keys()].filter((k) => board(lift.maxZ + 23, -250, buttons, (i) => lastOpen - 40 + k + i + (i > jump ? 24 : 0)) >= 0);

  it('rides away after stepping in just before the doorway shuts, even when the next clock is 24 ticks on', () =>
    assert.deepEqual(fromEveryStart(BTN.FWD, 6), []));
  it('rides away after jumping in through the doorway', () =>
    assert.deepEqual(fromEveryStart(BTN.FWD | BTN.JUMP | BTN.DUCK, 1000), []));
});
