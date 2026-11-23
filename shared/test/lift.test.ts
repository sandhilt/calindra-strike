import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BTN, CollisionWorld, LIFT_SPEED_UNITS, LIFT_STOP_WAIT_TICKS, MapBuilder, STANCE, WEAPON,
  applyCmd, createPlayerState, getMaps, liftAt, liftRideSeconds, liftStep, spawnState, type Cmd, type Lift, type MapDef,
} from '../src/index.ts';

const LIFT: Lift = { minX: -56, maxX: 56, minZ: 100, maxZ: 212, stops: [0, 192, 384] };

/** A floor, a shaft with a doorway on its -z side at each upper stop, and a deck outside the door at every stop. */
function shaftWorld(): CollisionWorld {
  const b = new MapBuilder();
  b.add(-2000, -32, -2000, 2000, 0, 2000, 'ground');
  for (const stop of [192, 384]) b.add(-300, stop - 16, -300, 300, stop, 100, 'tile');
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

describe('lift field', () => {
  it('carries only players whose centre is in the footprint and between the first and last stop', () => {
    assert.equal(liftAt([LIFT], 0, 0, 150), LIFT);
    assert.equal(liftAt([LIFT], 0, 384 + 8, 150), LIFT);
    assert.equal(liftAt([LIFT], 0, 384 + 9, 150), undefined);
    assert.equal(liftAt([LIFT], 70, 0, 150), undefined);
    assert.equal(liftAt([LIFT], 0, 0, 90), undefined);
    assert.equal(liftAt([], 0, 0, 150), undefined);
  });

  it('holds for the wait, then travels at full speed and stops at the next stop for another wait', () => {
    assert.deepEqual(liftStep(LIFT, 0, 1, 5, 1), { y: 0, dir: 1, wait: 4 });
    assert.deepEqual(liftStep(LIFT, 10, 1, 0, 1), { y: 10 + LIFT_SPEED_UNITS, dir: 1, wait: 0 });
    assert.deepEqual(liftStep(LIFT, 100, 1, 0, 1), { y: 192, dir: 1, wait: LIFT_STOP_WAIT_TICKS });
    assert.deepEqual(liftStep(LIFT, 192, 1, 0, 1), { y: 192 + LIFT_SPEED_UNITS, dir: 1, wait: 0 });
    assert.deepEqual(liftStep(LIFT, 300, -1, 0, 1), { y: 192, dir: -1, wait: LIFT_STOP_WAIT_TICKS });
  });

  it('only goes up from the first stop and only down from the last, whatever it was doing', () => {
    assert.equal(liftStep(LIFT, 0, -1, 0, 1 / 60).dir, 1);
    assert.equal(liftStep(LIFT, 384, 1, 0, 1 / 60).dir, -1);
    assert.equal(liftStep(LIFT, 384, 1, 0, 1 / 60).y < 384, true);
    assert.equal(liftStep(LIFT, 0, -1, 0, 1 / 60).y > 0, true);
  });

  it('takes a few seconds to ride, with a wait at every floor', () => {
    const toTop = liftRideSeconds(LIFT, 0, 384);
    const toDeck = liftRideSeconds(LIFT, 0, 192);
    assert.ok(toTop > 5 && toTop < 10, 'ground to top took ' + toTop);
    assert.ok(toDeck > 2.5 && toDeck < toTop);
    assert.ok(liftRideSeconds(LIFT, 192, 0) > toDeck, 'from the middle it goes up first');
    assert.ok(Math.abs(liftRideSeconds(LIFT, 384, 0) - toTop) < 0.2, 'down takes as long as up');
  });
});

describe('riding a lift', () => {
  it('goes up from the ground floor to the top floor, stops at each floor, then comes back down, always grounded', () => {
    const w = shaftWorld();
    const s = rider(w, 0, 0, 150);
    let top = 0;
    let deckTicks = 0;
    let wentDown = false;
    let prev = s.y;
    for (let i = 0; i < 60 * 20; i++) {
      step(w, s, 0);
      top = Math.max(top, s.y);
      if (s.y === 192) deckTicks++;
      if (s.y < prev) wentDown = true;
      prev = s.y;
      assert.ok(s.onGround, 'a rider is always grounded');
    }
    assert.equal(top, 384, 'never above the top stop');
    assert.ok(deckTicks >= LIFT_STOP_WAIT_TICKS, 'waited at the food court floor for ' + deckTicks + ' ticks');
    assert.ok(wentDown, 'turned round at the top');
  });

  it('ignores crouch and jump: nothing a rider presses changes where the cab goes', () => {
    const w = shaftWorld();
    const a = rider(w, 0, 0, 150);
    const b = rider(w, 0, 0, 150);
    for (let i = 0; i < 400; i++) {
      step(w, a, 0);
      step(w, b, i % 2 ? BTN.JUMP | BTN.DUCK : BTN.DUCK);
    }
    assert.equal(b.y, a.y);
  });

  it('updates sprint, stamina and stance while the cab replaces jumping and gravity', () => {
    const w = shaftWorld();
    const s = rider(w, 0, 192, 150);
    for (let i = 0; i < LIFT_STOP_WAIT_TICKS; i++) step(w, s, 0);
    const startY = s.y;
    const startStamina = s.stamina;
    step(w, s, BTN.FWD | BTN.SPRINT | BTN.JUMP);
    assert.ok(s.y > startY);
    assert.equal(s.onGround, true);
    assert.equal(s.vy, 0);
    assert.equal(s.sprinting, true);
    assert.ok(s.stamina < startStamina);

    const beforeRecovery = s.stamina;
    step(w, s, BTN.DUCK);
    assert.equal(s.stance, STANCE.CROUCH);
    assert.equal(s.sprinting, false);
    assert.ok(s.stamina > beforeRecovery);
  });

  it('waits at a stop for long enough to walk out of its doorway', () => {
    const w = shaftWorld();
    const s = rider(w, 0, 0, 150);
    let ticksAtDoor = 0;
    for (let i = 0; i < 60 * 8; i++) {
      step(w, s, 0);
      if (s.y === 192) ticksAtDoor++;
    }
    assert.ok(ticksAtDoor >= LIFT_STOP_WAIT_TICKS - 1, 'the doorway is level for ' + ticksAtDoor + ' ticks');
  });

  it('steps out onto the deck through the doorway at the stop, and is then not carried any more', () => {
    const w = shaftWorld();
    const s = rider(w, 0, 0, 150);
    for (let i = 0; i < 600 && s.y !== 192; i++) step(w, s, 0);
    assert.equal(s.y, 192);
    // the doorway is on the -z side: yaw 0 faces -z
    for (let i = 0; i < 90; i++) step(w, s, BTN.FWD);
    assert.ok(s.z < 94, 'left the shaft, at z=' + s.z);
    assert.ok(Math.abs(s.y - 192) < 1, 'stands on the deck, at y=' + s.y);
    const y = s.y;
    for (let i = 0; i < 60; i++) step(w, s, 0);
    assert.equal(s.y, y, 'a player on the deck is not carried');
  });

  it('cannot walk out through the wall between stops', () => {
    const w = shaftWorld();
    const s = rider(w, 0, 0, 150);
    for (let i = 0; i < 20; i++) step(w, s, BTN.FWD);
    assert.ok(s.z >= 100, 'stopped by the wall, z=' + s.z);
  });

  it('boards at the top going down, and at the middle going up first', () => {
    const w = shaftWorld();
    const top = rider(w, 0, 384, 150);
    for (let i = 0; i < 2 * LIFT_STOP_WAIT_TICKS + 20; i++) step(w, top, 0);
    assert.ok(top.y < 384, 'the top floor only goes down');
    const mid = rider(w, 0, 192, 150);
    for (let i = 0; i < LIFT_STOP_WAIT_TICKS + 20; i++) step(w, mid, 0);
    assert.ok(mid.y > 192, 'the middle floor goes up first');
  });

  it('is not grounded by the cab once the rider steps out of an open shaft between floors: gravity takes over', () => {
    const b = new MapBuilder();
    b.add(-2000, -32, -2000, 2000, 0, 2000, 'ground');
    const open = new CollisionWorld({ ...getMaps()[0], boxes: b.boxes, lifts: [LIFT] });
    const s = rider(open, 0, 0, 150);
    for (let i = 0; i < LIFT_STOP_WAIT_TICKS + 45; i++) step(open, s, 0);
    assert.ok(s.y > 100 && s.y < 192, 'riding at ' + s.y);
    // yaw -90 degrees faces +x
    let leftAt = -1;
    for (let i = 0; i < 60 && leftAt < 0; i++) {
      step(open, s, BTN.FWD, -Math.PI / 2);
      if (s.x >= LIFT.maxX) leftAt = i;
    }
    assert.ok(leftAt >= 0, 'walked out, at x=' + s.x);
    assert.equal(s.onGround, false, 'nothing under the feet');
    const y = s.y;
    step(open, s, 0, -Math.PI / 2);
    assert.ok(s.y < y, 'falls');
  });

  it('is deterministic: the same inputs give the same heights every time', () => {
    const run = () => {
      const w = shaftWorld();
      const s = rider(w, 10, 0, 150);
      const ys: number[] = [];
      for (let i = 0; i < 600; i++) {
        step(w, s, 0);
        ys.push(s.y);
      }
      return ys;
    };
    assert.deepEqual(run(), run());
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
      for (let i = 0; i < 24; i++) step(world, s, BTN.FWD, yaw);
      assert.ok(Math.abs(s.z) > 560 && Math.abs(s.z) < 672, 'inside the shaft at z=' + s.z);
      for (let i = 0; i < 600 && s.y !== 192; i++) step(world, s, 0, yaw);
      for (let i = 0; i < 90; i++) step(world, s, BTN.FWD, yaw);
      assert.ok(Math.abs(s.z) > 690, 'out on the deck, z=' + s.z);
      assert.ok(Math.abs(s.y - 192) < 1, 'level with the deck, y=' + s.y);
    });

    it(`takes a rider all the way to the Mirante, and brings them back down by itself (${side < 0 ? 'north' : 'south'} half)`, () => {
      const s = rider(world, 0, 0, doorZ(530));
      for (let i = 0; i < 24; i++) step(world, s, BTN.FWD, yaw);
      for (let i = 0; i < 60 * 12 && s.y !== 384; i++) step(world, s, 0, yaw);
      assert.equal(s.y, 384);
      for (let i = 0; i < 30; i++) step(world, s, BTN.FWD, yaw);
      assert.ok(Math.abs(s.z) > 690 && Math.abs(s.y - 384) < 1, 'out on the Mirante at ' + [s.z, s.y]);
      for (let i = 0; i < 40; i++) step(world, s, BTN.BACK, yaw);
      for (let i = 0; i < 60 * 30 && s.y > 0; i++) step(world, s, 0, yaw);
      assert.equal(s.y, 0);
      for (let i = 0; i < 120; i++) step(world, s, BTN.BACK, yaw);
      assert.ok(Math.abs(s.z) < 550, 'walked out into the atrium, z=' + s.z);
    });
  }
});
