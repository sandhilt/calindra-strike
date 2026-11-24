/** Range readout and ruler of the AWP scope. Pure, so the scale and the labels are tested without a DOM. */

export const METERS_PER_UNIT = 0.0254;
/** Farthest range the ruler and the readout report (m); anything beyond reads as out of range. */
export const RANGE_MAX_METERS = 500;
export const RANGE_MAX_UNITS = RANGE_MAX_METERS / METERS_PER_UNIT;
/** Marks drawn on the scope's ruler (m). */
export const RULER_STOPS_METERS = [25, 50, 100, 200, 300, 400] as const;

export interface RangeReading {
  meters: number | null;
  /** An enemy is under the aim point. */
  onEnemy: boolean;
}

export const NO_RANGE: RangeReading = { meters: null, onEnemy: false };

export function rangeReading(units: number | null, onEnemy: boolean): RangeReading {
  if (units === null) return NO_RANGE;
  const meters = units * METERS_PER_UNIT;
  return meters > RANGE_MAX_METERS ? NO_RANGE : { meters, onEnemy };
}

export function rangeLabel(r: RangeReading): string {
  return r.meters === null ? '— m' : `${Math.round(r.meters)} m`;
}

/** Position along the ruler, 0 at the top (near) to 1 at the bottom (far). Square-root scale, so the short ranges where most shots happen get the room. */
export function rulerFraction(meters: number): number {
  return Math.sqrt(Math.min(Math.max(meters, 0), RANGE_MAX_METERS) / RANGE_MAX_METERS);
}
