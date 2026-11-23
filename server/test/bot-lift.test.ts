import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld, TICK_RATE, WEAPON, applyCmd, createPlayerState, getMaps, liftAt, spawnState } from '@calindra-strike/shared';
import { BotBrain, type BotAgent, type BotEnv } from '../src/bot.ts';
import { NavGrid } from '../src/nav.ts';

const shopping = getMaps().find((m) => m.id === 'shopping');
assert.ok(shopping);
const collision = new CollisionWorld(shopping);
const nav = new NavGrid(collision, shopping);

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function agent(x: number, y: number, z: number): BotAgent {
  const state = createPlayerState();
  spawnState(state, x, y, z, 0, WEAPON.RIFLE);
  state.dropping = false;
  state.onGround = true;
  return { id: 1, team: 0, alive: true, state };
}

/** Sends a bot to a point and reports when it got there, and whether it rode a lift on the way. */
function trip(from: [number, number, number], to: [number, number, number], seed = 1) {
  const self = agent(...from);
  const env: BotEnv = { world: collision, nav, random: seeded(seed), players: [self], airdrops: [], tick: 0, now: 0, mode: 'tdm' };
  const brain = new BotBrain(0.5);
  brain.setDirective({ kind: 'goto', x: to[0], y: to[1], z: to[2] });
  let rode = 0;
  const shafts = new Set<unknown>();
  for (env.tick = 1; env.tick <= TICK_RATE * 60; env.tick++) {
    collision.liftTick = env.tick;
    applyCmd(collision, self.state, brain.think(self, env), 1);
    const shaft = liftAt(shopping!.lifts, self.state.x, self.state.y, self.state.z);
    if (shaft) {
      rode++;
      shafts.add(shaft);
    }
    if (brain.arrived) return { seconds: env.tick / TICK_RATE, rode, shafts, state: self.state };
  }
  return { seconds: Infinity, rode, shafts, state: self.state };
}

describe('bots and the glass lift', () => {
  for (const side of [-1, 1]) {
    const half = side < 0 ? 'north' : 'south';
    it(`rides the ${half} lift from the atrium to the Mirante`, () => {
      const r = trip([0, 0, side * 520], [0, 384, side * 800]);
      assert.ok(r.seconds < 20, `took ${r.seconds}s, stopped at ${[r.state.x, r.state.y, r.state.z].map(Math.round)}`);
      assert.ok(r.rode > 60, 'rode the lift for ' + r.rode + ' ticks');
      assert.ok(Math.abs(r.state.y - 384) <= 20);
    });

    it(`rides the ${half} lift from the Mirante down to the atrium`, () => {
      const r = trip([0, 384, side * 760], [0, 0, side * 450]);
      assert.ok(r.seconds < 25, `took ${r.seconds}s, stopped at ${[r.state.x, r.state.y, r.state.z].map(Math.round)}`);
      assert.ok(r.rode > 60, 'rode the lift for ' + r.rode + ' ticks');
      assert.ok(Math.abs(r.state.y) <= 20);
    });

    it(`gets off the ${half} lift at the food court when that is where it is going`, () => {
      const r = trip([0, 0, side * 520], [0, 192, side * 800]);
      assert.ok(r.seconds < 20, `took ${r.seconds}s, stopped at ${[r.state.x, r.state.y, r.state.z].map(Math.round)}`);
      assert.ok(Math.abs(r.state.y - 192) <= 20);
    });
  }

  it('crosses the mall from one top floor to the other, riding down one shaft and up the other', () => {
    const r = trip([0, 384, -616], [0, 384, 800]);
    assert.equal(r.shafts.size, 2, 'rode both shafts');
    assert.ok(r.seconds < 40, `took ${r.seconds}s, stopped at ${[r.state.x, r.state.y, r.state.z].map(Math.round)}`);
    assert.ok(Math.abs(r.state.y - 384) <= 20);
  });

  it('does not wait in the cab forever when its goal changes mid-ride', () => {
    const self = agent(0, 0, -520);
    const env: BotEnv = { world: collision, nav, random: seeded(3), players: [self], airdrops: [], tick: 0, now: 0, mode: 'tdm' };
    const brain = new BotBrain(0.5);
    brain.setDirective({ kind: 'goto', x: 0, y: 384, z: -800 });
    for (env.tick = 1; env.tick <= TICK_RATE * 3; env.tick++) {
      collision.liftTick = env.tick;
      applyCmd(collision, self.state, brain.think(self, env), 1);
    }
    assert.ok(self.state.y > 40, 'is riding, at ' + self.state.y);
    brain.setDirective({ kind: 'goto', x: 0, y: 0, z: -420 });
    let arrived = -1;
    for (; env.tick <= TICK_RATE * 40 && arrived < 0; env.tick++) {
      collision.liftTick = env.tick;
      applyCmd(collision, self.state, brain.think(self, env), 1);
      if (brain.arrived) arrived = env.tick;
    }
    assert.ok(arrived > 0, 'stopped at ' + [self.state.x, self.state.y, self.state.z].map(Math.round));
    assert.ok(Math.abs(self.state.y) <= 20);
  });
});
