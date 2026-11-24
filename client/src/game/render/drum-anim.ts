/**
 * The Azeitadora's six chamber drum, as pure maths the viewmodel applies to its parts: which chambers hold a round and how far the drum has turned for the
 * rounds left in the magazine, and the flight of a round that leaves a chamber. No WebGL, so it can be tested.
 */

export const DRUM_CHAMBERS = 6;
const STEP_RAD = (2 * Math.PI) / DRUM_CHAMBERS;

export interface DrumLayout {
  /** Clockwise turn of the drum about its axis: one chamber step per round fired. */
  angle: number;
  /** One flag per chamber (index = position on the drum at rest): true while it still holds a round. */
  loaded: readonly boolean[];
}

/**
 * The order the chambers are fired in. The drum turns clockwise as seen from behind, so the next chamber to fire is the one anticlockwise of the last: that sends the
 * rounds still to fire round the side the shooter sees, not the side the frame hides.
 */
export const FIRING_ORDER: readonly number[] = Array.from({ length: DRUM_CHAMBERS }, (_, j) => (DRUM_CHAMBERS - j) % DRUM_CHAMBERS);

/** The drum with `mag` rounds left of `capacity` (3 while the frenzy halves it): the first chambers in firing order are spent, and the drum has turned past them. */
export function drumLayout(mag: number, capacity: number): DrumLayout {
  const size = Math.min(DRUM_CHAMBERS, Math.max(0, capacity));
  const fired = Math.min(size, Math.max(0, size - mag));
  const loaded = new Array<boolean>(DRUM_CHAMBERS).fill(false);
  for (const chamber of FIRING_ORDER.slice(fired, size)) loaded[chamber] = true;
  return { angle: fired * STEP_RAD, loaded };
}

/** Where chamber `k` sits round the drum, clockwise from the top, when the drum has turned `angle`: 0 is the firing position. */
export function chamberPosition(k: number, angle: number): number {
  const full = 2 * Math.PI;
  return (((k * STEP_RAD + angle) % full) + full) % full;
}

/** The chambers a reload has filled at `count`, in the order they are loaded. */
export function filledChambers(count: number): readonly number[] {
  return FIRING_ORDER.slice(0, count);
}

/** Seconds a fired round takes to leave the view. */
export const EJECT_SECONDS = 0.55;

/** The drum swings out and a reload spins it one full turn while it fills, in seconds of drum turn per chamber it loads. */
export const LOAD_TURN_RAD = 2 * Math.PI;

export interface ShellFlight {
  /** Offsets from the chamber, in model units: out to the left (the side the shooter sees), up, back toward the shooter. */
  x: number;
  y: number;
  z: number;
  /** Tumble about the shell's axis, radians. */
  spin: number;
  visible: boolean;
}

const OUT_UNITS = 9;
const RISE_UNITS = 6;
const FALL_UNITS = 26;
const BACK_UNITS = 3;
const TUMBLE_RAD = 11;

/** A fired round thrown from its chamber: it kicks out and up, then falls away on a spin. `t` runs 0..1 over `EJECT_SECONDS`. */
export function ejectedShell(t: number): ShellFlight {
  if (t < 0 || t >= 1) return { x: 0, y: 0, z: 0, spin: 0, visible: false };
  return { x: -OUT_UNITS * t, y: RISE_UNITS * t - FALL_UNITS * t * t, z: BACK_UNITS * t, spin: TUMBLE_RAD * t, visible: true };
}

/** A round dropping straight out of an open drum, `t` 0..1 as it falls. */
export function droppedShell(t: number): ShellFlight {
  if (t < 0 || t >= 1) return { x: 0, y: 0, z: 0, spin: 0, visible: false };
  return { x: -1.2 * t, y: -FALL_UNITS * 1.3 * t * t, z: 0, spin: 5 * t, visible: true };
}

/** How many chambers of a drum loaded to `capacity` are filled at `fill` (0 empty .. 1 full) during a reload. */
export function chambersFilled(fill: number, capacity: number): number {
  const size = Math.min(DRUM_CHAMBERS, Math.max(0, capacity));
  return Math.min(size, Math.max(0, Math.round(fill * size)));
}
