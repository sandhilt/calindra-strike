import {
  BATATA_BOUNTY_POINTS, BATATA_DOUBLE_EVERY_SECONDS, BATATA_DURATION_SECONDS,
  BATATA_KILL_POINTS, BATATA_MAX_MULTIPLIER, BATATA_WINDOW_END, BATATA_WINDOW_START,
  CARRAPETA_MAX_HOLD_SECONDS, CTF_PICKUP_RADIUS_UNITS, TICK_RATE,
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
    const landed = actors.filter((actor) => actor.landed);
    if (landed.length) chosen = landed[Math.floor(roll() * landed.length)];
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

/** The frenzy starts of a match, one per roll: the window is cut into equal slices and each event starts somewhere in its own slice, early enough to end inside it when the slice is long enough. */
export function frenzyAtTicks(start: number, duration: number, rolls: readonly number[]): number[] {
  const windowStart = Math.max(1, Math.ceil(duration * BATATA_WINDOW_START));
  const windowEnd = Math.floor(duration * BATATA_WINDOW_END);
  const slice = Math.floor((windowEnd - windowStart) / rolls.length);
  const eventTicks = BATATA_DURATION_SECONDS * TICK_RATE;
  return rolls.map((moment, i) => {
    const first = windowStart + i * slice;
    const last = Math.max(first, first + slice - eventTicks);
    return start + first + Math.floor(moment * (last - first + 1));
  });
}

/** Whether the holder has kept the Carrapeta as long as allowed, so it is redrawn among the others. */
export function holdExpired(state: CarrapetaState, tick: number): boolean {
  return state.kind === 'held' && tick - state.sinceTick >= CARRAPETA_MAX_HOLD_SECONDS * TICK_RATE;
}

export function stepFrenzy(state: FrenzyState, tick: number, at?: number): FrenzyState {
  if (state.kind === 'frenzy') return tick >= state.untilTick ? { kind: 'calm' } : state;
  if (at === undefined || tick < at) return state;
  return { kind: 'frenzy', sinceTick: tick, untilTick: tick + BATATA_DURATION_SECONDS * TICK_RATE };
}

export function carrapetaPointsPerSecond(tick: number, frenzy: FrenzyState, heldSinceTick: number): number {
  if (frenzy.kind === 'calm') return 1;
  const streakTicks = tick - Math.max(heldSinceTick, frenzy.sinceTick);
  return Math.min(BATATA_MAX_MULTIPLIER, 2 ** Math.floor(streakTicks / (BATATA_DOUBLE_EVERY_SECONDS * TICK_RATE)));
}

export function carrapetaKillPoints(frenzy: FrenzyState, holder: number, killer: number, victim: number): number {
  if (frenzy.kind === 'calm' || killer === victim) return 0;
  return killer === holder ? BATATA_KILL_POINTS : victim === holder ? BATATA_BOUNTY_POINTS : 0;
}

/** While somebody holds the objective everybody plays against the holder, so a pair can hurt each other only when one of them is the holder. With nobody holding it, everyone is fair game. */
export function carrapetaEnemies(state: CarrapetaState, a: number, b: number): boolean {
  return state.kind !== 'held' || a === state.holder || b === state.holder;
}
