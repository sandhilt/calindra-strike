import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BTN, RF_ALIVE, TICK_MS, WEAPON, createPlayerState, packState, spawnState } from '../../shared/src/index.ts';
import { aimSkill } from '../../server/src/bot.ts';
import { BotDriver, type Brain, type Snap } from '../bot-driver.ts';

const FORJA = 0;
const SELF = { x: -100, y: 0, z: -1500 };
const ENEMY = { x: -100, y: 0, z: -1150 };
const holdBrain: Brain = { decide: () => ({ role: 'hold', point: SELF, settle: 1000 }) };

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ticks from an enemy stepping into view until the bot first pulls the trigger. */
function ticksToFirstShot(skill: number, seed: number): number {
  const driver = new BotDriver(holdBrain, skill, seeded(seed));
  const state = createPlayerState();
  spawnState(state, SELF.x, SELF.y, SELF.z, Math.PI / 2, WEAPON.RIFLE);
  state.dropping = false;
  state.onGround = true;
  const teams = new Map([[1, 0], [2, 1]]);
  for (let tick = 1; tick <= 120; tick++) {
    const snap: Snap = {
      t: 'snap', time: tick * TICK_MS, ack: 0, me: packState(state),
      ps: [[2, ENEMY.x, ENEMY.y, ENEMY.z, 0, 0, RF_ALIVE]], ad: [], fl: [], bm: [],
    };
    if (driver.drive(snap, FORJA, 1, teams, tick).buttons & BTN.ATTACK) return tick;
  }
  return Infinity;
}

const average = (skill: number) => {
  const runs = Array.from({ length: 20 }, (_, seed) => ticksToFirstShot(skill, seed));
  assert.ok(runs.every(Number.isFinite), 'the bot at skill ' + skill + ' shot within two seconds: ' + runs);
  return runs.reduce((a, b) => a + b) / runs.length;
};

describe('dev bot aim follows BOT_SKILL', () => {
  it('a low-skill bot takes longer to open fire than a high-skill one', () => {
    const slow = average(0);
    const fast = average(1);
    assert.ok(slow > fast + 10, 'skill 0 fired after ' + slow + ' ticks on average, skill 1 after ' + fast);
  });

  it('never fires before its reaction time, even at full skill', () => {
    for (let seed = 0; seed < 20; seed++) assert.ok(ticksToFirstShot(1, seed) > aimSkill(1).reactTicks, 'seed ' + seed);
  });
});
