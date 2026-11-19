import { type BombPoint } from '../shared/src/index.ts';

const PATROL_RADIUS_UNITS = 320;
const PATROL_REACHED_UNITS = 60;
/** A step is 18 units: a bot standing a crate's height below a point is not there yet. */
const REACH_MAX_HEIGHT_UNITS = 20;
const STUCK_MS = 1500;
const STUCK_DISTANCE_UNITS = 20;

export interface BotPlayer extends BombPoint {
  id: number;
  team: number;
  dropping: boolean;
  /** Dead players stay in snapshots until they respawn. */
  alive: boolean;
}

/** What a mode wants one bot to do this tick. The driver turns it into movement and aim. */
export interface Goal {
  role: string;
  point: BombPoint;
  /** Hold USE here (planting, defusing). */
  use?: boolean;
  /** Strafe against a close enemy instead of walking on. */
  duel?: boolean;
  /** `point` is a patrol point: pick the next one on arrival or when stuck. */
  roam?: boolean;
  /** Stop walking once this close (3D) to `point`. Used for a moving player: walking onto them only makes the bot circle them. */
  settle?: number;
  /** Walk to this visible enemy instead of `point`. */
  intercept?: BombPoint;
}

export function patrolPoint(center: BombPoint, id: number, leg: number, radius = PATROL_RADIUS_UNITS): BombPoint {
  const angle = id * Math.PI * (3 - Math.sqrt(5)) + leg * Math.PI / 3;
  return { x: center.x + Math.cos(angle) * radius, y: center.y, z: center.z + Math.sin(angle) * radius };
}

export function reachedPatrolPoint(self: BombPoint, point: BombPoint): boolean {
  return atPoint(self, point, PATROL_REACHED_UNITS);
}

/** Within `radius` on the floor plane and at the same height. Height counts, but a stale snapshot makes a 3D radius unreachable. */
export function atPoint(self: BombPoint, point: BombPoint, radius: number): boolean {
  return Math.hypot(point.x - self.x, point.z - self.z) < radius && Math.abs(point.y - self.y) <= REACH_MAX_HEIGHT_UNITS;
}

export interface ProgressSample {
  point: BombPoint;
  at: number;
}

export function checkProgress(previous: ProgressSample | null, point: BombPoint, now: number) {
  // Floor plane only: a bot hopping against a ledge gains and loses height all the time without getting anywhere.
  if (!previous || Math.hypot(previous.point.x - point.x, previous.point.z - point.z) > STUCK_DISTANCE_UNITS) {
    return { sample: { point, at: now }, stuck: false };
  }
  if (now - previous.at < STUCK_MS) return { sample: previous, stuck: false };
  return { sample: { point, at: now }, stuck: true };
}
