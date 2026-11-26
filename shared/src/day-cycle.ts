import { DAY_PHASES, MOON_ECLIPSE_CHANCE, MOON_PHASES, SOLAR_ECLIPSE_MS, type MoonPhase, DAY_SLOT_MS, DAY_TRANSITION_MS, type DayPhase } from './constants.ts';

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

function cycleIndex(serverMs: number): number {
  return Math.floor(serverMs / DAY_CYCLE_MS);
}

/**
 * The moon of the cycle running at a server time. It changes once per cycle, at the start of day, so it holds through
 * a whole night and every player sees the same one.
 */
export function moonPhaseAt(serverMs: number): MoonPhase {
  const n = MOON_PHASES.length;
  return MOON_PHASES[((cycleIndex(serverMs) % n) + n) % n];
}

/** A seeded 0..1 value per cycle (integer hash), so every client draws the same eclipses without a message. */
export function cycleRoll(cycle: number): number {
  let h = Math.imul(cycle | 0, 0x9e3779b1) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export type EclipseKind = 'lunar' | 'solar';

export interface Eclipse {
  kind: EclipseKind | null;
  /** 0 none, 1 totality. */
  depth: number;
  /** 0..1 through the eclipse's stretch, so a solar occulter crosses the sun from one side to the other. */
  progress: number;
}

/** Whether the cycle at this time has an eclipse: lunar only on full moon, solar only on new moon. */
export function eclipseKindAt(serverMs: number): EclipseKind | null {
  const phase = moonPhaseAt(serverMs);
  if (phase !== 'full' && phase !== 'new') return null;
  if (cycleRoll(cycleIndex(serverMs)) >= MOON_ECLIPSE_CHANCE) return null;
  return phase === 'full' ? 'lunar' : 'solar';
}

/**
 * The eclipse at a server time. A lunar eclipse reddens the moon across the night slot, deepest in its middle; a solar
 * one darkens the sun for `SOLAR_ECLIPSE_MS` in the middle of the day slot. Both ease in and out.
 */
export function eclipseAt(serverMs: number, into: Eclipse = { kind: null, depth: 0, progress: 0 }): Eclipse {
  into.kind = eclipseKindAt(serverMs);
  into.depth = 0;
  into.progress = 0;
  if (!into.kind) return into;
  const t = ((serverMs % DAY_CYCLE_MS) + DAY_CYCLE_MS) % DAY_CYCLE_MS;
  let start: number;
  let length: number;
  if (into.kind === 'lunar') {
    start = DAY_CYCLE_MS - DAY_SLOT_MS.night;
    length = DAY_SLOT_MS.night - DAY_TRANSITION_MS;
  } else {
    length = SOLAR_ECLIPSE_MS;
    start = (DAY_SLOT_MS.day - DAY_TRANSITION_MS - length) / 2;
  }
  const x = (t - start) / length;
  if (x <= 0 || x >= 1) return into;
  into.depth = Math.sin(Math.PI * x) ** 2;
  into.progress = x;
  return into;
}
