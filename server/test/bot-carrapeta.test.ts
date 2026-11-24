import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
  CTF_PICKUP_RADIUS_UNITS, CollisionWorld, MapBuilder, WEAPON, applyCmd, createPlayerState, getMaps, spawnState,
} from '@calindra-strike/shared';
import { BotBrain, type BotAgent, type BotEnv } from '../src/bot.ts';
import { NavGrid } from '../src/nav.ts';

it('walks to a Carrapeta drop in the same nav cell until it is within pickup reach', () => {
  const builder = new MapBuilder();
  builder.add(-256, -32, -256, 256, 0, 256, 'ground');
  const map = { ...getMaps()[0], boxes: builder.boxes };
  const world = new CollisionWorld(map);
  const nav = new NavGrid(world, map);
  const node = nav.nearest(0, 0, 0);
  assert.ok(node);

  const state = createPlayerState();
  spawnState(state, node.x - 20, node.y, node.z - 20, 0, WEAPON.RIFLE);
  state.dropping = false;
  state.onGround = true;
  const self: BotAgent = { id: 1, team: 0, alive: true, state };
  const drop = { kind: 'dropped', x: node.x + 20, y: node.y, z: node.z + 20, rerollAtTick: 300 } as const;
  assert.equal(nav.nearest(state.x, state.y, state.z), node);
  assert.equal(nav.nearest(drop.x, drop.y, drop.z), node);

  const distance = () => Math.hypot(drop.x - state.x, drop.y - state.y, drop.z - state.z);
  assert.ok(distance() > CTF_PICKUP_RADIUS_UNITS);
  const env: BotEnv = { world, nav, mode: 'carrapeta', carrapeta: drop, players: [self], airdrops: [], tick: 0, now: 0, random: () => 0.5 };
  const brain = new BotBrain(0.5);
  for (env.tick = 1; env.tick <= 120 && distance() > CTF_PICKUP_RADIUS_UNITS; env.tick++) {
    applyCmd(world, state, brain.think(self, env), self.id);
  }
  assert.ok(distance() <= CTF_PICKUP_RADIUS_UNITS, `bot stopped ${distance()} units from the drop`);
});
