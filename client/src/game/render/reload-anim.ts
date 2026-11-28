import { RELOAD_CUE_AT, WEAPON, type ReloadCursor, type WeaponId } from '@calindra-strike/shared';

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
  /** Pitch away from the seated angle, in radians. */
  magPitch: number;
  /** The fresh magazine below the well, 1 far below .. 0 seated. */
  spareLift: number;
  spareVisible: boolean;
  /** Pitch away from the seated angle, in radians. */
  sparePitch: number;
  /** Short jolt as the fresh magazine seats or a shell drops in, 0..1. */
  seatKick: number;
  /** Slide, handle or pump drawn back, 0..1. */
  boltPull: number;
  /** Bolt handle raised before it is pulled, 0..1. */
  boltLift: number;
  /** Shooting hand off the grip and on the bolt handle, 0..1. Only rigs with a grip on the handle use it. */
  boltHand: number;
  /** Supporting hand moves from the magazine grip to the slide or charging handle, 0..1. */
  supportBolt: number;
  /** The shell below the loading port, 1 far below .. 0 at the port. */
  shellLift: number;
  /** How far the supporting hand is from the loading port along the shell's path, 0..1. */
  shellHandLift: number;
  /** The spent cartridge thrown from the AWP's port, 0 as it leaves .. 1 when it has fallen out of view, -1 when none is in the air. */
  casing: number;
  shellVisible: boolean;
  /** Supporting hand reaches for the magazine or the loading port, 0..1. */
  hand: number;
  /** Feed cover or launcher drum, 0 shut .. 1 wide open. */
  cover: number;
  /** The ammo belt on the feed tray, 0 lifted off it .. 1 laid in. */
  beltLaid: number;
  /** The tray end of the belt, 0 over the tray .. 1 swung out to the left of the gun. */
  beltClear: number;
  /** The launcher's drum spun while it is loaded: 0 .. 1 is one full turn. */
  drumTurn: number;
  /** How full the drum is while a reload loads it, 0 empty .. 1 full, -1 when the reload is not loading it. */
  drumFill: number;
  /** How far the rounds have fallen out of the open drum, 0 .. 1, -1 when it is not being emptied. */
  drumDump: number;
}

export const RESTING_RELOAD_POSE: Readonly<ReloadPose> = {
  tilt: 0,
  dip: 0,
  magDrop: 0,
  magGone: false,
  magPitch: 0,
  spareLift: 1,
  spareVisible: false,
  sparePitch: 0,
  seatKick: 0,
  boltPull: 0,
  boltLift: 0,
  boltHand: 0,
  supportBolt: 0,
  shellLift: 1,
  shellHandLift: 0,
  shellVisible: false,
  casing: -1,
  hand: 0,
  cover: 0,
  beltLaid: 1,
  beltClear: 0,
  drumTurn: 0,
  drumFill: -1,
  drumDump: -1,
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
/** The fresh magazine takes over where the old one left the view, so a belt hanging from it does not jump. */
const SPARE_APPEARS_AT = RELOAD_CUE_AT.out + MAG_FALL_SPAN;
const SPARE_ARRIVES_BELOW_WELL = 0.25;
const TILT_WHILE_SEATING = 0.8;
const SHELL_TILT = 0.55;
/** Offset from the loading port to the pickup point, in local viewmodel units. */
export const SHELL_PICKUP_OFFSET = [-2, -16, -6] as const;
/**
 * Machine gun. Out: the cover opens, the belt end lifts off the tray and is swung out clear of the receiver, and only then does
 * the box fall with it. In: the fresh box seats first (the clack at RELOAD_CUE_AT.in), the belt end swings back over the tray,
 * is set down, and the cover is slapped shut in the last stretch.
 */
const COVER_OPENS = { from: 0.05, to: 0.3 } as const;
const BELT_LIFTS = { from: 0.12, to: 0.28 } as const;
const BELT_SWINGS_OUT = { from: 0.22, to: 0.38 } as const;
const BELT_SWINGS_IN = { from: 0.76, to: 0.88 } as const;
const BELT_LAYS = { from: 0.84, to: 0.94 } as const;
const COVER_SHUTS = { from: 0.92 } as const;

function boltCurve(t: number): { pull: number; lift: number } {
  const pull = ramp(t, 0.1, 0.4) * (1 - ramp(t, 0.4, 0.58));
  const lift = ramp(t, 0, 0.1) * (1 - ramp(t, 0.62, 0.78));
  return { pull, lift };
}

const MAGAZINE_EXCHANGE = {
  [WEAPON.PISTOL]: { clearAt: 0.59, approach: 0.34, rockRad: 0 },
  [WEAPON.RIFLE]: { clearAt: 0.69, approach: 0.46, rockRad: 0.55 },
};

function exchangePose({ phase, t }: ReloadCursor, weapon: keyof typeof MAGAZINE_EXCHANGE): ReloadPose {
  const pose = { ...RESTING_RELOAD_POSE };
  const { clearAt, approach, rockRad } = MAGAZINE_EXCHANGE[weapon];
  const released = RELOAD_CUE_AT.out;
  const seated = RELOAD_CUE_AT.in;
  const racking = RELOAD_CUE_AT.bolt;
  switch (phase) {
    case 'out': {
      pose.tilt = ramp(t, 0, released);
      pose.magGone = t >= clearAt;
      const spareAt = clearAt + 0.08;
      pose.spareVisible = t >= spareAt;
      pose.spareLift = 1 - (1 - approach) * ramp(t, spareAt, 1);
      pose.magDrop = weapon === WEAPON.PISTOL ? ramp(t, released, clearAt) ** 2 : ramp(t, 0.47, clearAt);
      pose.magPitch = rockRad * ramp(t, released, 0.52);
      pose.sparePitch = rockRad;
      pose.hand = weapon === WEAPON.PISTOL ? ramp(t, spareAt, 0.85) : ramp(t, 0.05, released);
      break;
    }
    case 'in':
      pose.tilt = 1;
      pose.magGone = true;
      pose.spareVisible = true;
      pose.spareLift = approach * (1 - ramp(t, 0, seated));
      pose.sparePitch = rockRad * (1 - ramp(t, 0.35, seated));
      pose.seatKick = pulse(t, seated - 0.02, seated + 0.15);
      pose.hand = 1;
      pose.supportBolt = ramp(t, seated + 0.04, 1);
      break;
    case 'bolt':
      pose.tilt = 1 - ramp(t, 0.52, 1);
      pose.magGone = true;
      pose.spareVisible = true;
      pose.spareLift = 0;
      pose.boltPull = ramp(t, racking, 0.39) * (1 - ramp(t, 0.42, 0.54));
      pose.hand = 1 - ramp(t, 0.54, 0.93);
      pose.supportBolt = 1;
      break;
  }
  return pose;
}

function launcherReloadPose({ phase, t }: ReloadCursor): ReloadPose {
  const pose = { ...RESTING_RELOAD_POSE };
  if (phase === 'out') {
    pose.cover = ramp(t, RELOAD_CUE_AT.out, 0.85);
    pose.drumDump = ramp(t, 0.45, 1);
  }
  if (phase === 'in') {
    pose.cover = 1;
    pose.drumFill = ramp(t, 0.1, 0.9);
    pose.drumTurn = pose.drumFill;
  }
  if (phase === 'bolt') {
    pose.cover = 1 - ramp(t, RELOAD_CUE_AT.bolt, 0.45);
    pose.drumFill = 1;
    pose.drumTurn = 1;
  }
  pose.hand = phase === 'out' ? ramp(t, 0, RELOAD_CUE_AT.out)
    : phase === 'bolt' ? 1 - ramp(t, 0.45, 1) : 1;
  pose.tilt = pose.hand * 0.7;
  pose.dip = pose.tilt * 0.5;
  return pose;
}

export function reloadPose(cursor: ReloadCursor | null, weapon?: WeaponId, reloadShells = 0): ReloadPose {
  if (!cursor) return RESTING_RELOAD_POSE;
  if (weapon === WEAPON.MGL) return launcherReloadPose(cursor);
  if (weapon === WEAPON.PISTOL || weapon === WEAPON.RIFLE) return exchangePose(cursor, weapon);
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
      pose.beltClear = ramp(t, BELT_SWINGS_OUT.from, BELT_SWINGS_OUT.to);
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
      pose.beltClear = 1 - ramp(t, BELT_SWINGS_IN.from, BELT_SWINGS_IN.to);
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
      pose.shellHandLift = 1;
      break;
    }
    case 'shell': {
      pose.tilt = SHELL_TILT;
      pose.hand = 1;
      pose.shellVisible = t < RELOAD_CUE_AT.shell;
      pose.shellLift = 1 - ramp(t, 0, RELOAD_CUE_AT.shell);
      pose.shellHandLift = pose.shellLift;
      if (cursor.shell + 1 < reloadShells) pose.shellHandLift += ramp(t, RELOAD_CUE_AT.shell, 1);
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
  /** Share of the bolt's work when the spent cartridge is thrown, from the draw back until the handle is on its way home. */
  casingFrom: 0.22,
  casingTo: 0.8,
} as const;

/** How far the spent cartridge has flown, 0..1, for the bolt's work `u` (0..1), or -1 while none is in the air. */
function casingFlight(u: number): number {
  const { casingFrom, casingTo } = BOLT_CYCLE;
  return u >= casingFrom && u < casingTo ? (u - casingFrom) / (casingTo - casingFrom) : -1;
}

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
    casing: casingFlight((t - c.workFrom) / (c.workTo - c.workFrom)),
  };
}
