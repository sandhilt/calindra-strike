import {
  BLACK_FRIDAY_CHANCE, BLACK_FRIDAY_FUSE_MS, BLACK_FRIDAY_FUSE_TICKS, BLACK_FRIDAY_GUARANTEE_ROUND, BOMB_CRATE_HEIGHT_UNITS, BOMB_CRATE_SIZE_UNITS, BOMB_DESK_HEIGHT_UNITS, BOMB_DESK_SIZE_UNITS, BOMB_DROPPED_TICKS,
  BOMB_SITE_RADIUS_UNITS, CTF_PICKUP_RADIUS_UNITS, PLAYER_RADIUS, DEFUSE_RADIUS_UNITS, DEFUSE_TICKS, FUSE_MS, FUSE_TICKS, PLANT_TICKS,
} from './constants.ts';

export interface BombPoint { x: number; y: number; z: number }
export type BombState =
  | { kind: 'home' }
  | { kind: 'carried'; carrier: number }
  | { kind: 'planting'; carrier: number; doneAtTick: number }
  /** `returnAtTick`: when a bug nobody picked up hands the round to the other team. */
  | ({ kind: 'dropped'; returnAtTick: number } & BombPoint)
  | ({ kind: 'planted'; explodeAtTick: number; variant: number; defuse: { by: number; doneAtTick: number } | null } & BombPoint);
export type BombAction = 'take' | 'drop' | 'return' | 'plant' | 'defuse' | 'defused' | 'exploded' | 'expired' | 'abandoned';
/** 'expired': the attackers ran out of time to plant or left the bug on the floor too long; nobody scores and the laptop goes to the other team. */
export type BombOutcome = 'defused' | 'exploded' | 'expired';
export interface BombActor extends BombPoint { id: number; team: number; alive: boolean; dropping: boolean; using: boolean }
/** Outcome events carry the winning team (the new attackers for 'expired' and 'abandoned'); the others carry the acting player's team. */
export interface BombEvent { k: 'bomb'; what: BombAction; team: number; by: number }
export interface BombPlaces { home: BombPoint; site: BombPoint; attackers: number }
export interface BombStep { bomb: BombState; events: BombEvent[]; outcome?: BombOutcome }
/**
 * Drawn when a round starts: which laptop scenario plays, whether Black Friday is on right now, when it will switch on
 * (`blackFridayAtTick`, absent in a normal round) and when the plant window closes.
 */
export interface BombRound { variant: number; blackFriday: boolean; blackFridayAtTick?: number; plantByTick?: number }

/** Whether the round about to start is a Black Friday one: by chance, or because the match has gone without one for too long. */
export function blackFridayMarked(roll: number, roundNumber: number, matchHadBlackFriday: boolean): boolean {
  return roll < BLACK_FRIDAY_CHANCE || (!matchHadBlackFriday && roundNumber >= BLACK_FRIDAY_GUARANTEE_ROUND);
}

/** A pending Black Friday switches on at its moment, or at the plant, so a marked round is always Black Friday by the time it is scored. */
export function blackFridayDue(round: BombRound, bomb: BombState, tick: number): boolean {
  return !round.blackFriday && round.blackFridayAtTick !== undefined && (tick >= round.blackFridayAtTick || bomb.kind === 'planted');
}

/** Switches Black Friday on, and shortens a fuse already burning to the Black Friday one. */
export function startBlackFriday(bomb: BombState, round: BombRound, tick: number): { bomb: BombState; round: BombRound } {
  const next = { ...round, blackFriday: true };
  if (bomb.kind !== 'planted') return { bomb, round: next };
  return { bomb: { ...bomb, explodeAtTick: Math.min(bomb.explodeAtTick, tick + BLACK_FRIDAY_FUSE_TICKS) }, round: next };
}

/** A scenario other than `variant`, picked by `roll` in [0, 1): the laptop the other team gets must not look like the one that was ignored. */
export function otherVariant(variant: number, roll: number, count: number): number {
  return (variant + 1 + Math.floor(roll * (count - 1))) % count;
}

export function fuseTicks(blackFriday: boolean): number {
  return blackFriday ? BLACK_FRIDAY_FUSE_TICKS : FUSE_TICKS;
}

export function fuseMs(blackFriday: boolean): number {
  return blackFriday ? BLACK_FRIDAY_FUSE_MS : FUSE_MS;
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

/** Gap left between a player pushed off a stand and the stand, so the next move does not start in contact. */
const STAND_EXIT_GAP_UNITS = 2;
/** Directions tried around the player's back, in eighths of a turn: straight back, then fanning out to straight ahead. */
const STAND_EXIT_TURNS = [0, 1, -1, 2, -2, 3, -3, 4] as const;
/** Spacing of the hull checks along the push, under a hull radius so no thin wall is skipped. */
const STAND_EXIT_STEP_UNITS = 8;

/**
 * Where a player caught inside a stand's footprint steps to, so the desk that appears under a planter does not trap them.
 * Tries backwards from where they face first, then fans out; `fits` says whether the hull can stand at a spot, and is
 * checked along the whole push so the player is never moved through a wall.
 * Null when the player is clear of the stand already, or when no direction has room.
 */
export function standExit(box: BombStandBox, player: BombPoint & { yaw: number; height: number }, fits: (x: number, z: number) => boolean): { x: number; z: number } | null {
  const reach = PLAYER_RADIUS + STAND_EXIT_GAP_UNITS;
  const minX = box.min.x - reach, maxX = box.max.x + reach, minZ = box.min.z - reach, maxZ = box.max.z + reach;
  const inside = player.x > minX && player.x < maxX && player.z > minZ && player.z < maxZ && player.y < box.max.y && player.y + player.height > box.min.y;
  if (!inside) return null;
  for (const turn of STAND_EXIT_TURNS) {
    // yaw 0 faces -z, so the player's back points along (sin yaw, cos yaw).
    const angle = player.yaw + (turn * Math.PI) / 4;
    const dx = Math.sin(angle), dz = Math.cos(angle);
    const tx = dx > 0 ? (maxX - player.x) / dx : dx < 0 ? (minX - player.x) / dx : Infinity;
    const tz = dz > 0 ? (maxZ - player.z) / dz : dz < 0 ? (minZ - player.z) / dz : Infinity;
    const t = Math.min(tx, tz);
    const steps = Math.ceil(t / STAND_EXIT_STEP_UNITS);
    let clear = true;
    for (let i = 1; i <= steps && clear; i++) clear = fits(player.x + (dx * t * i) / steps, player.z + (dz * t * i) / steps);
    if (clear) return { x: player.x + dx * t, z: player.z + dz * t };
  }
  return null;
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
    bomb: { kind: 'dropped', x: at.x, y: at.y, z: at.z, returnAtTick: tick + BOMB_DROPPED_TICKS },
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
  const windowClosed = round.plantByTick !== undefined && tick >= round.plantByTick;
  const handOver = (what: 'expired' | 'abandoned'): BombStep => ({ bomb: { kind: 'home' }, events: [{ k: 'bomb', what, team: 1 - places.attackers, by: -1 }], outcome: 'expired' });
  const expire = () => handOver('expired');
  // A plant already under way is allowed to finish, so a carrier at the last second is not cut off.
  if (windowClosed && bomb.kind !== 'planting') return expire();
  let next: BombState = bomb;
  if (next.kind === 'dropped' && tick >= next.returnAtTick) return handOver('abandoned');
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
  if (!planting) return windowClosed ? expire() : { bomb: { kind: 'carried', carrier: carrier.id }, events };
  if (tick < next.doneAtTick) return { bomb: next, events };
  events.push({ k: 'bomb', what: 'plant', team: places.attackers, by: carrier.id });
  return { bomb: { kind: 'planted', x: carrier.x, y: carrier.y, z: carrier.z, explodeAtTick: tick + fuseTicks(round.blackFriday), variant: round.variant, defuse: null }, events };
}
