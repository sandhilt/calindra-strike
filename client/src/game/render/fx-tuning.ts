import { WEAPON, type WeaponId } from '@calindra-strike/shared';

/** Same pull the existing sparks and gibs use, so every particle falls alike. */
export const GRAVITY_UNITS_PER_S2 = 800;

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

/** Barrel smoke. Heat runs 0..1 per shooter, rises per shot and falls with time. */
export const SMOKE = {
  heatDecayPerS: 0.6,
  /** Forward drift out of the barrel, units per second. */
  forwardSpeedUnitsPerS: [30, 55],
  riseSpeedUnitsPerS: 14,
  jitterUnitsPerS: 8,
  dragPerS: 2.5,
  lifeSeconds: [0.35, 0.65],
  /** Extra life at full heat, as a share of the base life. */
  lifeHeatBonus: 0.5,
  startSizeUnits: [1.2, 2],
  growthUnits: 4,
  growthHeatUnits: 4,
  alphaCalm: 0.14,
  alphaHot: 0.2,
  /** Share of the life spent fading in before the fade out. */
  attackShare: 0.12,
  color: 0.82,
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
