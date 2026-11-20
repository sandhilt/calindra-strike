import type { Surface } from '@calindra-strike/shared';

export { SURFACE_OF, surfaceOf, type Surface } from '@calindra-strike/shared';

/** How an impact sparks on a surface. `glints` are the extra long-lived yellow sparks the high tier adds. */
export interface SparkLook {
  color: string;
  sparks: number;
  glints: number;
}

export const SPARK_LOOK: Readonly<Record<Surface, SparkLook>> = {
  metal: { color: '#ffe066', sparks: 9, glints: 6 },
  container: { color: '#ffd84d', sparks: 7, glints: 4 },
  concrete: { color: '#ffd38a', sparks: 6, glints: 2 },
  ground: { color: '#d8b88a', sparks: 3, glints: 0 },
  brick: { color: '#f0a867', sparks: 5, glints: 1 },
  tile: { color: '#fff0c0', sparks: 5, glints: 1 },
  plaster: { color: '#e8d9b8', sparks: 2, glints: 0 },
  wood: { color: '#e8a860', sparks: 3, glints: 0 },
  crate: { color: '#d99a58', sparks: 3, glints: 0 },
  glass: { color: '#fff4c8', sparks: 5, glints: 1 },
  screen: { color: '#cfe6ff', sparks: 4, glints: 1 },
  cloth: { color: '#c9b38a', sparks: 1, glints: 0 },
  plant: { color: '#b9c98a', sparks: 1, glints: 0 },
};

/** Sparks every tier draws, in the colour the game has always used. */
export const PLAIN_SPARKS = 6;
export const PLAIN_SPARK_COLOR = '#ffd38a';

/** What one impact throws. Only the high tier (`sparkle`) colours sparks by surface, adds glints and fades them out; every other tier draws the plain sparks. */
export interface SparkPlan {
  color: string;
  sparks: number;
  glints: number;
  fades: boolean;
}

export function sparkPlan(surface: Surface, sparkle: boolean): SparkPlan {
  if (!sparkle) return { color: PLAIN_SPARK_COLOR, sparks: PLAIN_SPARKS, glints: 0, fades: false };
  return { ...SPARK_LOOK[surface], fades: true };
}
