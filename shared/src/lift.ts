/**
 * Glass lifts. A lift is a field, not a vehicle: a player whose centre is inside a shaft's footprint is carried
 * up at a constant speed, or down while holding crouch, so the result depends only on where the player is and
 * what they press. Client prediction and the server agree without sharing any state, and the cab drawn on the
 * client simply follows its riders.
 *
 * The cab slows to a crawl around every stop between the ends, long enough to walk out through the doorway
 * of that floor, and holds at the first and last stop.
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

export const LIFT_SPEED_UNITS = 150;
/** Speed near an intermediate stop, so the doorway stays level with the floor for a second and a half. */
export const LIFT_DWELL_SPEED_UNITS = 28;
/** Distance either side of an intermediate stop where the cab crawls: about what a step up or a doorway allows. */
export const LIFT_DWELL_RADIUS_UNITS = 20;
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

/** Climb speed at height `y`: slow around the stops between the ends. */
export function liftSpeed(lift: Lift, y: number): number {
  const between = lift.stops.slice(1, -1);
  return between.some((stop) => Math.abs(y - stop) <= LIFT_DWELL_RADIUS_UNITS) ? LIFT_DWELL_SPEED_UNITS : LIFT_SPEED_UNITS;
}

/** Feet height after one tick of riding, never past the first or last stop. */
export function liftRide(lift: Lift, y: number, down: boolean, dt: number): number {
  const next = y + (down ? -1 : 1) * liftSpeed(lift, y) * dt;
  return Math.min(liftTop(lift), Math.max(liftBottom(lift), next));
}

/** Seconds to ride from one height to another by holding up or crouch, counting the crawl at the stops passed. */
export function liftRideSeconds(lift: Lift, from: number, to: number, dt = 1 / 60): number {
  let y = from;
  let ticks = 0;
  const down = to < from;
  while (down ? y > to : y < to) {
    const next = liftRide(lift, y, down, dt);
    if (next === y) return Infinity;
    y = next;
    ticks++;
  }
  return ticks * dt;
}
