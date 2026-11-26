import { TICK_MS, TICK_RATE } from './constants.ts';
/**
 * Glass lifts: one cab per shaft that everybody shares. Where it is depends only on the server clock, so the
 * server, every client's prediction and the drawn cab agree without any state to send. It goes up through every
 * stop and back down, waits at each one long enough to walk out through that floor's doorway, and nobody
 * presses anything. A player whose centre is in the footprint and whose feet are on the cab's floor, or just
 * behind it in its direction of travel, boards it, and rides it until their centre leaves the footprint. The shaft has no floor of its own at the upper stops, so
 * each doorway is shut (solid) except while the cab waits at it.
 */
/** A doorway of the shaft: the wall slab across it, `LIFT_DOOR_HEIGHT_UNITS` high from the stop's floor. */
export interface LiftDoor {
  /** The stop whose cab opens it. */
  y: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Lift {
  /** Inner footprint of the shaft (world units): a player is carried while their centre is inside it. */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Floor heights the shaft serves, ascending. The first and last are where the cab holds. */
  stops: readonly number[];
  doors: readonly LiftDoor[];
}

/** Ticks the cab stands still at every stop (1.5 s, a tuning value). */
export const LIFT_STOP_WAIT_TICKS = 90;
export const LIFT_SPEED_UNITS = 150;
/** A rider is carried while the cab is this far ahead of their feet in its direction of travel: about three ticks of travel. */
export const LIFT_CARRY_UNITS = 8;
/** The server accepts a command's own clock only this close to its tick; further off, a command rides on the server's clock. */
export const LIFT_CLOCK_SLACK_TICKS = 12;
/** Feet this far above the last stop are still carried, so a hop at the top does not drop the rider down the shaft. */
export const LIFT_TOP_SLACK_UNITS = 8;
/** Height of the doorway of a stop above its floor. */
export const LIFT_DOOR_HEIGHT_UNITS = 96;

export const liftBottom = (lift: Lift): number => lift.stops[0];
export const liftTop = (lift: Lift): number => lift.stops[lift.stops.length - 1];

/** Whether a centre at (x, z) is inside the shaft's footprint, at any height. */
export const inFootprint = (lift: Lift, x: number, z: number): boolean => x > lift.minX && x < lift.maxX && z > lift.minZ && z < lift.maxZ;

/** The lift that carries a player standing with feet at (x, y, z), if any. */
export function liftAt(lifts: readonly Lift[], x: number, y: number, z: number): Lift | undefined {
  return lifts.find(
    (lift) => inFootprint(lift, x, z) && y >= liftBottom(lift) - 1 && y <= liftTop(lift) + LIFT_TOP_SLACK_UNITS,
  );
}

/** The one cab of a shaft at a moment: its floor height and which way it moves (0 while it waits at a stop). */
export interface LiftCab {
  y: number;
  moving: -1 | 0 | 1;
}

interface Leg {
  from: number;
  to: number;
  travelTicks: number;
}

interface Schedule {
  legs: readonly Leg[];
  period: number;
}

const schedules = new WeakMap<Lift, Schedule>();

/** The cab goes up through every stop and back down again, waiting at each one, and never stops anywhere else. */
function scheduleOf(lift: Lift): Schedule {
  const cached = schedules.get(lift);
  if (cached) return cached;
  const order = [...lift.stops.keys(), ...[...lift.stops.keys()].slice(1, -1).reverse()];
  const legs = order.map((index, i): Leg => {
    const from = lift.stops[index];
    const to = lift.stops[order[(i + 1) % order.length]];
    return { from, to, travelTicks: Math.ceil(Math.abs(to - from) / (LIFT_SPEED_UNITS / TICK_RATE)) };
  });
  const period = legs.reduce((sum, leg) => sum + LIFT_STOP_WAIT_TICKS + leg.travelTicks, 0);
  const schedule = { legs, period };
  schedules.set(lift, schedule);
  return schedule;
}

/** Where the shaft's cab is at server tick `tick`: the same for everybody, from the clock alone. */
export function liftCab(lift: Lift, tick: number): LiftCab {
  const { legs, period } = scheduleOf(lift);
  let t = ((tick % period) + period) % period;
  for (const leg of legs) {
    if (t < LIFT_STOP_WAIT_TICKS) return { y: leg.from, moving: 0 };
    t -= LIFT_STOP_WAIT_TICKS;
    if (t < leg.travelTicks) {
      const heading = leg.to > leg.from ? 1 : -1;
      const reached = (t + 1) / leg.travelTicks;
      return { y: leg.from + (leg.to - leg.from) * reached, moving: heading };
    }
    t -= leg.travelTicks;
  }
  return { y: legs[0].from, moving: 0 };
}

/**
 * Whether a player stands in the cab: their centre is in the shaft and their feet are on the cab floor, moving or waiting
 * at a stop. Someone in the shaft with the cab on another floor is not in it.
 */
export function inLiftCab(lifts: readonly Lift[], x: number, y: number, z: number, tick: number): boolean {
  const shaft = liftAt(lifts, x, y, z);
  return shaft !== undefined && Math.abs(liftCab(shaft, tick).y - y) <= LIFT_CARRY_UNITS;
}

/**
 * Whether a player in the shaft with feet at `y` boards the cab: the cab carries them, or they are inside it above its
 * floor, having walked or jumped in through a doorway. Jumping is off in the shaft, so nobody else is up there.
 */
/** Whether the cab carries a rider standing with feet at `y`: its floor is under them, or it moves and its floor is just ahead of them. */
export function boards(cab: LiftCab, y: number): boolean {
  return carriedBy(cab, y) || (y > cab.y && y <= cab.y + LIFT_DOOR_HEIGHT_UNITS);
}

export function carriedBy(cab: LiftCab, y: number): boolean {
  if (cab.moving === 0) return Math.abs(cab.y - y) <= LIFT_CARRY_UNITS;
  const ahead = (cab.y - y) * cab.moving;
  return ahead >= 0 && ahead <= LIFT_CARRY_UNITS;
}

/**
 * The doors shut this many ticks before the cab leaves (0.2 s, a tuning value), so whoever is mid-doorway at that moment
 * is already inside on the cab floor when it sets off, and nobody can slip in behind a departed cab.
 */
export const LIFT_DOOR_CLOSE_TICKS = 12;

/** A doorway is open only while the cab waits at its stop, until just before it leaves; everywhere else it is shut. */
export function liftDoorOpen(lift: Lift, door: LiftDoor, tick: number): boolean {
  const waitsAt = (t: number): boolean => {
    const cab = liftCab(lift, t);
    return cab.moving === 0 && Math.abs(cab.y - door.y) < 1;
  };
  return waitsAt(tick) && waitsAt(tick + LIFT_DOOR_CLOSE_TICKS);
}

/**
 * The tick a command runs the cab at: its own clock (the client's render time plus the interpolation delay it
 * subtracted) when it is close to the server's, so prediction and server agree on the cab, else the server's.
 */
export function liftClockTick(interpMs: number, delayMs: number, serverTick: number): number {
  const claimed = Math.round((interpMs + delayMs) / TICK_MS);
  return Math.abs(claimed - serverTick) <= LIFT_CLOCK_SLACK_TICKS ? claimed : serverTick;
}

/**
 * Average seconds from reaching the doorway at `from` to standing at `to`: the wait for the cab, then the ride in
 * whichever direction it comes, counting every stop it waits at. For pathfinding and for agents.
 */
export function liftRideSeconds(lift: Lift, from: number, to: number): number {
  if (Math.abs(from - to) <= 1) return 0;
  const { period } = scheduleOf(lift);
  const step = 6;
  let total = 0;
  let samples = 0;
  for (let arrive = 0; arrive < period; arrive += step) {
    let t = arrive;
    while (Math.abs(liftCab(lift, t).y - from) > 1) t++;
    while (Math.abs(liftCab(lift, t).y - to) > 1) t++;
    total += (t - arrive) / TICK_RATE;
    samples++;
  }
  return total / samples;
}
