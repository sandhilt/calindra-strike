import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPON, reloadCursor, weaponDef } from '@calindra-strike/shared';
import { BELT_BURST_S, BELT_FLOW_SLOTS_PER_S, BELT_PATH, TRACER_EVERY, TRAY_LIFT_UNITS, type BeltFlow, isTracer, linkPlacement, pointAlong, stepBeltFlow } from '../src/game/render/belt-anim.ts';
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

test('only the rounds on the tray rise when the belt is not laid', () => {
  const count = 10;
  for (let i = 0; i < count; i++) {
    const laid = linkPlacement(i, count, 0.3, 1).position;
    const lifted = linkPlacement(i, count, 0.3, 0).position;
    const rise = lifted.y - laid.y;
    if (i < 5) assert.equal(rise, 0, `round ${i} is on the flank`);
    assert.ok(rise >= 0 && rise <= TRAY_LIFT_UNITS + 1e-9);
  }
  assert.ok(linkPlacement(count - 1, count, 0.3, 0).position.y - linkPlacement(count - 1, count, 0.3, 1).position.y > 3, 'the end of the belt is clearly lifted');
});

test('swinging the belt clear moves only the tray end, out to the left of the gun', () => {
  const count = 10;
  for (let i = 0; i < count; i++) {
    const over = linkPlacement(i, count, 0.3, 1, 0).position;
    const clear = linkPlacement(i, count, 0.3, 1, 1).position;
    if (i < 5) assert.equal(clear.x, over.x, `round ${i} is on the flank`);
    assert.ok(clear.x <= over.x);
  }
  const end = count - 1;
  assert.ok(linkPlacement(end, count, 0.3, 1, 0).position.x - linkPlacement(end, count, 0.3, 1, 1).position.x > 4, 'the end is well clear of the receiver');
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
