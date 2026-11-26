import { ACTIONS, ACTION_IDS, effectiveBindings, type Bindings } from '../game/bindings.ts';
import { CollisionWorld, TICK_DT, createPlayerState, spawnState, surfaceOf, weaponDef, type Mat, type PlayerState, type ShotInfo, type Surface, type WeaponId } from '@calindra-strike/shared';

/** Lifts the walker a little above the floor so it lands on it under gravity, as a spawn does in a match. */
const SPAWN_LIFT_UNITS = 4;
/** A slow frame runs at most this much simulation, so a stalled tab does not fire a burst of commands. */
const MAX_CATCH_UP_SECONDS = 0.25;
/** The number of weapon slots the keyboard reaches; the wheel (5 and 6) is not in the explorer. */
const KEY_WEAPON_SLOTS = 4;
const MELEE_SLOT = 3;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Impact {
  kind: 'wall' | 'pane';
  surface: Surface;
  at: Vec3;
  normal: Vec3;
}

export interface ShotPath {
  from: Vec3;
  end: Vec3;
  impacts: Impact[];
}

/** Button bits held this frame, read from the same bindings the game reads. */
export function walkButtons(held: ReadonlySet<string>, bindings: Bindings): number {
  let buttons = 0;
  for (const id of ACTION_IDS) {
    const bit = ACTIONS[id].bit;
    if (bit !== undefined && effectiveBindings(bindings, id).some((code) => held.has(code))) buttons |= bit;
  }
  return buttons;
}

/** The weapon slot a key asks for (1 to 4), or 0 when the key is not a weapon key. */
export function weaponRequest(code: string, bindings: Bindings): number {
  for (const id of ACTION_IDS) {
    const slot = ACTIONS[id].weapon;
    if (slot !== undefined && slot <= KEY_WEAPON_SLOTS && effectiveBindings(bindings, id).includes(code)) return slot;
  }
  return 0;
}

/** Simulation ticks due after `dtSeconds`, and the time carried into the next frame. */
export function ticksDue(carry: number, dtSeconds: number): { ticks: number; carry: number } {
  const total = Math.min(carry + dtSeconds, MAX_CATCH_UP_SECONDS);
  const ticks = Math.floor(total / TICK_DT + 1e-9);
  return { ticks, carry: Math.max(0, total - ticks * TICK_DT) };
}

/** Unit vector the camera looks along, the same convention `stepFly` moves by. */
export function lookDirection(yaw: number, pitch: number): Vec3 {
  return {
    x: -Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch),
  };
}

/** A player on the floor under (x, z), dropped from just above the eye height it starts at. */
export function spawnWalker(world: CollisionWorld, x: number, z: number, yaw: number, weapon: WeaponId, eyeY: number): PlayerState {
  const ground = world.groundBelow(x, eyeY, z, 0);
  const player = createPlayerState();
  spawnState(player, x, (Number.isFinite(ground) ? ground : eyeY) + SPAWN_LIFT_UNITS, z, yaw, weapon);
  player.dropping = false;
  return player;
}

/**
 * Where each pellet of a shot goes and what it hits, in the order the client plays it:
 * a glass or water pane on the way first, then the wall where the round stops.
 */
export function shotPaths(world: CollisionWorld, shot: ShotInfo): ShotPath[] {
  const def = weaponDef(shot.weapon);
  const melee = def.slot === MELEE_SLOT;
  const from = { x: shot.ox, y: shot.oy, z: shot.oz };
  const paths: ShotPath[] = [];
  for (let i = 0; i < shot.dirs.length; i += 3) {
    const dir = { x: shot.dirs[i], y: shot.dirs[i + 1], z: shot.dirs[i + 2] };
    const wall = world.trace(from.x, from.y, from.z, dir.x, dir.y, dir.z, def.range);
    const dist = wall ? wall.t : def.range;
    const impacts: Impact[] = [];
    const pane = melee ? null : world.tracePane(from.x, from.y, from.z, dir.x, dir.y, dir.z, dist);
    if (pane) impacts.push(impactAt('pane', pane.mat, pane, from, dir));
    if (wall) impacts.push(impactAt('wall', wall.mat, wall, from, dir));
    paths.push({ from, end: pointAlong(from, dir, dist), impacts });
  }
  return paths;
}

function pointAlong(from: Vec3, dir: Vec3, t: number): Vec3 {
  return { x: from.x + dir.x * t, y: from.y + dir.y * t, z: from.z + dir.z * t };
}

function impactAt(
  kind: Impact['kind'],
  mat: Mat,
  hit: { t: number; nx: number; ny: number; nz: number },
  from: Vec3,
  dir: Vec3,
): Impact {
  return {
    kind,
    surface: surfaceOf(mat),
    at: pointAlong(from, dir, hit.t),
    normal: { x: hit.nx, y: hit.ny, z: hit.nz },
  };
}
