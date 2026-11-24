import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BTN, CollisionWorld, LIFT_CARRY_UNITS, LIFT_CLOCK_SLACK_TICKS, LIFT_SPEED_UNITS, LIFT_STOP_WAIT_TICKS, MapBuilder, TICK_MS, WEAPON,
  applyCmd, carriedBy, createPlayerState, getMaps, inLiftCab, liftAt, liftCab, liftClockTick, liftDoorOpen, liftRideSeconds, spawnState, type Cmd, type Lift, type MapDef,
} from '../src/index.ts';

const LIFT: Lift = { minX: -56, maxX: 56, minZ: 100, maxZ: 212, stops: [0, 192, 384], doors: [] };

/** A floor, a shaft with a doorway on its -z side at each upper stop, and a deck outside the door at every stop. */
function shaftWorld(): CollisionWorld {
  const b = new MapBuilder();
  b.add(-2000, -32, -2000, 2000, 0, 2000, 'ground');
  for (const stop of [192, 384]) b.add(-300, stop - 16, -300, 300, stop, 100, 'tile');
  for (const stop of [192, 384]) b.add(-56, stop - 4, 100, 56, stop, 212, 'tile');
  b.add(-62, 0, 94, 62, 192, 100, 'glass');
  b.add(-62, 288, 94, 62, 384, 100, 'glass');
  b.add(-62, 480, 94, 62, 600, 100, 'glass');
  for (const side of [-1, 1]) b.add(side > 0 ? 56 : -62, 0, 94, side > 0 ? 62 : -56, 600, 218, 'glass');
  b.add(-62, 0, 212, 62, 600, 218, 'glass');
  const map: MapDef = { ...getMaps()[0], boxes: b.boxes, lifts: [LIFT] };
  return new CollisionWorld(map);
}

let seq = 0;
function step(world: CollisionWorld, s: ReturnType<typeof createPlayerState>, buttons: number, yaw = 0): void {
  const cmd: Cmd = { seq: seq++, buttons, yaw, pitch: 0, weapon: 0, interp: 0 };
  applyCmd(world, s, cmd, 1);
}

function rider(world: CollisionWorld, x: number, y: number, z: number) {
  const s = createPlayerState();
  spawnState(s, x, y + 0.1, z, 0, WEAPON.RIFLE);
  s.dropping = false;
  s.pitch = 0;
  for (let i = 0; i < 5; i++) step(world, s, 0);
  return s;
}

const PERIOD_TICKS = 4 * LIFT_STOP_WAIT_TICKS + 2 * Math.ceil(192 / (LIFT_SPEED_UNITS / 60)) + 2 * Math.ceil(192 / (LIFT_SPEED_UNITS / 60));
const TICKS_UP = Math.ceil(192 / (LIFT_SPEED_UNITS / 60));

describe('the lift cab', () => {
  it('carries only players whose centre is in the footprint and between the first and last stop', () => {
    assert.equal(liftAt([LIFT], 0, 0, 150), LIFT);
    assert.equal(liftAt([LIFT], 0, 384 + 8, 150), LIFT);
    assert.equal(liftAt([LIFT], 0, 384 + 9, 150), undefined);
    assert.equal(liftAt([LIFT], 70, 0, 150), undefined);
    assert.equal(liftAt([LIFT], 0, 0, 90), undefined);
    assert.equal(liftAt([], 0, 0, 150), undefined);
  });

  it('waits at every stop, goes up through all of them and back down, and repeats', () => {
    const at = (tick: number) => liftCab(LIFT, tick);
    assert.deepEqual(at(0), { y: 0, moving: 0 });
    assert.deepEqual(at(LIFT_STOP_WAIT_TICKS - 1), { y: 0, moving: 0 });
    assert.equal(at(LIFT_STOP_WAIT_TICKS).moving, 1);
    assert.deepEqual(at(LIFT_STOP_WAIT_TICKS + TICKS_UP - 1), { y: 192, moving: 1 }, 'lands exactly on the stop');
    assert.deepEqual(at(LIFT_STOP_WAIT_TICKS + TICKS_UP), { y: 192, moving: 0 });
    assert.deepEqual(at(2 * (LIFT_STOP_WAIT_TICKS + TICKS_UP)), { y: 384, moving: 0 });
    assert.equal(at(3 * LIFT_STOP_WAIT_TICKS + 2 * TICKS_UP + 5).moving, -1, 'comes back down');
    assert.deepEqual(at(PERIOD_TICKS), at(0), 'a full cycle repeats');
    assert.deepEqual(at(7 * PERIOD_TICKS + 123), at(123));
  });

  it('never stands anywhere but at a stop while it waits, and never leaves the shaft', () => {
    for (let tick = 0; tick < 2 * PERIOD_TICKS; tick++) {
      const cab = liftCab(LIFT, tick);
      assert.ok(cab.y >= 0 && cab.y <= 384);
      if (cab.moving === 0) assert.ok([0, 192, 384].includes(cab.y), 'waiting at ' + cab.y);
    }
  });

  it('carries a rider whose feet are on the cab floor, or just behind it in its direction of travel, and nobody else', () => {
    assert.equal(carriedBy({ y: 200, moving: 1 }, 195), true);
    assert.equal(carriedBy({ y: 200, moving: 1 }, 200 + 1), false, 'cab below the rider going up: the floor holds them');
    assert.equal(carriedBy({ y: 200, moving: 1 }, 200 - LIFT_CARRY_UNITS - 1), false, 'far below');
    assert.equal(carriedBy({ y: 200, moving: -1 }, 205), true);
    assert.equal(carriedBy({ y: 200, moving: -1 }, 195), false, 'cab above the rider going down');
    assert.equal(carriedBy({ y: 192, moving: 0 }, 192), true, 'waiting: the floor is under them, with no landing to stand on');
    assert.equal(carriedBy({ y: 192, moving: 0 }, 192 - LIFT_CARRY_UNITS - 1), false, 'waiting on another floor');
  });

  it('opens a doorway only while the cab waits at its stop', () => {
    const door = { y: 192, minX: -62, maxX: 62, minZ: 94, maxZ: 100 };
    const open = [...Array(2 * PERIOD_TICKS).keys()].filter((tick) => liftDoorOpen(LIFT, door, tick));
    assert.ok(open.length > 0);
    for (const tick of open) assert.deepEqual(liftCab(LIFT, tick), { y: 192, moving: 0 });
    assert.equal(liftDoorOpen(LIFT, door, 0), false, 'the cab waits on the ground floor');
    assert.equal(liftDoorOpen(LIFT, door, LIFT_STOP_WAIT_TICKS + 30), false, 'the cab is passing');
    assert.equal(liftDoorOpen(LIFT, door, LIFT_STOP_WAIT_TICKS + TICKS_UP + 1), true);
  });

  it('runs on the command clock when it is close to the server clock, and on the server clock when it is not', () => {
    const delay = 100;
    const serverTick = 1000;
    assert.equal(liftClockTick(serverTick * TICK_MS - delay, delay, serverTick), serverTick);
    assert.equal(liftClockTick((serverTick + 5) * TICK_MS - delay, delay, serverTick), serverTick + 5);
    assert.equal(liftClockTick((serverTick + LIFT_CLOCK_SLACK_TICKS + 1) * TICK_MS - delay, delay, serverTick), serverTick);
    assert.equal(liftClockTick(0, delay, serverTick), serverTick, 'a bot without a clock');
  });

  it('takes a few seconds to ride on average, counting the wait for the cab and every stop', () => {
    const toTop = liftRideSeconds(LIFT, 0, 384);
    const toDeck = liftRideSeconds(LIFT, 0, 192);
    assert.ok(toTop > 3 && toTop < 15, 'ground to top took ' + toTop);
    assert.ok(toDeck > 1 && toDeck < 15);
    assert.equal(liftRideSeconds(LIFT, 192, 192), 0);
  });
});

describe('riding a lift', () => {
  /** Runs ticks with the cab clock following the tick count, as the server does. */
  function run(world: CollisionWorld, s: ReturnType<typeof createPlayerState>, from: number, ticks: number, buttons = 0, yaw = 0): number {
    for (let i = 0; i < ticks; i++) {
      world.liftTick = from + i;
      step(world, s, buttons, yaw);
    }
    return from + ticks;
  }

  it('rides the cab up from the ground floor to the top, down again, always grounded', () => {
    const w = shaftWorld();
    const s = rider(w, 0, 0, 150);
    let top = 0;
    let wentDown = false;
    let prev = s.y;
    for (let t = 0; t < PERIOD_TICKS; t++) {
      w.liftTick = t;
      step(w, s, 0);
      top = Math.max(top, s.y);
      if (s.y < prev) wentDown = true;
      prev = s.y;
      assert.ok(s.onGround, 'a rider is always grounded');
    }
    assert.equal(top, 384);
    assert.ok(wentDown, 'came back down');
    assert.equal(s.y, 0);
  });

  it('stays level with the cab through the whole ride', () => {
    const w = shaftWorld();
    const s = rider(w, 0, 0, 150);
    for (let t = 0; t < PERIOD_TICKS; t++) {
      w.liftTick = t;
      step(w, s, 0);
      if (t > LIFT_STOP_WAIT_TICKS + 3) assert.ok(Math.abs(s.y - liftCab(LIFT, t).y) <= LIFT_CARRY_UNITS, 'rider ' + s.y + ' cab ' + liftCab(LIFT, t).y + ' at ' + t);
    }
  });

  it('is one cab for everybody: two riders in the shaft are at the same height, whenever they got in', () => {
    const w = shaftWorld();
    const a = rider(w, 0, 0, 150);
    const b = rider(w, 20, 0, 170);
    for (let t = 0; t < 400; t++) {
      w.liftTick = t;
      step(w, a, 0);
      step(w, b, 0);
      if (t > 120) assert.equal(a.y, b.y);
    }
  });

  it('a rider who steps in at a floor while the cab is away stands on the landing and is picked up when it comes', () => {
    const w = shaftWorld();
    const s = rider(w, 0, 192, 150);
    let t = 0;
    t = run(w, s, t, 10);
    assert.equal(Math.round(s.y), 192, 'waits on the landing, does not fall down the shaft');
    let reachedWithCab = false;
    for (let i = 0; i < PERIOD_TICKS; i++) {
      w.liftTick = t++;
      step(w, s, 0);
      if (liftCab(LIFT, t - 1).y > 230 && s.y > 230) reachedWithCab = true;
    }
    assert.ok(reachedWithCab, 'went up with the cab');
  });

  it('ignores crouch and jump: nothing a rider presses changes where the cab goes', () => {
    const w = shaftWorld();
    const a = rider(w, 0, 0, 150);
    const b = rider(w, 0, 0, 150);
    for (let t = 0; t < 400; t++) {
      w.liftTick = t;
      step(w, a, 0);
      step(w, b, t % 2 ? BTN.JUMP | BTN.DUCK : BTN.DUCK);
    }
    assert.equal(b.y, a.y);
  });

  it('steps out onto the deck through the doorway while the cab waits there, and is then not carried any more', () => {
    const w = shaftWorld();
    const s = rider(w, 0, 0, 150);
    const arrive = LIFT_STOP_WAIT_TICKS + TICKS_UP;
    let t = run(w, s, 0, arrive);
    assert.equal(s.y, 192);
    // the doorway is on the -z side: yaw 0 faces -z
    t = run(w, s, t, 60, BTN.FWD);
    assert.ok(s.z < 94, 'left the shaft, at z=' + s.z);
    assert.ok(Math.abs(s.y - 192) < 1, 'stands on the deck, at y=' + s.y);
    const y = s.y;
    run(w, s, t, 200);
    assert.equal(s.y, y, 'a player on the deck is not carried');
  });

  it('cannot walk out through the wall between stops', () => {
    const w = shaftWorld();
    const s = rider(w, 0, 0, 150);
    run(w, s, 0, 20, BTN.FWD);
    assert.ok(s.z >= 100, 'stopped by the wall, z=' + s.z);
  });

  it('is not grounded by the cab once the rider steps out of an open shaft between floors: gravity takes over', () => {
    const b = new MapBuilder();
    b.add(-2000, -32, -2000, 2000, 0, 2000, 'ground');
    const open = new CollisionWorld({ ...getMaps()[0], boxes: b.boxes, lifts: [LIFT] });
    const s = rider(open, 0, 0, 150);
    let t = run(open, s, 0, LIFT_STOP_WAIT_TICKS + 40);
    assert.ok(s.y > 80 && s.y < 192, 'riding at ' + s.y);
    let leftAt = -1;
    for (let i = 0; i < 60 && leftAt < 0; i++) {
      open.liftTick = t++;
      step(open, s, BTN.FWD, -Math.PI / 2);
      if (s.x >= LIFT.maxX) leftAt = i;
    }
    assert.ok(leftAt >= 0, 'walked out, at x=' + s.x);
    assert.equal(s.onGround, false, 'nothing under the feet');
    const y = s.y;
    open.liftTick = t;
    step(open, s, 0, -Math.PI / 2);
    assert.ok(s.y < y, 'falls');
  });

  it('is deterministic: the same inputs give the same heights every time', () => {
    const go = () => {
      const w = shaftWorld();
      const s = rider(w, 10, 0, 150);
      const ys: number[] = [];
      for (let t = 0; t < 600; t++) {
        w.liftTick = t;
        step(w, s, 0);
        ys.push(s.y);
      }
      return ys;
    };
    assert.deepEqual(go(), go());
  });
});

describe('the Shopping Sul Rio lifts', () => {
  const shopping = getMaps().find((m) => m.id === 'shopping');
  assert.ok(shopping);
  const world = new CollisionWorld(shopping);

  it('has one shaft in each half, serving the ground floor, the food court and the Mirante, and a cab prop for each', () => {
    assert.equal(shopping.lifts.length, 2);
    for (const lift of shopping.lifts) assert.deepEqual(lift.stops, [0, 192, 384]);
    assert.deepEqual(shopping.lifts.map((l) => Math.sign(l.minZ)).toSorted(), [-1, 1]);
    assert.equal(shopping.props.filter((p) => p.kind === 'lift').length, 2);
  });

  for (const side of [-1, 1]) {
    const yaw = side < 0 ? 0 : Math.PI;
    const doorZ = (z: number) => side * z;
    it(`takes a rider from the atrium to the food court deck and out its doorway (${side < 0 ? 'north' : 'south'} half)`, () => {
      const s = rider(world, 0, 0, doorZ(530));
      let t = 0;
      const go = (ticks: number, buttons: number) => {
        for (let i = 0; i < ticks; i++) {
          world.liftTick = t++;
          step(world, s, buttons, yaw);
        }
      };
      go(24, BTN.FWD);
      assert.ok(Math.abs(s.z) > 560 && Math.abs(s.z) < 672, 'inside the shaft at z=' + s.z);
      for (let i = 0; i < 60 * 30 && s.y !== 192; i++) go(1, 0);
      assert.equal(s.y, 192);
      go(60, BTN.FWD);
      assert.ok(Math.abs(s.z) > 690, 'out on the deck, z=' + s.z);
      assert.ok(Math.abs(s.y - 192) < 1, 'level with the deck, y=' + s.y);
    });

    it(`has no floor of its own at the upper stops, and a deck doorway stays shut until the cab waits there (${side < 0 ? 'north' : 'south'} half)`, () => {
      for (const stop of [192, 384]) assert.equal(world.groundBelow(0, stop + 8, doorZ(616), 16), 0, 'nothing to stand on at ' + stop);
      const s = rider(world, 0, 192, doorZ(780));
      let t = 0;
      const go = (ticks: number) => {
        for (let i = 0; i < ticks; i++) {
          world.liftTick = t++;
          step(world, s, BTN.FWD, yaw + Math.PI);
        }
      };
      go(LIFT_STOP_WAIT_TICKS - 5);
      assert.ok(Math.abs(s.z) > 690, 'held at the shut door, z=' + s.z);
      assert.ok(Math.abs(s.y - 192) < 1, 'still on the deck');
      for (let i = 0; i < 60 * 30 && Math.abs(s.z) > 660; i++) go(1);
      assert.ok(Math.abs(s.z) < 660, 'went in once the cab waited, z=' + s.z);
      assert.equal(s.y, 192, 'standing on the cab');
    });

    it(`takes a rider all the way to the Mirante and back down by itself (${side < 0 ? 'north' : 'south'} half)`, () => {
      const s = rider(world, 0, 0, doorZ(530));
      let t = 0;
      const go = (ticks: number, buttons: number) => {
        for (let i = 0; i < ticks; i++) {
          world.liftTick = t++;
          step(world, s, buttons, yaw);
        }
      };
      go(24, BTN.FWD);
      for (let i = 0; i < 60 * 30 && s.y !== 384; i++) go(1, 0);
      assert.equal(s.y, 384);
      go(30, BTN.FWD);
      assert.ok(Math.abs(s.z) > 690 && Math.abs(s.y - 384) < 1, 'out on the Mirante at ' + [s.z, s.y]);
      go(40, BTN.BACK);
      for (let i = 0; i < 60 * 40 && s.y > 0; i++) go(1, 0);
      assert.equal(s.y, 0);
      go(120, BTN.BACK);
      assert.ok(Math.abs(s.z) < 550, 'walked out into the atrium, z=' + s.z);
    });
  }
});

describe('inLiftCab', () => {
  const lifts = [LIFT];
  const waiting = 2;
  const away = LIFT_STOP_WAIT_TICKS + 120;

  it('is true on the cab floor, waiting at a stop or moving', () => {
    assert.equal(inLiftCab(lifts, 0, liftCab(LIFT, waiting).y + 0.05, 150, waiting), true);
    const moving = LIFT_STOP_WAIT_TICKS + 30;
    const cab = liftCab(LIFT, moving);
    assert.notEqual(cab.moving, 0);
    assert.equal(inLiftCab(lifts, 0, cab.y + 1, 150, moving), true);
  });

  it('is false in the shaft while the cab is on another floor', () => {
    const cab = liftCab(LIFT, away);
    assert.ok(Math.abs(cab.y) > LIFT_CARRY_UNITS * 4);
    assert.equal(inLiftCab(lifts, 0, 0.05, 150, away), false);
  });

  it('is false outside the shaft, even level with the cab', () => {
    assert.equal(inLiftCab(lifts, 200, liftCab(LIFT, waiting).y, 150, waiting), false);
    assert.equal(inLiftCab(lifts, 0, liftCab(LIFT, waiting).y, 400, waiting), false);
  });

  it('is false on a map with no lifts', () => {
    assert.equal(inLiftCab([], 0, 0, 150, waiting), false);
  });
});
