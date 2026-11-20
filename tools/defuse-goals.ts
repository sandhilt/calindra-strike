import {
  BOMB_SITE_RADIUS_UNITS, DEFUSE_RADIUS_UNITS, inBombReach,
  type BombPlaces, type BombPoint,
} from '../shared/src/index.ts';
import { patrolPoint, type BotPlayer, type Goal } from './drive-goals.ts';

const BOMB_STATES = ['home', 'carried', 'planting', 'dropped', 'planted'] as const;
const DEFENDER_PURSUIT_UNITS = 650;
const ESCORT_TRAIL_UNITS = 150; // an escort trails its carrier at about this distance

export interface DefuseGoal extends Goal {
  role: 'fetch' | 'plant' | 'defuse' | 'escort' | 'patrol';
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

export function pickDefuseGoal(
  bomb: NonNullable<ReturnType<typeof readBombRow>>, places: BombPlaces,
  self: BotPlayer, players: readonly BotPlayer[], leg: number,
): DefuseGoal {
  if (self.team === bomb.attackers) {
    if (bomb.kind === 'home') return { role: 'fetch', point: places.home };
    if (bomb.kind === 'dropped') return { role: 'fetch', point: bomb };
    if ((bomb.kind === 'carried' || bomb.kind === 'planting') && bomb.actor === self.id) {
      return { role: 'plant', point: places.site };
    }
  } else if (bomb.kind === 'planted') {
    // Continue an interaction already in progress. Otherwise all clients elect from the same snapshot rows.
    const defenders = players.filter((p) => p.team === self.team && p.alive && !p.dropping);
    const distance = (p: BombPoint) => Math.hypot(p.x - bomb.x, p.y - bomb.y, p.z - bomb.z);
    const nearest = defenders.find((p) => p.id === bomb.actor)
      ?? defenders.toSorted((a, b) => distance(a) - distance(b) || a.id - b.id)[0];
    if (nearest?.id === self.id) return { role: 'defuse', point: bomb };
  }
  // A ring around a carrier on the move shifts every tick, so escorts trail the carrier instead and patrol only a bug that stays put.
  if (self.team === bomb.attackers && bomb.kind === 'carried') return { role: 'escort', point: bomb, settle: ESCORT_TRAIL_UNITS };
  const center = bomb.kind === 'planted' || (self.team === bomb.attackers && bomb.kind === 'planting') ? bomb : places.site;
  return { role: 'patrol', point: patrolPoint(center, self.id, leg), roam: true };
}

export function canHoldUse(self: BotPlayer, goal: DefuseGoal, closeEnemy: boolean): boolean {
  if (self.dropping || closeEnemy) return false;
  if (goal.role === 'plant') return inBombReach(self, goal.point, BOMB_SITE_RADIUS_UNITS - 12);
  return goal.role === 'defuse' && inBombReach(self, goal.point, DEFUSE_RADIUS_UNITS - 5);
}

/** Adds the per-tick combat decisions to the objective: use, duel and defender interception. */
export function defuseGoal(
  bomb: NonNullable<ReturnType<typeof readBombRow>>, places: BombPlaces,
  self: BotPlayer, players: readonly BotPlayer[], leg: number,
  enemy: BombPoint | null, closeEnemy: boolean,
): DefuseGoal {
  const objective = pickDefuseGoal(bomb, places, self, players, leg);
  const duel = objective.role === 'plant' || objective.role === 'defuse';
  // Defenders intercept visible intruders near the site before returning to the perimeter.
  const intercepting = enemy && !closeEnemy && self.team !== bomb.attackers && bomb.kind !== 'planted'
    && Math.hypot(enemy.x - places.site.x, enemy.z - places.site.z) < DEFENDER_PURSUIT_UNITS;
  return {
    ...objective,
    use: canHoldUse(self, objective, closeEnemy),
    duel,
    ...(intercepting ? { intercept: enemy } : {}),
  };
}
