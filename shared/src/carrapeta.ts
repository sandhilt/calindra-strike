import {
  BATATA_BOUNTY_POINTS, BATATA_CHANCE, BATATA_DOUBLE_EVERY_SECONDS, BATATA_DURATION_SECONDS,
  BATATA_KILL_POINTS, BATATA_MAX_MULTIPLIER, BATATA_WINDOW_END, BATATA_WINDOW_START,
  CTF_PICKUP_RADIUS_UNITS, TICK_RATE,
} from './constants.ts';

export type CarrapetaPosition = { x: number; y: number; z: number };
export type CarrapetaState =
  | { kind: 'none' }
  | { kind: 'held'; holder: number; sinceTick: number }
  | ({ kind: 'dropped'; rerollAtTick: number } & CarrapetaPosition);

export type FrenzyState = { kind: 'calm' } | { kind: 'frenzy'; sinceTick: number; untilTick: number };
export type CarrapetaEvent =
  | { k: 'carrapeta'; what: 'take' | 'reroll'; by: number }
  | { k: 'carrapeta'; what: 'lose'; by: number; at: CarrapetaPosition };
export type FrenzyEvent = { k: 'frenzy'; what: 'on'; untilMs: number } | { k: 'frenzy'; what: 'off' };
export type CarrapetaActor = CarrapetaPosition & { id: number; landed: boolean };

export function stepCarrapeta(
  state: CarrapetaState, actors: readonly CarrapetaActor[], tick: number, roll: () => number,
): { state: CarrapetaState; event?: CarrapetaEvent } {
  if (state.kind === 'held') return { state };
  const reroll = state.kind === 'dropped' && tick >= state.rerollAtTick;
  let chosen: CarrapetaActor | undefined;
  if (state.kind === 'none' || reroll) {
    if (actors.length) chosen = actors[Math.floor(roll() * actors.length)];
  } else {
    let best = Infinity;
    for (const actor of actors) {
      const distance = Math.hypot(actor.x - state.x, actor.y - state.y, actor.z - state.z);
      if (!actor.landed || distance > CTF_PICKUP_RADIUS_UNITS || distance >= best) continue;
      chosen = actor;
      best = distance;
    }
  }
  if (!chosen) return { state };
  return {
    state: { kind: 'held', holder: chosen.id, sinceTick: tick },
    event: { k: 'carrapeta', what: reroll ? 'reroll' : 'take', by: chosen.id },
  };
}

export function dropCarrapeta(state: CarrapetaState, id: number, at: CarrapetaPosition, rerollAtTick: number):
  { state: CarrapetaState; event?: CarrapetaEvent } {
  if (state.kind !== 'held' || state.holder !== id) return { state };
  return { state: { kind: 'dropped', ...at, rerollAtTick }, event: { k: 'carrapeta', what: 'lose', by: id, at } };
}

/** Draw the single possible frenzy start from the live match clock. */
export function frenzyAtTick(start: number, duration: number, chance: number, moment: number): number | undefined {
  if (chance >= BATATA_CHANCE) return undefined;
  const first = Math.max(1, Math.ceil(duration * BATATA_WINDOW_START));
  const windowEnd = Math.floor(duration * BATATA_WINDOW_END);
  const fullEventEnd = duration - BATATA_DURATION_SECONDS * TICK_RATE;
  const last = Math.max(first, fullEventEnd > first ? Math.min(windowEnd, fullEventEnd) : windowEnd);
  return start + first + Math.floor(moment * (last - first + 1));
}

export function stepFrenzy(state: FrenzyState, tick: number, at?: number): FrenzyState {
  if (state.kind === 'frenzy') return tick >= state.untilTick ? { kind: 'calm' } : state;
  if (at === undefined || tick < at) return state;
  return { kind: 'frenzy', sinceTick: tick, untilTick: tick + BATATA_DURATION_SECONDS * TICK_RATE };
}

export function carrapetaPointsPerSecond(streakTicks: number, frenzy: FrenzyState): number {
  if (frenzy.kind === 'calm') return 1;
  return Math.min(BATATA_MAX_MULTIPLIER, 2 ** Math.floor(streakTicks / (BATATA_DOUBLE_EVERY_SECONDS * TICK_RATE)));
}

export function carrapetaKillPoints(frenzy: FrenzyState, holder: number, killer: number, victim: number): number {
  if (frenzy.kind === 'calm' || killer === victim) return 0;
  return killer === holder ? BATATA_KILL_POINTS : victim === holder ? BATATA_BOUNTY_POINTS : 0;
}

/** During frenzy, a pair can fight only when one of them holds the objective. */
export function carrapetaEnemies(frenzy: FrenzyState, state: CarrapetaState, a: number, b: number): boolean {
  return frenzy.kind === 'calm' || (state.kind === 'held' && (a === state.holder || b === state.holder));
}
