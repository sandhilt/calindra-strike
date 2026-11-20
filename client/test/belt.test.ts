import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPON, reloadCursor, weaponDef } from '@calindra-strike/shared';
import { BELT_BURST_S, BELT_FLOW_SLOTS_PER_S, BELT_PATH, TRACER_EVERY, TRAY_CLEAR_UNITS, TRAY_LIFT_UNITS, type BeltFlow, type BeltPoint, isTracer, linkPlacement, pointAlong, reachedPath, stepBeltFlow } from '../src/game/render/belt-anim.ts';
import { reloadPose } from '../src/game/render/reload-anim.ts';
import { QUALITY, QUALITY_TIERS } from '../src/game/render/quality.ts';
import { buildWeapon } from '../src/game/render/weapons3d.ts';

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);

test('the belt path starts at the box and ends on the feed tray, and rounds are spaced by distance', () => {
  for (const [u, expected] of [[0, BELT_PATH[0]], [1, BELT_PATH[BELT_PATH.length - 1]]] as const) {
    const p = pointAlong(BELT_PATH, u);
    near(p.x, expected.x);
    near(p.y, expected.y);
    near(p.z, expected.z);
  }
  const step = (u: number) => {
    const a = pointAlong(BELT_PATH, u);
    const b = pointAlong(BELT_PATH, u + 0.05);
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  };
  for (const u of [0, 0.2, 0.4, 0.6, 0.8, 0.95]) near(step(u), step(0), 0.35);
});

test('rounds appear out of the box and are eaten at the tray, and are full size along the rest of the belt', () => {
  const count = 10;
  const sizes = Array.from({ length: count }, (_, i) => linkPlacement(i, count, 0.5, 1).scale);
  assert.ok(sizes.every((s) => s > 0 && s <= 1));
  assert.equal(linkPlacement(0, count, 0, 1).scale, 0, 'a round at the box mouth has not come out yet');
  near(linkPlacement(count - 1, count, 0.999, 1).scale, 0, 0.01);
  assert.equal(linkPlacement(4, count, 0, 1).scale, 1);
});

test('feeding one round moves the belt one slot, and the wrap from one round to the next does not jump', () => {
  const count = 8;
  const visible = (feed: number) =>
    Array.from({ length: count }, (_, i) => linkPlacement(i, count, feed, 1))
      .filter((p) => p.scale > 0.01)
      .map((p) => [p.position.x, p.position.y, p.position.z, p.scale].map((v) => Math.round(v * 100) / 100).join())
      .sort();
  assert.deepEqual(visible(0.9999), visible(1.0001), 'same rounds in the same places either side of the wrap');
  assert.deepEqual(visible(3), visible(0), 'whole rounds fed repeat the pattern');
  const before = linkPlacement(3, count, 0, 1).position;
  const after = linkPlacement(3, count, 0.5, 1).position;
  assert.ok(after.y > before.y, 'the belt climbs toward the tray as rounds are fed');
});

test('lifting the belt raises its tray end and barely moves the end at the box', () => {
  const count = 10;
  const rise = (i: number) => linkPlacement(i, count, 0.3, 0).position.y - linkPlacement(i, count, 0.3, 1).position.y;
  assert.ok(rise(0) < 0.1, 'the round at the box stays put');
  for (let i = 0; i < count; i++) assert.ok(rise(i) >= -1e-9 && rise(i) <= TRAY_LIFT_UNITS + 1e-9, `round ${i} rises by no more than the lift`);
  assert.ok(rise(count - 1) > 0.7 * TRAY_LIFT_UNITS, 'the end of the belt is clearly lifted');
  for (let i = 1; i < count; i++) assert.ok(rise(i) >= rise(i - 1) - 1e-9, 'the rise grows toward the tray end');
});

test('swinging the belt clear moves the tray end out to the left of the gun and leaves the box end alone', () => {
  const count = 10;
  const shift = (i: number) => linkPlacement(i, count, 0.3, 1, 1).position.x - linkPlacement(i, count, 0.3, 1, 0).position.x;
  assert.ok(Math.abs(shift(0)) < 0.2, 'the round at the box stays put');
  assert.ok(shift(count - 1) < -0.7 * TRAY_CLEAR_UNITS, 'the end is well clear of the receiver');
});

/** Distance between neighbouring rounds, over every round of a belt of `count`. */
const spacings = (count: number, feed: number, laid: number, clear: number, fall: BeltPoint = { x: 0, y: 0, z: 0 }): number[] => {
  const bent = reachedPath(laid, clear, fall);
  const at = Array.from({ length: count }, (_, i) => linkPlacement(i, count, feed, laid, clear, bent).position);
  return at.slice(1).map((p, i) => Math.hypot(p.x - at[i].x, p.y - at[i].y, p.z - at[i].z));
};

test('a belt that is lifted, swung out or hanging from the hand stays one chain, with no gap or bunching between rounds', () => {
  const rest = spacings(10, 0, 1, 0);
  const nominal = rest.reduce((sum, d) => sum + d, 0) / rest.length;
  for (const count of [4, 6, 10]) {
    const unit = nominal * (10 / count);
    for (const laid of [1, 0.5, 0]) {
      for (const clear of [0, 0.5, 1]) {
        for (const feed of [0, 0.3, 0.6, 0.9]) {
          for (const fall of [0, 3, 12]) {
            for (const d of spacings(count, feed, laid, clear, { x: 0, y: -fall, z: 0 })) {
              const ratio = d / unit;
              assert.ok(ratio > 0.5 && ratio < 2.6, `spacing ${ratio.toFixed(2)}x at ${count} rounds, laid ${laid}, clear ${clear}, feed ${feed}, fall ${fall}`);
            }
          }
        }
      }
    }
  }
});

test('a belt held by the hand hangs from it while the box falls, and one lying on the tray falls with the box', () => {
  const count = 10;
  const tip = (laid: number, clear: number, fall: number) => linkPlacement(count - 1, count, 0.3, laid, clear, reachedPath(laid, clear, { x: 0, y: -fall, z: 0 })).position;
  const mouth = (laid: number, clear: number, fall: number) => linkPlacement(0, count, 0.3, laid, clear, reachedPath(laid, clear, { x: 0, y: -fall, z: 0 })).position;
  assert.ok(tip(1, 0, 0).y - tip(1, 0, 12).y > 11, 'on the tray, the whole belt goes down with the box');
  const held = tip(0, 1, 0).y - tip(0, 1, 12).y;
  assert.ok(held < 0.45 * 12, 'in the hand, the tray end drops only a part of the way');
  assert.ok(mouth(0, 1, 0).y - mouth(0, 1, 12).y > 11, 'the box end still goes all the way down with the box');
});

test('the last round of a lifted belt stays whole instead of being eaten by the gun', () => {
  const count = 10;
  const last = (laid: number, clear: number) => linkPlacement(count - 1, count, 0.3, laid, clear).scale;
  near(last(1, 0), 0.7, 1e-9);
  assert.equal(last(0, 0), 1);
  assert.equal(last(1, 1), 1);
  const lifting = Array.from({ length: 11 }, (_, i) => last(1 - i / 10, 0));
  for (let i = 1; i < lifting.length; i++) assert.ok(lifting[i] >= lifting[i - 1] - 1e-9, 'it grows back smoothly as the belt lifts, it does not pop');
});

/** The body of the machine gun the belt must stay out of, in the gun's own units (see weapons3d). */
const RECEIVER = { x: [-2.3, 2.3], y: [-1.5, 4.5], z: [-12, 6] } as const;

test('through the whole machine gun reload, no round of the belt sits inside the receiver', () => {
  const timing = weaponDef(WEAPON.LMG).reloadTiming;
  assert.ok(timing?.kind === 'magazine');
  const total = timing.outTicks + timing.inTicks + timing.boltTicks;
  const count = QUALITY.high.fx.beltLinks;
  for (let tick = 0; tick < total; tick++) {
    const pose = reloadPose(reloadCursor(timing, tick, 0));
    const fall = (pose.magGone ? pose.spareLift : pose.magDrop) * 12;
    const bent = reachedPath(pose.beltLaid, pose.beltClear, { x: 0, y: -fall, z: 0 });
    for (const feed of [0, 0.5]) {
      // The first rounds come out of the mouth of the box, which sits in the receiver, so only what has come out is checked.
      for (let i = 2; i < count; i++) {
        const { position: p, scale } = linkPlacement(i, count, feed, pose.beltLaid, pose.beltClear, bent);
        if (scale < 0.5) continue;
        const inside = p.x > RECEIVER.x[0] && p.x < RECEIVER.x[1] && p.y > RECEIVER.y[0] && p.y < RECEIVER.y[1] && p.z > RECEIVER.z[0] && p.z < RECEIVER.z[1];
        assert.ok(!inside, `round ${i} at tick ${tick} is inside the receiver (${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`);
      }
    }
  }
});

test('the belt hangs from the box without a jump where the fresh box takes over from the old one', () => {
  const timing = weaponDef(WEAPON.LMG).reloadTiming;
  assert.ok(timing?.kind === 'magazine');
  let last = 0;
  let worst = 0;
  for (let s = 0; s < timing.outTicks * 8; s++) {
    const pose = reloadPose(reloadCursor(timing, s / 8, 0));
    const fall = pose.magGone ? pose.spareLift : pose.magDrop;
    if (s > 0) worst = Math.max(worst, Math.abs(fall - last));
    last = fall;
  }
  assert.ok(worst < 0.01, `the belt moves ${worst.toFixed(3)} of the fall in one eighth of a tick`);
});

test('one round in four is a tracer and it keeps its look as the belt carries it along', () => {
  const lit = Array.from({ length: 12 }, (_, i) => isTracer(i, 0));
  assert.equal(lit.filter(Boolean).length, 3);
  for (let i = 0; i < 12; i++) assert.equal(lit[i], i % TRACER_EVERY === 0);
  for (const feed of [0, 1, 2, 3, 7, 41]) {
    for (let i = 0; i < 8; i++) assert.equal(isTracer(i + 1, feed + 1), isTracer(i, feed), 'the round that moves into the next slot is still the same round');
  }
});

test('the belt flows at a steady pace while firing and coasts to a stop after, without a jerk on every shot', () => {
  const flow: BeltFlow = { feed: 0, speed: 0, burst: 0 };
  const dt = 1 / 60;
  const steps: number[] = [];
  let shots = 0;
  for (let tick = 0; tick < 120; tick++) {
    if (tick % 5 === 0) {
      flow.burst = BELT_BURST_S;
      shots++;
    }
    const before = flow.feed;
    stepBeltFlow(flow, dt);
    steps.push(flow.feed - before);
  }
  const settled = steps.slice(60);
  assert.ok(Math.max(...settled) < 0.12, 'a slice of a slot per frame, never a whole slot');
  assert.ok(Math.max(...settled) - Math.min(...settled) < 0.01, 'the same speed on the frame of a shot and between shots');
  near(flow.speed, BELT_FLOW_SLOTS_PER_S, 0.2);
  const perShot = (flow.feed - 0) / shots;
  assert.ok(Math.abs(perShot - Math.round(perShot)) > 0.2, 'not a whole number of slots per shot, which is what made the belt shimmer');
  const stopped = flow.feed;
  for (let tick = 0; tick < 120; tick++) stepBeltFlow(flow, dt);
  assert.ok(flow.feed - stopped < 0.6, 'it coasts a little and stops');
  const parked = flow.feed;
  stepBeltFlow(flow, dt);
  assert.ok(Math.abs(flow.feed - parked) < 1e-3, 'a gun that is not firing leaves the belt where it is');
});

test('the machine gun opens its cover, takes the belt off, lays a new one and shuts the cover before the bolt', () => {
  const timing = weaponDef(WEAPON.LMG).reloadTiming;
  assert.ok(timing?.kind === 'magazine');
  const at = (frac: number) => reloadPose(reloadCursor(timing, Math.floor((timing.outTicks + timing.inTicks + timing.boltTicks) * frac), 0));
  const total = timing.outTicks + timing.inTicks + timing.boltTicks;
  const out = (f: number) => at((timing.outTicks * f) / total);
  const inn = (f: number) => at((timing.outTicks + timing.inTicks * f) / total);
  const bolt = (f: number) => at((timing.outTicks + timing.inTicks + timing.boltTicks * f) / total);
  assert.equal(out(0).cover, 0, 'shut when the reload starts');
  assert.equal(out(0).beltLaid, 1, 'belt on the tray when the reload starts');
  assert.ok(out(0.5).cover > 0.99, 'wide open before the box falls away');
  assert.ok(out(0.99).beltLaid < 0.01, 'belt is off the tray by the end of the out phase');
  assert.ok(inn(0.1).cover > 0.99 && inn(0.1).beltLaid < 0.01, 'still open with the belt out while the new box rises');
  assert.ok(inn(0.8).beltLaid < 0.01, 'the belt is not set down while the new box is only just seated');
  assert.ok(inn(0.93).beltLaid > 0.9 && inn(0.93).cover > 0.9, 'belt set down with the cover still open, which then slaps shut');
  assert.ok(inn(0.99).cover < 0.2, 'cover almost shut at the end of the in phase');
  assert.equal(out(0).beltClear, 0);
  assert.ok(out(0.5).beltClear > 0.99, 'the belt end is swung out before the box falls');
  assert.ok(inn(0.7).beltClear > 0.99, 'the new belt stays out until the box has seated');
  assert.ok(inn(0.99).beltClear < 0.01 && inn(0.99).beltLaid > 0.99, 'swung back and set down by the end');
  assert.equal(bolt(0.5).cover, 0);
  assert.equal(bolt(0.5).beltLaid, 1);
  assert.equal(reloadPose(null).cover, 0);
});

test('the rifle, which has no cover, never asks for one to move', () => {
  const rifle = buildWeapon(WEAPON.RIFLE, 10);
  assert.equal(rifle.rig.cover, null);
  assert.equal(rifle.rig.belt, null);
});

test('the machine gun is built with a cover and as many belt rounds as the graphics tier allows', () => {
  for (const tier of QUALITY_TIERS) {
    const links = QUALITY[tier].fx.beltLinks;
    const lmg = buildWeapon(WEAPON.LMG, links);
    assert.ok(lmg.rig.cover, `${tier} has a cover`);
    assert.ok(lmg.rig.coverOpenRad < -Math.PI / 2, 'opening swings the cover past upright, clear of the line of sight');
    assert.equal(lmg.rig.belt?.links.length ?? 0, links, `${tier} draws ${links} rounds`);
  }
  assert.equal(buildWeapon(WEAPON.LMG).rig.belt, null, 'third person draws no belt');
});

test('lighter graphics tiers draw fewer belt rounds, and even the lightest keeps a short belt for the reload', () => {
  const [high, low, performance] = QUALITY_TIERS.map((t) => QUALITY[t].fx.beltLinks);
  assert.ok(high > low && low > performance);
  assert.ok(performance >= TRACER_EVERY, 'enough rounds to show a tracer');
  assert.ok(QUALITY_TIERS.every((t) => Number.isInteger(QUALITY[t].fx.beltLinks)));
});
