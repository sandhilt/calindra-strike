import {
  LUNCH_FOLLOW_GAP_UNITS, LUNCH_FOLLOW_SPACING_UNITS, LUNCH_SEAT_HEIGHT_UNITS, LUNCH_SEAT_RADIUS_UNITS, LUNCH_TRAIL_MAX_POINTS,
  LUNCH_TRAIL_STEP_UNITS, LUNCH_USE_RADIUS_UNITS, LUNCH_WALK_UNITS_PER_TICK,
} from './constants.ts';

import type { MapDef } from './maps/types.ts';
import { round, type GameMode } from './protocol.ts';

/**
 * Hora de almoçar: a hostage rescue round. The attackers take their colleagues from the defenders' base to a restaurant
 * of the food court; the defenders hold them at work until the food court runs out of seats.
 */
export const LUNCH_COLLEAGUES = ['Estagiário', 'PO', 'Tech lead'] as const;

export interface LunchPoint { x: number; y: number; z: number }
interface Placed extends LunchPoint { yaw: number }
export type Colleague = Placed & (
  | { kind: 'waiting' }
  | { kind: 'following'; leader: number; trail: readonly LunchPoint[] }
  | { kind: 'seated' }
);
export interface LunchRound { attackers: number; endsAtTick: number }
export interface LunchPlaces { hold: LunchPoint; restaurants: readonly LunchPoint[] }
export interface LunchActor extends LunchPoint { id: number; team: number; alive: boolean; using: boolean }
export type LunchAction = 'follow' | 'stop' | 'seated' | 'served' | 'full';
/** `team` is the acting player's team, or the round winner for 'served' and 'full'; `who` is the colleague, -1 for the round. */
export interface LunchEvent { k: 'lunch'; what: LunchAction; team: number; by: number; who: number }
/** 'served': every colleague sat down, the attackers win. 'full': time ran out, the defenders win. */
export type LunchOutcome = 'served' | 'full';
export interface LunchStep { colleagues: Colleague[]; events: LunchEvent[]; outcome?: LunchOutcome }

/** Only maps with a food court can play the mode. */
export function modeFitsMap(mode: GameMode, map: MapDef): boolean {
  return mode !== 'almoco' || map.restaurants.length > 0;
}

const HOLD_OFFSETS = [[-40, 0], [40, 0], [0, 44]] as const;

export function startLunch(hold: LunchPoint): Colleague[] {
  return LUNCH_COLLEAGUES.map((_, i) => {
    const [dx, dz] = HOLD_OFFSETS[i % HOLD_OFFSETS.length];
    return { kind: 'waiting', x: hold.x + dx, y: hold.y, z: hold.z + dz, yaw: 0 };
  });
}

function flat(a: LunchPoint, b: LunchPoint): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function seatAt(c: Placed, restaurants: readonly LunchPoint[]): LunchPoint | null {
  return restaurants.find((r) => flat(c, r) <= LUNCH_SEAT_RADIUS_UNITS && Math.abs(c.y - r.y) <= LUNCH_SEAT_HEIGHT_UNITS) ?? null;
}

/** Walks one tick along the leader's trail, stopping `gap` short of the leader. */
function walk(c: Extract<Colleague, { kind: 'following' }>, leader: LunchActor, gap: number): Colleague {
  const last = c.trail.at(-1) ?? c;
  const trail = flat(last, leader) >= LUNCH_TRAIL_STEP_UNITS
    ? [...c.trail, { x: leader.x, y: leader.y, z: leader.z }].slice(-LUNCH_TRAIL_MAX_POINTS)
    : [...c.trail];
  if (flat(c, leader) <= gap) return { ...c, trail };
  let { x, y, z, yaw } = c;
  let budget = LUNCH_WALK_UNITS_PER_TICK;
  while (budget > 0 && trail.length) {
    const next = trail[0];
    const d = Math.hypot(next.x - x, next.y - y, next.z - z);
    if (d > 0.001) yaw = Math.atan2(-(next.x - x), -(next.z - z));
    if (d <= budget) {
      ({ x, y, z } = next);
      trail.shift();
      budget -= d;
      continue;
    }
    const t = budget / d;
    x += (next.x - x) * t;
    y += (next.y - y) * t;
    z += (next.z - z) * t;
    budget = 0;
  }
  return { ...c, x, y, z, yaw, trail };
}

export function stepLunch(colleagues: readonly Colleague[], places: LunchPlaces, actors: readonly LunchActor[], round: LunchRound, tick: number): LunchStep {
  const events: LunchEvent[] = [];
  const byId = new Map(actors.map((a) => [a.id, a]));
  const ranks = new Map<number, number>();
  const next = colleagues.map((c, who): Colleague => {
    if (c.kind === 'seated') return c;
    if (c.kind === 'waiting') {
      const rescuer = actors.find((a) => a.alive && a.using && a.team === round.attackers && Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z) <= LUNCH_USE_RADIUS_UNITS);
      if (!rescuer) return c;
      events.push({ k: 'lunch', what: 'follow', team: rescuer.team, by: rescuer.id, who });
      return { kind: 'following', leader: rescuer.id, trail: [], x: c.x, y: c.y, z: c.z, yaw: c.yaw };
    }
    const leader = byId.get(c.leader);
    if (!leader?.alive || leader.team !== round.attackers) {
      events.push({ k: 'lunch', what: 'stop', team: round.attackers, by: c.leader, who });
      return { kind: 'waiting', x: c.x, y: c.y, z: c.z, yaw: c.yaw };
    }
    const rank = ranks.get(leader.id) ?? 0;
    ranks.set(leader.id, rank + 1);
    const moved = walk(c, leader, LUNCH_FOLLOW_GAP_UNITS + rank * LUNCH_FOLLOW_SPACING_UNITS);
    const seat = seatAt(moved, places.restaurants);
    if (!seat) return moved;
    events.push({ k: 'lunch', what: 'seated', team: leader.team, by: leader.id, who });
    return { kind: 'seated', x: moved.x, y: seat.y, z: moved.z, yaw: Math.atan2(-(seat.x - moved.x), -(seat.z - moved.z)) };
  });
  if (next.every((c) => c.kind === 'seated')) {
    events.push({ k: 'lunch', what: 'served', team: round.attackers, by: -1, who: -1 });
    return { colleagues: next, events, outcome: 'served' };
  }
  if (tick >= round.endsAtTick) {
    events.push({ k: 'lunch', what: 'full', team: 1 - round.attackers, by: -1, who: -1 });
    return { colleagues: next, events, outcome: 'full' };
  }
  return { colleagues: next, events };
}

/** How many colleagues already sat down. */
export function seatedCount(colleagues: readonly Colleague[]): number {
  return colleagues.filter((c) => c.kind === 'seated').length;
}

const KIND_CODE = { waiting: 0, following: 1, seated: 2 } as const;
export const LUNCH_KINDS = ['waiting', 'following', 'seated'] as const;

/** Wire row per colleague: [kind, leaderId, x, y, z, yaw]. */
export function colleagueRow(c: Colleague): number[] {
  return [KIND_CODE[c.kind], c.kind === 'following' ? c.leader : -1, round(c.x, 10), round(c.y, 10), round(c.z, 10), round(c.yaw, 1000)];
}
