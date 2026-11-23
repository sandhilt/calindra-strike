import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld, createPlayerState, getMaps, MapBuilder, spawnState, STANCE, WEAPON, type MapDef, type Stance } from '@calindra-strike/shared';
import { BotBrain, type BotAgent, type BotEnv } from '../src/bot.ts';
import { NavGrid } from '../src/nav.ts';

const LOW_BARRIER_UNITS = 32;

/** The enemy stands 400 units ahead, inside hearing range so the field of view does not matter, behind a low wall near it. */
function duel(enemyStance: Stance) {
  const b = new MapBuilder();
  b.add(-4000, -32, -4000, 4000, 0, 4000, 'ground');
  b.add(100, 0, -200, 104, LOW_BARRIER_UNITS, 200, 'crate');
  const map: MapDef = { ...getMaps()[0], boxes: b.boxes };
  const world = new CollisionWorld(map);
  const self: BotAgent = { id: 6, team: 0, alive: true, state: createPlayerState() };
  spawnState(self.state, -300, 0, 0, 0, WEAPON.RIFLE);
  const enemy: BotAgent = { id: 7, team: 1, alive: true, state: createPlayerState() };
  spawnState(enemy.state, 100 + 4 + 96, 0, 0, 0, WEAPON.RIFLE);
  for (const p of [self, enemy]) Object.assign(p.state, { dropping: false, onGround: true });
  enemy.state.stance = enemyStance;
  const env: BotEnv = { world, nav: new NavGrid(world, map), tick: 0, now: 0, mode: 'tdm', random: () => 0.5, players: [self, enemy], airdrops: [] };
  return { self, env };
}

function spotsEnemy(enemyStance: Stance): boolean {
  const { self, env } = duel(enemyStance);
  const brain = new BotBrain(1);
  for (env.tick = 0; env.tick < 12; env.tick++) brain.think(self, env);
  return brain.takeSpotted();
}

describe('bot target acquisition behind low cover', () => {
  it('sees a standing enemy over the barrier', () => {
    assert.equal(spotsEnemy(STANCE.STAND), true);
  });

  it('does not acquire a prone enemy the barrier covers', () => {
    assert.equal(spotsEnemy(STANCE.PRONE), false);
  });
});
