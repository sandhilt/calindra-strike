import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
  BATATA_BOUNTY_POINTS, BATATA_PER_MATCH, CARRAPETA_MAX_HOLD_SECONDS, BATATA_DOUBLE_EVERY_SECONDS, BATATA_DURATION_SECONDS,
  BATATA_KILL_POINTS, BATATA_MAX_MULTIPLIER, CARRAPETA_BLAST_RADIUS_UNITS, CARRAPETA_SELF_DAMAGE_SCALE,
  CollisionWorld, MapBuilder, TICK_RATE, blastDamage, carrapetaEnemies, carrapetaKillPoints,
  carrapetaPointsPerSecond, dropCarrapeta, frenzyAtTicks, holdExpired, getMaps, stepCarrapeta, stepFrenzy,
  type FrenzyState,
} from '../src/index.ts';

it('draws a holder, drops on loss, picks the nearest landed player, and rerolls at the deadline', () => {
  const at = { x: 0, y: 0, z: 0 };
  const players = [
    { ...at, id: 1, landed: false },
    { ...at, id: 2, landed: true, x: 12 },
    { ...at, id: 3, landed: true, x: 6 },
  ];
  const pending = { kind: 'none' } as const;
  assert.deepEqual(stepCarrapeta(pending, players.slice(0, 1), 0, () => 0), { state: pending });
  const draw = stepCarrapeta(pending, players, 0, () => 0);
  assert.deepEqual(draw.event, { k: 'carrapeta', what: 'take', by: 2 });
  const drop = dropCarrapeta(draw.state, 2, at, 100);
  assert.deepEqual(drop.event, { k: 'carrapeta', what: 'lose', by: 2, at });
  assert.equal(dropCarrapeta(draw.state, 1, at, 100).state, draw.state);
  assert.equal(stepCarrapeta(drop.state, players.slice(0, 1), 99, () => 0).state, drop.state);
  assert.equal(stepCarrapeta(drop.state, [], 100, () => 0).state, drop.state);
  assert.deepEqual(stepCarrapeta(drop.state, players, 99, () => 0).event, { k: 'carrapeta', what: 'take', by: 3 });
  assert.deepEqual(stepCarrapeta(drop.state, players.slice(0, 1), 100, () => 0), { state: drop.state });
  assert.deepEqual(stepCarrapeta(drop.state, players, 101, () => 0).event, { k: 'carrapeta', what: 'reroll', by: 2 });
});

it('activates frenzy inside the match, doubles the streak rate with a cap, and expires', () => {
  const calm: FrenzyState = { kind: 'calm' };
  const duration = 300 * TICK_RATE;
  const [at] = frenzyAtTicks(0, duration, [0.5, 0.5]);
  assert.ok(at > 0 && at < duration);
  assert.equal(stepFrenzy(calm, at - 1, at), calm);
  const frenzy = stepFrenzy(calm, at, at);
  const untilTick = at + BATATA_DURATION_SECONDS * TICK_RATE;
  assert.deepEqual(frenzy, { kind: 'frenzy', sinceTick: at, untilTick });
  assert.equal(stepFrenzy(frenzy, untilTick - 1), frenzy);
  assert.deepEqual(stepFrenzy(frenzy, untilTick), calm);
  assert.equal(stepFrenzy(calm, untilTick + 1), calm);
  const interval = BATATA_DOUBLE_EVERY_SECONDS * TICK_RATE;
  assert.equal(carrapetaPointsPerSecond(at, calm, 0), 1);
  assert.equal(carrapetaPointsPerSecond(at, frenzy, 0), 1);
  assert.equal(carrapetaPointsPerSecond(at + interval - 1, frenzy, 0), 1);
  assert.equal(carrapetaPointsPerSecond(at + interval, frenzy, 0), 2);
  assert.equal(carrapetaPointsPerSecond(at + 2 * interval, frenzy, 0), 4);
  assert.equal(carrapetaPointsPerSecond(at + 2 * interval, frenzy, at + interval), 2);
  assert.equal(carrapetaPointsPerSecond(at + 100 * interval, frenzy, 0), BATATA_MAX_MULTIPLIER);
  assert.equal(carrapetaKillPoints(calm, 1, 1, 2), 0);
  assert.equal(carrapetaKillPoints(frenzy, 1, 1, 2), BATATA_KILL_POINTS);
  assert.equal(carrapetaKillPoints(frenzy, 1, 2, 1), BATATA_BOUNTY_POINTS);
  assert.equal(carrapetaKillPoints(frenzy, 1, 1, 1), 0);
  const held = { kind: 'held', holder: 1, sinceTick: 0 } as const;
  assert.equal(carrapetaEnemies(held, 2, 3), false);
  assert.equal(carrapetaEnemies(held, 2, 1), true);
  assert.equal(carrapetaEnemies(held, 1, 2), true);
  assert.equal(carrapetaEnemies({ kind: 'none' }, 2, 3), true);
  assert.equal(carrapetaEnemies({ kind: 'dropped', x: 0, y: 0, z: 0, rerollAtTick: 10 }, 1, 2), true);
});

it('applies linear falloff, reduced self damage and wall shielding', () => {
  const b = new MapBuilder();
  b.add(-40, -10, -15, -30, 10, 15, 'concrete');
  const world = new CollisionWorld({ ...getMaps()[0], boxes: b.boxes });
  const origin = { x: 0, y: 0, z: 0 };
  const halfway = { ...origin, x: CARRAPETA_BLAST_RADIUS_UNITS / 2 };
  assert.equal(blastDamage(world, origin, origin, 100, true), 100 * CARRAPETA_SELF_DAMAGE_SCALE);
  assert.equal(blastDamage(world, origin, halfway, 100, false), 50);
  assert.equal(blastDamage(world, origin, { ...origin, x: CARRAPETA_BLAST_RADIUS_UNITS }, 100, false), 0);
  assert.equal(blastDamage(world, origin, { ...halfway, x: -halfway.x }, 100, false), 0);
});

it('schedules the Batata Quente at least twice a match, each event whole and apart from the other', () => {
  const duration = 300 * TICK_RATE;
  const eventTicks = BATATA_DURATION_SECONDS * TICK_RATE;
  for (const roll of [0, 0.5, 0.999]) {
    const at = frenzyAtTicks(1000, duration, Array.from({ length: BATATA_PER_MATCH }, () => roll));
    assert.ok(at.length >= 2);
    at.forEach((tick, i) => {
      assert.ok(tick >= 1000 && tick + eventTicks <= 1000 + duration, 'inside the match');
      if (i > 0) assert.ok(tick >= at[i - 1] + eventTicks, 'the events do not overlap');
    });
  }
});

it('the Carrapeta expires after the longest hold and not before', () => {
  const held = { kind: 'held', holder: 1, sinceTick: 100 } as const;
  const limit = 100 + CARRAPETA_MAX_HOLD_SECONDS * TICK_RATE;
  assert.equal(holdExpired(held, limit - 1), false);
  assert.equal(holdExpired(held, limit), true);
  assert.equal(holdExpired({ kind: 'none' }, limit), false);
});
