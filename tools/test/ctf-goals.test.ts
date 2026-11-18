import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ctfGoal, electRoles, readFlags, type CtfFlag, type CtfView } from '../ctf-goals.ts';
import { patrolPoint, type BotPlayer } from '../drive-goals.ts';

const bases = [{ x: -900, y: 0, z: 0 }, { x: 900, y: 0, z: 0 }] as const;
const home: CtfFlag = { kind: 'home', carrier: -1, ...bases[0] };
const theirsHome: CtfFlag = { kind: 'home', carrier: -1, ...bases[1] };
const atStart: [CtfFlag, CtfFlag] = [home, theirsHome];

function player(id: number, x: number, extra: Partial<BotPlayer> = {}): BotPlayer {
  return { id, team: 0, x, y: 0, z: 0, dropping: false, alive: true, ...extra };
}

function goalFor(self: BotPlayer, players: BotPlayer[], flags: [CtfFlag, CtfFlag], extra: Partial<CtfView> = {}) {
  return ctfGoal({ flags, bases, self, players, leg: 0, time: 0, enemy: null, closeEnemy: false, ...extra });
}

test('read flag rows and reject malformed ones', () => {
  assert.deepEqual(readFlags([[0, -1, 1, 2, 3, 0], [1, 7, 4, 5, 6, 0]]), [
    { kind: 'home', carrier: -1, x: 1, y: 2, z: 3 },
    { kind: 'carried', carrier: 7, x: 4, y: 5, z: 6 },
  ]);
  assert.equal(readFlags([]), null);
  assert.equal(readFlags([[0, -1, 0, 0, 0, 0], [9, -1, 0, 0, 0, 0]]), null);
});

test('the teammate nearest to the enemy flag runs, then a defender, then at most two escorts', () => {
  const mates = [player(1, 600), player(2, -800), player(3, 0), player(4, -100), player(5, -200)];
  const roles = electRoles(mates, theirsHome, bases[1], bases[0]);
  assert.equal(roles.get(1), 'runner');
  assert.equal(roles.get(2), 'defender');
  assert.deepEqual([roles.get(3), roles.get(4)], ['escort', 'escort']);
  assert.equal(roles.get(5), 'defender', 'extra bots beyond two escorts defend');
});

test('few bots fill runner first, then defender, then escort', () => {
  const one = electRoles([player(1, 0)], theirsHome, bases[1], bases[0]);
  assert.deepEqual([...one.values()], ['runner']);
  const two = electRoles([player(1, 0), player(2, -800)], theirsHome, bases[1], bases[0]);
  assert.deepEqual([two.get(1), two.get(2)], ['runner', 'defender']);
  const three = electRoles([player(1, 0), player(2, -800), player(3, 100)], theirsHome, bases[1], bases[0]);
  assert.deepEqual([three.get(1), three.get(2), three.get(3)], ['escort', 'defender', 'runner']);
});

test('ties break by id and every teammate elects the same roles', () => {
  const mates = [player(2, 0), player(1, 0)];
  const roles = electRoles(mates, theirsHome, bases[1], bases[0]);
  assert.equal(roles.get(1), 'runner');
  assert.equal(roles.get(2), 'defender');
  assert.equal(goalFor(mates[0], mates, atStart).role, 'guard');
  assert.equal(goalFor(mates[1], mates, atStart).role, 'steal');
});

test('dead and airborne teammates are never elected', () => {
  const players = [
    player(1, 800, { alive: false }), player(2, 700, { dropping: true }),
    player(3, -500), player(4, -600),
  ];
  assert.equal(goalFor(players[2], players, atStart).role, 'steal', 'the living teammate nearest to the flag runs');
  assert.equal(goalFor(players[3], players, atStart).role, 'guard');
});

test('a carrying teammate is the carrier, never the runner, and the rest defend and escort', () => {
  const carrying: CtfFlag = { kind: 'carried', carrier: 3, x: 0, y: 0, z: 0 };
  const mates = [player(1, -800), player(2, 200), player(3, 0)];
  const roles = electRoles(mates, carrying, carrying, bases[0]);
  assert.equal(roles.get(3), 'carrier');
  assert.equal(roles.get(1), 'defender');
  assert.equal(roles.get(2), 'escort');
  assert.equal([...roles.values()].includes('runner'), false);
});

test('the runner steals the enemy flag, or picks it up where it was dropped', () => {
  const players = [player(1, 0), player(2, -800)];
  assert.deepEqual(goalFor(players[0], players, atStart), { role: 'steal', point: bases[1] });
  const dropped: CtfFlag = { kind: 'dropped', carrier: -1, x: 300, y: 0, z: 50 };
  assert.deepEqual(goalFor(players[0], players, [home, dropped]), { role: 'steal', point: dropped });
});

test('the carrier captures when its own flag is home and waits moving near home when it is not', () => {
  const carrying: CtfFlag = { kind: 'carried', carrier: 1, x: 0, y: 0, z: 0 };
  const players = [player(1, 0), player(2, -800)];
  assert.deepEqual(goalFor(players[0], players, [home, carrying]), { role: 'capture', point: bases[0] });
  const taken: CtfFlag = { kind: 'carried', carrier: 9, x: 500, y: 0, z: 0 };
  const waiting = goalFor(players[0], players, [taken, carrying]);
  assert.equal(waiting.role, 'wait');
  assert.equal(waiting.roam, true);
  assert.ok(Math.hypot(waiting.point.x - bases[0].x, waiting.point.z - bases[0].z) < 300);
  const next = goalFor(players[0], players, [taken, carrying], { leg: 1 });
  assert.notDeepEqual(next.point, waiting.point);
});

test('the teammate nearest to a dropped own flag returns it, carrier included', () => {
  const dropped: CtfFlag = { kind: 'dropped', carrier: -1, x: -300, y: 0, z: 0 };
  const players = [player(1, 0), player(2, -800), player(3, -350)];
  assert.deepEqual(goalFor(players[2], players, [dropped, theirsHome]), { role: 'return', point: dropped });
  assert.notEqual(goalFor(players[0], players, [dropped, theirsHome]).role, 'return');
  const carrying: CtfFlag = { kind: 'carried', carrier: 1, x: -320, y: 0, z: 0 };
  const carrier = [player(1, -320), player(2, -800)];
  assert.equal(goalFor(carrier[0], carrier, [dropped, carrying]).role, 'return');
  const withBody = [player(3, -300, { alive: false }), player(2, -800)];
  assert.equal(goalFor(withBody[1], withBody, [dropped, theirsHome]).role, 'return', 'a body does not claim the return');
});

test('defenders and a close teammate chase an enemy carrying the own flag', () => {
  const taken: CtfFlag = { kind: 'carried', carrier: 9, x: 200, y: 0, z: 0 };
  const players = [player(1, 500), player(2, -800), player(3, 0)];
  const goalOf = (i: number) => goalFor(players[i], players, [taken, theirsHome]);
  assert.deepEqual(goalOf(1), { role: 'chase', point: taken, duel: true });
  assert.equal(goalOf(2).role, 'chase', 'the nearest runner or escort joins');
  assert.equal(goalOf(0).role, 'steal', 'only one extra teammate leaves the attack');
  const far = [player(1, 1200), player(2, -800)];
  assert.equal(goalFor(far[0], far, [taken, theirsHome]).role, 'steal', 'a runner far from the carrier keeps attacking');
});

test('escorts ring the runner and defenders ring the own base, apart from each other', () => {
  const players = [player(1, 600), player(2, -800), player(3, 500), player(4, 450), player(5, 400)];
  const escort = goalFor(players[2], players, atStart);
  assert.equal(escort.role, 'escort');
  assert.deepEqual(escort.point, patrolPoint(players[0], 3, 0, 180));
  assert.notDeepEqual(escort.point, goalFor(players[3], players, atStart).point);
  const guard = goalFor(players[1], players, atStart);
  assert.equal(guard.role, 'guard');
  assert.equal(guard.roam, true);
  assert.notDeepEqual(guard.point, goalFor(players[1], players, atStart, { time: 4000 }).point);
});

test('defenders intercept a visible intruder near their base but not a close one', () => {
  const players = [player(1, 600), player(2, -800)];
  const intruder = { x: -700, y: 0, z: 0 };
  assert.deepEqual(goalFor(players[1], players, atStart, { enemy: intruder }).intercept, intruder);
  assert.equal(goalFor(players[1], players, atStart, { enemy: intruder, closeEnemy: true }).intercept, undefined);
  assert.equal(goalFor(players[1], players, atStart, { enemy: { x: 900, y: 0, z: 0 } }).intercept, undefined);
});
