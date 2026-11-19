import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BTN, CollisionWorld, TICK_RATE, WEAPON, applyCmd, createPlayerState, getMaps, spawnState,
  type BombPlaces, type MapDef,
} from '@calindra-strike/shared';
import { BotBrain, pickBombGoal, type BotAgent, type BotEnv } from '../src/bot.ts';
import { NavGrid } from '../src/nav.ts';

const [forja, escritorio] = getMaps();

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function world(map: MapDef) {
  const collision = new CollisionWorld(map);
  return { collision, nav: new NavGrid(collision, map) };
}

function agent(id: number, team: number, x: number, y: number, z: number): BotAgent {
  const state = createPlayerState();
  spawnState(state, x, y, z, 0, WEAPON.RIFLE);
  state.dropping = false;
  state.onGround = true;
  return { id, team, alive: true, state };
}

/** Where the bot is headed, coarse enough that a goal following a carrier counts as the same for a moment. */
function goalCell(self: BotAgent, env: BotEnv): string {
  const goal = pickBombGoal(self, env);
  return goal ? Math.round(goal.x / GOAL_CELL_UNITS) + ',' + Math.round(goal.z / GOAL_CELL_UNITS) : 'none';
}

const GOAL_CELL_UNITS = 64;
const SECONDS = (n: number) => n * TICK_RATE;

describe('bot stairs and crates', () => {
  // Start on the floor, goal on a raised surface: the anvil stairs, a crate chain and the office mezzanine.
  const climbs: [string, MapDef, [number, number, number], [number, number, number]][] = [
    ['the anvil stairs on Forja', forja, [-360, 0, 408], [-72, 96, 216]],
    ['the mezzanine stairs on Escritório', escritorio, [-200, 0, -300], [-900, 128, -940]],
  ];
  for (const [name, map, from, to] of climbs) {
    it('a bot sent up ' + name + ' gets on top and stays there', () => {
      const { collision, nav } = world(map);
      const self = agent(1, 0, ...from);
      const env: BotEnv = { world: collision, nav, random: seeded(5), players: [self], airdrops: [], tick: 0, now: 0, mode: 'tdm' };
      const brain = new BotBrain(0.5);
      brain.setDirective({ kind: 'goto', x: to[0], y: to[1], z: to[2] });
      let arrivedAt = -1;
      for (env.tick = 1; env.tick <= SECONDS(40) && arrivedAt < 0; env.tick++) {
        applyCmd(collision, self.state, brain.think(self, env), 1);
        if (brain.arrived) arrivedAt = env.tick;
      }
      assert.ok(arrivedAt > 0, 'never arrived, stopped at ' + [self.state.x, self.state.y, self.state.z].map(Math.round));
      const floor = nav.nearest(...to)!.y;
      assert.ok(Math.abs(self.state.y - floor) <= 20, 'arrived at height ' + self.state.y + ', not on the ' + floor + ' surface');
      for (let i = 0; i < SECONDS(3); i++) {
        env.tick++;
        applyCmd(collision, self.state, brain.think(self, env), 1);
        assert.ok(self.state.y >= floor - 20, 'came back down to ' + self.state.y);
      }
    });
  }

  it('a bot fetching a bomb dropped on the Forja platform climbs to it and stays', () => {
    const { collision, nav } = world(forja);
    const places: BombPlaces = { home: { x: 900, y: 0, z: 300 }, site: { x: -900, y: 0, z: -300 }, attackers: 0 };
    const self = agent(1, 0, -360, 0, 408);
    const bomb = { kind: 'dropped', x: -72, y: 96, z: 216, returnAtTick: Number.MAX_SAFE_INTEGER } as const;
    const env: BotEnv = { world: collision, nav, random: seeded(5), players: [self], airdrops: [], tick: 0, now: 0, mode: 'defuse', bomb, bombPlaces: places };
    const brain = new BotBrain(0.5);
    let climbedAt = -1;
    for (env.tick = 1; env.tick <= SECONDS(40); env.tick++) {
      applyCmd(collision, self.state, brain.think(self, env), 1);
      if (climbedAt < 0 && Math.hypot(bomb.x - self.state.x, bomb.z - self.state.z) < 60 && Math.abs(self.state.y - bomb.y) <= 20) climbedAt = env.tick;
      if (climbedAt > 0 && env.tick > climbedAt + SECONDS(3)) break;
    }
    assert.ok(climbedAt > 0, 'never reached the bomb, stopped at ' + [self.state.x, self.state.y, self.state.z].map(Math.round));
    assert.ok(Math.abs(self.state.y - bomb.y) <= 20, 'left the platform and is at ' + self.state.y);
  });
});

describe('bot escorts', () => {
  const WINDOW_TICKS = SECONDS(1);
  // A U-turn is half a turn. A bot circling a waypoint or its carrier keeps turning the same way.
  const ORBIT_RADIANS = 1.5 * Math.PI;

  function longestOrbit(map: MapDef, seed: number): number {
    const { collision, nav } = world(map);
    const random = seeded(seed);
    const floor = nav.nodes.filter((n) => n.y === 0);
    const pick = (id: number) => {
      const n = floor[Math.floor(random() * floor.length)];
      return agent(id, 0, n.x, n.y, n.z);
    };
    const carrier = pick(2);
    const escort = pick(4);
    const bases = map.flagBases.map((b) => ({ ...b, y: 0 }));
    const places: BombPlaces = { home: bases[0], site: bases[1], attackers: 0 };
    const env: BotEnv = {
      world: collision, nav, random, players: [carrier, escort], airdrops: [], tick: 0, now: 0, mode: 'defuse',
      bomb: { kind: 'carried', carrier: carrier.id }, bombPlaces: places,
    };
    const carrierBrain = new BotBrain(0.5);
    const escortBrain = new BotBrain(0.5);
    const turns: number[] = [];
    const goals: string[] = [];
    let yaw = escort.state.yaw;
    for (env.tick = 1; env.tick <= SECONDS(30); env.tick++) {
      const carrierCmd = carrierBrain.think(carrier, env);
      const escortCmd = escortBrain.think(escort, env);
      applyCmd(collision, carrier.state, carrierCmd, 1);
      applyCmd(collision, escort.state, escortCmd, 1);
      if (carrierCmd.buttons & BTN.USE && env.bomb?.kind === 'carried') {
        env.bomb = { kind: 'planting', carrier: carrier.id, doneAtTick: env.tick + SECONDS(3) };
      }
      turns.push(Math.atan2(Math.sin(escort.state.yaw - yaw), Math.cos(escort.state.yaw - yaw)));
      yaw = escort.state.yaw;
      goals.push(goalCell(escort, env));
    }
    let longest = 0;
    for (let end = WINDOW_TICKS; end < turns.length; end++) {
      let rotation = 0;
      let sameGoal = true;
      for (let i = end - WINDOW_TICKS + 1; i <= end; i++) {
        rotation += turns[i];
        if (goals[i] !== goals[end]) sameGoal = false;
      }
      if (sameGoal) longest = Math.max(longest, Math.abs(rotation));
    }
    return longest;
  }

  for (const map of [forja, escritorio]) {
    it('never circle a waypoint or their carrier while heading for the same goal on ' + map.id, () => {
      for (let seed = 1; seed <= 24; seed++) {
        const rotation = longestOrbit(map, seed);
        assert.ok(rotation < ORBIT_RADIANS, 'seed ' + seed + ' turned ' + rotation.toFixed(1) + ' rad within one second toward one goal');
      }
    });
  }
});
