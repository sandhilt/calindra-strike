import { it } from 'node:test';
import assert from 'node:assert/strict';
import { stepBomb, dropBomb, applyCmd, createPlayerState, CollisionWorld, getMaps, BTN, type BombActor, type BombPlaces, type BombState } from '../src/index.ts';
import { BOMB_RETURN_TICKS, DEFUSE_TICKS, FUSE_TICKS, PLANT_TICKS } from '../src/constants.ts';

const places: BombPlaces = { home: { x: 0, y: 0, z: -1000 }, site: { x: 0, y: 0, z: 1000 }, attackers: 0 };
const actor = (team: number, at: { x: number; y: number; z: number }, extra: Partial<BombActor> = {}): BombActor =>
  ({ id: team === 0 ? 7 : 9, team, alive: true, dropping: false, using: false, ...at, ...extra });
const home: BombState = { kind: 'home' };
const planted = (extra: Partial<Extract<BombState, { kind: 'planted' }>> = {}): BombState =>
  ({ kind: 'planted', ...places.site, explodeAtTick: 1000, variant: 3, defuse: null, ...extra });

it('only living attackers take the home or dropped bomb', () => {
  assert.deepEqual(stepBomb(home, places, [actor(0, places.home)], 1, 0).bomb, { kind: 'carried', carrier: 7 });
  assert.deepEqual(stepBomb(home, places, [actor(0, places.home)], 1, 0).events, [{ k: 'bomb', what: 'take', team: 0, by: 7 }]);
  for (const blocked of [actor(1, places.home), actor(0, places.home, { alive: false }), actor(0, places.home, { dropping: true }), actor(0, places.site)]) {
    assert.deepEqual(stepBomb(home, places, [blocked], 1, 0).bomb, home);
  }
  const dropped: BombState = { kind: 'dropped', x: 5, y: 0, z: 6, returnAtTick: 99 };
  assert.deepEqual(stepBomb(dropped, places, [actor(0, { x: 5, y: 0, z: 6 })], 1, 0).bomb, { kind: 'carried', carrier: 7 });
  assert.deepEqual(stepBomb(dropped, places, [actor(1, { x: 5, y: 0, z: 6 })], 1, 0).bomb, dropped);
});

it('carriers plant by holding use inside the site and the plant completes after the plant time', () => {
  const carried: BombState = { kind: 'carried', carrier: 7 };
  assert.deepEqual(stepBomb(carried, places, [actor(0, places.site)], 1, 0).bomb, carried);
  assert.deepEqual(stepBomb(carried, places, [actor(0, places.home, { using: true })], 1, 0).bomb, carried);
  const start = stepBomb(carried, places, [actor(0, places.site, { using: true })], 10, 0);
  assert.deepEqual(start.bomb, { kind: 'planting', carrier: 7, doneAtTick: 10 + PLANT_TICKS });
  const holding = [actor(0, places.site, { using: true })];
  assert.equal(stepBomb(start.bomb, places, holding, 9 + PLANT_TICKS, 4).bomb.kind, 'planting');
  const done = stepBomb(start.bomb, places, holding, 10 + PLANT_TICKS, 4);
  assert.deepEqual(done.bomb, { kind: 'planted', ...places.site, explodeAtTick: 10 + PLANT_TICKS + FUSE_TICKS, variant: 4, defuse: null });
  assert.deepEqual(done.events, [{ k: 'bomb', what: 'plant', team: 0, by: 7 }]);
});

it('releasing use or leaving the site returns a planting carrier to carried', () => {
  const planting: BombState = { kind: 'planting', carrier: 7, doneAtTick: 100 };
  for (const state of [actor(0, places.site), actor(0, places.home, { using: true })]) {
    assert.deepEqual(stepBomb(planting, places, [state], 50, 0).bomb, { kind: 'carried', carrier: 7 });
  }
});

it('a vanished or dead carrier sends the bomb home and death drops it where it stood', () => {
  const carried: BombState = { kind: 'carried', carrier: 7 };
  assert.deepEqual(stepBomb(carried, places, [], 1, 0).bomb, home);
  const drop = dropBomb({ kind: 'planting', carrier: 7, doneAtTick: 5 }, 7, { x: 1, y: 2, z: 3 }, 10, 0);
  assert.deepEqual(drop.bomb, { kind: 'dropped', x: 1, y: 2, z: 3, returnAtTick: 10 + BOMB_RETURN_TICKS });
  assert.deepEqual(drop.events, [{ k: 'bomb', what: 'drop', team: 0, by: 7 }]);
  assert.deepEqual(dropBomb(carried, 8, { x: 1, y: 2, z: 3 }, 10, 0).bomb, carried);
  assert.deepEqual(dropBomb(home, 7, { x: 1, y: 2, z: 3 }, 10, 0).events, []);
  const dropped = drop.bomb;
  assert.equal(stepBomb(dropped, places, [], 9 + BOMB_RETURN_TICKS, 0).bomb.kind, 'dropped');
  const back = stepBomb(dropped, places, [], 10 + BOMB_RETURN_TICKS, 0);
  assert.deepEqual(back.bomb, home);
  assert.deepEqual(back.events, [{ k: 'bomb', what: 'return', team: 0, by: -1 }]);
});

it('the fuse explodes for the attackers exactly at the deadline', () => {
  assert.equal(stepBomb(planted(), places, [], 999, 0).outcome, undefined);
  const boom = stepBomb(planted(), places, [], 1000, 0);
  assert.equal(boom.outcome, 'exploded');
  assert.deepEqual(boom.bomb, home);
  assert.deepEqual(boom.events, [{ k: 'bomb', what: 'exploded', team: 0, by: -1 }]);
});

it('one defender holding use near the bomb defuses it after the defuse time; attackers cannot', () => {
  const near = { ...places.site, x: 40 };
  assert.deepEqual(stepBomb(planted(), places, [actor(0, near, { using: true })], 1, 0).bomb, planted());
  assert.deepEqual(stepBomb(planted(), places, [actor(1, { ...places.site, x: 200 }, { using: true })], 1, 0).bomb, planted());
  const start = stepBomb(planted(), places, [actor(1, near, { using: true })], 20, 0);
  assert.deepEqual(start.bomb, planted({ defuse: { by: 9, doneAtTick: 20 + DEFUSE_TICKS } }));
  assert.deepEqual(start.events, [{ k: 'bomb', what: 'defuse', team: 1, by: 9 }]);
  const second = { ...actor(1, near, { using: true }), id: 11 };
  const holding = [second, actor(1, near, { using: true })];
  assert.equal(stepBomb(start.bomb, places, holding, 21, 0).events.length, 0);
  assert.equal(stepBomb(start.bomb, places, holding, 19 + DEFUSE_TICKS, 0).outcome, undefined);
  const done = stepBomb(start.bomb, places, holding, 20 + DEFUSE_TICKS, 0);
  assert.equal(done.outcome, 'defused');
  assert.deepEqual(done.bomb, home);
  assert.deepEqual(done.events, [{ k: 'bomb', what: 'defused', team: 1, by: 9 }]);
});

it('release, death or leaving cancel the defuse and progress starts over', () => {
  const near = { ...places.site, x: 40 };
  const defusing = planted({ defuse: { by: 9, doneAtTick: 100 } });
  for (const state of [actor(1, near), actor(1, near, { using: true, alive: false }), actor(1, { ...places.site, x: 300 }, { using: true })]) {
    assert.deepEqual(stepBomb(defusing, places, [state], 50, 0).bomb, planted());
  }
  const restart = stepBomb(defusing, places, [actor(1, near, { using: true })], 99, 0);
  assert.equal(restart.outcome, undefined);
  const resumed = stepBomb(planted(), places, [actor(1, near, { using: true })], 99, 0);
  assert.deepEqual(resumed.bomb, planted({ defuse: { by: 9, doneAtTick: 99 + DEFUSE_TICKS } }));
});

it('a defuse that cannot finish before the fuse loses to the explosion', () => {
  const near = { ...places.site, x: 40 };
  const late = planted({ explodeAtTick: 30, defuse: { by: 9, doneAtTick: 20 + DEFUSE_TICKS } });
  assert.equal(stepBomb(late, places, [actor(1, near, { using: true })], 30, 0).outcome, 'exploded');
});

it('does not mutate its inputs', () => {
  const bomb = planted();
  const frozen = structuredClone(bomb);
  stepBomb(bomb, places, [actor(1, places.site, { using: true })], 5, 0);
  assert.deepEqual(bomb, frozen);
});

it('the movement sim ignores the use button', () => {
  const world = new CollisionWorld(getMaps()[0]);
  const a = createPlayerState();
  const b = createPlayerState();
  Object.assign(a, { x: 0, y: 0, z: 0, dropping: false });
  Object.assign(b, { x: 0, y: 0, z: 0, dropping: false });
  for (let seq = 1; seq <= 60; seq++) {
    applyCmd(world, a, { seq, buttons: BTN.FWD, yaw: 0.3, pitch: 0, weapon: 0, interp: 0 }, 1);
    applyCmd(world, b, { seq, buttons: BTN.FWD | BTN.USE, yaw: 0.3, pitch: 0, weapon: 0, interp: 0 }, 1);
  }
  assert.deepEqual(b, a);
});
