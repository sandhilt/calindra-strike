import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LUNCH_COLLEAGUES, LUNCH_ROUND_TICKS, LUNCH_RUSH_SPEED, colleagueFromRow, lunchRoundTicks, colleagueRow, getMaps, modeFitsMap, startLunch, stepLunch, type Colleague, type LunchActor, type LunchPlaces } from '../src/index.ts';

const hold = { x: 0, y: 0, z: 0 };
const places: LunchPlaces = { hold, restaurants: [{ x: 0, y: 0, z: -1200 }] };
const round = { attackers: 1, endsAtTick: 10_000, target: 0, rush: false };

function actor(over: Partial<LunchActor>): LunchActor {
  return { id: 7, team: 1, alive: true, using: false, x: 0, y: 0, z: 0, ...over };
}

/** Moves the leader toward the restaurant a little each tick, the way a player walks. */
function lead(start: Colleague[], leaderAt: (tick: number) => Partial<LunchActor>, ticks: number) {
  let colleagues = start;
  const events = [];
  for (let tick = 0; tick < ticks; tick++) {
    const step = stepLunch(colleagues, places, [actor(leaderAt(tick))], round, tick);
    colleagues = step.colleagues;
    events.push(...step.events);
    if (step.outcome) return { colleagues, events, outcome: step.outcome };
  }
  return { colleagues, events, outcome: undefined };
}

describe('hora de almoçar', () => {
  it('a colleague sits only at the round target, not at another restaurant', () => {
    const two: LunchPlaces = { hold, restaurants: [{ x: 0, y: 0, z: -1200 }, { x: 600, y: 0, z: -1200 }] };
    const at = (x: number): Colleague[] => startLunch(hold).map(() => ({ kind: 'following', leader: 7, trail: [], x, y: 0, z: -1200, yaw: 0 }));
    const leader = [actor({ x: 0, y: 0, z: -1200 })];
    const wrong = stepLunch(at(600), two, leader, round, 0);
    assert.ok(wrong.colleagues.every((c) => c.kind === 'following'), 'the other restaurant does not seat anyone');
    const right = stepLunch(at(0), two, leader, round, 0);
    assert.equal(right.outcome, 'served');
    const other = stepLunch(at(600), two, leader, { ...round, target: 1 }, 0);
    assert.equal(other.outcome, 'served', 'the target moves with the round');
  });

  it('starts every colleague waiting at the hold point', () => {
    const colleagues = startLunch(hold);
    assert.equal(colleagues.length, LUNCH_COLLEAGUES.length);
    for (const c of colleagues) {
      assert.equal(c.kind, 'waiting');
      assert.ok(Math.hypot(c.x, c.z) < 60);
    }
  });

  it('an attacker holding USE takes the colleagues to lunch and wins the round', () => {
    const result = lead(startLunch(hold), (tick) => ({ using: tick < 5, z: -Math.min(1300, tick * 3) }), 2000);
    assert.equal(result.outcome, 'served');
    assert.ok(result.colleagues.every((c) => c.kind === 'seated'));
    assert.equal(result.events.filter((e) => e.what === 'follow').length, LUNCH_COLLEAGUES.length);
    assert.equal(result.events.filter((e) => e.what === 'seated').length, LUNCH_COLLEAGUES.length);
    assert.partialDeepStrictEqual(result.events.at(-1), { what: 'served', team: 1 });
  });

  it('colleagues follow the trail at a distance instead of walking into their leader', () => {
    const result = lead(startLunch(hold), (tick) => ({ using: tick < 5, z: -Math.min(400, tick * 3) }), 400);
    assert.equal(result.outcome, undefined);
    for (const c of result.colleagues) {
      assert.equal(c.kind, 'following');
      assert.ok(Math.hypot(c.x, c.z + 400) >= 60, 'keeps a gap to the leader');
    }
  });

  it('a defender holding USE does not move them', () => {
    const step = stepLunch(startLunch(hold), places, [actor({ team: 0, using: true })], round, 0);
    assert.ok(step.colleagues.every((c) => c.kind === 'waiting'));
    assert.equal(step.events.length, 0);
  });

  it('colleagues stop where their leader died', () => {
    const following = stepLunch(startLunch(hold), places, [actor({ using: true })], round, 0).colleagues;
    const step = stepLunch(following, places, [actor({ alive: false })], round, 1);
    assert.ok(step.colleagues.every((c) => c.kind === 'waiting'));
    assert.equal(step.events.filter((e) => e.what === 'stop').length, LUNCH_COLLEAGUES.length);
  });

  it('when time runs out the food court is full and the defenders score', () => {
    const step = stepLunch(startLunch(hold), places, [], round, round.endsAtTick);
    assert.equal(step.outcome, 'full');
    assert.partialDeepStrictEqual(step.events.at(-1), { what: 'full', team: 0 });
  });

  it('is only played on maps with a food court', () => {
    const playable = getMaps().filter((m) => modeFitsMap('almoco', m)).map((m) => m.id);
    assert.deepEqual(playable, ['shopping']);
    assert.ok(getMaps().every((m) => modeFitsMap('tdm', m)));
  });

  it('a colleague survives the wire row, minus the trail only the server walks', () => {
    const following: Colleague = { kind: 'following', leader: 7, trail: [hold], x: 10, y: 96, z: -20, yaw: 0.5 };
    assert.deepEqual(colleagueFromRow(colleagueRow(following)), { ...following, trail: [] });
    for (const c of startLunch(hold)) assert.deepEqual(colleagueFromRow(colleagueRow(c)), c);
    assert.equal(colleagueFromRow([2, -1, 0, 0, 0, 0]).kind, 'seated');
  });
});

it('a rush hour round is the normal round at the rush speed, so it ends that many times sooner', () => {
  assert.equal(lunchRoundTicks(false), LUNCH_ROUND_TICKS);
  assert.equal(lunchRoundTicks(true), LUNCH_ROUND_TICKS / LUNCH_RUSH_SPEED);
  assert.ok(lunchRoundTicks(true) < lunchRoundTicks(false));
});
