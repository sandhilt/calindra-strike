import { DAY_PHASES, DAY_SLOT_MS, DAY_TRANSITION_MS, type DayPhase } from './constants.ts';

/** Where the day cycle is: `phase` has the floor, and `blend` (0..1) is how far it has already handed over to `next`. */
export interface DayCycle {
  phase: DayPhase;
  next: DayPhase;
  blend: number;
}

export const DAY_CYCLE_MS = DAY_PHASES.reduce((sum, p) => sum + DAY_SLOT_MS[p], 0);

/**
 * The cycle at a server time. It is a pure function of the clock every client already shares, so all players see
 * the same light without a message. Time 0 is the start of day. Pass `into` to reuse one object every frame.
 */
export function dayCycleAt(serverMs: number, into: DayCycle = { phase: 'day', next: 'afternoon', blend: 0 }): DayCycle {
  let t = ((serverMs % DAY_CYCLE_MS) + DAY_CYCLE_MS) % DAY_CYCLE_MS;
  for (let i = 0; i < DAY_PHASES.length; i++) {
    const phase = DAY_PHASES[i];
    const slot = DAY_SLOT_MS[phase];
    if (t < slot) {
      const next = DAY_PHASES[(i + 1) % DAY_PHASES.length];
      into.phase = phase;
      into.next = next;
      into.blend = Math.max(0, (t - (slot - DAY_TRANSITION_MS)) / DAY_TRANSITION_MS);
      return into;
    }
    t -= slot;
  }
  into.phase = DAY_PHASES[0];
  into.next = DAY_PHASES[1];
  into.blend = 0;
  return into;
}

/** The phase the light is heading for: the next one once the transition has begun. */
export function dayCycleTarget(c: DayCycle): DayPhase {
  return c.blend > 0 ? c.next : c.phase;
}
