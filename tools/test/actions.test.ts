import { describe, it, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BTN, CollisionWorld, MapBuilder, SLIDE_MIN_SPEED, SLIDE_STAMINA_COST, STAMINA_MAX, STANCE, WEAPON,
  applyCmd, createPlayerState, getMaps, spawnState,
  type Cmd, type MapDef, type WeaponId,
} from '../../shared/src/index.ts';
import { ActionOverlay } from '../mcp/actions.ts';
import * as actions from '../mcp/actions.ts';

const cmd = (buttons = 0, seq = 1): Cmd => ({ seq, buttons, yaw: 0, pitch: 0, weapon: 0, interp: 0 });
function player(weapon: WeaponId = WEAPON.SNIPER) {
  const s = createPlayerState();
  s.weapon = weapon;
  s.onGround = true;
  return s;
}
const pressed = (c: Cmd, b: number) => (c.buttons & b) !== 0;

test('crouch is latched on every cmd, even without a player snapshot', () => {
  const o = new ActionOverlay();
  o.crouch = true;
  assert.ok(pressed(o.apply(cmd(), null), BTN.DUCK));
  assert.ok(pressed(o.apply(cmd(), player()), BTN.DUCK));
  o.crouch = false;
  assert.ok(!pressed(o.apply(cmd(), player()), BTN.DUCK));
  assert.ok(pressed(o.apply(cmd(BTN.DUCK), player()), BTN.DUCK), 'keeps the brain duck');
});

test('apply does not mutate the incoming cmd', () => {
  const o = new ActionOverlay();
  o.crouch = true;
  const input = cmd();
  o.apply(input, player());
  assert.equal(input.buttons, 0);
});

test('jump pulses JUMP on exactly one apply', () => {
  const o = new ActionOverlay();
  o.requestJump();
  assert.ok(pressed(o.apply(cmd(), player()), BTN.JUMP));
  assert.ok(!pressed(o.apply(cmd(), player()), BTN.JUMP));
});

test('jump is dropped, not queued, when airborne', () => {
  const o = new ActionOverlay();
  const s = player();
  s.onGround = false;
  o.requestJump();
  assert.ok(!pressed(o.apply(cmd(), s), BTN.JUMP));
  s.onGround = true;
  assert.ok(!pressed(o.apply(cmd(), s), BTN.JUMP));
});

test('zoom presses once and only presses again after the server acknowledged that press', () => {
  const o = new ActionOverlay();
  const s = player();
  o.zoom = 1;
  assert.ok(pressed(o.apply(cmd(0, 1), s), BTN.ATTACK2));
  // high latency: no snapshot has caught up for a long time, so never repeat on a timer
  for (let seq = 2; seq <= 200; seq++) assert.ok(!pressed(o.apply(cmd(0, seq), s), BTN.ATTACK2), 'seq ' + seq);
  o.ack = 0;
  assert.ok(!pressed(o.apply(cmd(0, 201), s), BTN.ATTACK2));
  o.ack = 1; // snapshot now reflects the press; scope still not at 1, so press again
  assert.ok(pressed(o.apply(cmd(0, 202), s), BTN.ATTACK2));
  assert.ok(!pressed(o.apply(cmd(0, 203), s), BTN.ATTACK2));
});

test('zoom never presses once the snapshot shows the wanted level', () => {
  const o = new ActionOverlay();
  const s = player();
  s.zoom = 1;
  o.zoom = 1;
  for (let i = 0; i < 40; i++) assert.ok(!pressed(o.apply(cmd(), s), BTN.ATTACK2));
});

test('zoom cycles 1 to 2 and wraps 2 to 0 with a single press each', () => {
  const up = new ActionOverlay();
  const s = player();
  s.zoom = 1;
  up.zoom = 2;
  assert.ok(pressed(up.apply(cmd(), s), BTN.ATTACK2));
  const off = new ActionOverlay();
  s.zoom = 2;
  off.zoom = 0;
  assert.ok(pressed(off.apply(cmd(), s), BTN.ATTACK2));
});

test('a manual zoom strips the brain auto-scope; null leaves it', () => {
  const manual = new ActionOverlay();
  const s = player();
  s.zoom = 1;
  manual.zoom = 1;
  assert.ok(!pressed(manual.apply(cmd(BTN.ATTACK2), s), BTN.ATTACK2));
  const auto = new ActionOverlay();
  assert.ok(pressed(auto.apply(cmd(BTN.ATTACK2), s), BTN.ATTACK2));
});

test('a weapon without a scope never gets ATTACK2 from zoom', () => {
  const o = new ActionOverlay();
  o.zoom = 1;
  for (let i = 0; i < 40; i++) assert.ok(!pressed(o.apply(cmd(), player(WEAPON.RIFLE)), BTN.ATTACK2));
});

test('during the AWP bolt cycle zoom 0 cancels the re-scope and a positive level waits', () => {
  const s = player();
  s.resumeZoom = 1;
  const off = new ActionOverlay();
  off.zoom = 0;
  assert.ok(pressed(off.apply(cmd(), s), BTN.ATTACK2));
  const on = new ActionOverlay();
  on.zoom = 1;
  assert.ok(!pressed(on.apply(cmd(), s), BTN.ATTACK2));
});

test('reset forgets an unacknowledged scope press', () => {
  const o = new ActionOverlay();
  const s = player();
  o.zoom = 1;
  assert.ok(pressed(o.apply(cmd(0, 5), s), BTN.ATTACK2));
  o.reset();
  o.zoom = 1;
  assert.ok(pressed(o.apply(cmd(0, 6), s), BTN.ATTACK2));
});

test('reset clears crouch, zoom and a pending jump', () => {
  const o = new ActionOverlay();
  o.crouch = true;
  o.zoom = 2;
  o.requestJump();
  o.reset();
  const out = o.apply(cmd(), player());
  assert.equal(out.buttons, 0);
  assert.equal(o.crouch, false);
  assert.equal(o.zoom, null);
});

test('walk latches on every apply, releases on off and resets', () => {
  const o = new ActionOverlay();
  o.walk = true;
  assert.ok(pressed(o.apply(cmd(), null), BTN.WALK));
  assert.ok(pressed(o.apply(cmd(), player()), BTN.WALK));
  o.walk = false;
  assert.ok(!pressed(o.apply(cmd(), player()), BTN.WALK));
  assert.ok(pressed(o.apply(cmd(BTN.WALK), player()), BTN.WALK));
  o.walk = true;
  o.reset();
  assert.equal(o.walk, false);
  assert.ok(!pressed(o.apply(cmd(), player()), BTN.WALK));
});

test('reload is consumed on exactly one apply and reset clears a pending reload', () => {
  const o = new ActionOverlay();
  o.requestReload();
  assert.ok(pressed(o.apply(cmd(), player()), BTN.RELOAD));
  assert.ok(!pressed(o.apply(cmd(), player()), BTN.RELOAD));
  o.requestReload();
  o.reset();
  assert.ok(!pressed(o.apply(cmd(), player()), BTN.RELOAD));
});

test('weapon requests override the brain on one apply without mutating its command', () => {
  for (const request of [1, 2, 3, 4] as const) {
    const o = new ActionOverlay();
    const input = { ...cmd(), weapon: 2 };
    o.requestWeapon(request);
    assert.equal(o.apply(input, player()).weapon, request);
    assert.equal(input.weapon, 2);
    o.ack = input.seq;
    assert.equal(o.apply(input, player()).weapon, 2);
    o.requestWeapon(request);
    o.reset();
    assert.equal(o.apply(cmd(), player()).weapon, 0);
  }
});

test('weapon request suppresses stale brain switches until acknowledged and reset clears it', () => {
  const overlay = new ActionOverlay();
  overlay.requestWeapon(3);
  const brain = { ...cmd(0, 5), weapon: 2 };
  assert.equal(overlay.apply(brain, player()).weapon, 3);
  assert.equal(overlay.apply({ ...brain, seq: 6 }, player()).weapon, 0);
  overlay.ack = 5;
  assert.equal(overlay.apply({ ...brain, seq: 7 }, player()).weapon, 2);
  overlay.requestWeapon(3);
  overlay.apply({ ...brain, seq: 8 }, player());
  overlay.reset();
  assert.equal(overlay.apply(brain, player()).weapon, 2);
});

test('weaponSlots returns available slots', () => {
  const self = player(WEAPON.RIFLE);
  self.primary = WEAPON.RIFLE;
  self.lastWeapon = WEAPON.PISTOL;
  assert.deepEqual(actions.weaponSlots(self), {
    primary: WEAPON.RIFLE, pistol: WEAPON.PISTOL, hammer: WEAPON.HAMMER, last: WEAPON.PISTOL,
  });
});

test('weaponSlots hides the current weapon from last', () => {
  const self = player(WEAPON.PISTOL);
  self.lastWeapon = self.weapon;
  assert.equal(actions.weaponSlots(self).last, null);
});

test('weaponSlots hides a primary replaced by an airdrop', () => {
  const self = player(WEAPON.SNIPER);
  self.primary = WEAPON.SNIPER;
  self.lastWeapon = WEAPON.RIFLE;
  assert.equal(actions.weaponSlots(self).last, null);
});

test('manual use holds through both commands, stops movement and fire, and resets', () => {
  const o = new ActionOverlay();
  o.use = true;
  for (let seq = 1; seq <= 2; seq++) {
    const result = o.apply(cmd(BTN.FWD | BTN.RIGHT | BTN.JUMP | BTN.ATTACK | BTN.ATTACK2, seq), player());
    assert.equal(result.buttons, BTN.USE);
  }
  assert.equal(o.apply(cmd(), null).buttons & BTN.USE, 0);
  o.reset();
  assert.equal(o.apply(cmd(), player()).buttons & BTN.USE, 0);
});

/** What the server's last snapshot would show for a player running flat out. */
function sprinter() {
  const s = player(WEAPON.RIFLE);
  Object.assign(s, { sprinting: true, vx: SLIDE_MIN_SPEED + 60, stamina: STAMINA_MAX });
  return s;
}

test('sprint latches SPRINT on every cmd, even without a player snapshot, and releases', () => {
  const o = new ActionOverlay();
  o.sprint = true;
  assert.ok(pressed(o.apply(cmd(), null), BTN.SPRINT));
  assert.ok(pressed(o.apply(cmd(BTN.FWD), player()), BTN.SPRINT | BTN.FWD));
  o.sprint = false;
  assert.ok(!pressed(o.apply(cmd(), player()), BTN.SPRINT));
});

test('lean maps each side to its own button and off releases both', () => {
  const o = new ActionOverlay();
  o.lean = 'left';
  assert.equal(o.apply(cmd(), player()).buttons, BTN.LEAN_LEFT);
  o.lean = 'right';
  assert.equal(o.apply(cmd(), player()).buttons, BTN.LEAN_RIGHT);
  o.lean = 'off';
  assert.equal(o.apply(cmd(), player()).buttons, 0);
});

test('prone latches PRONE on every cmd and releases', () => {
  const o = new ActionOverlay();
  o.prone = true;
  assert.ok(pressed(o.apply(cmd(), null), BTN.PRONE));
  assert.ok(pressed(o.apply(cmd(), player()), BTN.PRONE));
  o.prone = false;
  assert.ok(!pressed(o.apply(cmd(), player()), BTN.PRONE));
});

test('reset releases sprint, lean, prone and a pending slide', () => {
  const o = new ActionOverlay();
  o.sprint = true;
  o.lean = 'left';
  o.prone = true;
  o.requestSlide();
  o.reset();
  assert.equal(o.apply(cmd(), sprinter()).buttons, 0);
  assert.deepEqual(o.echo(), { crouch: false, walk: false, zoom: null, sprint: false, lean: 'off', prone: false });
});

test('slide presses DUCK on exactly one apply and does not mutate the incoming cmd', () => {
  const o = new ActionOverlay();
  const input = cmd(BTN.FWD | BTN.SPRINT);
  o.requestSlide();
  assert.ok(pressed(o.apply(input, sprinter()), BTN.DUCK));
  assert.equal(input.buttons, BTN.FWD | BTN.SPRINT);
  assert.ok(!pressed(o.apply(input, sprinter()), BTN.DUCK));
});

test('a slide request is dropped, not queued, when the state no longer allows it', () => {
  const o = new ActionOverlay();
  const slow = sprinter();
  slow.vx = 10;
  o.requestSlide();
  assert.ok(!pressed(o.apply(cmd(), slow), BTN.DUCK));
  assert.ok(!pressed(o.apply(cmd(), sprinter()), BTN.DUCK), 'the request is gone once the state recovers');
  o.requestSlide();
  assert.ok(!pressed(o.apply(cmd(), null), BTN.DUCK), 'no snapshot, no press');
});

test('slideBlocker names what stops a slide, and is null when it would start', () => {
  const o = new ActionOverlay();
  assert.equal(o.slideBlocker(sprinter()), null);
  const blocked = (mutate: (s: ReturnType<typeof sprinter>) => void) => {
    const s = sprinter();
    mutate(s);
    return o.slideBlocker(s);
  };
  assert.match(blocked((s) => { s.sprinting = false; }) ?? '', /Not sprinting/);
  assert.match(blocked((s) => { s.onGround = false; }) ?? '', /Not on the ground/);
  assert.match(blocked((s) => { s.slide = 5; }) ?? '', /Already sliding/);
  assert.match(blocked((s) => { s.vx = SLIDE_MIN_SPEED - 1; }) ?? '', /Too slow/);
  assert.match(blocked((s) => { s.stamina = SLIDE_STAMINA_COST - 1; }) ?? '', /Not enough stamina/);
  assert.match(blocked((s) => { s.dropping = true; }) ?? '', /dropping/);
  o.crouch = true;
  assert.match(o.slideBlocker(sprinter()) ?? '', /crouch\(false\)/);
  o.crouch = false;
  o.prone = true;
  assert.match(o.slideBlocker(sprinter()) ?? '', /prone\(false\)/);
});

test('sprintBlockers lists the latched actions that stop a sprint', () => {
  const o = new ActionOverlay();
  assert.deepEqual(o.sprintBlockers(), []);
  o.walk = true;
  o.prone = true;
  assert.deepEqual(o.sprintBlockers(), ['walk', 'prone']);
});

/** The overlay drives the real sim, so the blocker and the sim cannot drift apart. */
describe('slide request against the movement sim', () => {
  const flat = () => {
    const b = new MapBuilder();
    b.add(-4000, -32, -4000, 4000, 0, 4000, 'ground');
    const map: MapDef = { ...getMaps()[0], boxes: b.boxes };
    return new CollisionWorld(map);
  };
  let seq = 0;
  const run = (world: CollisionWorld, o: ActionOverlay, s: ReturnType<typeof createPlayerState>, ticks: number) => {
    for (let i = 0; i < ticks; i++) applyCmd(world, s, o.apply(cmd(BTN.FWD, ++seq), s), 7);
  };
  const standing = (world: CollisionWorld) => {
    const s = createPlayerState();
    spawnState(s, 0, 0.1, 0, 0, WEAPON.RIFLE);
    s.dropping = false;
    s.pitch = 0;
    run(world, new ActionOverlay(), s, 10);
    return s;
  };
  /** Requests a slide when the blocker allows it and returns what the sim did with that command. */
  const trySlide = (world: CollisionWorld, o: ActionOverlay, s: ReturnType<typeof createPlayerState>) => {
    const blocker = o.slideBlocker(s);
    if (blocker === null) o.requestSlide();
    run(world, o, s, 1);
    return { blocker, slid: s.slide > 0 };
  };

  type Sim = ReturnType<typeof createPlayerState>;
  const cases: { name: string; ticks: number; tweak?: (s: Sim) => void; slides: boolean }[] = [
    { name: 'running flat out', ticks: 40, slides: true },
    { name: 'too slow', ticks: 2, slides: false },
    { name: 'out of stamina', ticks: 40, tweak: (s) => { s.stamina = SLIDE_STAMINA_COST - 1; }, slides: false },
    { name: 'in the air', ticks: 40, tweak: (s) => { s.y = 200; s.onGround = false; }, slides: false },
  ];
  for (const { name, ticks, tweak, slides } of cases) {
    it(name + ': the blocker is null exactly when the sim starts a slide', () => {
      const world = flat();
      const o = new ActionOverlay();
      o.sprint = true;
      const s = standing(world);
      run(world, o, s, ticks);
      tweak?.(s);
      const { blocker, slid } = trySlide(world, o, s);
      assert.equal(slid, slides, String(blocker));
      assert.equal(blocker === null, slides);
      if (slides) assert.equal(s.stance, STANCE.CROUCH);
    });
  }

  it('a second slide request while sliding is refused and the sim agrees', () => {
    const world = flat();
    const o = new ActionOverlay();
    o.sprint = true;
    const s = standing(world);
    run(world, o, s, 40);
    assert.equal(trySlide(world, o, s).slid, true);
    const again = o.slideBlocker(s);
    assert.match(again ?? '', /Already sliding/);
  });
});
