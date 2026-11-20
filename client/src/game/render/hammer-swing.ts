type Angles = readonly [number, number, number];

/** The hammer swings in turn from the right and from the left; the heavy attack comes down from above. */
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

/** Wind up, strike through the centre of the view, follow through, then ease back to rest. */
const SWINGS: Readonly<Record<HammerSwing, { readonly seconds: number; readonly keys: readonly SwingKey[] }>> = {
  rightToLeft: {
    seconds: 0.42,
    keys: [
      { at: 0, ...REST },
      { at: 0.3, arm: [0.12, -0.35, -0.2], wrist: [0, 0, -0.5] },
      { at: 0.62, arm: [-0.05, 0.5, 0.2], wrist: [0, 0, 0.6] },
      { at: 1, ...REST },
    ],
  },
  leftToRight: {
    seconds: 0.42,
    keys: [
      { at: 0, ...REST },
      { at: 0.3, arm: [0.1, 0.45, 0.2], wrist: [0, 0, 0.6] },
      { at: 0.62, arm: [-0.05, -0.25, -0.15], wrist: [0, 0, -0.55] },
      { at: 1, ...REST },
    ],
  },
  overhead: {
    seconds: 0.8,
    keys: [
      { at: 0, ...REST },
      { at: 0.38, arm: [0.5, 0.3, 0], wrist: [0.4, 0, 0] },
      { at: 0.62, arm: [-0.5, 0.18, 0.08], wrist: [-1.05, 0, 0] },
      { at: 1, ...REST },
    ],
  },
};

const smooth = (x: number): number => x * x * (3 - 2 * x);
const mix = (a: Angles, b: Angles, k: number): Angles => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];

export function swingSeconds(swing: HammerSwing): number {
  return SWINGS[swing].seconds;
}

/** The light attack alternates sides so a held trigger flows back and forth; the heavy one is always the overhead blow. */
export function nextHammerSwing(last: HammerSwing | null, heavy: boolean): HammerSwing {
  if (heavy) return 'overhead';
  return last === 'rightToLeft' ? 'leftToRight' : 'rightToLeft';
}

/** The pose `t` (0..1) into a swing; at rest at both ends, eased between keys so the arm never jumps. */
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
