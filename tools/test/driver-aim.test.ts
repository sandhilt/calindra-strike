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

function drive(skill: number, random: () => number, enemy: { x: number; y: number; z: number }, ticks: number) {
  const driver = new BotDriver(holdBrain, skill, random);
  const state = createPlayerState();
  spawnState(state, SELF.x, SELF.y, SELF.z, Math.PI / 2, WEAPON.RIFLE);
  state.dropping = false;
  state.onGround = true;
  const teams = new Map([[1, 0], [2, 1]]);
  const inputs = [];
  for (let tick = 1; tick <= ticks; tick++) {
    const snap: Snap = {
      t: 'snap', time: tick * TICK_MS, ack: 0, me: packState(state),
      ps: [[2, enemy.x, enemy.y, enemy.z, 0, 0, RF_ALIVE]], ad: [], fl: [], bm: [], lu: [], lc: [], su: [],
    };
    inputs.push(driver.drive(snap, FORJA, 1, teams, tick));
  }
  return inputs;
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
      ps: [[2, ENEMY.x, ENEMY.y, ENEMY.z, 0, 0, RF_ALIVE]], ad: [], fl: [], bm: [], lu: [], lc: [], su: [],
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

describe('dev bot aim moves like a hand', () => {
  it('turns its view toward a new walking direction over several frames instead of snapping', () => {
    const side = { x: SELF.x + 400, y: 0, z: SELF.z };
    const brain: Brain = { decide: () => ({ role: 'go', point: side }) };
    const driver = new BotDriver(brain, 0.5, seeded(3));
    const state = createPlayerState();
    spawnState(state, SELF.x, SELF.y, SELF.z, 0, WEAPON.RIFLE);
    state.dropping = false;
    state.onGround = true;
    const teams = new Map([[1, 0]]);
    const yaws = [];
    for (let tick = 1; tick <= 60; tick++) {
      const snap: Snap = { t: 'snap', time: tick * TICK_MS, ack: 0, me: packState(state), ps: [], ad: [], fl: [], bm: [], lu: [], lc: [], su: [] };
      yaws.push(driver.drive(snap, FORJA, 1, teams, tick).yaw);
    }
    const heading = yaws.at(-1)!;
    const gap = (yaw: number) => Math.abs(Math.atan2(Math.sin(yaw - heading), Math.cos(yaw - heading)));
    assert.ok(gap(yaws[0]) > Math.PI / 3, 'it starts facing away from where it walks: ' + gap(yaws[0]));
    assert.ok(gap(yaws[1]) > Math.PI / 4, 'still well short of the new heading after two frames: ' + gap(yaws[1]));
    assert.ok(gap(yaws[50]) < 5 * Math.PI / 180, 'facing it within a second: ' + gap(yaws[50]));
  });

  it('turns onto a target fast at first and slows down as it arrives, without snapping', () => {
    const yaws = drive(0.5, seeded(7), ENEMY, 60).map((input) => input.yaw);
    const steps = yaws.slice(1).map((yaw, i) => Math.abs(Math.atan2(Math.sin(yaw - yaws[i]), Math.cos(yaw - yaws[i]))));
    const biggest = Math.max(...steps);
    assert.ok(biggest < Math.PI / 4, 'no frame turns more than 45 degrees: ' + biggest);
    const early = steps.slice(0, 5).reduce((a, b) => a + b);
    const late = steps.slice(-5).reduce((a, b) => a + b);
    assert.ok(late < early / 4, 'the last frames move far less than the first: ' + late + ' vs ' + early);
  });
});

describe('dev bot crouching', () => {
  const always = () => 0.01;
  it('crouches to take a long shot once it has reacted', () => {
    const inputs = drive(0.5, always, { x: -100, y: 0, z: -900 }, 120);
    assert.ok(inputs.some((input) => input.buttons & BTN.ATTACK), 'it shoots at the far enemy');
    assert.ok(inputs.some((input) => input.buttons & BTN.DUCK), 'and crouches for it');
    assert.equal(inputs[0].buttons & BTN.DUCK, 0, 'not before reacting');
  });

  it('stays on its feet in a close fight', () => {
    assert.ok(drive(0.5, always, ENEMY, 120).every((input) => !(input.buttons & BTN.DUCK)));
  });
});
