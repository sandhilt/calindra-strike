import {
  BLACK_FRIDAY_FUSE_TICKS, BOMB_CRATE_HEIGHT_UNITS, BOMB_CRATE_SIZE_UNITS, BOMB_DESK_HEIGHT_UNITS, BOMB_DESK_SIZE_UNITS, BOMB_RETURN_TICKS,
  BOMB_SITE_RADIUS_UNITS, CTF_PICKUP_RADIUS_UNITS, DEFUSE_RADIUS_UNITS, DEFUSE_TICKS, FUSE_TICKS, PLANT_TICKS, TICK_MS,
} from './constants.ts';

export interface BombPoint { x: number; y: number; z: number }
export type BombState =
  | { kind: 'home' }
  | { kind: 'carried'; carrier: number }
  | { kind: 'planting'; carrier: number; doneAtTick: number }
  | ({ kind: 'dropped'; returnAtTick: number } & BombPoint)
  | ({ kind: 'planted'; explodeAtTick: number; variant: number; defuse: { by: number; doneAtTick: number } | null } & BombPoint);
export type BombAction = 'take' | 'drop' | 'return' | 'plant' | 'defuse' | 'defused' | 'exploded';
export type BombOutcome = 'defused' | 'exploded';
export interface BombActor extends BombPoint { id: number; team: number; alive: boolean; dropping: boolean; using: boolean }
/** Outcome events carry the winning team; the others carry the acting player's team. */
export interface BombEvent { k: 'bomb'; what: BombAction; team: number; by: number }
export interface BombPlaces { home: BombPoint; site: BombPoint; attackers: number }
export interface BombStep { bomb: BombState; events: BombEvent[]; outcome?: BombOutcome }
/** Drawn when a round starts: which laptop scenario plays and whether it is a Black Friday round. */
export interface BombRound { variant: number; blackFriday: boolean }

export function fuseTicks(blackFriday: boolean): number {
  return blackFriday ? BLACK_FRIDAY_FUSE_TICKS : FUSE_TICKS;
}

export function fuseMs(blackFriday: boolean): number {
  return fuseTicks(blackFriday) * TICK_MS;
}

/** What the bug rests on: a desk once planted, a crate at the attackers' base, nothing while held or dropped. */
export type BombStand = 'desk' | 'crate';
export interface BombStandBox { stand: BombStand; min: BombPoint; max: BombPoint }
const STAND_OF: Record<BombState['kind'], BombStand | null> = { planted: 'desk', home: 'crate', carried: null, planting: null, dropped: null };
export const BOMB_STAND_SIZE: Record<BombStand, { size: number; height: number }> = {
  desk: { size: BOMB_DESK_SIZE_UNITS, height: BOMB_DESK_HEIGHT_UNITS },
  crate: { size: BOMB_CRATE_SIZE_UNITS, height: BOMB_CRATE_HEIGHT_UNITS },
};

/** The solid box under the bug at `at`, null when it has no stand. */
export function bombStandBox(kind: BombState['kind'], at: BombPoint): BombStandBox | null {
  const stand = STAND_OF[kind];
  if (!stand) return null;
  const { size, height } = BOMB_STAND_SIZE[stand];
  const half = size / 2;
  return { stand, min: { x: at.x - half, y: at.y, z: at.z - half }, max: { x: at.x + half, y: at.y + height, z: at.z + half } };
}

export function inBombReach(a: BombPoint, b: BombPoint, radius: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= radius;
}

function canAct(actor: BombActor): boolean {
  return actor.alive && !actor.dropping;
}

export function dropBomb(bomb: BombState, carrierId: number, at: BombPoint, tick: number, attackers: number): { bomb: BombState; events: BombEvent[] } {
  if ((bomb.kind !== 'carried' && bomb.kind !== 'planting') || bomb.carrier !== carrierId) return { bomb, events: [] };
  return {
    bomb: { kind: 'dropped', x: at.x, y: at.y, z: at.z, returnAtTick: tick + BOMB_RETURN_TICKS },
    events: [{ k: 'bomb', what: 'drop', team: attackers, by: carrierId }],
  };
}

function stepPlanted(bomb: Extract<BombState, { kind: 'planted' }>, places: BombPlaces, actors: readonly BombActor[], tick: number): BombStep {
  const defenders = 1 - places.attackers;
  const events: BombEvent[] = [];
  let defuse = bomb.defuse;
  const current = defuse && actors.find((a) => a.id === defuse?.by);
  if (defuse && !(current && canAct(current) && current.using && current.team === defenders && inBombReach(current, bomb, DEFUSE_RADIUS_UNITS))) defuse = null;
  if (!defuse) {
    const starter = actors.find((a) => canAct(a) && a.using && a.team === defenders && inBombReach(a, bomb, DEFUSE_RADIUS_UNITS));
    if (starter) {
      defuse = { by: starter.id, doneAtTick: tick + DEFUSE_TICKS };
      events.push({ k: 'bomb', what: 'defuse', team: defenders, by: starter.id });
    }
  }
  if (defuse && tick >= defuse.doneAtTick) {
    events.push({ k: 'bomb', what: 'defused', team: defenders, by: defuse.by });
    return { bomb: { kind: 'home' }, events, outcome: 'defused' };
  }
  if (tick >= bomb.explodeAtTick) {
    events.push({ k: 'bomb', what: 'exploded', team: places.attackers, by: -1 });
    return { bomb: { kind: 'home' }, events, outcome: 'exploded' };
  }
  return { bomb: defuse === bomb.defuse ? bomb : { ...bomb, defuse }, events };
}

/** Pure bomb rules. Positions are taken from the actors, so the caller snaps planted and dropped bombs to the floor. */
export function stepBomb(bomb: BombState, places: BombPlaces, actors: readonly BombActor[], tick: number, round: BombRound): BombStep {
  const events: BombEvent[] = [];
  if (bomb.kind === 'planted') return stepPlanted(bomb, places, actors, tick);
  let next: BombState = bomb;
  if (next.kind === 'dropped' && tick >= next.returnAtTick) {
    next = { kind: 'home' };
    events.push({ k: 'bomb', what: 'return', team: places.attackers, by: -1 });
  }
  if (next.kind === 'home' || next.kind === 'dropped') {
    const at = next.kind === 'home' ? places.home : next;
    const taker = actors.find((a) => canAct(a) && a.team === places.attackers && inBombReach(a, at, CTF_PICKUP_RADIUS_UNITS));
    if (taker) {
      next = { kind: 'carried', carrier: taker.id };
      events.push({ k: 'bomb', what: 'take', team: places.attackers, by: taker.id });
    }
    return { bomb: next, events };
  }
  const carrier = actors.find((a) => a.id === next.carrier);
  if (!carrier || !canAct(carrier) || carrier.team !== places.attackers) {
    events.push({ k: 'bomb', what: 'return', team: places.attackers, by: -1 });
    return { bomb: { kind: 'home' }, events };
  }
  const planting = carrier.using && inBombReach(carrier, places.site, BOMB_SITE_RADIUS_UNITS);
  if (next.kind === 'carried') {
    return { bomb: planting ? { kind: 'planting', carrier: carrier.id, doneAtTick: tick + PLANT_TICKS } : next, events };
  }
  if (!planting) return { bomb: { kind: 'carried', carrier: carrier.id }, events };
  if (tick < next.doneAtTick) return { bomb: next, events };
  events.push({ k: 'bomb', what: 'plant', team: places.attackers, by: carrier.id });
  return { bomb: { kind: 'planted', x: carrier.x, y: carrier.y, z: carrier.z, explodeAtTick: tick + fuseTicks(round.blackFriday), variant: round.variant, defuse: null }, events };
}
