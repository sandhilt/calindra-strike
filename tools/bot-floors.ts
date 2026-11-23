/**
 * Dev-only: where do server bots spend their time, and do they get stuck?
 *   node tools/bot-floors.ts [--map shopping] [--bots 8] [--seconds 300] [--seeds 3] [--modes tdm,ffa,ctf,defuse,almoco] [--stuck 5]
 *
 * Runs the real `Game` in-process (clock = ticks, seeded random), so a run is fast and repeatable. For every bot in
 * play it tallies time per floor, time inside the ground floor stores, and "stuck" episodes: the bot stayed within
 * STUCK_RADIUS_UNITS of one spot for `--stuck` seconds without firing or holding USE.
 */
import { parseArgs } from 'node:util';
import { TICK_RATE, WEAPON, mulberry32 } from '../shared/src/index.ts';
import { Game } from '../server/src/game.ts';

const STUCK_RADIUS_UNITS = 64;
const STUCK_RELEASE_UNITS = 96;
/** Height at which a bot counts as one floor higher: halfway to each floor of a mall. */
const FLOOR_SPLITS_UNITS = [96, 296] as const;
const STORE_DEPTH_UNITS = 880;
/** A bot this close to a flag base is guarding it (CTF, debug defusion), which is standing still on purpose. */
const GUARD_RADIUS_UNITS = 200;
const SPOT_CELL_UNITS = 96;
const SAMPLE_TICKS = TICK_RATE;

interface Tally {
  botSeconds: number;
  floorSeconds: number[];
  storeSeconds: number;
  floorChanges: number;
  stuckEpisodes: number;
  stuckSpots: Map<string, number>;
}

const floorOf = (y: number): number => FLOOR_SPLITS_UNITS.filter((split) => y > split).length;

function newTally(): Tally {
  return { botSeconds: 0, floorSeconds: [0, 0, 0], storeSeconds: 0, floorChanges: 0, stuckEpisodes: 0, stuckSpots: new Map() };
}

interface Trail {
  samples: { x: number; y: number; z: number }[];
  floor: number;
  stuckAt: { x: number; y: number; z: number } | null;
}

function run(map: string, mode: string, bots: number, seconds: number, seed: number, stuckSeconds: number): Tally {
  const random = mulberry32(seed);
  const game = new Game({
    maxPlayers: 24, matchMs: seconds * 1000 + 60_000, podiumMs: 15_000, warmupMinPlayers: 2, maps: [map],
    modes: [mode as 'tdm'], botFill: bots, botSkill: 0.5, random, airdropFirstMs: 25_000,
  });
  game.join('Observer', 0, WEAPON.RIFLE, () => {});
  const tally = newTally();
  const trails = new Map<number, Trail>();
  for (let tick = 0; tick < seconds * TICK_RATE; tick++) {
    game.update();
    if (tick % SAMPLE_TICKS !== 0 || game.phase === 'podium') continue;
    for (const p of game.players.values()) {
      if (!p.brain) continue;
      const s = p.state;
      const trail = trails.get(p.id) ?? { samples: [], floor: 0, stuckAt: null };
      trails.set(p.id, trail);
      if (!p.alive || s.dropping) {
        trail.samples.length = 0;
        trail.stuckAt = null;
        continue;
      }
      const floor = floorOf(s.y);
      if (trail.samples.length > 0 && floor !== trail.floor) tally.floorChanges++;
      trail.floor = floor;
      tally.botSeconds++;
      tally.floorSeconds[floor]++;
      if (floor === 0 && Math.abs(s.z) > STORE_DEPTH_UNITS) tally.storeSeconds++;
      trail.samples.push({ x: s.x, y: s.y, z: s.z });
      if (trail.samples.length > stuckSeconds) trail.samples.shift();
      if (trail.stuckAt) {
        if (Math.hypot(s.x - trail.stuckAt.x, s.z - trail.stuckAt.z) > STUCK_RELEASE_UNITS || Math.abs(s.y - trail.stuckAt.y) > 24) trail.stuckAt = null;
        continue;
      }
      if (trail.samples.length < stuckSeconds) continue;
      const first = trail.samples[0];
      const near = trail.samples.every((q) => Math.hypot(q.x - first.x, q.z - first.z) < STUCK_RADIUS_UNITS && Math.abs(q.y - first.y) < 24);
      const guarding = game.map.flagBases.some((base) => Math.hypot(base.x - s.x, base.z - s.z) < GUARD_RADIUS_UNITS);
      const busy = p.using || guarding || p.brain.browsing || s.tick - s.lastFire < stuckSeconds * TICK_RATE;
      if (!near || busy) continue;
      trail.stuckAt = { x: s.x, y: s.y, z: s.z };
      tally.stuckEpisodes++;
      const spot = [Math.round(s.x / SPOT_CELL_UNITS) * SPOT_CELL_UNITS, Math.round(s.y), Math.round(s.z / SPOT_CELL_UNITS) * SPOT_CELL_UNITS].join(',');
      tally.stuckSpots.set(spot, (tally.stuckSpots.get(spot) ?? 0) + 1);
    }
  }
  return tally;
}

function add(a: Tally, b: Tally): void {
  a.botSeconds += b.botSeconds;
  b.floorSeconds.forEach((v, i) => (a.floorSeconds[i] += v));
  a.storeSeconds += b.storeSeconds;
  a.floorChanges += b.floorChanges;
  a.stuckEpisodes += b.stuckEpisodes;
  for (const [k, v] of b.stuckSpots) a.stuckSpots.set(k, (a.stuckSpots.get(k) ?? 0) + v);
}

const { values } = parseArgs({
  options: {
    map: { type: 'string', default: 'shopping' },
    bots: { type: 'string', default: '8' },
    seconds: { type: 'string', default: '300' },
    seeds: { type: 'string', default: '3' },
    modes: { type: 'string', default: 'tdm,ffa,ctf,defuse,almoco' },
    stuck: { type: 'string', default: '5' },
  },
});

const pct = (part: number, whole: number) => (whole ? ((100 * part) / whole).toFixed(1) : '0.0') + '%';

const perHour = (count: number, botSeconds: number) => (botSeconds ? ((count * 3600) / botSeconds).toFixed(1) : '0.0');

function report(label: string, t: Tally): string {
  const floors = t.floorSeconds.map((v, i) => 'floor ' + i + ' ' + pct(v, t.botSeconds)).join(', ');
  return `${label.padEnd(10)} bot-seconds ${t.botSeconds} | ${floors} | in stores ${pct(t.storeSeconds, t.botSeconds)} | floor changes ${perHour(t.floorChanges, t.botSeconds)}/bot-hour | stuck > ${values.stuck}s: ${t.stuckEpisodes} (${perHour(t.stuckEpisodes, t.botSeconds)}/bot-hour)`;
}

const total = newTally();
for (const mode of values.modes.split(',')) {
  const modeTally = newTally();
  for (let seed = 1; seed <= Number(values.seeds); seed++) {
    add(modeTally, run(values.map, mode, Number(values.bots), Number(values.seconds), seed, Number(values.stuck)));
  }
  add(total, modeTally);
  console.log(report(mode, modeTally));
}
console.log(report('all modes', total));
const spots = [...total.stuckSpots].toSorted((p, q) => q[1] - p[1]).slice(0, 8);
console.log('worst spots (x,y,z cell: episodes):', spots.map(([k, v]) => k + ': ' + v).join(' | ') || 'none');
