/**
 * How loud a sound is at a distance, 0..1, on the same inverse-distance curve the browser's audio uses for positional
 * sounds: full volume inside `refUnits`, then falling off with a rolloff of 1.1. A sound at the listener is 1.
 */
export function heardIntensity(distanceUnits: number, refUnits: number): number {
  const rolloff = 1.1;
  const d = Math.max(0, distanceUnits);
  return Math.min(1, refUnits / (refUnits + rolloff * Math.max(0, d - refUnits)));
}

/** Reference distances of the sounds an agent can hear, in units; the same numbers the browser gives its panners. */
export const HEARING_REF_UNITS = { shot: 260, hammer: 120, impact: 200 } as const;

/** Quieter than this the sound is lost in the ambience, so an agent is not told about it. */
export const AUDIBLE_INTENSITY = 0.08;

/** Yaw and pitch, in radians, that look from `from` at `to`; yaw 0 faces -z and positive pitch looks up, like `dirFromAngles`. */
export function anglesToward(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }): { yaw: number; pitch: number } {
  const dx = to.x - from.x, dz = to.z - from.z;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(to.y - from.y, Math.hypot(dx, dz)) };
}
