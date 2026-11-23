import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { closeTo } from './helpers.ts';
import {
  BTN,
  BTN_MASK,
  CollisionWorld,
  type Cmd,
  LEAN_BODY_SHIFT_UNITS,
  LEAN_HEAD_SHIFT_UNITS,
  LEAN_OFFSET_UNITS,
  LEAN_RATE_PER_TICK,
  LEAN_WALL_MARGIN_UNITS,
  type MapDef,
  MapBuilder,
  PRONE_SWITCH_TICKS,
  SLIDE_BOOST_SPEED,
  SLIDE_STAMINA_COST,
  SLIDE_TICKS,
  SPRINT_OUT_TICKS,
  SPRINT_SPEED_MULT,
  STAMINA_DRAIN_PER_TICK,
  STAMINA_MAX,
  STAMINA_RESUME,
  STANCE,
  STANCES,
  WEAPON,
  applyCmd,
  computeSpread,
  createPlayerState,
  eyeHeight,
  eyePosition,
  getMaps,
  hitboxes,
  hullHeight,
  packState,
  rayHitbox,
  spawnState,
  unpackState,
  weaponDef,
} from '../src/index.ts';

function testMap(build: (b: MapBuilder) => void): CollisionWorld {
  const b = new MapBuilder();
  b.add(-4000, -32, -4000, 4000, 0, 4000, 'ground');
  build(b);
  const map: MapDef = { ...getMaps()[0], boxes: b.boxes };
  return new CollisionWorld(map);
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

function grounded(world: CollisionWorld, x = 0, y = 0.1, z = 0) {
  const s = createPlayerState();
  spawnState(s, x, y, z, 0, WEAPON.RIFLE);
  s.dropping = false;
  s.pitch = 0;
  run(world, s, 10, 0);
  return s;
}

const speedOf = (s: ReturnType<typeof createPlayerState>) => Math.hypot(s.vx, s.vz);
const RUN = BTN.FWD | BTN.SPRINT;

describe('sprint and stamina', () => {
  it('runs faster than a walk and drains the meter', () => {
    const w = testMap(() => {});
    const walker = grounded(w);
    const runner = grounded(w);
    run(w, walker, 90, BTN.FWD);
    run(w, runner, 90, RUN);
    assert.ok(speedOf(runner) > speedOf(walker) * 1.2);
    assert.ok(speedOf(runner) <= weaponDef(WEAPON.RIFLE).speed * SPRINT_SPEED_MULT + 0.01);
    assert.equal(runner.sprinting, true);
    closeTo(runner.stamina, STAMINA_MAX - 90 * STAMINA_DRAIN_PER_TICK, 3);
  });

  it('needs forward, the ground, standing and no back, walk or attack', () => {
    const w = testMap(() => {});
    const sprintsWith = (buttons: number, setup: (s: ReturnType<typeof createPlayerState>) => void = () => {}) => {
      const s = grounded(w);
      setup(s);
      run(w, s, 3, buttons);
      return s.sprinting;
    };
    assert.equal(sprintsWith(RUN), true);
    assert.equal(sprintsWith(BTN.SPRINT), false, 'no forward');
    assert.equal(sprintsWith(RUN | BTN.BACK), false);
    assert.equal(sprintsWith(RUN | BTN.WALK), false);
    assert.equal(sprintsWith(RUN | BTN.ATTACK), false);
    assert.equal(sprintsWith(RUN | BTN.DUCK), false, 'crouched');
    assert.equal(sprintsWith(RUN | BTN.PRONE), false, 'prone');
    const airborne = grounded(w);
    airborne.y = 200;
    airborne.onGround = false;
    run(w, airborne, 1, RUN);
    assert.equal(airborne.sprinting, false);
  });

  it('winds the player at zero and resumes only after the refill threshold', () => {
    const w = testMap(() => {});
    const s = grounded(w);
    run(w, s, Math.ceil(STAMINA_MAX / STAMINA_DRAIN_PER_TICK) + 2, RUN);
    assert.equal(s.winded, true);
    assert.ok(s.stamina < STAMINA_RESUME);
    assert.equal(s.sprinting, false);
    run(w, s, 30, RUN);
    assert.equal(s.sprinting, false, 'still winded');
    assert.ok(s.stamina < STAMINA_RESUME);
    run(w, s, 120, RUN);
    assert.equal(s.winded, false);
    assert.equal(s.sprinting, true);
  });

  it('regenerates while not sprinting', () => {
    const w = testMap(() => {});
    const s = grounded(w);
    s.stamina = 10;
    run(w, s, 60, BTN.FWD);
    assert.ok(s.stamina > 10);
    run(w, s, 600, 0);
    assert.equal(s.stamina, STAMINA_MAX);
  });

  it('ends on attack and keeps the gun down for the sprint-out time', () => {
    const w = testMap(() => {});
    const s = grounded(w);
    run(w, s, 30, RUN);
    const shots = run(w, s, 20, RUN | BTN.ATTACK);
    assert.equal(s.sprinting, false);
    assert.equal(shots[0].tick - (s.tick - 20) , SPRINT_OUT_TICKS + 1);
  });

  it('cannot swing the hammer while sprinting', () => {
    const w = testMap(() => {});
    const s = grounded(w);
    run(w, s, 5, 0, 0, 3);
    run(w, s, 30, RUN);
    const shots = run(w, s, 5, RUN | BTN.ATTACK2);
    assert.equal(s.sprinting, true);
    assert.equal(shots.length, 0);
  });

  it('drops the scope when a sprint starts', () => {
    const w = testMap(() => {});
    const s = grounded(w);
    s.weapon = WEAPON.SNIPER;
    s.zoom = 1;
    run(w, s, 1, RUN);
    assert.equal(s.zoom, 0);
  });

  it('cannot scope in while sprinting', () => {
    const w = testMap(() => {});
    const s = grounded(w);
    s.weapon = WEAPON.SNIPER;
    run(w, s, 5, RUN);
    assert.equal(s.sprinting, true);
    run(w, s, 1, RUN | BTN.ATTACK2);
    assert.equal(s.zoom, 0);
    run(w, s, 1, RUN);
    run(w, s, 1, RUN | BTN.ATTACK2);
    assert.equal(s.zoom, 0);
  });

  it('ends on the command that runs off a ledge, with the sprint-out delay', () => {
    const w = testMap((b) => b.add(-300, -40, -200, 300, 40, 600, 'ground'));
    const s = grounded(w, 0, 40.1, 300);
    run(w, s, 40, RUN);
    s.z = -170;
    run(w, s, 1, RUN);
    assert.equal(s.sprinting, true);
    let left = 0;
    while (s.onGround && left++ < 60) run(w, s, 1, RUN);
    assert.equal(s.onGround, false);
    assert.equal(s.sprinting, false);
    assert.ok(s.nextFire >= s.tick + SPRINT_OUT_TICKS);
  });

  it('keeps its speed through a jump', () => {
    const w = testMap(() => {});
    const s = grounded(w);
    run(w, s, 60, RUN);
    const before = speedOf(s);
    run(w, s, 1, RUN | BTN.JUMP);
    assert.equal(s.onGround, false);
    assert.ok(speedOf(s) >= before - 1);
  });
});

describe('slide', () => {
  const sprinted = (w: CollisionWorld, ticks = 40) => {
    const s = grounded(w);
    run(w, s, ticks, RUN);
    return s;
  };

  it('starts on a crouch press during a sprint, with a push, a crouch hull and a stamina cost', () => {
    const w = testMap(() => {});
    const s = sprinted(w);
    const stamina = s.stamina;
    run(w, s, 1, RUN | BTN.DUCK);
    assert.equal(s.slide, SLIDE_TICKS - 1);
    assert.equal(s.stance, STANCE.CROUCH);
    assert.equal(hullHeight(s), STANCES[STANCE.CROUCH].height);
    assert.ok(speedOf(s) >= SLIDE_BOOST_SPEED * 0.97);
    assert.ok(s.stamina < stamina - SLIDE_STAMINA_COST + 1);
    assert.equal(s.sprinting, false);
  });

  it('does not start without the sprint, the speed, the stamina or a fresh press', () => {
    const w = testMap(() => {});
    const walking = grounded(w);
    walking.weapon = WEAPON.HAMMER;
    run(w, walking, 90, BTN.FWD);
    run(w, walking, 1, BTN.FWD | BTN.DUCK);
    assert.equal(walking.slide, 0, 'speed alone is not enough');

    const slow = sprinted(w, 2);
    run(w, slow, 1, RUN | BTN.DUCK);
    assert.equal(slow.slide, 0, 'too slow');

    const tired = sprinted(w);
    tired.stamina = SLIDE_STAMINA_COST - 1;
    run(w, tired, 1, RUN | BTN.DUCK);
    assert.equal(tired.slide, 0, 'no stamina');

    const held = grounded(w);
    run(w, held, 40, BTN.FWD | BTN.DUCK);
    run(w, held, 40, RUN | BTN.DUCK);
    assert.equal(held.slide, 0, 'duck was already down');
  });

  it('keeps going without the crouch held and ends when its ticks run out', () => {
    const w = testMap(() => {});
    const s = sprinted(w);
    run(w, s, 1, RUN | BTN.DUCK);
    run(w, s, SLIDE_TICKS - 2, BTN.FWD);
    assert.equal(s.slide, 1);
    assert.equal(s.stance, STANCE.CROUCH);
    run(w, s, 1, BTN.FWD);
    assert.equal(s.slide, 0);
    run(w, s, 2, BTN.FWD);
    assert.equal(s.stance, STANCE.STAND);
  });

  it('does not steer while it lasts', () => {
    const w = testMap(() => {});
    const s = sprinted(w);
    run(w, s, 1, RUN | BTN.DUCK);
    const heading = Math.atan2(s.vx, s.vz);
    run(w, s, 10, BTN.RIGHT);
    closeTo(Math.atan2(s.vx, s.vz), heading, 3);
  });

  it('ends when it slows down against a wall', () => {
    const w = testMap((b) => b.add(-200, 0, -330, 200, 200, -310, 'concrete'));
    const s = sprinted(w);
    s.z = -260;
    run(w, s, 1, RUN | BTN.DUCK);
    assert.ok(s.slide > 0);
    run(w, s, 20, 0);
    assert.equal(s.slide, 0);
  });

  it('ends when the player leaves the ground', () => {
    const w = testMap((b) => b.add(-300, -40, -200, 300, 40, 600, 'ground'));
    const s = grounded(w, 0, 40.1, 300);
    run(w, s, 40, RUN);
    s.z = -170;
    run(w, s, 1, RUN | BTN.DUCK);
    assert.ok(s.slide > 0);
    run(w, s, 20, 0);
    assert.equal(s.onGround, false);
    assert.equal(s.slide, 0);
  });

  it('ends with a jump', () => {
    const w = testMap(() => {});
    const s = sprinted(w);
    run(w, s, 1, RUN | BTN.DUCK);
    run(w, s, 1, BTN.FWD | BTN.JUMP);
    assert.equal(s.slide, 0);
    assert.equal(s.onGround, false);
  });
});

describe('prone', () => {
  it('lies down slowly and cannot jump', () => {
    const w = testMap(() => {});
    const s = grounded(w);
    run(w, s, 1, BTN.PRONE);
    assert.equal(s.stance, STANCE.PRONE);
    assert.equal(hullHeight(s), STANCES[STANCE.PRONE].height);
    assert.equal(eyeHeight(s), STANCES[STANCE.PRONE].eye);
    run(w, s, 150, BTN.PRONE | BTN.FWD | BTN.JUMP);
    assert.equal(s.onGround, true);
    closeTo(speedOf(s), weaponDef(WEAPON.RIFLE).speed * STANCES[STANCE.PRONE].speedMult, 1);
  });

  it('holds the stance for the switch lock before it lets go', () => {
    const w = testMap(() => {});
    const s = grounded(w);
    run(w, s, 1, BTN.PRONE);
    run(w, s, 5, 0);
    assert.equal(s.stance, STANCE.PRONE);
    run(w, s, PRONE_SWITCH_TICKS + 2, 0);
    assert.equal(s.stance, STANCE.STAND);
    run(w, s, 1, BTN.PRONE);
    assert.equal(s.stance, STANCE.STAND, 'getting up locked it again');
    run(w, s, PRONE_SWITCH_TICKS, BTN.PRONE);
    assert.equal(s.stance, STANCE.PRONE);
  });

  it('cannot get up under a low ceiling and rises as far as it fits', () => {
    const low = testMap((b) => b.add(-100, 24, -100, 100, 60, 100, 'concrete'));
    const a = grounded(low);
    run(low, a, 1, BTN.PRONE);
    run(low, a, PRONE_SWITCH_TICKS * 3, 0);
    assert.equal(a.stance, STANCE.PRONE);

    const mid = testMap((b) => b.add(-100, 50, -100, 100, 90, 100, 'concrete'));
    const c = grounded(mid);
    run(mid, c, 1, BTN.PRONE);
    run(mid, c, PRONE_SWITCH_TICKS * 3, 0);
    assert.equal(c.stance, STANCE.CROUCH);
  });

  it('shoots tighter than crouched, which shoots tighter than standing', () => {
    const w = testMap(() => {});
    const spreadIn = (buttons: number) => {
      const s = grounded(w);
      run(w, s, 1, buttons);
      run(w, s, PRONE_SWITCH_TICKS, buttons);
      return computeSpread(s);
    };
    const stand = spreadIn(0);
    const crouch = spreadIn(BTN.DUCK);
    const prone = spreadIn(BTN.PRONE);
    assert.ok(prone < crouch && crouch < stand);
  });
});

describe('lean', () => {
  it('ramps to the side at the lean rate and back', () => {
    const w = testMap(() => {});
    const s = grounded(w);
    run(w, s, 1, BTN.LEAN_RIGHT);
    closeTo(s.lean, LEAN_RATE_PER_TICK, 4);
    run(w, s, 20, BTN.LEAN_RIGHT);
    assert.equal(s.lean, 1);
    run(w, s, 20, BTN.LEAN_LEFT);
    assert.equal(s.lean, -1);
    run(w, s, 20, BTN.LEAN_LEFT | BTN.LEAN_RIGHT);
    assert.equal(s.lean, 0);
  });

  it('stops short of a wall', () => {
    const w = testMap((b) => b.add(20, 0, -100, 40, 200, 100, 'concrete'));
    const s = grounded(w);
    run(w, s, 20, BTN.LEAN_RIGHT);
    closeTo(s.lean, (20 - LEAN_WALL_MARGIN_UNITS) / LEAN_OFFSET_UNITS, 3);
    run(w, s, 20, BTN.LEAN_LEFT);
    assert.equal(s.lean, -1);
  });

  it('moves the shot origin sideways, to the right of the view', () => {
    const w = testMap(() => {});
    const s = grounded(w);
    run(w, s, 20, BTN.LEAN_RIGHT);
    const [shot] = run(w, s, 1, BTN.LEAN_RIGHT | BTN.ATTACK);
    closeTo(shot.ox, LEAN_OFFSET_UNITS, 2);
    closeTo(shot.oz, 0, 2);
    closeTo(shot.oy, s.y + eyeHeight(s), 2);
    const turned = grounded(w);
    run(w, turned, 20, BTN.LEAN_RIGHT, Math.PI / 2);
    const eye = eyePosition(turned);
    closeTo(eye.x, 0, 2);
    closeTo(eye.z, -LEAN_OFFSET_UNITS, 2);
  });

  it('is forced to zero while sprinting, sliding, prone or airborne', () => {
    const w = testMap(() => {});
    const leaning = () => {
      const s = grounded(w);
      run(w, s, 20, BTN.LEAN_RIGHT);
      assert.equal(s.lean, 1);
      return s;
    };
    const sprinter = leaning();
    run(w, sprinter, 20, RUN | BTN.LEAN_RIGHT);
    assert.equal(sprinter.lean, 0);

    const lying = leaning();
    run(w, lying, 1, BTN.PRONE | BTN.LEAN_RIGHT);
    run(w, lying, 20, BTN.PRONE | BTN.LEAN_RIGHT);
    assert.equal(lying.lean, 0);

    const jumper = leaning();
    run(w, jumper, 12, BTN.JUMP | BTN.LEAN_RIGHT);
    assert.equal(jumper.onGround, false);
    assert.equal(jumper.lean, 0);

    const slider = grounded(w);
    run(w, slider, 40, RUN);
    run(w, slider, 1, RUN | BTN.DUCK | BTN.LEAN_RIGHT);
    run(w, slider, 12, BTN.LEAN_RIGHT);
    assert.ok(slider.slide > 0);
    assert.equal(slider.lean, 0);
  });
});

describe('hitboxes', () => {
  const center = (box: number[]) => [(box[0] + box[3]) / 2, (box[2] + box[5]) / 2];

  it('are built from the stance table', () => {
    for (const stance of [STANCE.STAND, STANCE.CROUCH, STANCE.PRONE]) {
      const [head, body, legs] = hitboxes(0, 0, 0, stance, 0, 0);
      const def = STANCES[stance];
      assert.deepEqual([head[1], head[4]], [def.head.y0, def.head.y1]);
      assert.deepEqual([body[1], body[4]], [def.body.y0, def.body.y1]);
      assert.deepEqual([legs[1], legs[4]], [def.legs.y0, def.legs.y1]);
    }
  });

  it('shift the head and body along the right vector and leave the legs', () => {
    const [head, body, legs] = hitboxes(0, 0, 0, STANCE.STAND, 1, 0);
    closeTo(center(head)[0], LEAN_HEAD_SHIFT_UNITS);
    closeTo(center(body)[0], LEAN_BODY_SHIFT_UNITS);
    closeTo(center(legs)[0], 0);
    const [turnedHead] = hitboxes(0, 0, 0, STANCE.STAND, 1, Math.PI / 2);
    closeTo(center(turnedHead)[0], 0);
    closeTo(center(turnedHead)[1], -LEAN_HEAD_SHIFT_UNITS);
    const [leftHead] = hitboxes(0, 0, 0, STANCE.STAND, -1, 0);
    closeTo(center(leftHead)[0], -LEAN_HEAD_SHIFT_UNITS);
  });

  it('let a shot find a leaned head that the whole-hull reject would cut off', () => {
    const headY = STANCES[STANCE.STAND].head.y1 - 3;
    const throughLeanedHead = (lean: number) => rayHitbox(LEAN_HEAD_SHIFT_UNITS, headY, 300, 0, 0, -1, 0, 0, 0, STANCE.STAND, lean, 0, 1000);
    assert.equal(throughLeanedHead(0), null);
    assert.equal(throughLeanedHead(1)?.zone, 0);
  });

  it('see a prone player low to the ground', () => {
    assert.equal(rayHitbox(0, 60, 300, 0, 0, -1, 0, 0, 0, STANCE.PRONE, 0, 0, 1000), null);
    assert.ok(rayHitbox(0, 10, 300, 0, 0, -1, 0, 0, 0, STANCE.PRONE, 0, 0, 1000));
  });
});

describe('spawn and buttons', () => {
  it('spawn restores full stamina and a clean stance', () => {
    const s = createPlayerState();
    Object.assign(s, { stance: STANCE.PRONE, stamina: 3, winded: true, slide: 9, lean: 0.5, stanceLock: 7, sprinting: true, duckHeld: true });
    spawnState(s, 0, 0, 0, 0, WEAPON.RIFLE);
    assert.deepEqual(
      { stance: s.stance, stamina: s.stamina, winded: s.winded, slide: s.slide, lean: s.lean, stanceLock: s.stanceLock, sprinting: s.sprinting, duckHeld: s.duckHeld },
      { stance: STANCE.STAND, stamina: STAMINA_MAX, winded: false, slide: 0, lean: 0, stanceLock: 0, sprinting: false, duckHeld: false },
    );
  });

  it('are distinct bits that the mask covers', () => {
    const bits = Object.values(BTN);
    assert.equal(new Set(bits).size, bits.length);
    for (const bit of bits) assert.equal(bit & (bit - 1), 0, 'one bit each');
    assert.equal(bits.reduce((all, bit) => all | bit, 0), BTN_MASK);
  });
});

describe('packed state', () => {
  it('round-trips every stance, sprint, slide, lean and stamina field', () => {
    const a = createPlayerState();
    Object.assign(a, {
      stance: STANCE.PRONE,
      duckHeld: true,
      sprinting: true,
      stamina: 41.2345,
      winded: true,
      slide: 17,
      lean: -0.56,
      stanceLock: 9,
      onGround: true,
    });
    a.mag[WEAPON.SMG] = 12;
    a.reserve[WEAPON.PISTOL] = 33;
    const b = createPlayerState();
    unpackState(packState(a), b);
    assert.partialDeepStrictEqual(b, { stance: STANCE.PRONE, duckHeld: true, sprinting: true, winded: true, slide: 17, lean: -0.56, stanceLock: 9, onGround: true });
    closeTo(b.stamina, 41.2345, 4);
    assert.equal(b.mag[WEAPON.SMG], 12);
    assert.equal(b.reserve[WEAPON.PISTOL], 33);
    for (const stance of [STANCE.STAND, STANCE.CROUCH]) {
      a.stance = stance;
      unpackState(packState(a), b);
      assert.equal(b.stance, stance);
    }
  });

  it('keeps the sprint decision identical when a winded player is reconciled mid-recovery', () => {
    const w = testMap(() => {});
    const server = grounded(w);
    server.stamina = 0;
    server.winded = true;
    run(w, server, 89, 0);
    const client = createPlayerState();
    unpackState(packState(server), client);
    for (let i = 0; i < 4; i++) {
      run(w, server, 1, RUN);
      run(w, client, 1, RUN);
      assert.equal(client.winded, server.winded, 'winded, tick ' + i);
      assert.equal(client.sprinting, server.sprinting, 'sprinting, tick ' + i);
      assert.equal(client.stamina, server.stamina, 'stamina, tick ' + i);
    }
  });

  it('carries stamina and lean to the exact value', () => {
    const a = createPlayerState();
    a.stamina = 24.722222222222;
    a.lean = 0.123456789;
    const b = createPlayerState();
    unpackState(packState(a), b);
    assert.equal(b.stamina, a.stamina);
    assert.equal(b.lean, a.lean);
  });
});
