import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LUNCH_COLLEAGUES, colleagueRow, getMaps, modeFitsMap, startLunch, stepLunch, type Colleague, type LunchActor, type LunchPlaces } from '../src/index.ts';

const hold = { x: 0, y: 0, z: 0 };
const places: LunchPlaces = { hold, restaurants: [{ x: 0, y: 0, z: -1200 }] };
const round = { attackers: 1, endsAtTick: 10_000 };

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
});
