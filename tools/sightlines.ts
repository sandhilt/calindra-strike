/**
 * Dev-only: how open is a map to clean long shots?
 *   node tools/sightlines.ts [mapId...]
 *
 * Samples walkable standing points (nav nodes a player can reach from the first flag base) with a fixed seed.
 * `clearPairs` is the share of point pairs with an unobstructed bullet line, using the rule bots use to see
 * a target. `lane*` is how far a player sees along a horizontal ray from eye height before a bullet blocker.
 */
import { CollisionWorld, STAND_EYE, getMaps, type MapDef } from '../shared/src/index.ts';
import { hasLineOfSight } from '../server/src/bot.ts';
import { NavGrid, type NavNode } from '../server/src/nav.ts';

const PAIRS = 12_000;
const RAYS_PER_POINT = 32;
const RAY_POINTS = 600;
const LANE_CAP_UNITS = 4000;
const LONG_SHOT_UNITS = 800;
const SEED = 20260;

export interface SightlineStats {
  /** Sampled pairs with a clear line, as a share of all pairs. */
  clearPairs: number;
  /** Share of clear lines longer than `LONG_SHOT_UNITS`, over all pairs: the lanes a sniper can use. */
  longClearPairs: number;
  /** Distance quantiles of the clear lines, in world units. */
  clearMedian: number;
  clearP90: number;
  clearMax: number;
  /** Free run along horizontal rays from eye height, in world units. */
  laneMedian: number;
  laneP90: number;
  laneP99: number;
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quantile(sorted: readonly number[], q: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

/** Nodes reachable by walking, jumping up and dropping down from the first flag base. */
export function walkableNodes(nav: NavGrid, map: MapDef): NavNode[] {
  const base = map.flagBases[0];
  const start = nav.nearest(base.x, 0, base.z);
  return start ? nav.reachableFrom(start) : [];
}

export function measureSightlines(world: CollisionWorld, nav: NavGrid, map: MapDef): SightlineStats {
  const nodes = walkableNodes(nav, map);
  const random = rng(SEED);
  const pick = () => nodes[Math.floor(random() * nodes.length)];

  const clearLengths: number[] = [];
  for (let i = 0; i < PAIRS; i++) {
    const a = pick();
    const b = pick();
    if (!hasLineOfSight(world, a.x, a.y + STAND_EYE, a.z, b)) continue;
    clearLengths.push(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
  }
  clearLengths.sort((p, q) => p - q);

  const lanes: number[] = [];
  for (let i = 0; i < RAY_POINTS; i++) {
    const a = pick();
    const phase = random() * Math.PI * 2;
    for (let r = 0; r < RAYS_PER_POINT; r++) {
      const angle = phase + (r / RAYS_PER_POINT) * Math.PI * 2;
      const hit = world.trace(a.x, a.y + STAND_EYE, a.z, Math.cos(angle), 0, Math.sin(angle), LANE_CAP_UNITS);
      lanes.push(hit ? hit.t : LANE_CAP_UNITS);
    }
  }
  lanes.sort((p, q) => p - q);

  return {
    clearPairs: clearLengths.length / PAIRS,
    longClearPairs: clearLengths.filter((d) => d > LONG_SHOT_UNITS).length / PAIRS,
    clearMedian: quantile(clearLengths, 0.5),
    clearP90: quantile(clearLengths, 0.9),
    clearMax: clearLengths.at(-1) ?? 0,
    laneMedian: quantile(lanes, 0.5),
    laneP90: quantile(lanes, 0.9),
    laneP99: quantile(lanes, 0.99),
  };
}

if (import.meta.main) {
  const wanted = process.argv.slice(2);
  for (const map of getMaps().filter((m) => !wanted.length || wanted.includes(m.id))) {
    const world = new CollisionWorld(map);
    const stats = measureSightlines(world, new NavGrid(world, map), map);
    const fmt = Object.entries(stats).map(([k, v]) => `${k}=${k.endsWith('Pairs') ? (v * 100).toFixed(2) + '%' : Math.round(v)}`);
    console.log(`${map.id.padEnd(11)} ${fmt.join('  ')}`);
  }
}
