import { CTF_CAPTURE_RADIUS_UNITS, CTF_PICKUP_RADIUS_UNITS, CTF_RETURN_TICKS } from './constants.ts';

export type FlagState =
  | { kind: 'home' }
  | { kind: 'carried'; carrier: number }
  | { kind: 'dropped'; x: number; y: number; z: number; returnAtTick: number };
export type FlagAction = 'take' | 'drop' | 'return' | 'capture';
export interface FlagBase { x: number; y: number; z: number }
export interface FlagActor extends FlagBase { id: number; team: number; alive: boolean; dropping: boolean }
export interface FlagEvent { k: 'flag'; what: FlagAction; team: number; by: number }

function touches(a: FlagBase, b: FlagBase, radius: number): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= radius;
}

export function dropCarried(flags: readonly FlagState[], carrierId: number, at: FlagBase, tick: number): { flags: FlagState[]; events: FlagEvent[] } {
  const events: FlagEvent[] = [];
  const next = flags.map((flag, team): FlagState => {
    if (flag.kind !== 'carried' || flag.carrier !== carrierId) return flag;
    events.push({ k: 'flag', what: 'drop', team, by: carrierId });
    return { kind: 'dropped', x: at.x, y: at.y, z: at.z, returnAtTick: tick + CTF_RETURN_TICKS };
  });
  return { flags: next, events };
}

export function stepFlags(flags: readonly FlagState[], bases: readonly FlagBase[], actors: readonly FlagActor[], tick: number): { flags: FlagState[]; events: FlagEvent[]; captured: number[] } {
  const next = [...flags];
  const events: FlagEvent[] = [];
  const captured: number[] = [];
  for (let team = 0; team < next.length; team++) {
    const flag = next[team];
    if (flag.kind === 'dropped' && tick >= flag.returnAtTick) {
      next[team] = { kind: 'home' };
      events.push({ k: 'flag', what: 'return', team, by: -1 });
    }
  }
  for (const actor of actors) {
    if (!actor.alive || actor.dropping || (actor.team !== 0 && actor.team !== 1)) continue;
    for (let team = 0; team < next.length; team++) {
      const flag = next[team];
      if (flag.kind === 'carried') continue;
      if (!touches(actor, flag.kind === 'home' ? bases[team] : flag, CTF_PICKUP_RADIUS_UNITS)) continue;
      if (team === actor.team) {
        if (flag.kind !== 'dropped') continue;
        next[team] = { kind: 'home' };
        events.push({ k: 'flag', what: 'return', team, by: actor.id });
      } else {
        next[team] = { kind: 'carried', carrier: actor.id };
        events.push({ k: 'flag', what: 'take', team, by: actor.id });
      }
    }
  }
  for (let team = 0; team < next.length; team++) {
    const flag = next[team];
    if (flag.kind !== 'carried') continue;
    const actor = actors.find((a) => a.id === flag.carrier);
    if (!actor || !actor.alive || actor.dropping || (actor.team !== 0 && actor.team !== 1) || actor.team === team) continue;
    if (next[actor.team]?.kind !== 'home' || !touches(actor, bases[actor.team], CTF_CAPTURE_RADIUS_UNITS)) continue;
    next[team] = { kind: 'home' };
    captured.push(actor.team);
    events.push({ k: 'flag', what: 'capture', team, by: actor.id });
  }
  return { flags: next, events, captured };
}
