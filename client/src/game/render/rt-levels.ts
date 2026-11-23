/**
 * How much the light ray pass (`LightRt`) does. The pass is the dearest effect of the high tier, so it comes in steps
 * that keep the look and cut the cost: fewer rays, a smaller target, less edge smoothing. A level only exists on tiers
 * whose profile has `lightRt`; `off` builds nothing.
 */

export const RT_LEVELS = ['off', 'light', 'medium', 'high'] as const;
export type RtLevel = (typeof RT_LEVELS)[number];

export const DEFAULT_RT_LEVEL: RtLevel = 'medium';

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
  /** How much of the traced occlusion shows in the image (0..1). */
  strength: number;
  /** Ray-march radius in world units, about half a player's height. */
  radiusUnits: number;
}

/** `high` is what the pass looked like before it had levels. Each step down keeps the effect and lowers its cost. */
export const RT: Readonly<Record<RtLevel, RtProfile | null>> = {
  off: null,
  light: { label: 'leve', resolution: 0.5, rays: 3, denoiseSamples: 8, msaa: 0, strength: 0.75, radiusUnits: 40 },
  medium: { label: 'médio', resolution: 0.5, rays: 6, denoiseSamples: 12, msaa: 2, strength: 0.85, radiusUnits: 40 },
  high: { label: 'alto', resolution: 1, rays: 8, denoiseSamples: 16, msaa: 4, strength: 0.85, radiusUnits: 40 },
};

const OFF_LABEL = 'desligado';

export const RT_OPTIONS: readonly { v: RtLevel; label: string }[] = RT_LEVELS.map((v) => ({ v, label: RT[v]?.label ?? OFF_LABEL }));

export const rtLabel = (level: RtLevel): string => RT[level]?.label ?? OFF_LABEL;

export function isRtLevel(value: unknown): value is RtLevel {
  return RT_LEVELS.some((level) => level === value);
}

/** Reads a saved or untrusted value. The old on/off switch maps to `medium` and `off`; anything else gets the default. */
export function parseRtLevel(value: unknown): RtLevel {
  if (typeof value === 'boolean') return value ? DEFAULT_RT_LEVEL : 'off';
  return isRtLevel(value) ? value : DEFAULT_RT_LEVEL;
}

/** The step one notch cheaper, never below `light`: the lowest level the frame-time governor falls back to. */
export function cheaperRtLevel(level: RtLevel): RtLevel {
  if (level === 'high') return 'medium';
  if (level === 'medium') return 'light';
  return level;
}

/** The cheaper of the chosen level and a ceiling. `off` is the cheapest, so a player's choice of it always wins. */
export function capRtLevel(chosen: RtLevel, ceiling: RtLevel): RtLevel {
  return RT_LEVELS.indexOf(chosen) <= RT_LEVELS.indexOf(ceiling) ? chosen : ceiling;
}
