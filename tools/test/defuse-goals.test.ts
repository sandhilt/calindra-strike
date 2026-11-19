import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canHoldUse, defuseGoal, pickDefuseGoal, readBombRow } from '../defuse-goals.ts';
import { checkProgress, patrolPoint } from '../drive-goals.ts';

const home = { x: 0, y: 0, z: 0 };
const site = { x: 700, y: 0, z: 0 };
const places = { home, site, attackers: 0 };
const attacker = { ...home, id: 1, team: 0, dropping: false, alive: true };
const escort = { ...attacker, id: 2 };
const defender = { ...site, id: 3, team: 1, dropping: false, alive: true };
const cover = { ...defender, id: 4, x: 800 };
const players = [attacker, escort, defender, cover];

function bomb(state: number, actor = -1, attackers = 0) {
  const parsed = readBombRow([state, actor, 700, 0, 0, 10000, 9000, 3, attackers, 3000, 1, 60000]);
  assert.ok(parsed);
  return parsed;
}

test('read the documented bomb row and handle absent objectives', () => {
  assert.equal(readBombRow([]), null);
  assert.deepEqual(bomb(4, 3), {
    kind: 'planted', actor: 3, x: 700, y: 0, z: 0, explodeAt: 10000,
    defuseDoneAt: 9000, variant: 3, attackers: 0, plantDoneAt: 3000, blackFriday: true, plantByAt: 60000,
  });
});

test('attackers fetch the bomb, escort its carrier, and guard it after planting', () => {
  assert.deepEqual(pickDefuseGoal(bomb(0), places, attacker, players, 0), { role: 'fetch', point: home });
  assert.deepEqual(pickDefuseGoal(bomb(3), places, attacker, players, 0), { role: 'fetch', point: bomb(3) });
  for (const state of [1, 2]) {
    assert.deepEqual(pickDefuseGoal(bomb(state, 1), places, attacker, players, 0), { role: 'plant', point: site });
  }
  assert.deepEqual(pickDefuseGoal(bomb(1, 1), places, escort, players, 0), { role: 'escort', point: bomb(1, 1), settle: 150 });
  assert.deepEqual(pickDefuseGoal(bomb(2, 1), places, escort, players, 0), {
    role: 'patrol', point: patrolPoint(bomb(2, 1), 2, 0), roam: true,
  });
  assert.deepEqual(pickDefuseGoal(bomb(4), places, attacker, players, 1), {
    role: 'patrol', point: patrolPoint(site, 1, 1), roam: true,
  });
});

test('defenders patrol distinct legs and elect one grounded defuser', () => {
  const patrol = pickDefuseGoal(bomb(0), places, defender, players, 0);
  assert.equal(patrol.role, 'patrol');
  assert.notDeepEqual(patrol.point, pickDefuseGoal(bomb(0), places, cover, players, 0).point);
  assert.notDeepEqual(patrol.point, pickDefuseGoal(bomb(0), places, defender, players, 1).point);
  assert.equal(pickDefuseGoal(bomb(4), places, defender, players, 0).role, 'defuse');
  assert.equal(pickDefuseGoal(bomb(4), places, cover, players, 0).role, 'patrol');
  assert.equal(pickDefuseGoal(bomb(4, cover.id), places, cover, players, 0).role, 'defuse');
  const airborne = { ...defender, dropping: true };
  assert.equal(pickDefuseGoal(bomb(4), places, cover, [airborne, cover], 0).role, 'defuse');
  const tied = { ...cover, x: defender.x };
  assert.equal(pickDefuseGoal(bomb(4), places, defender, [tied, defender], 0).role, 'defuse');
  assert.equal(pickDefuseGoal(bomb(0, -1, 1), { ...places, home: site, attackers: 1 }, defender, players, 0).role, 'fetch');
});

test('use is allowed within reach and interrupted by a close enemy', () => {
  const planted = pickDefuseGoal(bomb(4), places, defender, players, 0);
  assert.equal(canHoldUse(defender, planted, false), true);
  assert.equal(canHoldUse(defender, planted, true), false);
  assert.equal(canHoldUse({ ...defender, dropping: true }, planted, false), false);
  assert.equal(canHoldUse(cover, planted, false), false);
  const plant = pickDefuseGoal(bomb(2, 1), places, attacker, players, 0);
  assert.equal(canHoldUse({ ...attacker, ...site }, plant, false), true);
  assert.equal(canHoldUse({ ...attacker, ...site }, plant, true), false);
});

test('recover after 1.5 seconds of little movement and reset on progress', () => {
  const { sample } = checkProgress(null, home, 0);
  assert.equal(checkProgress(sample, home, 1499).stuck, false);
  assert.equal(checkProgress(sample, { ...home, x: 5 }, 1500).stuck, true);
  const moved = checkProgress(sample, { ...home, x: 25 }, 1400);
  assert.equal(moved.stuck, false);
  assert.equal(checkProgress(moved.sample, moved.sample.point, 1500).stuck, false);
});

test('defender goals carry the combat decisions: use, duel and interception', () => {
  const intruder = { x: 600, y: 0, z: 0 };
  const intercept = defuseGoal(bomb(0), places, cover, players, 0, intruder, false);
  assert.equal(intercept.role, 'patrol');
  assert.deepEqual(intercept.intercept, intruder);
  assert.equal(defuseGoal(bomb(0), places, cover, players, 0, intruder, true).intercept, undefined);
  assert.equal(defuseGoal(bomb(4), places, cover, players, 0, intruder, false).intercept, undefined);
  assert.equal(defuseGoal(bomb(0, -1, 1), { ...places, attackers: 1 }, defender, players, 0, intruder, false).intercept, undefined);
  const defusing = defuseGoal(bomb(4), places, defender, players, 0, null, false);
  assert.deepEqual([defusing.role, defusing.use, defusing.duel], ['defuse', true, true]);
  assert.equal(defuseGoal(bomb(4), places, defender, players, 0, intruder, true).use, false);
});

test('a dead defender next to the bug is not elected to defuse', () => {
  const planted = bomb(4);
  const body = { ...defender, alive: false };
  const goal = pickDefuseGoal(planted, places, cover, [attacker, escort, body, cover], 0);
  assert.equal(goal.role, 'defuse', 'the living defender goes for the bug');
});
