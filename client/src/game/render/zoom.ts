/** Time constant of the field-of-view glide when zooming in or out, in seconds: most of the way in 0.14 s, settled in about 0.3 s. */
export const ZOOM_EASE_SECONDS = 0.045;
/** Closer than this (degrees) the glide snaps to the target, so the projection stops being rebuilt every frame. */
const ZOOM_SNAP_DEG = 0.05;

/** The next vertical FOV on the way to `target`, framerate independent. */
export function easeFov(current: number, target: number, dtSeconds: number): number {
  const next = target + (current - target) * Math.exp(-Math.max(0, dtSeconds) / ZOOM_EASE_SECONDS);
  return Math.abs(next - target) < ZOOM_SNAP_DEG ? target : next;
}
