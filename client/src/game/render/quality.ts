/**
 * Graphics tiers. Every per-tier difference lives in this one table, so the
 * renderer, the world builder and the effects read a profile instead of
 * branching on the tier name. A tier only changes how things look: it never
 * hides a player, an effect that tells where a shot came from, or the bug.
 */

export const QUALITY_TIERS = ['high', 'low', 'performance'] as const;
export type Quality = (typeof QUALITY_TIERS)[number];

export const DEFAULT_QUALITY: Quality = 'high';

/** Barrel smoke and casing budgets. A zero turns the effect off. */
export interface FxProfile {
  /** Live spent magazines. */
  magazines: number;
  /** Live ejected casings. */
  casings: number;
  /** Live barrel-smoke puffs. */
  smokePuffs: number;
  /** Live projectiles and their trails. */
  tracers: number;
  /** Share of shots (0..1) that eject a casing. */
  casingChance: number;
  /** Rounds drawn on the machine gun's ammo belt in first person. */
  beltLinks: number;
  /** Impact sparks take the colour of the surface and add long yellow glints. Off draws the plain sparks. */
  sparkle: boolean;
}

export interface QualityProfile {
  /** Label on the lobby and menu buttons. */
  label: string;
  /** Internal resolution as a share of the window size; the canvas still fills the window. */
  renderScale: number;
  /** Cap on the device pixel ratio before the render scale applies. */
  maxPixelRatio: number;
  /** Edge smoothing. Only read when the renderer is created, so it applies on the next join. */
  antialias: boolean;
  /** Sun shadows. */
  shadows: boolean;
  /** Sun shadow map side in pixels, used when shadows are on. */
  shadowMapPx: number;
  /** Side of the image-based lighting cube in pixels. */
  envMapPx: number;
  /** Light ray-marched lighting, on only where the graphics card supports it. */
  lightRt: boolean;
  /** Blur outside the AWP lens. On for high only. */
  scopeBlur: boolean;
  /**
   * Scenery that moves for looks only: vent fans, fountain water and jet. On for high and low,
   * off for performance, where they stand still. Ceiling fans are not part of this: they turn on every tier. Escalator steps are not part of this: they move on every tier.
   */
  ambientMotion: boolean;
  /** Rings and droplets where feet meet water. On for high and low; off for performance, where they are not even built. */
  waterRipples: boolean;
  /** Faint vapour drifting out of the vents. On for high and low; off for performance, where it is not even built. */
  ventSmoke: boolean;
  /** Minimum gap between redraws of the defuse laptop screen, in ms. */
  laptopScreenRefreshMs: number;
  fx: FxProfile;
}

export const QUALITY: Readonly<Record<Quality, QualityProfile>> = {
  high: {
    label: 'alta',
    renderScale: 1,
    maxPixelRatio: 1.5,
    antialias: true,
    shadows: true,
    shadowMapPx: 2048,
    envMapPx: 256,
    lightRt: true,
    scopeBlur: true,
    ambientMotion: true,
    waterRipples: true,
    ventSmoke: true,
    laptopScreenRefreshMs: 100,
    fx: { magazines: 8, casings: 32, smokePuffs: 72, tracers: 48, casingChance: 1, beltLinks: 10, sparkle: true },
  },
  low: {
    label: 'leve',
    renderScale: 1,
    maxPixelRatio: 1,
    antialias: false,
    shadows: true,
    shadowMapPx: 1024,
    envMapPx: 256,
    lightRt: false,
    scopeBlur: false,
    ambientMotion: true,
    waterRipples: true,
    ventSmoke: true,
    laptopScreenRefreshMs: 100,
    fx: { magazines: 4, casings: 8, smokePuffs: 24, tracers: 16, casingChance: 0.4, beltLinks: 6, sparkle: false },
  },
  performance: {
    label: 'desempenho',
    renderScale: 0.65,
    maxPixelRatio: 1,
    antialias: false,
    shadows: false,
    shadowMapPx: 1024,
    envMapPx: 64,
    lightRt: false,
    scopeBlur: false,
    ambientMotion: false,
    waterRipples: false,
    ventSmoke: false,
    laptopScreenRefreshMs: 250,
    fx: { magazines: 2, casings: 0, smokePuffs: 0, tracers: 12, casingChance: 0, beltLinks: 4, sparkle: false },
  },
};

/** Lobby and menu options, in the order they are shown. */
export const QUALITY_OPTIONS: readonly { v: Quality; label: string }[] = QUALITY_TIERS.map((v) => ({ v, label: QUALITY[v].label }));

/** Reads a saved or untrusted value; anything unknown falls back to the default tier. */
export function parseQuality(value: unknown): Quality {
  return QUALITY_TIERS.find((tier) => tier === value) ?? DEFAULT_QUALITY;
}

/** Pixels drawn per CSS pixel on one axis. The canvas keeps filling the window, so a value below 1 only blurs it. */
export function renderPixelRatio(profile: QualityProfile, devicePixelRatio: number): number {
  return Math.min(devicePixelRatio, profile.maxPixelRatio) * profile.renderScale;
}
