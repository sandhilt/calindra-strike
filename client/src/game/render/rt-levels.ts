/**
 * How much the light ray pass (`LightRt`) does. The pass is the dearest effect of the high tier, so it comes in steps
 * that keep the look and cut the cost: fewer rays, a smaller target, less edge smoothing. A level only exists on tiers
 * whose profile has `lightRt`; `off` builds nothing.
 */

export const RT_LEVELS = ['off', 'light', 'medium', 'high'] as const;
export type RtLevel = (typeof RT_LEVELS)[number];

export const DEFAULT_RT_LEVEL: RtLevel = 'medium';

/** What the menu stores: a fixed level, or `auto`, which starts at `high` and lets the frame-time governor step it down. */
export const RT_CHOICES = ['auto', ...RT_LEVELS] as const;
export type RtChoice = (typeof RT_CHOICES)[number];
export const DEFAULT_RT_CHOICE: RtChoice = 'auto';
export const AUTO_RT_START: RtLevel = 'high';
/** Where `auto` starts on an integrated GPU: `high` costs about 27 ms of its GPU time per frame, so the first seconds of every match would stutter until the governor stepped down. */
export const INTEGRATED_RT_START: RtLevel = 'medium';

export interface RtProfile {
  /** Label on the pause menu. */
  label: string;
  /** Side of the occlusion targets as a share of the canvas; the result is upsampled when it is blended in. */
  resolution: number;
  /** Rays per pixel (three.js `SAMPLES`); the pass takes `ceil(rays / 3)` steps along each of 3 directions. */
  rays: number;
  /** Taps of the denoise pass that smooths the rays. */
  denoiseSamples: number;
  /** MSAA samples of the composer targets. The canvas's own antialiasing does not reach a pass chain, so 0 shows jagged edges. */
  msaa: number;
  /** Takes depth from the scene the composer already drew and rebuilds normals from it, so the scene is not drawn a second time for normals. Slightly softer at silhouettes. */
  sceneDepth: boolean;
  /** How much of the traced occlusion shows in the image (0..1). */
  strength: number;
  /** Ray-march radius in world units, about half a player's height. */
  radiusUnits: number;
}

/** `high` is what the pass looked like before it had levels. Each step down keeps the effect and lowers its cost. */
export const RT: Readonly<Record<RtLevel, RtProfile | null>> = {
  off: null,
  light: { label: 'leve', resolution: 0.5, rays: 3, denoiseSamples: 8, msaa: 2, sceneDepth: true, strength: 0.75, radiusUnits: 40 },
  medium: { label: 'médio', resolution: 0.5, rays: 6, denoiseSamples: 12, msaa: 2, sceneDepth: true, strength: 0.85, radiusUnits: 40 },
  high: { label: 'alto', resolution: 1, rays: 8, denoiseSamples: 16, msaa: 4, sceneDepth: false, strength: 0.85, radiusUnits: 40 },
};

const OFF_LABEL = 'desligado';
const AUTO_LABEL = 'automático';

export const RT_OPTIONS: readonly { v: RtChoice; label: string }[] = RT_CHOICES.map((v) => ({ v, label: v === 'auto' ? AUTO_LABEL : (RT[v]?.label ?? OFF_LABEL) }));

export const rtLabel = (level: RtLevel): string => RT[level]?.label ?? OFF_LABEL;

export function isRtLevel(value: unknown): value is RtLevel {
  return RT_LEVELS.some((level) => level === value);
}

/** Reads a saved or untrusted value. The old on/off switch maps to `auto` and `off`; anything else gets the default. */
export function parseRtChoice(value: unknown): RtChoice {
  if (typeof value === 'boolean') return value ? DEFAULT_RT_CHOICE : 'off';
  return RT_CHOICES.some((choice) => choice === value) ? (value as RtChoice) : DEFAULT_RT_CHOICE;
}

/** The level to run: a fixed choice as it is, `auto` at the governor's ceiling (which starts at `high`). */
export function resolveRtChoice(choice: RtChoice, autoCeiling: RtLevel): RtLevel {
  return choice === 'auto' ? autoCeiling : choice;
}

/** The step one notch cheaper, never below `light`: the lowest level the frame-time governor falls back to. */
export function cheaperRtLevel(level: RtLevel): RtLevel {
  if (level === 'high') return 'medium';
  if (level === 'medium') return 'light';
  return level;
}

