import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BTN, CollisionWorld, LIFT_DWELL_RADIUS_UNITS, LIFT_DWELL_SPEED_UNITS, LIFT_SPEED_UNITS, MapBuilder, WEAPON,
  applyCmd, createPlayerState, getMaps, liftAt, liftRide, liftRideSeconds, spawnState, type Cmd, type Lift, type MapDef,
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

  it('climbs at full speed, crawls around the stops in between and holds at both ends', () => {
    assert.equal(liftRide(LIFT, 60, false, 1), 60 + LIFT_SPEED_UNITS);
    assert.equal(liftRide(LIFT, 192, false, 1), 192 + LIFT_DWELL_SPEED_UNITS);
    assert.equal(liftRide(LIFT, 192 + LIFT_DWELL_RADIUS_UNITS + 1, false, 1), 192 + LIFT_DWELL_RADIUS_UNITS + 1 + LIFT_SPEED_UNITS);
    assert.equal(liftRide(LIFT, 380, false, 1), 384, 'never past the last stop');
    assert.equal(liftRide(LIFT, 0, true, 1), 0, 'never below the first stop');
    assert.equal(liftRide(LIFT, 384, false, 1), 384);
    assert.equal(liftRide(LIFT, 384, true, 1), 384 - LIFT_SPEED_UNITS);
  });

  it('takes a few seconds to ride, and the crawl at a stop is the only slow part', () => {
    const toTop = liftRideSeconds(LIFT, 0, 384);
    const toDeck = liftRideSeconds(LIFT, 0, 192);
    assert.ok(toTop > 3 && toTop < 8, 'ground to top took ' + toTop);
    assert.ok(toDeck > 1.5 && toDeck < toTop);
    assert.equal(liftRideSeconds(LIFT, 384, 0) > 3, true, 'down takes as long as up');
  });
});

describe('riding a lift', () => {
  it('carries a standing player from the ground floor to the top floor and holds them there, grounded', () => {
    const w = shaftWorld();
    const s = rider(w, 0, 0, 150);
    let top = 0;
    for (let i = 0; i < 60 * 12; i++) {
      step(w, s, 0);
      top = Math.max(top, s.y);
      assert.ok(s.onGround, 'a rider is always grounded');
    }
    assert.equal(s.y, 384);
    assert.equal(top, 384, 'never above the top stop');
  });

  it('ignores a jump while riding, so hopping cannot outrun the cab', () => {
    const w = shaftWorld();
    const a = rider(w, 0, 0, 150);
    const b = rider(w, 0, 0, 150);
    for (let i = 0; i < 90; i++) {
      step(w, a, 0);
      step(w, b, i % 2 ? BTN.JUMP : 0);
    }
    assert.equal(b.y, a.y);
  });

  it('crawls through an intermediate stop for long enough to walk out of its doorway', () => {
    const w = shaftWorld();
    const s = rider(w, 0, 0, 150);
    let ticksAtDoor = 0;
    for (let i = 0; i < 60 * 8; i++) {
      step(w, s, 0);
      if (s.y >= 192 - 18 && s.y <= 192 + 24) ticksAtDoor++;
    }
    assert.ok(ticksAtDoor >= 60, 'the doorway stays reachable for ' + ticksAtDoor + ' ticks');
  });

  it('steps out onto the deck through the doorway at the stop, and is then not carried any more', () => {
    const w = shaftWorld();
    const s = rider(w, 0, 0, 150);
    for (let i = 0; i < 600 && s.y < 192 - 4; i++) step(w, s, 0);
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

  it('goes down while crouch is held and holds on the ground floor', () => {
    const w = shaftWorld();
    const s = rider(w, 0, 0, 150);
    for (let i = 0; i < 60 * 12; i++) step(w, s, 0);
    assert.equal(s.y, 384);
    let lowest = s.y;
    for (let i = 0; i < 60 * 12; i++) {
      step(w, s, BTN.DUCK);
      lowest = Math.min(lowest, s.y);
    }
    assert.equal(lowest, 0);
    assert.equal(s.y, 0);
  });

  it('turns round mid-shaft: releasing crouch climbs again from where the rider is', () => {
    const w = shaftWorld();
    const s = rider(w, 0, 0, 150);
    for (let i = 0; i < 60 * 12; i++) step(w, s, 0);
    for (let i = 0; i < 40; i++) step(w, s, BTN.DUCK);
    const lowered = s.y;
    assert.ok(lowered < 384);
    for (let i = 0; i < 20; i++) step(w, s, 0);
    assert.ok(s.y > lowered);
  });

  it('is deterministic: the same inputs give the same heights every time', () => {
    const run = () => {
      const w = shaftWorld();
      const s = rider(w, 10, 0, 150);
      const ys: number[] = [];
      for (let i = 0; i < 400; i++) {
        step(w, s, i > 200 ? BTN.DUCK : 0);
        ys.push(s.y);
      }
      return ys;
    };
    assert.deepEqual(run(), run());
  });
});
