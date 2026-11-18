import { WEAPON, type WeaponId } from '@calindra-strike/shared';

export type FxQuality = 'high' | 'low';

/** Same pull the existing sparks and gibs use, so every particle falls alike. */
export const GRAVITY_UNITS_PER_S2 = 800;

/** Hard caps on live particles per pool, and how often a shot sheds a casing. */
export const FX_LIMITS: Readonly<Record<FxQuality, { magazines: number; casings: number; smokePuffs: number; tracers: number; casingChance: number }>> = {
  high: { magazines: 8, casings: 32, smokePuffs: 72, tracers: 48, casingChance: 1 },
  low: { magazines: 4, casings: 8, smokePuffs: 24, tracers: 16, casingChance: 0.4 },
};

export interface DebrisSpec {
  /** Distance from the centre to the floor when lying on its side. */
  halfHeightUnits: number;
  /** Share of the impact speed kept after a bounce. */
  bounce: number;
  /** Horizontal speed kept per bounce. */
  bounceFriction: number;
  /** Below this impact speed the body stops bouncing and lies down. */
  settleSpeedUnitsPerS: number;
  /** Exponential horizontal slide decay once lying down, per second. */
  slideDragPerS: number;
  /** Seconds it lies on the floor, counted from landing, at full size. */
  holdSeconds: number;
  /** Seconds it then takes to shrink away. */
  shrinkSeconds: number;
  /** Safety net when the body never lands (nothing below it). */
  maxAgeSeconds: number;
  /** Tumble speed in flight, radians per second (each axis is within plus or minus this). */
  spinRadPerS: number;
}

export const MAGAZINE_SPEC: DebrisSpec = {
  halfHeightUnits: 1.6,
  bounce: 0.3,
  bounceFriction: 0.55,
  settleSpeedUnitsPerS: 45,
  slideDragPerS: 9,
  holdSeconds: 2,
  shrinkSeconds: 0.3,
  maxAgeSeconds: 6,
  spinRadPerS: 9,
};

export const CASING_SPEC: DebrisSpec = {
  halfHeightUnits: 0.55,
  bounce: 0.4,
  bounceFriction: 0.6,
  settleSpeedUnitsPerS: 35,
  slideDragPerS: 10,
  holdSeconds: 0.6,
  shrinkSeconds: 0.2,
  maxAgeSeconds: 3,
  spinRadPerS: 28,
};

/** Magazine model size in world units (a box: width, length, depth). */
export const MAGAZINE_SIZE_UNITS = { w: 2.2, l: 7.5, d: 3.2 } as const;
/** Casing model size in world units. */
export const CASING_SIZE_UNITS = { radius: 0.55, length: 2.4 } as const;

/** How a magazine leaves the gun, in units per second. */
export const MAGAZINE_DROP = { downSpeedUnitsPerS: 40, driftUnitsPerS: 22 } as const;

/** Where a casing leaves the gun and how fast, in units and units per second. */
export const CASING_EJECT = {
  backFromMuzzleUnits: 10,
  sideSpeedUnitsPerS: 95,
  sideJitterUnitsPerS: 35,
  upSpeedUnitsPerS: 90,
  upJitterUnitsPerS: 35,
  backSpeedUnitsPerS: 25,
} as const;

export const CASING_BRASS = { variant: 0, color: '#c9a227' } as const;
export const CASING_SHELL = { variant: 1, color: '#b3261e' } as const;
export const MAGAZINE_COLOR = '#474d55';

/** Casing look per weapon, as a variant and a scale on the base model. */
export const CASING_BY_WEAPON: Readonly<Record<WeaponId, { variant: number; scale: number } | null>> = {
  [WEAPON.HAMMER]: null,
  [WEAPON.PISTOL]: { variant: CASING_BRASS.variant, scale: 0.8 },
  [WEAPON.RIFLE]: { variant: CASING_BRASS.variant, scale: 1 },
  [WEAPON.SMG]: { variant: CASING_BRASS.variant, scale: 0.8 },
  [WEAPON.SHOTGUN]: { variant: CASING_SHELL.variant, scale: 1.6 },
  [WEAPON.SNIPER]: { variant: CASING_BRASS.variant, scale: 1.5 },
  [WEAPON.LMG]: { variant: CASING_BRASS.variant, scale: 1 },
};

export interface SmokeStyle {
  heatDecayPerS: number;
  /** Forward drift out of the barrel, units per second. */
  forwardSpeedUnitsPerS: readonly [number, number];
  riseSpeedUnitsPerS: number;
  jitterUnitsPerS: number;
  dragPerS: number;
  /** Sideways curl: a slow sway of the drift, so a wisp snakes up instead of rising in a line. */
  swayAccelUnitsPerS2: number;
  swayHz: number;
  lifeSeconds: readonly [number, number];
  /** Extra life at full heat, as a share of the base life. */
  lifeHeatBonus: number;
  startSizeUnits: readonly [number, number];
  growthUnits: number;
  growthHeatUnits: number;
  alphaCalm: number;
  alphaHot: number;
  /** Share of the life spent fading in before the fade out. */
  attackShare: number;
  /** Grey level of the smoke, 0..1. */
  color: number;
  /** Puffs per shot, as [heat from, puffs] steps. */
  puffsByHeat: readonly (readonly [number, number])[];
  /** Dust puffs where a bullet hits; 0 skips impact dust. */
  impactDustPuffs: number;
}

/**
 * Barrel smoke per quality. High is the CS 1.6 look: grey wisps that leave the muzzle slowly, rise, curl sideways,
 * swell and linger about a second, thicker on sustained fire, plus dust where bullets hit. Low keeps the lighter,
 * short-lived puffs. Heat runs 0..1 per shooter, rises per shot and falls with time.
 */
export const SMOKE_STYLES: Readonly<Record<FxQuality, SmokeStyle>> = {
  high: {
    heatDecayPerS: 0.45,
    forwardSpeedUnitsPerS: [10, 24],
    riseSpeedUnitsPerS: 26,
    jitterUnitsPerS: 5,
    dragPerS: 1.6,
    swayAccelUnitsPerS2: 30,
    swayHz: 1.1,
    lifeSeconds: [0.8, 1.25],
    lifeHeatBonus: 0.6,
    startSizeUnits: [2.5, 3.5],
    growthUnits: 10,
    growthHeatUnits: 8,
    alphaCalm: 0.24,
    alphaHot: 0.34,
    attackShare: 0.08,
    color: 0.74,
    puffsByHeat: [[0, 1], [0.35, 2], [0.7, 3]],
    impactDustPuffs: 2,
  },
  low: {
    heatDecayPerS: 0.6,
    forwardSpeedUnitsPerS: [30, 55],
    riseSpeedUnitsPerS: 14,
    jitterUnitsPerS: 8,
    dragPerS: 2.5,
    swayAccelUnitsPerS2: 0,
    swayHz: 0,
    lifeSeconds: [0.35, 0.65],
    lifeHeatBonus: 0.5,
    startSizeUnits: [1.2, 2],
    growthUnits: 4,
    growthHeatUnits: 4,
    alphaCalm: 0.14,
    alphaHot: 0.2,
    attackShare: 0.12,
    color: 0.82,
    puffsByHeat: [[0, 1], [0.6, 2]],
    impactDustPuffs: 0,
  },
};

/** Dust where a bullet hits a surface: a grey puff blown off along the surface normal. */
export const IMPACT_DUST = {
  speedUnitsPerS: [18, 40],
  lifeSeconds: [0.6, 0.95],
  startSizeUnits: [3, 4.5],
  growthUnits: 12,
  alpha: 0.3,
} as const;

export const SMOKE_BY_WEAPON: Readonly<Record<WeaponId, { heatPerShot: number; sizeScale: number } | null>> = {
  [WEAPON.HAMMER]: null,
  [WEAPON.PISTOL]: { heatPerShot: 0.25, sizeScale: 0.8 },
  [WEAPON.RIFLE]: { heatPerShot: 0.14, sizeScale: 1 },
  [WEAPON.SMG]: { heatPerShot: 0.12, sizeScale: 0.9 },
  [WEAPON.SHOTGUN]: { heatPerShot: 0.45, sizeScale: 1.4 },
  [WEAPON.SNIPER]: { heatPerShot: 0.5, sizeScale: 1.4 },
  [WEAPON.LMG]: { heatPerShot: 0.11, sizeScale: 1.1 },
};

/** Tracer streak: length of the visible segment and how fast it flies. Shorter and quicker than a full-length beam. */
export const TRACER = { lengthUnits: 120, speedUnitsPerS: 16000, minDistanceUnits: 40 } as const;

/** Draw a tracer on every Nth shot (0 = never), and on how many pellets of that shot. */
export const TRACER_RULES: Readonly<Record<WeaponId, { everyNthShot: number; pelletsPerShot: number }>> = {
  [WEAPON.HAMMER]: { everyNthShot: 0, pelletsPerShot: 0 },
  [WEAPON.PISTOL]: { everyNthShot: 1, pelletsPerShot: 1 },
  [WEAPON.RIFLE]: { everyNthShot: 3, pelletsPerShot: 1 },
  [WEAPON.SMG]: { everyNthShot: 3, pelletsPerShot: 1 },
  [WEAPON.SHOTGUN]: { everyNthShot: 1, pelletsPerShot: 3 },
  [WEAPON.SNIPER]: { everyNthShot: 1, pelletsPerShot: 1 },
  [WEAPON.LMG]: { everyNthShot: 3, pelletsPerShot: 1 },
};
