import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CollisionWorld } from '../../shared/src/index.ts';
import type { Brain } from '../bot-driver.ts';
import { defuseBrain } from '../brains.ts';
import { SECONDS, SimBot, getMap, type PlayerState } from './driver-sim.ts';

const FORJA = 0;
const CARRIED = 1;

function carrierRun(start: { x: number; z: number }, seconds: number, lag = 0) {
  const map = getMap(FORJA);
  const world = new CollisionWorld(map);
  const bot = new SimBot(defuseBrain, 1, 0, { x: start.x, y: 0, z: start.z }, lag);
  const track: { x: number; y: number; z: number }[] = [];
  for (let tick = 1; tick <= SECONDS(seconds); tick++) {
    const { x, y, z } = bot.state;
    // bm row: state, carrier, x, y, z, explodeAt, defuseDoneAt, variant, attackers, plantDoneAt, blackFriday, plantByAt
    bot.step(FORJA, world, tick, [CARRIED, bot.id, x, y, z, 0, 0, 0, 0, 0, 0, 0]);
    if (tick % 30 === 0) track.push({ x, y, z });
  }
  return track;
}

describe('dev bot carrying the bug', () => {
  for (const lag of [0, 3, 6, 12]) {
    it('leaves home and reaches the site with the snapshot ' + lag + ' ticks old', () => {
      const failures: string[] = [];
      for (const x of [-300, -100, 0, 150]) {
        for (const z of [-1500, -1350, -1250]) {
          const end = carrierRun({ x, z }, 70, lag).at(-1)!;
          if (end.z < 1000) failures.push('from ' + x + ',' + z + ' ended at ' + [end.x, end.y, end.z].map(Math.round));
        }
      }
      assert.deepEqual(failures, []);
    });
  }
});

const LAGS = [0, 6, 12];
const ORBIT_RADIANS = 1.5 * Math.PI; // a U-turn is half a turn; a bot circling a waypoint keeps turning one way

/** Most a bot turned within any one second, summed over the yaw it commanded. */
function longestSpin(yaws: number[]): number {
  const wrapped = yaws.map((yaw, i) => (i === 0 ? 0 : Math.atan2(Math.sin(yaw - yaws[i - 1]), Math.cos(yaw - yaws[i - 1]))));
  let longest = 0;
  for (let end = SECONDS(1); end < wrapped.length; end++) {
    let rotation = 0;
    for (let i = end - SECONDS(1) + 1; i <= end; i++) rotation += wrapped[i];
    longest = Math.max(longest, Math.abs(rotation));
  }
  return longest;
}

describe('dev bot on stairs', () => {
  const goalBrain = (point: { x: number; y: number; z: number }): Brain => ({
    decide: () => ({ role: 'fetch', point, settle: 30 }),
  });
  const top = { x: -72, y: 96, z: 216 }; // the anvil stairs on Forja
  for (const lag of LAGS) {
    it('climbs to the platform and stays on it with the snapshot ' + lag + ' ticks old', () => {
      const world = new CollisionWorld(getMap(FORJA));
      const bot = new SimBot(goalBrain(top), 1, 0, { x: -360, y: 0, z: 408 }, lag);
      let arrivedAt = -1;
      let lowest = Infinity;
      for (let tick = 1; tick <= SECONDS(40); tick++) {
        bot.step(FORJA, world, tick, [1, bot.id, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        const onTop = Math.hypot(top.x - bot.state.x, top.z - bot.state.z) < 60 && Math.abs(top.y - bot.state.y) <= 20;
        if (arrivedAt < 0 && onTop) arrivedAt = tick;
        if (arrivedAt > 0 && tick > arrivedAt + SECONDS(3)) lowest = Math.min(lowest, bot.state.y);
      }
      assert.ok(arrivedAt > 0, 'never reached the platform, stopped at ' + [bot.state.x, bot.state.y, bot.state.z].map(Math.round));
      assert.ok(lowest >= top.y - 20, 'came back down to ' + lowest);
    });
  }
});

describe('dev bot orbits', () => {
  for (const lag of LAGS) {
    it('an escort does not circle its carrier with the snapshot ' + lag + ' ticks old', () => {
      const world = new CollisionWorld(getMap(FORJA));
      const carrier = new SimBot(defuseBrain, 1, 0, { x: 0, y: 0, z: -1300 }, lag);
      const escort = new SimBot(defuseBrain, 2, 0, { x: 120, y: 0, z: -1400 }, lag);
      const yaws: number[] = [];
      for (let tick = 1; tick <= SECONDS(40); tick++) {
        const { x, y, z } = carrier.state;
        const bm = [1, carrier.id, x, y, z, 0, 0, 0, 0, 0, 0, 0];
        carrier.step(FORJA, world, tick, bm, [escort]);
        escort.step(FORJA, world, tick, bm, [carrier]);
        yaws.push(escort.state.yaw);
      }
      assert.ok(longestSpin(yaws) < ORBIT_RADIANS, 'turned ' + longestSpin(yaws).toFixed(1) + ' rad within one second');
    });

    it('a defender walks the ring round the site without turning in circles with the snapshot ' + lag + ' ticks old', () => {
      const world = new CollisionWorld(getMap(FORJA));
      const defender = new SimBot(defuseBrain, 3, 1, { x: 0, y: 0, z: 1200 }, lag);
      const yaws: number[] = [];
      const farthest: number[] = [];
      for (let tick = 1; tick <= SECONDS(60); tick++) {
        defender.step(FORJA, world, tick, [0, -1, 0, 0, -1400, 0, 0, 0, 0, 0, 0, 0]);
        yaws.push(defender.state.yaw);
        farthest.push(Math.hypot(defender.state.x, defender.state.z - 1400));
      }
      assert.ok(longestSpin(yaws) < ORBIT_RADIANS, 'turned ' + longestSpin(yaws).toFixed(1) + ' rad within one second');
      assert.ok(Math.max(...farthest) < 500, 'wandered ' + Math.round(Math.max(...farthest)) + ' units from the site');
    });
  }
});
export type { PlayerState };
