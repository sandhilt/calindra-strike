import { type DayCycle, type DayPhase, type MapTheme } from '@calindra-strike/shared';
import * as THREE from 'three';

/** Tone-mapping exposure of full day, what the renderer is created with. */
export const DAY_EXPOSURE = 1.05;

const COLOR_FIELDS = ['skyTop', 'skyHorizon', 'skyBottom', 'fog', 'sun', 'hemiSky', 'hemiGround'] as const;
const NUMBER_FIELDS = ['fogNear', 'fogFar', 'sunIntensity', 'sunAzimuth', 'sunElevation', 'hemiIntensity', 'exposure', 'stars', 'glow', 'scenery'] as const;

type ColorField = (typeof COLOR_FIELDS)[number];
type NumberField = (typeof NUMBER_FIELDS)[number];

/**
 * Everything the light of a map changes through the day. The day look is exactly the map's own theme; the others
 * are derived from it (`PHASE_GRADES`) so a map never has to be edited for them.
 */
export type DayLook = Record<ColorField, THREE.Color> &
  Record<NumberField, number> & {
    /** Direction the light travels FROM, kept in step with `sunAzimuth` and `sunElevation`. */
    sunDir: THREE.Vector3;
  };

/** How the afternoon and the night are drawn from the day theme. Angles are degrees, scales multiply the theme. */
interface PhaseGrade {
  /** Each colour moves `amount` (0..1) of the way toward `tint`. */
  colors: Record<ColorField, readonly [tint: string, amount: number]>;
  sunIntensityScale: number;
  hemiIntensityScale: number;
  /** The sun (or moon) turns this far around the map from its day bearing and stands at this height. */
  sunTurnDeg: number;
  sunElevationDeg: number;
  exposure: number;
  /** Star density of the sky dome, 0 to 1. */
  stars: number;
  /** Multiplies emissive signs, screens and the map light halos, so they read stronger in the dark. */
  glow: number;
  /** Brightness of the unlit distant silhouettes (mountains). */
  scenery: number;
}

// Tuning values. Night stays readable on purpose: the hemisphere light and the exposure keep players visible at
// range, and the sun's colour turns to a cool moon instead of vanishing.
const PHASE_GRADES: Readonly<Record<Exclude<DayPhase, 'day'>, PhaseGrade>> = {
  afternoon: {
    colors: {
      skyTop: ['#4a62a6', 0.5],
      skyHorizon: ['#ffa35c', 0.8],
      skyBottom: ['#e8965f', 0.65],
      fog: ['#f0b183', 0.65],
      sun: ['#ff9f55', 0.8],
      hemiSky: ['#ffd2a3', 0.5],
      hemiGround: ['#7b5a47', 0.45],
    },
    sunIntensityScale: 1.1,
    hemiIntensityScale: 0.85,
    sunTurnDeg: 55,
    sunElevationDeg: 17,
    exposure: 1.05,
    stars: 0,
    glow: 1.15,
    scenery: 0.75,
  },
  night: {
    colors: {
      skyTop: ['#070d24', 0.92],
      skyHorizon: ['#25356b', 0.85],
      skyBottom: ['#121a38', 0.88],
      fog: ['#1c2850', 0.85],
      sun: ['#a9bdff', 0.9],
      hemiSky: ['#8ea2e8', 0.75],
      hemiGround: ['#434b72', 0.6],
    },
    sunIntensityScale: 0.34,
    hemiIntensityScale: 0.62,
    sunTurnDeg: 120,
    sunElevationDeg: 58,
    exposure: 1.3,
    stars: 1,
    glow: 1.9,
    scenery: 0.3,
  },
};

const RAD = Math.PI / 180;

export function createLook(): DayLook {
  return {
    skyTop: new THREE.Color(),
    skyHorizon: new THREE.Color(),
    skyBottom: new THREE.Color(),
    fog: new THREE.Color(),
    sun: new THREE.Color(),
    hemiSky: new THREE.Color(),
    hemiGround: new THREE.Color(),
    fogNear: 0,
    fogFar: 0,
    sunIntensity: 0,
    sunAzimuth: 0,
    sunElevation: 0,
    hemiIntensity: 0,
    exposure: DAY_EXPOSURE,
    stars: 0,
    glow: 1,
    scenery: 1,
    sunDir: new THREE.Vector3(),
  };
}

function setSunDir(look: DayLook): void {
  const c = Math.cos(look.sunElevation);
  look.sunDir.set(c * Math.sin(look.sunAzimuth), Math.sin(look.sunElevation), c * Math.cos(look.sunAzimuth));
}

function dayLook(theme: MapTheme): DayLook {
  const look = createLook();
  look.skyTop.set(theme.skyTop);
  look.skyHorizon.set(theme.skyHorizon);
  look.skyBottom.set(theme.skyBottom);
  look.fog.set(theme.fog);
  look.sun.set(theme.sun);
  look.hemiSky.set(theme.hemiSky);
  look.hemiGround.set(theme.hemiGround);
  look.fogNear = theme.fogNear;
  look.fogFar = theme.fogFar;
  look.sunIntensity = theme.sunIntensity;
  look.hemiIntensity = theme.hemiIntensity;
  const d = theme.sunDir;
  look.sunAzimuth = Math.atan2(d.x, d.z);
  look.sunElevation = Math.atan2(d.y, Math.hypot(d.x, d.z));
  setSunDir(look);
  return look;
}

function gradedLook(day: DayLook, grade: PhaseGrade): DayLook {
  const look = createLook();
  const tint = new THREE.Color();
  for (const field of COLOR_FIELDS) {
    const [to, amount] = grade.colors[field];
    look[field].copy(day[field]).lerp(tint.set(to), amount);
  }
  look.fogNear = day.fogNear;
  look.fogFar = day.fogFar;
  look.sunIntensity = day.sunIntensity * grade.sunIntensityScale;
  look.hemiIntensity = day.hemiIntensity * grade.hemiIntensityScale;
  look.sunAzimuth = day.sunAzimuth + grade.sunTurnDeg * RAD;
  look.sunElevation = grade.sunElevationDeg * RAD;
  look.exposure = grade.exposure;
  look.stars = grade.stars;
  look.glow = grade.glow;
  look.scenery = grade.scenery;
  setSunDir(look);
  return look;
}

function applyOverride(look: DayLook, over: Partial<Omit<MapTheme, 'phases'>>): void {
  for (const field of COLOR_FIELDS) {
    const value = over[field];
    if (value !== undefined) look[field].set(value);
  }
  if (over.fogNear !== undefined) look.fogNear = over.fogNear;
  if (over.fogFar !== undefined) look.fogFar = over.fogFar;
  if (over.sunIntensity !== undefined) look.sunIntensity = over.sunIntensity;
  if (over.hemiIntensity !== undefined) look.hemiIntensity = over.hemiIntensity;
  if (over.sunDir) {
    look.sunAzimuth = Math.atan2(over.sunDir.x, over.sunDir.z);
    look.sunElevation = Math.atan2(over.sunDir.y, Math.hypot(over.sunDir.x, over.sunDir.z));
    setSunDir(look);
  }
}

/** The look of every phase for one map: the day is its theme, the rest is derived from it unless the theme overrides. */
export function buildLooks(theme: MapTheme): Record<DayPhase, DayLook> {
  const day = dayLook(theme);
  const afternoon = gradedLook(day, PHASE_GRADES.afternoon);
  const night = gradedLook(day, PHASE_GRADES.night);
  if (theme.phases?.afternoon) applyOverride(afternoon, theme.phases.afternoon);
  if (theme.phases?.night) applyOverride(night, theme.phases.night);
  return { day, afternoon, night };
}

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** Writes the look at `cycle` into `out` without allocating: the phase's look eased toward the next one. */
export function lookAt(out: DayLook, looks: Readonly<Record<DayPhase, DayLook>>, cycle: DayCycle): void {
  const from = looks[cycle.phase];
  if (cycle.blend <= 0) {
    copyLook(out, from);
    return;
  }
  const to = looks[cycle.next];
  const t = smoothstep(Math.min(1, cycle.blend));
  for (const field of COLOR_FIELDS) out[field].lerpColors(from[field], to[field], t);
  for (const field of NUMBER_FIELDS) out[field] = from[field] + (to[field] - from[field]) * t;
  setSunDir(out);
}

export function copyLook(out: DayLook, from: DayLook): void {
  for (const field of COLOR_FIELDS) out[field].copy(from[field]);
  for (const field of NUMBER_FIELDS) out[field] = from[field];
  out.sunDir.copy(from.sunDir);
}
