/**
 * Glass lifts. A lift is a field, not a vehicle: a player whose centre is inside a shaft's footprint is carried
 * up at a constant speed, or down while holding crouch, so the result depends only on where the player is and
 * what they press. Client prediction and the server agree without sharing any state, and the cab drawn on the
 * client simply follows its riders.
 *
 * The cab slows to a crawl around every stop, long enough to walk out through the doorway of that floor (the
 * ground floor one too: a rider who stands up on arriving rises only a hand's breadth before they are out),
 * and holds at the first and last stop.
 */
export interface Lift {
  /** Inner footprint of the shaft (world units): a player is carried while their centre is inside it. */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Floor heights the shaft serves, ascending. The first and last are where the cab holds. */
  stops: readonly number[];
}

/** Ticks the cab stands still at every stop, and after a rider boards (1.5 s, a tuning value). */
export const LIFT_STOP_WAIT_TICKS = 90;
export const LIFT_SPEED_UNITS = 150;
/** Feet this far above the last stop are still carried, so a hop at the top does not drop the rider down the shaft. */
export const LIFT_TOP_SLACK_UNITS = 8;
/** Height of the doorway of a stop above its floor. */
export const LIFT_DOOR_HEIGHT_UNITS = 96;

export const liftBottom = (lift: Lift): number => lift.stops[0];
export const liftTop = (lift: Lift): number => lift.stops[lift.stops.length - 1];

/** The lift that carries a player standing with feet at (x, y, z), if any. */
export function liftAt(lifts: readonly Lift[], x: number, y: number, z: number): Lift | undefined {
  return lifts.find(
    (lift) => x > lift.minX && x < lift.maxX && z > lift.minZ && z < lift.maxZ && y >= liftBottom(lift) - 1 && y <= liftTop(lift) + LIFT_TOP_SLACK_UNITS,
  );
}

/** 1 rises, -1 descends. */
export type LiftDir = 1 | -1;

const AT_STOP_EPSILON = 1e-6;

export interface LiftRide {
  y: number;
  dir: LiftDir;
  /** Ticks left before the cab moves again. */
  wait: number;
}

/**
 * One tick of an ordinary elevator: it holds for `wait` ticks, then travels in `dir` and stops, for a new wait, at
 * the next stop. At the first stop it can only go up and at the last only down, so a rider never presses anything.
 */
export function liftStep(lift: Lift, y: number, dir: LiftDir, wait: number, dt: number): LiftRide {
  const heading: LiftDir = y >= liftTop(lift) - AT_STOP_EPSILON ? -1 : y <= liftBottom(lift) + AT_STOP_EPSILON ? 1 : dir;
  if (wait > 0) return { y, dir: heading, wait: wait - 1 };
  const reach = y + heading * LIFT_SPEED_UNITS * dt;
  const stop = heading > 0
    ? lift.stops.find((s) => s > y + AT_STOP_EPSILON && s <= reach)
    : lift.stops.findLast((s) => s < y - AT_STOP_EPSILON && s >= reach);
  if (stop !== undefined) return { y: stop, dir: heading, wait: LIFT_STOP_WAIT_TICKS };
  return { y: reach, dir: heading, wait: 0 };
}

const MAX_RIDE_TICKS = 60 * 600;

/** Seconds from boarding at height `from` (going up, unless it is the top) until the cab stands at `to`, counting every wait on the way. */
export function liftRideSeconds(lift: Lift, from: number, to: number, wait = LIFT_STOP_WAIT_TICKS, dt = 1 / 60): number {
  let ride: LiftRide = { y: from, dir: 1, wait };
  for (let ticks = 0; ticks < MAX_RIDE_TICKS; ticks++) {
    if (Math.abs(ride.y - to) <= 1) return ticks * dt;
    ride = liftStep(lift, ride.y, ride.dir, ride.wait, dt);
  }
  return Infinity;
}
