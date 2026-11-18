import {
  BOMB_SITE_RADIUS_UNITS, DEFUSE_RADIUS_UNITS, inBombReach,
  type BombPlaces, type BombPoint,
} from '../shared/src/index.ts';

const BOMB_STATES = ['home', 'carried', 'planting', 'dropped', 'planted'] as const;
const PATROL_RADIUS_UNITS = 320;
const PATROL_REACHED_UNITS = 28;
const STUCK_MS = 1500;
const STUCK_DISTANCE_UNITS = 20;

export interface DefusePlayer extends BombPoint {
  id: number;
  team: number;
  dropping: boolean;
}

export interface DefuseGoal {
  role: 'fetch' | 'plant' | 'defuse' | 'patrol';
  point: BombPoint;
}

export function readBombRow(row: readonly number[]) {
  const [state, actor, x, y, z, explodeAt, defuseDoneAt, variant, attackers, plantDoneAt, blackFriday, plantByAt = 0] = row;
  const kind = BOMB_STATES[state];
  if (!kind || row.length < 11 || (attackers !== 0 && attackers !== 1)) return null;
  return {
    kind, actor, x, y, z, explodeAt, defuseDoneAt, variant, attackers,
    plantDoneAt, blackFriday: blackFriday === 1, plantByAt,
  };
}

export function patrolPoint(center: BombPoint, id: number, leg: number): BombPoint {
  const angle = id * Math.PI * (3 - Math.sqrt(5)) + leg * Math.PI / 3;
  return { x: center.x + Math.cos(angle) * PATROL_RADIUS_UNITS, y: center.y, z: center.z + Math.sin(angle) * PATROL_RADIUS_UNITS };
}

export function pickDefuseGoal(
  bomb: NonNullable<ReturnType<typeof readBombRow>>, places: BombPlaces,
  self: DefusePlayer, players: readonly DefusePlayer[], leg: number,
): DefuseGoal {
  if (self.team === bomb.attackers) {
    if (bomb.kind === 'home') return { role: 'fetch', point: places.home };
    if (bomb.kind === 'dropped') return { role: 'fetch', point: bomb };
    if ((bomb.kind === 'carried' || bomb.kind === 'planting') && bomb.actor === self.id) {
      return { role: 'plant', point: places.site };
    }
  } else if (bomb.kind === 'planted') {
    // Continue an interaction already in progress. Otherwise all clients elect from the same snapshot rows.
    const defenders = players.filter((p) => p.team === self.team && !p.dropping);
    const distance = (p: BombPoint) => Math.hypot(p.x - bomb.x, p.y - bomb.y, p.z - bomb.z);
    const nearest = defenders.find((p) => p.id === bomb.actor)
      ?? defenders.toSorted((a, b) => distance(a) - distance(b) || a.id - b.id)[0];
    if (nearest?.id === self.id) return { role: 'defuse', point: bomb };
  }
  const followingCarrier = self.team === bomb.attackers && (bomb.kind === 'carried' || bomb.kind === 'planting');
  const center = bomb.kind === 'planted' || followingCarrier ? bomb : places.site;
  return { role: 'patrol', point: patrolPoint(center, self.id, leg) };
}

export function canHoldUse(self: DefusePlayer, goal: DefuseGoal, closeEnemy: boolean): boolean {
  if (self.dropping || closeEnemy) return false;
  if (goal.role === 'plant') return inBombReach(self, goal.point, BOMB_SITE_RADIUS_UNITS - 12);
  return goal.role === 'defuse' && inBombReach(self, goal.point, DEFUSE_RADIUS_UNITS - 5);
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
