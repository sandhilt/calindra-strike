import { ESCALATOR_SPEED_UNITS, type EscalatorTravel } from '@calindra-strike/shared';

/**
 * Pure motion rules of the animated scenery (escalator steps, fountain drops, vent wisps, fan spin).
 * No three.js here, so the shapes of the motion are unit tested and the renderers only place what these return.
 */

/** Longest rise of one escalator step: `MapBuilder.stairs` never makes a step taller. */
export const STEP_RISE_MAX_UNITS = 16;
/** How fast the steps travel along the incline, in units per second: the same speed that carries a rider (`escalatorDrift`). */
export const ESCALATOR_SPEED_UNITS_PER_S = ESCALATOR_SPEED_UNITS;
/** Thickness of a drawn tread and of a riser, in units. */
export const TREAD_THICKNESS_UNITS = 3.5;
export const RISER_THICKNESS_UNITS = 1.5;

export interface EscalatorShape {
  /** Horizontal run from the foot to the top, in units. */
  length: number;
  height: number;
}

export interface StepGeometry {
  count: number;
  rise: number;
  depth: number;
}

function stepCount(shape: EscalatorShape): number {
  return Math.ceil(shape.height / STEP_RISE_MAX_UNITS);
}

export function stepGeometry(shape: EscalatorShape): StepGeometry {
  const count = stepCount(shape);
  return { count, rise: shape.height / count, depth: shape.length / count };
}

/** One moving step, clipped to the escalator: positions run from the foot (0) to the top (`length`). */
export interface StepSlot {
  treadOn: boolean;
  treadFrom: number;
  treadTo: number;
  treadTop: number;
  riserOn: boolean;
  riserAt: number;
  riserBottom: number;
  riserTop: number;
}

export function newStepSlot(): StepSlot {
  return { treadOn: false, treadFrom: 0, treadTo: 0, treadTop: 0, riserOn: false, riserAt: 0, riserBottom: 0, riserTop: 0 };
}

/**
 * Where the step at position `u` (in steps from the foot, fractional while it moves) is. At whole numbers the
 * steps coincide with the stair boxes. A step enters flat at the foot and flattens into the landing at the top
 * instead of poking out of either end.
 */
export function fillStepSlot(out: StepSlot, u: number, shape: EscalatorShape): void {
  const count = stepCount(shape);
  const rise = shape.height / count;
  const depth = shape.length / count;
  const from = depth * u;
  const to = depth * (u + 1);
  const top = Math.min(rise * (u + 1), shape.height);
  out.treadOn = to > 0 && from < shape.length && top > 0;
  out.treadFrom = Math.max(from, 0);
  out.treadTo = Math.min(to, shape.length);
  out.treadTop = top;
  const bottom = Math.min(Math.max(rise * (u + 1), 0), shape.height);
  const riserTop = Math.min(rise * (u + 2), shape.height);
  out.riserOn = to > 0 && to <= shape.length && riserTop > bottom;
  out.riserAt = to;
  out.riserBottom = bottom;
  out.riserTop = riserTop;
}

/** Fractional offset of the steps from their resting positions, measured uphill. */
export function escalatorPhase(seconds: number, shape: EscalatorShape, travel: EscalatorTravel): number {
  const depth = shape.length / stepCount(shape);
  const turns = (seconds * ESCALATOR_SPEED_UNITS_PER_S) / depth;
  const phase = turns - Math.floor(turns);
  return travel === 'down' ? (1 - phase) % 1 : phase;
}

/** A falling drop of the fountain: launched from `radius` at height `y0`, flying outward with `vr` and up with `vy`. */
export interface DropSpec {
  radius: number;
  y0: number;
  outward: number;
  up: number;
  gravity: number;
  lifeSeconds: number;
}

export interface DropPose {
  r: number;
  y: number;
}

export function dropPose(out: DropPose, spec: DropSpec, lifeFraction: number): void {
  const age = lifeFraction * spec.lifeSeconds;
  out.r = spec.radius + spec.outward * age;
  out.y = spec.y0 + spec.up * age - 0.5 * spec.gravity * age * age;
}

/** The tall central jet, in basin units (y above the upper basin water). */
export const JET_DROP: DropSpec = { radius: 2, y0: 88, outward: 52, up: 150, gravity: 420, lifeSeconds: 1.15 };
/** The sheet of drops falling from the upper basin rim into the lower one. */
export const CASCADE_DROP: DropSpec = { radius: 76, y0: -2, outward: 26, up: 0, gravity: 420, lifeSeconds: 0.62 };

/** Share of its life (0 to 1) a particle that started `offset` into its cycle has reached after `seconds`. */
export function lifeFraction(seconds: number, lifeSeconds: number, offset: number): number {
  const x = seconds / lifeSeconds + offset;
  return x - Math.floor(x);
}

export const WISPS_PER_VENT = 5;
export const WISP_LIFE_SECONDS = 4.5;
/** Highest opacity a wisp reaches; it is meant to be barely there. */
export const WISP_MAX_ALPHA = 0.22;
export const WISP_REACH_UNITS = 46;
/** How far a wisp has sunk by the end of its life: the air from a vent is cold, so it falls instead of climbing. */
export const WISP_SINK_UNITS = 40;

export interface WispPose {
  out: number;
  /** Units below the grille, growing; the wisp only starts to fall after it has left the grille. */
  down: number;
  side: number;
  alpha: number;
}

/** Wisp `i` of a vent: it drifts out of the grille, then sinks faster as it goes, and fades in and out over its life. */
export function wispPose(out: WispPose, i: number, seconds: number, ventSeed: number): void {
  const life = lifeFraction(seconds, WISP_LIFE_SECONDS, i / WISPS_PER_VENT + ventSeed);
  out.out = life * WISP_REACH_UNITS;
  out.down = life * life * WISP_SINK_UNITS;
  out.side = Math.sin(life * Math.PI * 2 + i * 1.7 + ventSeed * 9) * 5 * life;
  out.alpha = WISP_MAX_ALPHA * Math.sin(life * Math.PI);
}

export interface FlamePose {
  height: number;
  width: number;
  swayRadians: number;
}

const FLAME_SEED_PHASE_RAD = 2.399;
const FLAME_RISE_RAD_PER_S = 11.3;
const FLAME_FLICKER_RAD_PER_S = 19.7;
const FLAME_SWAY_RAD_PER_S = 7.9;
const FLAME_RISE_AMPLITUDE = 0.16;
const FLAME_FLICKER_AMPLITUDE = 0.09;
const FLAME_WIDTH_AMPLITUDE = 0.18;
const FLAME_SWAY_AMPLITUDE_RAD = 0.17;

export function flamePose(out: FlamePose, seconds: number, seed: number): void {
  const phase = seed * FLAME_SEED_PHASE_RAD;
  const flicker = Math.sin(seconds * FLAME_FLICKER_RAD_PER_S - phase);
  out.height = 1 + FLAME_RISE_AMPLITUDE * Math.sin(seconds * FLAME_RISE_RAD_PER_S + phase)
    + FLAME_FLICKER_AMPLITUDE * flicker;
  out.width = 1 + FLAME_WIDTH_AMPLITUDE * flicker;
  out.swayRadians = FLAME_SWAY_AMPLITUDE_RAD * Math.sin(seconds * FLAME_SWAY_RAD_PER_S + phase);
}

/** Spin of a fan in radians after `seconds`; each fan starts at its own angle so they never move in step. */
export function fanAngle(seconds: number, radiansPerSecond: number, seed: number): number {
  return (seconds * radiansPerSecond + seed * 2.399) % (Math.PI * 2);
}

/** A vent hum is heard from this far and no farther (units). */
export const AIR_AUDIBLE_UNITS = 420;

export const CEILING_FAN_RAD_PER_S = 5.5;
export const VENT_FAN_RAD_PER_S = 13;

/** A cab's doors are fully open this close to a stop and fully shut this far from it. */
export const LIFT_DOOR_OPEN_UNITS = 6;
export const LIFT_DOOR_SHUT_UNITS = 30;

export interface LiftShape {
  x: number;
  z: number;
  yaw: number;
  width: number;
  depth: number;
  stops: readonly { y: number; side: 'front' | 'back' }[];
}

/** The stop a cab at height `y` is nearest to, with how far it is from it. */
export function nearestStop(stops: LiftShape['stops'], y: number): { index: number; distance: number } {
  let best = { index: 0, distance: Infinity };
  stops.forEach((stop, index) => {
    const distance = Math.abs(y - stop.y);
    if (distance < best.distance) best = { index, distance };
  });
  return best;
}

/** How open the doors are at that distance from a stop: 1 open, 0 shut, easing in between. */
export function doorOpening(distance: number): number {
  const t = (LIFT_DOOR_SHUT_UNITS - distance) / (LIFT_DOOR_SHUT_UNITS - LIFT_DOOR_OPEN_UNITS);
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}
