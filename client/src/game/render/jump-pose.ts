/** How the held gun reacts to jumping: a small, eased lift in the air and a short dip on landing. */
export const JUMP_POSE = {
  liftUnits: 0.7,
  /** Time constant of the lift while airborne, in seconds. */
  riseSeconds: 0.12,
  /** Time constant of the return once back on the ground, in seconds. */
  settleSeconds: 0.08,
  landDipUnits: 0.9,
  /** Time constant of the landing dip recovery, in seconds. */
  landRecoverSeconds: 0.12,
} as const;

export interface JumpPose {
  lift: number;
  landDip: number;
  onGround: boolean;
}

export const restingJumpPose = (): JumpPose => ({ lift: 0, landDip: 0, onGround: true });

/** Advances the pose by `dt` seconds and returns the vertical offset of the gun in view units. */
export function stepJumpPose(pose: JumpPose, onGround: boolean, dtSeconds: number): number {
  const dt = Math.max(0, dtSeconds);
  if (onGround && !pose.onGround) pose.landDip = JUMP_POSE.landDipUnits;
  pose.onGround = onGround;
  const target = onGround ? 0 : JUMP_POSE.liftUnits;
  const ease = onGround ? JUMP_POSE.settleSeconds : JUMP_POSE.riseSeconds;
  pose.lift = target + (pose.lift - target) * Math.exp(-dt / ease);
  pose.landDip *= Math.exp(-dt / JUMP_POSE.landRecoverSeconds);
  return pose.lift - pose.landDip;
}
