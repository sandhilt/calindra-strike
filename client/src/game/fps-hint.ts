import type { Quality } from './render/quality.ts';

export const FPS_HINT = {
  /** Frames are ignored for this long after joining, while shaders compile and the map loads. */
  warmupSeconds: 10,
  /** Length of each measured stretch after the warm-up. */
  windowSeconds: 5,
  /** A stretch averaging below this many frames per second triggers the hint. */
  belowFps: 30,
  /** A longer frame means the tab was hidden or the page stalled, so the measurement starts over. */
  maxFrameSeconds: 1,
} as const;

export const FPS_HINT_TEXT = 'está pesado? tente os gráficos "desempenho" no menu (Esc)';

/** Decides once whether to suggest the performance tier. It only suggests, the tier is never switched for the player. */
export class FpsHintWatch {
  private elapsed = 0;
  private windowElapsed = 0;
  private windowFrames = 0;
  private suggested = false;

  /** Starts a new warm-up, for a fresh join. A hint already given stays given. */
  restart(): void {
    this.elapsed = 0;
    this.resetWindow();
  }

  /** Feeds one rendered frame. Returns true exactly once, on the frame that completes a slow stretch. */
  sample(frameSeconds: number, quality: Quality): boolean {
    if (this.suggested || quality === 'performance') return false;
    if (frameSeconds > FPS_HINT.maxFrameSeconds) {
      this.restart();
      return false;
    }
    this.elapsed += frameSeconds;
    if (this.elapsed < FPS_HINT.warmupSeconds) return false;
    this.windowElapsed += frameSeconds;
    this.windowFrames++;
    if (this.windowElapsed < FPS_HINT.windowSeconds) return false;
    const fps = this.windowFrames / this.windowElapsed;
    this.resetWindow();
    this.suggested = fps < FPS_HINT.belowFps;
    return this.suggested;
  }

  private resetWindow(): void {
    this.windowElapsed = 0;
    this.windowFrames = 0;
  }
}
