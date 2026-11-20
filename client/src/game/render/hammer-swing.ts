type Angles = readonly [number, number, number];

/** Light attacks go right to left, left to right, then down from above, and round again; the heavy attack always comes from above. */
export type HammerSwing = 'rightToLeft' | 'leftToRight' | 'overhead';

/**
 * One moment of a swing, as Euler angles in radians. `arm` turns the whole arm about the shoulder, so the forearm stays on
 * the body; `wrist` turns only the hammer in the fist, so its head leads into the blow and trails after it.
 */
export interface SwingPose {
  readonly arm: Angles;
  readonly wrist: Angles;
}

interface SwingKey extends SwingPose {
  /** Share of the swing, 0..1. */
  readonly at: number;
}

const REST: SwingPose = { arm: [0, 0, 0], wrist: [0, 0, 0] };
const LIGHT_ORDER: readonly HammerSwing[] = ['rightToLeft', 'leftToRight', 'overhead'];

/**
 * Wind up, strike through the centre of the view, hold the follow-through, then drift back to rest. Each swing outlasts the
 * hammer's 0.45 s refire, so a held attack starts the next wind-up from the last follow-through instead of from rest.
 */
const SWINGS: Readonly<Record<HammerSwing, { readonly seconds: number; readonly keys: readonly SwingKey[] }>> = {
  rightToLeft: {
    seconds: 0.75,
    keys: [
      { at: 0, ...REST },
      { at: 0.24, arm: [0.12, -0.35, -0.2], wrist: [0, 0, -0.5] },
      { at: 0.56, arm: [-0.05, 0.5, 0.2], wrist: [0, 0, 0.6] },
      { at: 0.7, arm: [-0.03, 0.45, 0.18], wrist: [0, 0, 0.5] },
      { at: 1, ...REST },
    ],
  },
  leftToRight: {
    seconds: 0.75,
    keys: [
      { at: 0, ...REST },
      { at: 0.24, arm: [0.1, 0.45, 0.2], wrist: [0, 0, 0.6] },
      { at: 0.56, arm: [-0.05, -0.25, -0.15], wrist: [0, 0, -0.55] },
      { at: 0.7, arm: [-0.03, -0.2, -0.12], wrist: [0, 0, -0.45] },
      { at: 1, ...REST },
    ],
  },
  overhead: {
    seconds: 0.75,
    keys: [
      { at: 0, ...REST },
      { at: 0.28, arm: [0.5, 0.3, 0], wrist: [0.3, 0, 0] },
      { at: 0.56, arm: [-0.5, 0.18, 0.08], wrist: [-0.95, 0, 0] },
      { at: 0.7, arm: [-0.45, 0.15, 0.06], wrist: [-0.85, 0, 0] },
      { at: 1, ...REST },
    ],
  },
};

/** Time constant of the glide from the shown pose to the swing's pose, in seconds, like the zoom's field-of-view glide. */
export const SWING_GLIDE_SECONDS = 0.07;

const smooth = (x: number): number => x * x * (3 - 2 * x);
const mix = (a: Angles, b: Angles, k: number): Angles => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

export function swingSeconds(swing: HammerSwing): number {
  return SWINGS[swing].seconds;
}

export function nextHammerSwing(last: HammerSwing | null, heavy: boolean): HammerSwing {
  if (heavy) return 'overhead';
  const i = last ? LIGHT_ORDER.indexOf(last) : -1;
  return LIGHT_ORDER[(i + 1) % LIGHT_ORDER.length] ?? 'rightToLeft';
}

/** The pose `t` (0..1) into a swing; at rest at both ends, eased between keys. */
export function hammerSwingPose(swing: HammerSwing, t: number): SwingPose {
  const keys = SWINGS[swing].keys;
  if (t <= 0 || t >= 1) return REST;
  const next = keys.findIndex((key) => key.at > t);
  const from = keys[next - 1];
  const to = keys[next];
  if (!from || !to) return REST;
  const k = smooth((t - from.at) / (to.at - from.at));
  return { arm: mix(from.arm, to.arm, k), wrist: mix(from.wrist, to.wrist, k) };
}

/** Plays one swing at a time and glides the shown pose toward it, so a new swing picks up wherever the arm is. */
export class SwingPlayer {
  private current: { readonly kind: HammerSwing; elapsed: number } | null = null;
  private last: HammerSwing | null = null;
  private shown: SwingPose = REST;

  start(heavy: boolean): void {
    this.last = nextHammerSwing(this.last, heavy);
    this.current = { kind: this.last, elapsed: 0 };
  }

  /** Drops the swing and the glide, for a weapon change. */
  stop(): void {
    this.current = null;
    this.shown = REST;
  }

  /** Advances by `dt` seconds and returns the pose to show. */
  step(dt: number): SwingPose {
    let target = REST;
    if (this.current) {
      this.current.elapsed += dt;
      const t = this.current.elapsed / swingSeconds(this.current.kind);
      target = hammerSwingPose(this.current.kind, t);
      if (t >= 1) this.current = null;
    }
    const k = 1 - Math.exp(-Math.max(0, dt) / SWING_GLIDE_SECONDS);
    this.shown = { arm: mix(this.shown.arm, target.arm, k), wrist: mix(this.shown.wrist, target.wrist, k) };
    return this.shown;
  }
}
