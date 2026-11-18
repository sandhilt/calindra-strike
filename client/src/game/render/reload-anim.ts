import { RELOAD_CUE_AT, type ReloadCursor } from '@calindra-strike/shared';

/**
 * What the viewmodel does at one moment of a reload, as unit amounts the
 * weapon's rig scales to its own size. Pure so it can be tested without WebGL.
 */
export interface ReloadPose {
  /** The gun rolls to open the magazine well, 0..1. */
  tilt: number;
  /** The gun lowers a little, 0..1. */
  dip: number;
  /** The old magazine falls out along its axis, 0 seated .. 1 gone. */
  magDrop: number;
  magGone: boolean;
  /** The fresh magazine below the well, 1 far below .. 0 seated. */
  spareLift: number;
  spareVisible: boolean;
  /** Short jolt as the fresh magazine seats or a shell drops in, 0..1. */
  seatKick: number;
  /** Slide, handle or pump drawn back, 0..1. */
  boltPull: number;
  /** Bolt handle raised before it is pulled, 0..1. */
  boltLift: number;
  /** Shooting hand off the grip and on the bolt handle, 0..1. Only rigs with a grip on the handle use it. */
  boltHand: number;
  /** The shell below the loading port, 1 far below .. 0 at the port. */
  shellLift: number;
  shellVisible: boolean;
  /** Supporting hand reaches for the magazine or the loading port, 0..1. */
  hand: number;
  /** Feed cover over the receiver, 0 shut .. 1 wide open. Only the machine gun has one. */
  cover: number;
  /** The ammo belt on the feed tray, 0 lifted off it .. 1 laid in. */
  beltLaid: number;
}

export const RESTING_RELOAD_POSE: Readonly<ReloadPose> = {
  tilt: 0,
  dip: 0,
  magDrop: 0,
  magGone: false,
  spareLift: 1,
  spareVisible: false,
  seatKick: 0,
  boltPull: 0,
  boltLift: 0,
  boltHand: 0,
  shellLift: 1,
  shellVisible: false,
  hand: 0,
  cover: 0,
  beltLaid: 1,
};

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const smooth = (v: number): number => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
/** 0 before `from`, 1 after `to`, smooth in between. */
const ramp = (t: number, from: number, to: number): number => smooth((t - from) / (to - from));
const pulse = (t: number, from: number, to: number): number => Math.sin(Math.PI * clamp01((t - from) / (to - from)));

/** Share of the out phase the old magazine takes to fall clear. */
const MAG_FALL_SPAN = 0.3;
const SPARE_APPEARS_AT = 0.55;
const SPARE_ARRIVES_BELOW_WELL = 0.25;
const TILT_WHILE_SEATING = 0.8;
const SHELL_TILT = 0.55;
/** Machine gun: the cover opens before the box falls away, the belt goes onto the tray as the box seats, then the cover shuts. */
const COVER_OPENS = { from: 0.05, to: 0.3 } as const;
const BELT_LIFTS = { from: 0.2, to: 0.4 } as const;
const BELT_LAYS = { from: 0.55, to: 0.8 } as const;
const COVER_SHUTS = { from: 0.85 } as const;

function boltCurve(t: number): { pull: number; lift: number } {
  const pull = ramp(t, 0.1, 0.4) * (1 - ramp(t, 0.4, 0.58));
  const lift = ramp(t, 0, 0.1) * (1 - ramp(t, 0.62, 0.78));
  return { pull, lift };
}

export function reloadPose(cursor: ReloadCursor | null): ReloadPose {
  if (!cursor) return RESTING_RELOAD_POSE;
  const { phase, t } = cursor;
  const pose: ReloadPose = { ...RESTING_RELOAD_POSE };
  switch (phase) {
    case 'out': {
      pose.tilt = ramp(t, 0, 0.3);
      pose.hand = ramp(t, 0, 0.4);
      const fall = clamp01((t - RELOAD_CUE_AT.out) / MAG_FALL_SPAN);
      pose.magDrop = fall * fall;
      pose.magGone = fall >= 1;
      pose.spareVisible = t >= SPARE_APPEARS_AT;
      pose.spareLift = 1 - (1 - SPARE_ARRIVES_BELOW_WELL) * ramp(t, SPARE_APPEARS_AT, 1);
      pose.cover = ramp(t, COVER_OPENS.from, COVER_OPENS.to);
      pose.beltLaid = 1 - ramp(t, BELT_LIFTS.from, BELT_LIFTS.to);
      break;
    }
    case 'in': {
      pose.magGone = true;
      pose.spareVisible = true;
      pose.tilt = 1 - (1 - TILT_WHILE_SEATING) * ramp(t, RELOAD_CUE_AT.in, 1);
      pose.hand = 1 - ramp(t, 0.8, 1);
      pose.spareLift = SPARE_ARRIVES_BELOW_WELL * (1 - ramp(t, 0, RELOAD_CUE_AT.in));
      pose.seatKick = pulse(t, RELOAD_CUE_AT.in, 1);
      pose.boltHand = ramp(t, 0.85, 1);
      pose.beltLaid = ramp(t, BELT_LAYS.from, BELT_LAYS.to);
      pose.cover = 1 - ramp(t, COVER_SHUTS.from, 1);
      break;
    }
    case 'bolt': {
      pose.magGone = true;
      pose.spareVisible = true;
      pose.spareLift = 0;
      pose.tilt = TILT_WHILE_SEATING * (1 - ramp(t, 0, 0.5));
      const bolt = boltCurve(t);
      pose.boltPull = bolt.pull;
      pose.boltLift = bolt.lift;
      pose.boltHand = 1 - ramp(t, 0.8, 0.95);
      break;
    }
    case 'start': {
      pose.tilt = SHELL_TILT * ramp(t, 0, 1);
      pose.hand = ramp(t, 0, 1);
      break;
    }
    case 'shell': {
      pose.tilt = SHELL_TILT;
      pose.hand = 1;
      pose.shellVisible = t < RELOAD_CUE_AT.shell;
      pose.shellLift = 1 - ramp(t, 0, RELOAD_CUE_AT.shell);
      pose.seatKick = 0.5 * pulse(t, RELOAD_CUE_AT.shell, 1);
      break;
    }
    case 'pump': {
      pose.tilt = SHELL_TILT * (1 - ramp(t, 0, 0.6));
      pose.hand = 1 - ramp(t, 0, 0.2);
      pose.boltPull = ramp(t, 0, 0.45) * (1 - ramp(t, 0.45, 0.8));
      break;
    }
  }
  pose.dip = 0.5 * pose.tilt;
  return pose;
}

/** Shares of the AWP bolt cycle after a shot, CS 1.6 style: the kick settles, the gun rolls, the bolt is worked, it returns. */
const BOLT_CYCLE = {
  rollFrom: 0.08,
  rollIn: 0.22,
  reachFrom: 0.08,
  workFrom: 0.2,
  releaseFrom: 0.72,
  releaseTo: 0.86,
  workTo: 0.82,
  rollOut: 0.84,
  roll: 0.55,
} as const;

/**
 * The gun between two AWP shots, t running 0..1 over the bolt cycle: it rolls to show the action, the shooting hand takes
 * the handle, lifts it, draws it back and pushes it home, goes back to the grip, then the gun settles. Null outside the cycle.
 */
export function boltCyclePose(t: number): ReloadPose | null {
  if (t < 0 || t >= 1) return null;
  const c = BOLT_CYCLE;
  const roll = ramp(t, c.rollFrom, c.rollIn) * (1 - ramp(t, c.rollOut, 1));
  const bolt = boltCurve((t - c.workFrom) / (c.workTo - c.workFrom));
  return {
    ...RESTING_RELOAD_POSE,
    tilt: c.roll * roll,
    dip: 0.35 * roll,
    boltPull: t < c.workFrom ? 0 : bolt.pull,
    boltLift: t < c.workFrom ? 0 : bolt.lift,
    boltHand: ramp(t, c.reachFrom, c.workFrom) * (1 - ramp(t, c.releaseFrom, c.releaseTo)),
  };
}
