/**
 * How the held gun reacts to jumping. The gun hangs on a soft spring: leaving the ground and landing each give it a push
 * downward, as its weight lags behind the body, and in the air it floats up a little. A push changes the gun's speed,
 * never its position, so both the take-off and the landing are eased.
 */
export const JUMP_POSE = {
  liftUnits: 0.7,
  /** Downward speed the gun picks up as the body springs off the ground, in view units per second. */
  takeoffKick: 5,
  /** Downward speed the gun picks up on landing, in view units per second. */
  landKick: 6,
  /** Spring frequency in hertz and damping ratio: one soft bounce that dies out. */
  springHz: 1.8,
  damping: 0.55,
} as const;

/** Longest spring step, in seconds, so a long frame cannot make the spring overshoot. */
const MAX_STEP_SECONDS = 1 / 120;

export interface JumpPose {
  offset: number;
  speed: number;
  onGround: boolean;
}

export const restingJumpPose = (): JumpPose => ({ offset: 0, speed: 0, onGround: true });

/** Advances the pose by `dt` seconds and returns the vertical offset of the gun in view units. */
export function stepJumpPose(pose: JumpPose, onGround: boolean, dtSeconds: number): number {
  if (onGround !== pose.onGround) pose.speed -= onGround ? JUMP_POSE.landKick : JUMP_POSE.takeoffKick;
  pose.onGround = onGround;
  const target = onGround ? 0 : JUMP_POSE.liftUnits;
  const w = 2 * Math.PI * JUMP_POSE.springHz;
  let left = Math.max(0, dtSeconds);
  while (left > 0) {
    const dt = Math.min(left, MAX_STEP_SECONDS);
    pose.speed += (w * w * (target - pose.offset) - 2 * JUMP_POSE.damping * w * pose.speed) * dt;
    pose.offset += pose.speed * dt;
    left -= dt;
  }
  if (onGround && Math.abs(pose.offset) < 1e-3 && Math.abs(pose.speed) < 1e-2) {
    pose.offset = 0;
    pose.speed = 0;
  }
  return pose.offset;
}
