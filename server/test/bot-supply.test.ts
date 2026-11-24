import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld, MAX_ARMOR, TICK_RATE, WEAPON, applyCmd, createPlayerState, getMaps, inSupplyReach, spawnState } from '@calindra-strike/shared';
import { BotBrain, pickSupplyGoal, type BotAgent, type BotEnv } from '../src/bot.ts';
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

function agent(x: number, y: number, z: number, health: number, armor = MAX_ARMOR): BotAgent {
  const state = createPlayerState();
  spawnState(state, x, y, z, 0, WEAPON.RIFLE);
  state.dropping = false;
  state.onGround = true;
  state.health = health;
  state.armor = armor;
  return { id: 1, team: 0, alive: true, state };
}

const SUPPLIES = shopping.supplies.map((stand) => ({ ...stand, ready: true }));

function env(self: BotAgent, supplies = SUPPLIES, mode: BotEnv['mode'] = 'tdm'): BotEnv {
  return { world: collision, nav, random: seeded(4), players: [self], airdrops: [], tick: 0, now: 0, mode, supplies };
}

describe('bots and the Mirante supply stand', () => {
  it('picks the nearest full stand, and only for a bot that is worth the trip', () => {
    const hurt = agent(0, 0, -300, 30);
    assert.deepEqual(pickSupplyGoal(hurt, env(hurt), false), { x: 0, y: 384, z: -880, ready: true });
    const southern = agent(0, 0, 300, 30);
    assert.equal(pickSupplyGoal(southern, env(southern), false)?.z, 880);
    const fine = agent(0, 0, -300, 100);
    assert.equal(pickSupplyGoal(fine, env(fine), false), null);
    const scratched = agent(0, 0, -300, 90);
    assert.equal(pickSupplyGoal(scratched, env(scratched), false), null, 'a scratch is not worth the trip');
    const unarmoured = agent(0, 0, -300, 100, 0);
    assert.notEqual(pickSupplyGoal(unarmoured, env(unarmoured), false), null);
  });

  it('skips a stand that is empty, and an objective bot only goes when it is badly hurt', () => {
    const hurt = agent(0, 0, -300, 30);
    assert.equal(pickSupplyGoal(hurt, env(hurt, SUPPLIES.map((s) => ({ ...s, ready: false }))), false), null);
    const half = agent(0, 0, -300, 50);
    assert.equal(pickSupplyGoal(half, env(half), true), null);
    assert.notEqual(pickSupplyGoal(hurt, env(hurt), true), null);
  });

  it('walks a hurt roaming bot up to a stand, whichever one its route reaches first', () => {
    const self = agent(0, 0, -300, 30);
    const e = env(self);
    const brain = new BotBrain(0.5);
    let reached = -1;
    for (e.tick = 1; e.tick <= TICK_RATE * 60 && reached < 0; e.tick++) {
      collision.liftTick = e.tick;
      applyCmd(collision, self.state, brain.think(self, e), 1);
      if (shopping.supplies.some((stand) => inSupplyReach(self.state, stand))) reached = e.tick;
    }
    assert.ok(reached > 0, 'never reached a stand, stopped at ' + [self.state.x, self.state.y, self.state.z].map(Math.round));
  });
});
