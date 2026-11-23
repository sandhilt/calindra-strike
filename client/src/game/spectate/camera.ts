import { LEAN_OFFSET_UNITS, type Stance, clamp } from '@calindra-strike/shared';
import { movementEye } from '../render/movement-pose.ts';

/**
 * CS 1.6 spectator views, cycled with Space in this order: first person, locked chase (behind the player,
 * turning with their view), free chase (the mouse orbits the camera around the player) and free look.
 */
export type CameraMode = 'first' | 'chase' | 'orbit' | 'free';

export const CAMERA_MODES: readonly CameraMode[] = ['first', 'chase', 'orbit', 'free'];

export const CAMERA_MODE_LABEL: Record<CameraMode, string> = {
  first: '1ª pessoa',
  chase: '3ª pessoa travada',
  orbit: '3ª pessoa livre',
  free: 'câmera livre',
};

/** Modes where the mouse turns the camera instead of the camera following the player's view. */
export function mouseLooks(mode: CameraMode): boolean {
  return mode === 'orbit' || mode === 'free';
}

export function nextCameraMode(mode: CameraMode): CameraMode {
  return CAMERA_MODES[(CAMERA_MODES.indexOf(mode) + 1) % CAMERA_MODES.length];
}

/** Camera placement: position plus the yaw/pitch convention of the player view (pitch > 0 looks up). */
export interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

/** The followed player as the snapshot interpolation reports it. */
export interface FollowedPlayer {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  stance: Stance;
  onGround: boolean;
  sliding: boolean;
  lean: number;
}

/** The part of CollisionWorld the chase camera needs: nearest blocking surface along a normalized ray. */
export interface RayWorld {
  trace(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): { t: number } | null;
}

/** Distance behind the eye, in world units, the chase camera aims for. */
export const CHASE_DISTANCE = 130;
/** Extra height over the eye so the player's head does not fill the view, in world units. */
export const CHASE_RISE = 24;
/** Gap kept between the camera and the wall that pulled it in, in world units. */
export const CHASE_WALL_MARGIN = 10;

/** Free camera speeds in world units per second; a player runs at 250. */
export const FREE_SPEED = 450;
export const FREE_FAST_SPEED = 1400;
/** How far past the map bounds the free camera may fly, in world units. */
export const FREE_MARGIN = 600;
const FREE_MIN_Y = 8;

/** Unit view direction for a yaw/pitch pair. */
export function lookDir(yaw: number, pitch: number): [number, number, number] {
  const flat = Math.cos(pitch);
  return [-flat * Math.sin(yaw), Math.sin(pitch), -flat * Math.cos(yaw)];
}

/** First person: the camera sits in the followed player's eyes. */
export function eyePose(p: FollowedPlayer, eye = movementEye(p.stance, p.onGround, Number(p.sliding))): Pose {
  const offset = p.lean * LEAN_OFFSET_UNITS;
  return { x: p.x + Math.cos(p.yaw) * offset, y: p.y + eye, z: p.z - Math.sin(p.yaw) * offset, yaw: p.yaw, pitch: p.pitch };
}

/**
 * Third person: behind and a little above the followed player, looking along `view`. The locked chase passes the
 * player's own view, so the camera stays on their back; the free chase passes the mouse's, orbiting around them.
 * When a wall stands between the player's eye and that spot the camera is pulled in
 * to just in front of it, so it never ends up on the far side of the wall.
 */
export function chasePose(p: FollowedPlayer, world: RayWorld, view: { yaw: number; pitch: number } = p): Pose {
  const eye = eyePose(p);
  const [fx, fy, fz] = lookDir(view.yaw, view.pitch);
  const dx = -fx * CHASE_DISTANCE;
  const dy = -fy * CHASE_DISTANCE + CHASE_RISE;
  const dz = -fz * CHASE_DISTANCE;
  const length = Math.hypot(dx, dy, dz);
  const hit = world.trace(eye.x, eye.y, eye.z, dx / length, dy / length, dz / length, length);
  const reach = hit ? Math.min(length, Math.max(hit.t - CHASE_WALL_MARGIN, hit.t / 2)) : length;
  const k = reach / length;
  return { x: eye.x + dx * k, y: eye.y + dy * k, z: eye.z + dz * k, yaw: view.yaw, pitch: view.pitch };
}

/** Where the free camera starts before any player is followed: above the middle of the map, looking down. */
export function overviewPose(bounds: { minX: number; maxX: number; minZ: number; maxZ: number }): Pose {
  return { x: (bounds.minX + bounds.maxX) / 2, y: 700, z: (bounds.minZ + bounds.maxZ) / 2, yaw: 0, pitch: -0.6 };
}

export interface FreeKeys {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fast: boolean;
}

export const NO_FREE_KEYS: FreeKeys = { forward: false, back: false, left: false, right: false, up: false, down: false, fast: false };

/** Free camera keys: WASD fly, E up, Q or C down, Shift faster. Space is taken by the mode switch. */
export function freeKeysFrom(held: ReadonlySet<string>): FreeKeys {
  return {
    forward: held.has('KeyW'),
    back: held.has('KeyS'),
    left: held.has('KeyA'),
    right: held.has('KeyD'),
    up: held.has('KeyE'),
    down: held.has('KeyQ') || held.has('KeyC'),
    fast: held.has('ShiftLeft') || held.has('ShiftRight'),
  };
}

export interface FreeLimits {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  maxY: number;
}

/** One frame of free flight along the look direction. Diagonals are not faster; the camera stays inside the limits. */
export function stepFreeCam(pose: Pose, keys: FreeKeys, dt: number, limits?: FreeLimits): Pose {
  const [fx, fy, fz] = lookDir(pose.yaw, pose.pitch);
  const ahead = Number(keys.forward) - Number(keys.back);
  const side = Number(keys.right) - Number(keys.left);
  const rise = Number(keys.up) - Number(keys.down);
  const mx = fx * ahead + Math.cos(pose.yaw) * side;
  const my = fy * ahead + rise;
  const mz = fz * ahead - Math.sin(pose.yaw) * side;
  const length = Math.hypot(mx, my, mz);
  if (length === 0) return pose;
  const step = ((keys.fast ? FREE_FAST_SPEED : FREE_SPEED) * dt) / length;
  const next = { ...pose, x: pose.x + mx * step, y: pose.y + my * step, z: pose.z + mz * step };
  if (!limits) return next;
  const { bounds } = limits;
  return {
    ...next,
    x: clamp(next.x, bounds.minX - FREE_MARGIN, bounds.maxX + FREE_MARGIN),
    y: clamp(next.y, FREE_MIN_Y, limits.maxY),
    z: clamp(next.z, bounds.minZ - FREE_MARGIN, bounds.maxZ + FREE_MARGIN),
  };
}
