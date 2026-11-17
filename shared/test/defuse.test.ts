import { it } from 'node:test';
import assert from 'node:assert/strict';
import { stepBomb, bombStandBox, inBombReach, dropBomb, applyCmd, createPlayerState, CollisionWorld, getMaps, BTN, type BombActor, type BombPlaces, type BombState } from '../src/index.ts';
import { BLACK_FRIDAY_FUSE_TICKS, BOMB_CRATE_HEIGHT_UNITS, BOMB_CRATE_SIZE_UNITS, BOMB_DESK_HEIGHT_UNITS, BOMB_DESK_SIZE_UNITS, BOMB_RETURN_TICKS, CTF_PICKUP_RADIUS_UNITS, DEFUSE_RADIUS_UNITS, DEFUSE_TICKS, FUSE_TICKS, PLANT_TICKS, PLAYER_RADIUS, STAND_HEIGHT } from '../src/constants.ts';

const places: BombPlaces = { home: { x: 0, y: 0, z: -1000 }, site: { x: 0, y: 0, z: 1000 }, attackers: 0 };
const actor = (team: number, at: { x: number; y: number; z: number }, extra: Partial<BombActor> = {}): BombActor =>
  ({ id: team === 0 ? 7 : 9, team, alive: true, dropping: false, using: false, ...at, ...extra });
const home: BombState = { kind: 'home' };
const planted = (extra: Partial<Extract<BombState, { kind: 'planted' }>> = {}): BombState =>
  ({ kind: 'planted', ...places.site, explodeAtTick: 1000, variant: 3, defuse: null, ...extra });

it('only living attackers take the home or dropped bomb', () => {
  assert.deepEqual(stepBomb(home, places, [actor(0, places.home)], 1, { variant: 0, blackFriday: false }).bomb, { kind: 'carried', carrier: 7 });
  assert.deepEqual(stepBomb(home, places, [actor(0, places.home)], 1, { variant: 0, blackFriday: false }).events, [{ k: 'bomb', what: 'take', team: 0, by: 7 }]);
  for (const blocked of [actor(1, places.home), actor(0, places.home, { alive: false }), actor(0, places.home, { dropping: true }), actor(0, places.site)]) {
    assert.deepEqual(stepBomb(home, places, [blocked], 1, { variant: 0, blackFriday: false }).bomb, home);
  }
  const dropped: BombState = { kind: 'dropped', x: 5, y: 0, z: 6, returnAtTick: 99 };
  assert.deepEqual(stepBomb(dropped, places, [actor(0, { x: 5, y: 0, z: 6 })], 1, { variant: 0, blackFriday: false }).bomb, { kind: 'carried', carrier: 7 });
  assert.deepEqual(stepBomb(dropped, places, [actor(1, { x: 5, y: 0, z: 6 })], 1, { variant: 0, blackFriday: false }).bomb, dropped);
});

it('carriers plant by holding use inside the site and the plant completes after the plant time', () => {
  const carried: BombState = { kind: 'carried', carrier: 7 };
  assert.deepEqual(stepBomb(carried, places, [actor(0, places.site)], 1, { variant: 0, blackFriday: false }).bomb, carried);
  assert.deepEqual(stepBomb(carried, places, [actor(0, places.home, { using: true })], 1, { variant: 0, blackFriday: false }).bomb, carried);
  const start = stepBomb(carried, places, [actor(0, places.site, { using: true })], 10, { variant: 0, blackFriday: false });
  assert.deepEqual(start.bomb, { kind: 'planting', carrier: 7, doneAtTick: 10 + PLANT_TICKS });
  const holding = [actor(0, places.site, { using: true })];
  assert.equal(stepBomb(start.bomb, places, holding, 9 + PLANT_TICKS, { variant: 4, blackFriday: false }).bomb.kind, 'planting');
  const done = stepBomb(start.bomb, places, holding, 10 + PLANT_TICKS, { variant: 4, blackFriday: false });
  assert.deepEqual(done.bomb, { kind: 'planted', ...places.site, explodeAtTick: 10 + PLANT_TICKS + FUSE_TICKS, variant: 4, defuse: null });
  assert.deepEqual(done.events, [{ k: 'bomb', what: 'plant', team: 0, by: 7 }]);
});

it('releasing use or leaving the site returns a planting carrier to carried', () => {
  const planting: BombState = { kind: 'planting', carrier: 7, doneAtTick: 100 };
  for (const state of [actor(0, places.site), actor(0, places.home, { using: true })]) {
    assert.deepEqual(stepBomb(planting, places, [state], 50, { variant: 0, blackFriday: false }).bomb, { kind: 'carried', carrier: 7 });
  }
});

it('a vanished or dead carrier sends the bomb home and death drops it where it stood', () => {
  const carried: BombState = { kind: 'carried', carrier: 7 };
  assert.deepEqual(stepBomb(carried, places, [], 1, { variant: 0, blackFriday: false }).bomb, home);
  const drop = dropBomb({ kind: 'planting', carrier: 7, doneAtTick: 5 }, 7, { x: 1, y: 2, z: 3 }, 10, 0);
  assert.deepEqual(drop.bomb, { kind: 'dropped', x: 1, y: 2, z: 3, returnAtTick: 10 + BOMB_RETURN_TICKS });
  assert.deepEqual(drop.events, [{ k: 'bomb', what: 'drop', team: 0, by: 7 }]);
  assert.deepEqual(dropBomb(carried, 8, { x: 1, y: 2, z: 3 }, 10, 0).bomb, carried);
  assert.deepEqual(dropBomb(home, 7, { x: 1, y: 2, z: 3 }, 10, 0).events, []);
  const dropped = drop.bomb;
  assert.equal(stepBomb(dropped, places, [], 9 + BOMB_RETURN_TICKS, { variant: 0, blackFriday: false }).bomb.kind, 'dropped');
  const back = stepBomb(dropped, places, [], 10 + BOMB_RETURN_TICKS, { variant: 0, blackFriday: false });
  assert.deepEqual(back.bomb, home);
  assert.deepEqual(back.events, [{ k: 'bomb', what: 'return', team: 0, by: -1 }]);
});

it('the fuse explodes for the attackers exactly at the deadline', () => {
  assert.equal(stepBomb(planted(), places, [], 999, { variant: 0, blackFriday: false }).outcome, undefined);
  const boom = stepBomb(planted(), places, [], 1000, { variant: 0, blackFriday: false });
  assert.equal(boom.outcome, 'exploded');
  assert.deepEqual(boom.bomb, home);
  assert.deepEqual(boom.events, [{ k: 'bomb', what: 'exploded', team: 0, by: -1 }]);
});

it('one defender holding use near the bomb defuses it after the defuse time; attackers cannot', () => {
  const near = { ...places.site, x: 40 };
  assert.deepEqual(stepBomb(planted(), places, [actor(0, near, { using: true })], 1, { variant: 0, blackFriday: false }).bomb, planted());
  assert.deepEqual(stepBomb(planted(), places, [actor(1, { ...places.site, x: 200 }, { using: true })], 1, { variant: 0, blackFriday: false }).bomb, planted());
  const start = stepBomb(planted(), places, [actor(1, near, { using: true })], 20, { variant: 0, blackFriday: false });
  assert.deepEqual(start.bomb, planted({ defuse: { by: 9, doneAtTick: 20 + DEFUSE_TICKS } }));
  assert.deepEqual(start.events, [{ k: 'bomb', what: 'defuse', team: 1, by: 9 }]);
  const second = { ...actor(1, near, { using: true }), id: 11 };
  const holding = [second, actor(1, near, { using: true })];
  assert.equal(stepBomb(start.bomb, places, holding, 21, { variant: 0, blackFriday: false }).events.length, 0);
  assert.equal(stepBomb(start.bomb, places, holding, 19 + DEFUSE_TICKS, { variant: 0, blackFriday: false }).outcome, undefined);
  const done = stepBomb(start.bomb, places, holding, 20 + DEFUSE_TICKS, { variant: 0, blackFriday: false });
  assert.equal(done.outcome, 'defused');
  assert.deepEqual(done.bomb, home);
  assert.deepEqual(done.events, [{ k: 'bomb', what: 'defused', team: 1, by: 9 }]);
});

it('release, death or leaving cancel the defuse and progress starts over', () => {
  const near = { ...places.site, x: 40 };
  const defusing = planted({ defuse: { by: 9, doneAtTick: 100 } });
  for (const state of [actor(1, near), actor(1, near, { using: true, alive: false }), actor(1, { ...places.site, x: 300 }, { using: true })]) {
    assert.deepEqual(stepBomb(defusing, places, [state], 50, { variant: 0, blackFriday: false }).bomb, planted());
  }
  const restart = stepBomb(defusing, places, [actor(1, near, { using: true })], 99, { variant: 0, blackFriday: false });
  assert.equal(restart.outcome, undefined);
  const resumed = stepBomb(planted(), places, [actor(1, near, { using: true })], 99, { variant: 0, blackFriday: false });
  assert.deepEqual(resumed.bomb, planted({ defuse: { by: 9, doneAtTick: 99 + DEFUSE_TICKS } }));
});

it('a defuse that cannot finish before the fuse loses to the explosion', () => {
  const near = { ...places.site, x: 40 };
  const late = planted({ explodeAtTick: 30, defuse: { by: 9, doneAtTick: 20 + DEFUSE_TICKS } });
  assert.equal(stepBomb(late, places, [actor(1, near, { using: true })], 30, { variant: 0, blackFriday: false }).outcome, 'exploded');
});

it('does not mutate its inputs', () => {
  const bomb = planted();
  const frozen = structuredClone(bomb);
  stepBomb(bomb, places, [actor(1, places.site, { using: true })], 5, { variant: 0, blackFriday: false });
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

it('starts the Black Friday fuse when planting completes', () => {
  const tick = PLANT_TICKS + 10;
  const planting = { kind: 'planting', carrier: 7, doneAtTick: tick } as const;
  const result = stepBomb(planting, places, [actor(0, places.site, { using: true })], tick, { variant: 4, blackFriday: true });
  assert.deepEqual(result.bomb, planted({ explodeAtTick: tick + BLACK_FRIDAY_FUSE_TICKS, variant: 4 }));
});

it('only home and planted bombs create a stand', () => {
  for (const kind of ['carried', 'planting', 'dropped'] as const) {
    assert.equal(bombStandBox(kind, places.home), null);
  }
  for (const [kind, stand, size, height] of [
    ['home', 'crate', BOMB_CRATE_SIZE_UNITS, BOMB_CRATE_HEIGHT_UNITS],
    ['planted', 'desk', BOMB_DESK_SIZE_UNITS, BOMB_DESK_HEIGHT_UNITS],
  ] as const) {
    const at = { x: 100, y: 20, z: -100 };
    const half = size / 2;
    assert.deepEqual(bombStandBox(kind, at), {
      stand,
      min: { x: at.x - half, y: at.y, z: at.z - half },
      max: { x: at.x + half, y: at.y + height, z: at.z + half },
    });
  }
});

it('a hull touching any side or corner of either stand can interact', () => {
  const round = { variant: 0, blackFriday: false };
  for (const [size, radius, at, bomb, team] of [
    [BOMB_CRATE_SIZE_UNITS, CTF_PICKUP_RADIUS_UNITS, places.home, home, 0],
    [BOMB_DESK_SIZE_UNITS, DEFUSE_RADIUS_UNITS, places.site, planted(), 1],
  ] as const) {
    const contact = size / 2 + PLAYER_RADIUS;
    for (const dx of [-1, 0, 1]) {
      for (const dz of [-1, 0, 1]) {
        if (dx === 0 && dz === 0) continue;
        const position = { x: at.x + dx * contact, y: at.y, z: at.z + dz * contact };
        assert.ok(inBombReach(position, at, radius));
        const result = stepBomb(bomb, places, [actor(team, position, { using: true })], 1, round);
        assert.equal(result.events[0]?.what, team === 0 ? 'take' : 'defuse');
      }
    }
  }
});

it('a movable stand blocks entry, lets a hull leave and clears when removed', () => {
  const map = getMaps()[0];
  const world = new CollisionWorld({ ...map, boxes: [] });
  const at = { x: 0, y: 0, z: 0 };
  const contact = BOMB_DESK_SIZE_UNITS / 2 + PLAYER_RADIUS;
  const stand = bombStandBox('planted', at);
  world.setProp(stand);
  world.setProp(stand);
  assert.equal(world.clipAxis(-contact, 0, 0, STAND_HEIGHT, 0, 1), 0);
  assert.equal(world.clipAxis(0, 0, 0, STAND_HEIGHT, 0, contact + 1), contact + 1);
  world.setProp(null);
  assert.equal(world.clipAxis(-contact, 0, 0, STAND_HEIGHT, 0, 1), 1);
});

it('a stand stops bullets like a map crate and stops nothing once cleared', () => {
  const world = new CollisionWorld({ ...getMaps()[0], boxes: [] });
  const shooterX = -200;
  const aimY = BOMB_DESK_SIZE_UNITS / 4;
  world.setProp(bombStandBox('planted', { x: 0, y: 0, z: 0 }));
  const hit = world.trace(shooterX, aimY, 0, 1, 0, 0, 400);
  assert.equal(hit?.t, -shooterX - BOMB_DESK_SIZE_UNITS / 2);
  assert.equal(hit?.nx, -1);
  world.setProp(null);
  assert.equal(world.trace(shooterX, aimY, 0, 1, 0, 0, 400), null);
});
