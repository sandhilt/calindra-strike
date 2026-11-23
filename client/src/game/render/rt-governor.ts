import { cheaperRtLevel, type RtLevel } from './rt-levels.ts';

export const RT_GOVERNOR = {
  /** Frames are ignored for this long after joining and after each step, while shaders compile. */
  warmupSeconds: 5,
  /** Length of each measured stretch. */
  windowSeconds: 3,
  /** A stretch whose median frame is longer than this (below 30 fps) steps the ray pass down. A level that holds 30 to 60 fps stays. */
  overMs: 1000 / 30,
  /** A frame longer than this (below 24 fps) is a spike. A few are fine. */
  spikeMs: 1000 / 24,
  /** A stretch where more than this share of frames are spikes steps the ray pass down, even when its median is fine. */
  spikeShare: 0.05,
  /** A longer frame means the tab was hidden or the page stalled, so the measurement starts over. */
  maxFrameSeconds: 1,
} as const;

export function medianOf(values: readonly number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2;
}

/**
 * Keeps the high tier playable (30 fps or better) by taking the light ray pass down one level when frames stay slow. It never goes
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
    const spikes = this.frameMs.filter((ms) => ms > RT_GOVERNOR.spikeMs).length;
    const slow = medianOf(this.frameMs) > RT_GOVERNOR.overMs || spikes > this.frameMs.length * RT_GOVERNOR.spikeShare;
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
