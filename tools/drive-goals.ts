import { inBombReach, type BombPoint } from '../shared/src/index.ts';

const PATROL_RADIUS_UNITS = 320;
const PATROL_REACHED_UNITS = 28;
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
  /** Walk to this visible enemy instead of `point`. */
  intercept?: BombPoint;
}

export function patrolPoint(center: BombPoint, id: number, leg: number, radius = PATROL_RADIUS_UNITS): BombPoint {
  const angle = id * Math.PI * (3 - Math.sqrt(5)) + leg * Math.PI / 3;
  return { x: center.x + Math.cos(angle) * radius, y: center.y, z: center.z + Math.sin(angle) * radius };
}

export function reachedPatrolPoint(self: BombPoint, point: BombPoint): boolean {
  return inBombReach(self, point, PATROL_REACHED_UNITS);
}

export interface ProgressSample {
  point: BombPoint;
  at: number;
}

export function checkProgress(previous: ProgressSample | null, point: BombPoint, now: number) {
  if (!previous || !inBombReach(previous.point, point, STUCK_DISTANCE_UNITS)) {
    return { sample: { point, at: now }, stuck: false };
  }
  if (now - previous.at < STUCK_MS) return { sample: previous, stuck: false };
  return { sample: { point, at: now }, stuck: true };
}
