import { cheaperRtLevel, type RtLevel } from './rt-levels.ts';

export const RT_GOVERNOR = {
  /** Frames are ignored for this long after joining and after each step, while shaders compile. */
  warmupSeconds: 5,
  /** Length of each measured stretch. */
  windowSeconds: 3,
  /** A stretch whose median frame is longer than this (about 50 fps) steps the ray pass down. */
  overMs: 20,
  /** A longer frame means the tab was hidden or the page stalled, so the measurement starts over. */
  maxFrameSeconds: 1,
} as const;

export function medianOf(values: readonly number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;
}

/**
 * Keeps the high tier near 60 fps by taking the light ray pass down one level when frames stay slow. It never goes
 * back up, so a card that cannot hold a level is not tried on it again, and it stops at `light`. It only decides:
 * the caller applies the level and tells the player.
 */
export class RtGovernor {
  private elapsed = 0;
  private windowElapsed = 0;
  private frameMs: number[] = [];

  /** Starts a new warm-up, for a fresh join or after a step. */
  restart(): void {
    this.elapsed = 0;
    this.resetWindow();
  }

  /** Feeds one rendered frame with the level now running. Returns the cheaper level to switch to, or null. */
  sample(frameSeconds: number, running: RtLevel): RtLevel | null {
    if (running === 'off' || cheaperRtLevel(running) === running) return null;
    if (frameSeconds > RT_GOVERNOR.maxFrameSeconds) {
      this.restart();
      return null;
    }
    this.elapsed += frameSeconds;
    if (this.elapsed < RT_GOVERNOR.warmupSeconds) return null;
    this.windowElapsed += frameSeconds;
    this.frameMs.push(frameSeconds * 1000);
    if (this.windowElapsed < RT_GOVERNOR.windowSeconds) return null;
    const slow = medianOf(this.frameMs) > RT_GOVERNOR.overMs;
    this.resetWindow();
    if (!slow) return null;
    this.restart();
    return cheaperRtLevel(running);
  }

  private resetWindow(): void {
    this.windowElapsed = 0;
    this.frameMs = [];
  }
}
