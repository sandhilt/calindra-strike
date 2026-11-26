export interface FlyPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

type Axis = -1 | 0 | 1;

export interface FlyInput {
  forward: Axis;
  right: Axis;
  up: Axis;
  fast: boolean;
}

export const FLY_SPEED = { unitsPerSecond: 300, fastMultiplier: 3 };
const MAX_PITCH_RADIANS = 89 * Math.PI / 180;

export function stepFly(pose: FlyPose, input: FlyInput, dt: number): FlyPose {
  const { yaw, pitch } = pose;
  const forward = input.forward * Math.cos(pitch);
  const dx = input.right * Math.cos(yaw) - forward * Math.sin(yaw);
  const dy = input.up + input.forward * Math.sin(pitch);
  const dz = -input.right * Math.sin(yaw) - forward * Math.cos(yaw);
  const speed = FLY_SPEED.unitsPerSecond * (input.fast ? FLY_SPEED.fastMultiplier : 1);
  const distance = speed * dt / Math.max(1, Math.hypot(dx, dy, dz));
  return { ...pose, x: pose.x + dx * distance, y: pose.y + dy * distance, z: pose.z + dz * distance };
}

export function lookBy(pose: FlyPose, dx: number, dy: number, sensitivity: number): FlyPose {
  const yaw = pose.yaw - dx * sensitivity;
  const pitch = pose.pitch - dy * sensitivity;
  return { ...pose, yaw, pitch: Math.max(-MAX_PITCH_RADIANS, Math.min(MAX_PITCH_RADIANS, pitch)) };
}
