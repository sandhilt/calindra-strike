import type { MapDef, MapProp } from './maps/types.ts';
import { PLAYER_RADIUS } from './constants.ts';
import type { PlayerState } from './sim.ts';

/** How fast the steps travel, in horizontal units per second. The client animates its drawn steps at the same speed. */
export const ESCALATOR_SPEED_UNITS = 30;
/** Longest rise of one step: `MapBuilder.stairs` never makes a step taller. */
const STEP_RISE_MAX_UNITS = 16;
/** Feet this close to a tread count as standing on it (units). */
const TREAD_SLACK_UNITS = 2;

interface Escalator {
  x: number;
  z: number;
  y: number;
  dirX: number;
  dirZ: number;
  halfWidth: number;
  length: number;
  rise: number;
  run: number;
  steps: number;
  /** +1 carries uphill, -1 downhill. */
  sign: 1 | -1;
}

type EscalatorProp = Extract<MapProp, { kind: 'escalator' }>;

const asEscalator = (p: EscalatorProp): Escalator => {
  const steps = Math.ceil(p.height / STEP_RISE_MAX_UNITS);
  return {
    x: p.x, z: p.z, y: p.y, dirX: p.dirX, dirZ: p.dirZ,
    halfWidth: p.width / 2, length: p.length, rise: p.height / steps, run: p.length / steps, steps,
    sign: p.travel === 'up' ? 1 : -1,
  };
};

const cache = new WeakMap<MapDef, readonly Escalator[]>();

function escalatorsOf(map: MapDef): readonly Escalator[] {
  const known = cache.get(map);
  if (known) return known;
  const built: Escalator[] = [];
  for (const p of map.props) if (p.kind === 'escalator') built.push(asEscalator(p));
  cache.set(map, built);
  return built;
}

/** Height of the tread under `along` units from the foot, the same steps `MapBuilder.stairs` makes. */
function treadAt(e: Escalator, along: number): number {
  if (along < 0) return e.y;
  const step = Math.min(Math.floor(along / e.run), e.steps - 1);
  return e.y + e.rise * (step + 1);
}

/**
 * The drift of the steps under a standing player, in units per second, or null when they are not on one.
 * It is a pure function of the map and the pose, so the server and the client prediction agree.
 */
export function escalatorDrift(map: MapDef, s: Pick<PlayerState, 'x' | 'y' | 'z' | 'onGround'>): readonly [number, number] | null {
  if (!s.onGround) return null;
  for (const e of escalatorsOf(map)) {
    const dx = s.x - e.x;
    const dz = s.z - e.z;
    const along = dx * e.dirX + dz * e.dirZ;
    // A descending belt keeps carrying until the hull has cleared the first tread, not just the centre, or a rider stops on its edge above the landing.
    const start = e.sign < 0 ? -PLAYER_RADIUS : 0;
    if (along < start || along >= e.length) continue;
    if (Math.abs(dx * e.dirZ - dz * e.dirX) > e.halfWidth) continue;
    const low = treadAt(e, along - PLAYER_RADIUS);
    const high = treadAt(e, along + PLAYER_RADIUS);
    if (s.y < low - TREAD_SLACK_UNITS || s.y > high + TREAD_SLACK_UNITS) continue;
    return [e.dirX * e.sign * ESCALATOR_SPEED_UNITS, e.dirZ * e.sign * ESCALATOR_SPEED_UNITS];
  }
  return null;
}
