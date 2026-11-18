import type { BombPoint } from '../shared/src/index.ts';
import { patrolPoint, type BotPlayer, type Goal } from './drive-goals.ts';

const FLAG_STATES = ['home', 'carried', 'dropped'] as const;
const ESCORT_COUNT = 2;
const GUARD_RING_UNITS = 320;
const WAIT_RING_UNITS = 240;
const ESCORT_RING_UNITS = 180;
const PURSUIT_UNITS = 650;
const CHASE_JOIN_UNITS = 900;
const PATROL_ROTATE_MS = 4000;

export interface CtfFlag extends BombPoint {
  kind: (typeof FLAG_STATES)[number];
  /** Player id carrying it, -1 otherwise. */
  carrier: number;
}

/** Rows are `[state, carrier, x, y, z, returnAt]`, one per team. */
export function readFlags(rows: readonly (readonly number[])[]): [CtfFlag, CtfFlag] | null {
  const flags = rows.map(([state, carrier, x, y, z]): CtfFlag | null => {
    const kind = FLAG_STATES[state];
    return kind ? { kind, carrier, x, y, z } : null;
  });
  const [first, second] = flags;
  return flags.length === 2 && first && second ? [first, second] : null;
}

export type CtfRole = 'carrier' | 'runner' | 'defender' | 'escort';

const distance = (a: BombPoint, b: BombPoint) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

function nearestFirst<T extends BombPoint & { id: number }>(players: readonly T[], to: BombPoint): T[] {
  return players.toSorted((a, b) => distance(a, to) - distance(b, to) || a.id - b.id);
}

/**
 * Every teammate runs this on the same snapshot rows, so all of them reach the same roles.
 * `mates` holds only living, grounded teammates. Slots fill in priority order: runner, defender, escorts, then extra defenders.
 */
export function electRoles(
  mates: readonly BotPlayer[], enemyFlag: CtfFlag, enemyFlagPoint: BombPoint, ownBase: BombPoint,
): Map<number, CtfRole> {
  const roles = new Map<number, CtfRole>();
  const carrier = enemyFlag.kind === 'carried' ? mates.find((p) => p.id === enemyFlag.carrier) : undefined;
  if (carrier) roles.set(carrier.id, 'carrier');
  const pool = mates.filter((p) => p !== carrier);

  const runner = carrier ? undefined : nearestFirst(pool, enemyFlagPoint)[0];
  if (runner) roles.set(runner.id, 'runner');
  const free = pool.filter((p) => p !== runner);

  const defender = nearestFirst(free, ownBase)[0];
  if (defender) roles.set(defender.id, 'defender');
  const rest = free.filter((p) => p !== defender);

  const lead = carrier ?? runner;
  const escorts = lead ? nearestFirst(rest, lead).slice(0, ESCORT_COUNT) : [];
  for (const p of rest) roles.set(p.id, escorts.includes(p) ? 'escort' : 'defender');
  return roles;
}

/** Where a flag sits on the map: its base while home, the carrier or the ground spot otherwise. */
export function flagPoint(flag: CtfFlag, base: BombPoint): BombPoint {
  return flag.kind === 'home' ? base : flag;
}

export interface CtfView {
  flags: readonly [CtfFlag, CtfFlag];
  bases: readonly [BombPoint, BombPoint];
  self: BotPlayer;
  players: readonly BotPlayer[];
  /** Counts up each time the bot reaches a patrol point. */
  leg: number;
  /** Snapshot time in ms. */
  time: number;
  enemy: BombPoint | null;
  closeEnemy: boolean;
}

/** One goal for one bot. Pure: same snapshot rows give every teammate a consistent plan. */
export function ctfGoal(view: CtfView): Goal {
  const { flags, bases, self, players, time, enemy, closeEnemy } = view;
  const own = flags[self.team];
  const theirs = flags[1 - self.team];
  const ownBase = bases[self.team];
  const enemyBase = bases[1 - self.team];
  const ownPoint = flagPoint(own, ownBase);
  const theirPoint = flagPoint(theirs, enemyBase);
  const mates = players.filter((p) => p.team === self.team && p.alive && !p.dropping && p.id !== self.id);
  mates.push(self);
  const roles = electRoles(mates, theirs, theirPoint, ownBase);
  const role = roles.get(self.id) ?? 'defender';
  const rotation = view.leg + Math.floor(time / PATROL_ROTATE_MS);
  const nextTo = (center: BombPoint, radius: number) => patrolPoint(center, self.id, rotation, radius);
  const interceptNear = (center: BombPoint) =>
    enemy && !closeEnemy && Math.hypot(enemy.x - center.x, enemy.z - center.z) < PURSUIT_UNITS ? { intercept: enemy } : {};

  if (own.kind === 'dropped' && nearestFirst(mates, ownPoint)[0].id === self.id) {
    return { role: 'return', point: ownPoint };
  }
  if (role === 'carrier') {
    // A capture needs the own flag at home, so wait close to it, moving, until it is back.
    return own.kind === 'home'
      ? { role: 'capture', point: ownBase }
      : { role: 'wait', point: nextTo(ownBase, WAIT_RING_UNITS), roam: true };
  }
  if (own.kind === 'carried') {
    const others = nearestFirst(mates.filter((p) => roles.get(p.id) === 'runner' || roles.get(p.id) === 'escort'), ownPoint)[0];
    const joins = others?.id === self.id && distance(self, ownPoint) < CHASE_JOIN_UNITS;
    if (role === 'defender' || joins) return { role: 'chase', point: ownPoint, duel: true };
  }
  if (role === 'runner') return { role: 'steal', point: theirPoint };
  if (role === 'escort') {
    const lead = mates.find((p) => p.id === theirs.carrier) ?? mates.find((p) => roles.get(p.id) === 'runner') ?? ownBase;
    return { role: 'escort', point: nextTo(lead, ESCORT_RING_UNITS), roam: true, duel: true, ...interceptNear(lead) };
  }
  return { role: 'guard', point: nextTo(ownBase, GUARD_RING_UNITS), roam: true, duel: true, ...interceptNear(ownBase) };
}
