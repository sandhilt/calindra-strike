const FALL_UNITS_PER_SECOND = 48;
const DRIFT_UNITS_PER_SECOND = 16;
const SWAY_UNITS = 14;

/** Repeat a coordinate within a half-open interval without moving its world-space origin. */
export function wrapSnow(value: number, min: number, span: number): number {
  const offset = value - min;
  return min + offset - Math.floor(offset / span) * span;
}

export interface Snowflake {
  x: number;
  y: number;
  z: number;
  pace: number;
  phase: number;
}

interface SnowflakePosition { x: number; y: number; z: number }

/** Write a flake's position from its seed and elapsed seconds without allocating. */
export function snowPosition(flake: Snowflake, seconds: number, out: SnowflakePosition): void {
  out.x = flake.x + seconds * DRIFT_UNITS_PER_SECOND + Math.sin(seconds + flake.phase) * SWAY_UNITS;
  out.y = flake.y - seconds * FALL_UNITS_PER_SECOND * flake.pace;
  out.z = flake.z + Math.cos(seconds * flake.pace + flake.phase) * SWAY_UNITS;
}
