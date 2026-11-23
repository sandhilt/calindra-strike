import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld, TICK_RATE, WEAPON, applyCmd, createPlayerState, getMaps, spawnState } from '@calindra-strike/shared';
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

function trip(from: readonly [number, number, number], to: readonly [number, number, number], seconds: number) {
  const state = createPlayerState();
  spawnState(state, from[0], from[1], from[2], 0, WEAPON.RIFLE);
  state.dropping = false;
  state.onGround = true;
  const self: BotAgent = { id: 1, team: 0, alive: true, state };
  const env: BotEnv = { world: collision, nav, random: seeded(7), players: [self], airdrops: [], tick: 0, now: 0, mode: 'tdm' };
  const brain = new BotBrain(0.5);
  brain.setDirective({ kind: 'goto', x: to[0], y: to[1], z: to[2] });
  for (env.tick = 1; env.tick <= seconds * TICK_RATE; env.tick++) {
    collision.liftTick = env.tick;
    applyCmd(collision, state, brain.think(self, env), 1);
    if (brain.arrived) return { arrived: true, at: env.tick / TICK_RATE, state };
  }
  return { arrived: false, at: Infinity, state };
}

const where = (s: { x: number; y: number; z: number }) => [s.x, s.y, s.z].map(Math.round).join(',');

describe('bots on every escalator of Shopping Sul Rio, going up and coming down', () => {
  const escalators = shopping.props.filter((p) => p.kind === 'escalator');
  for (const e of escalators) {
    const foot = { x: e.x - e.dirX * 40, z: e.z - e.dirZ * 40, y: e.y };
    const top = { x: e.x + e.dirX * (e.length + 40), z: e.z + e.dirZ * (e.length + 40), y: e.y + e.height };
    it(`climbs and descends the one at ${e.x},${e.z} (${e.travel}, from y ${e.y})`, () => {
      const up = trip([foot.x, foot.y, foot.z], [top.x, top.y, top.z], 30);
      assert.ok(up.arrived, 'did not reach the top, stopped at ' + where(up.state));
      assert.ok(Math.abs(up.state.y - top.y) <= 20);
      const down = trip([top.x, top.y, top.z], [foot.x, foot.y, foot.z], 30);
      assert.ok(down.arrived, 'did not reach the foot, stopped at ' + where(down.state));
      assert.ok(Math.abs(down.state.y - foot.y) <= 20);
    });
  }
});

describe('bots in the shops and rooms of Shopping Sul Rio', () => {
  for (const spot of shopping.interiors) {
    it(`reaches the interior at ${spot.x},${spot.y},${spot.z} from a flag base`, () => {
      const base = shopping.flagBases[spot.z < 0 ? 1 : 0];
      const r = trip([base.x, 0, base.z], [spot.x, spot.y, spot.z], 90);
      assert.ok(r.arrived, 'stopped at ' + where(r.state));
      assert.ok(Math.abs(r.state.y - spot.y) <= 20);
    });
  }
});
