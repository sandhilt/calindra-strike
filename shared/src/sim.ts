import {
  ACCELERATE,
  AIR_ACCELERATE,
  AIR_WISHSPEED_CAP,
  BTN,
  BUNNYJUMP_MAX_FACTOR,
  DROP_ACCEL,
  DROP_AIR_SPEED,
  DROP_DIVE_SPEED,
  DROP_FALL_SPEED,
  FRICTION,
  GRAVITY,
  JUMP_SPEED,
  LEAN_BODY_SHIFT_UNITS,
  LEAN_HEAD_SHIFT_UNITS,
  LEAN_OFFSET_UNITS,
  LEAN_RATE_PER_TICK,
  LEAN_WALL_MARGIN_UNITS,
  MAX_HEALTH,
  MAX_VELOCITY,
  PLAYER_RADIUS,
  PRONE_SPREAD_MULT,
  PRONE_SWITCH_TICKS,
  SLIDE_BOOST_SPEED,
  SLIDE_END_SPEED,
  SLIDE_FRICTION,
  SLIDE_MIN_SPEED,
  SLIDE_STAMINA_COST,
  SLIDE_TICKS,
  SPAWN_PROTECT_TICKS,
  SPRINT_OUT_TICKS,
  SPRINT_SPEED_MULT,
  STAMINA_DRAIN_MIN_SPEED,
  STAMINA_DRAIN_PER_TICK,
  STAMINA_MAX,
  STAMINA_REGEN_PER_TICK,
  STAMINA_RESUME,
  STEP_SIZE,
  TICK_DT,
  WALK_SPEED_MULT,
} from './constants.ts';
import { carriedBy, liftAt, liftCab, type LiftCab } from './lift.ts';
import { escalatorDrift } from './escalator.ts';
import { DEG, clamp, dirFromAngles, hashSeed, mulberry32, rayAabb, wrapAngle } from './math.ts';
import type { CollisionWorld } from './physics.ts';
import { STANCE, STANCES, isLowered, type BodyBox, type Stance } from './stance.ts';
import {
  WEAPON,
  WEAPON_COUNT,
  magCapacity,
  reserveCapacity,
  type ShellReloadTiming,
  type WeaponDef,
  type WeaponId,
  csSniperSpread,
  recoilOffset,
  shellStepTicks,
  shellsToLoad,
  weaponDef,
} from './weapons.ts';

export interface PlayerState {
  halvedAmmo: boolean;
  infiniteMgl: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  onGround: boolean;
  stance: Stance;
  duckHeld: boolean; // DUCK was down last tick, so a slide starts on the press and not while held
  sprinting: boolean;
  aiming: boolean; // aim down sights (ADS) on a weapon with `ads`; the AWP scope is `zoom`, not this
  stamina: number; // 0..STAMINA_MAX
  winded: boolean; // the meter emptied and has not refilled to STAMINA_RESUME yet
  slide: number; // ticks left, 0 = not sliding
  lean: number; // -1 full left .. 1 full right
  stanceLock: number; // ticks left before prone may change
  jumpHeld: boolean;
  dropping: boolean;
  attackHeld: boolean;
  attack2Held: boolean;
  health: number;
  armor: number;
  weapon: WeaponId;
  lastWeapon: WeaponId;
  primary: WeaponId;
  mag: number[];
  reserve: number[];
  tick: number;
  nextFire: number;
  reload: number;
  deploy: number;
  recoil: number;
  lastFire: number;
  zoom: number;
  protect: number;
  resumeZoom: number; // AWP: zoom level restored once the bolt cycle ends (0 = none)
}

export interface Cmd {
  seq: number;
  buttons: number;
  yaw: number;
  pitch: number;
  weapon: number; // 0 none, 1 primary, 2 pistol, 3 hammer, 4 last used
  interp: number; // server-time (ms) the client was rendering, for lag compensation
}

export interface ShotInfo {
  weapon: WeaponId;
  heavy: boolean;
  ox: number;
  oy: number;
  oz: number;
  dirs: number[]; // flattened xyz per pellet
  tick: number;
}

export const MAX_PITCH = 89 * DEG;

export function createPlayerState(): PlayerState {
  return {
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    pitch: 0,
    onGround: false,
    stance: STANCE.STAND,
    duckHeld: false,
    sprinting: false,
    aiming: false,
    stamina: STAMINA_MAX,
    winded: false,
    slide: 0,
    lean: 0,
    stanceLock: 0,
    jumpHeld: false,
    dropping: false,
    attackHeld: false,
    attack2Held: false,
    health: MAX_HEALTH,
    armor: 0,
    weapon: WEAPON.RIFLE,
    lastWeapon: WEAPON.PISTOL,
    primary: WEAPON.RIFLE,
    halvedAmmo: false,
    infiniteMgl: false,
    mag: new Array(WEAPON_COUNT).fill(0),
    reserve: new Array(WEAPON_COUNT).fill(0),
    tick: 0,
    nextFire: 0,
    reload: 0,
    deploy: 0,
    recoil: 0,
    lastFire: -1000,
    zoom: 0,
    protect: 0,
    resumeZoom: 0,
  };
}

export function cloneState(s: PlayerState): PlayerState {
  return { ...s, mag: s.mag.slice(), reserve: s.reserve.slice() };
}

export function copyState(dst: PlayerState, s: PlayerState): void {
  Object.assign(dst, s);
  dst.mag = s.mag.slice();
  dst.reserve = s.reserve.slice();
}

export const hullHeight = (s: { stance: Stance }): number => STANCES[s.stance].height;
export const eyeHeight = (s: { stance: Stance }): number => STANCES[s.stance].eye;

/** Sideways shift of the eye (and of shots) from leaning, along the player's right vector (cos yaw, -sin yaw). */
export const leanOffset = (s: { lean: number }): number => s.lean * LEAN_OFFSET_UNITS;

/** Where the player sees and shoots from: the unleaned eye moved sideways by the lean. */
export function eyePosition(s: { x: number; y: number; z: number; yaw: number; lean: number; stance: Stance }): { x: number; y: number; z: number } {
  const off = leanOffset(s);
  return { x: s.x + Math.cos(s.yaw) * off, y: s.y + eyeHeight(s), z: s.z - Math.sin(s.yaw) * off };
}

function fillAmmo(s: PlayerState, id: WeaponId): void {
  const d = weaponDef(id);
  s.mag[id] = magCapacity(d, s.halvedAmmo);
  s.reserve[id] = reserveCapacity(d, s.halvedAmmo);
}

/** Warmup ammo: the reserve of the guns the player holds never runs out; magazines still empty and need reloading. */
export function refillReserve(s: PlayerState): void {
  for (const id of [s.primary, WEAPON.PISTOL]) s.reserve[id] = reserveCapacity(weaponDef(id), s.halvedAmmo);
}

/** Puts a freshly (re)spawned player in the sky above (x, z). */
export function spawnState(s: PlayerState, x: number, y: number, z: number, yaw: number, primary: WeaponId): void {
  s.x = x;
  s.y = y;
  s.z = z;
  s.vx = 0;
  s.vy = 0;
  s.vz = 0;
  s.yaw = yaw;
  s.pitch = -0.6;
  s.onGround = false;
  s.stance = STANCE.STAND;
  s.duckHeld = false;
  s.sprinting = false;
  s.aiming = false;
  s.stamina = STAMINA_MAX;
  s.winded = false;
  s.slide = 0;
  s.lean = 0;
  s.stanceLock = 0;
  s.dropping = true;
  s.health = MAX_HEALTH;
  s.armor = 0;
  s.halvedAmmo = false;
  s.infiniteMgl = false;
  s.mag.fill(0);
  s.reserve.fill(0);
  s.primary = primary;
  fillAmmo(s, primary);
  fillAmmo(s, WEAPON.PISTOL);
  s.weapon = primary;
  s.lastWeapon = WEAPON.PISTOL;
  s.reload = 0;
  s.deploy = 0;
  s.recoil = 0;
  s.zoom = 0;
  s.resumeZoom = 0;
  s.nextFire = s.tick;
  s.protect = 0;
}

/** Airdrop reward: legendary primary with full ammo. */
export function giveWeapon(s: PlayerState, id: WeaponId): void {
  s.primary = id;
  fillAmmo(s, id);
  if (s.weapon !== id) s.lastWeapon = s.weapon;
  s.weapon = id;
  s.deploy = weaponDef(id).deployTicks;
  s.reload = 0;
  s.zoom = 0;
  s.resumeZoom = 0;
  s.aiming = false;
}

/** Convert carried ammo once on activation; restoring capacities keeps the remaining rounds. */
export function setHalvedAmmo(s: PlayerState, halved: boolean): void {
  if (s.halvedAmmo === halved) return;
  s.halvedAmmo = halved;
  s.reload = 0;
  if (!halved) return;
  for (const id of [s.primary, WEAPON.PISTOL]) {
    s.mag[id] = Math.ceil(s.mag[id] / 2);
    s.reserve[id] = Math.ceil(s.reserve[id] / 2);
  }
}

// ---------------------------------------------------------------- movement

function accelerate(s: PlayerState, wx: number, wz: number, wishspeed: number, accel: number, dt: number): void {
  const current = s.vx * wx + s.vz * wz;
  const add = wishspeed - current;
  if (add <= 0) return;
  let accelSpeed = accel * dt * wishspeed;
  if (accelSpeed > add) accelSpeed = add;
  s.vx += accelSpeed * wx;
  s.vz += accelSpeed * wz;
}

function airAccelerate(s: PlayerState, wx: number, wz: number, wishspeed: number, dt: number): void {
  const wishspd = Math.min(wishspeed, AIR_WISHSPEED_CAP);
  const current = s.vx * wx + s.vz * wz;
  const add = wishspd - current;
  if (add <= 0) return;
  let accelSpeed = AIR_ACCELERATE * wishspeed * dt;
  if (accelSpeed > add) accelSpeed = add;
  s.vx += accelSpeed * wx;
  s.vz += accelSpeed * wz;
}

function friction(s: PlayerState, dt: number, coefficient = FRICTION): void {
  const speed = Math.hypot(s.vx, s.vz);
  if (speed < 0.1) {
    s.vx = 0;
    s.vz = 0;
    return;
  }
  const { stopSpeed } = STANCES[s.stance];
  const control = speed < stopSpeed ? stopSpeed : speed;
  const drop = control * coefficient * dt;
  const ns = Math.max(speed - drop, 0) / speed;
  s.vx *= ns;
  s.vz *= ns;
}

function checkGround(w: CollisionWorld, s: PlayerState): boolean {
  if (s.vy > 1) return false;
  const r = 16;
  return w.overlaps(s.x - r, s.y - 0.25, s.z - r, s.x + r, s.y + 0.01, s.z + r);
}

/** Horizontal move with stair stepping (only used while grounded). Returns blocked flags. */
/** `driftX` and `driftZ` move the player on top of their own velocity, as an escalator does, without becoming velocity. */
function walkMove(w: CollisionWorld, s: PlayerState, dt: number, driftX = 0, driftZ = 0): void {
  const h = hullHeight(s);
  const dx = (s.vx + driftX) * dt;
  const dz = (s.vz + driftZ) * dt;
  const sx = s.x;
  const sy = s.y;
  const sz = s.z;

  const mx = w.clipAxis(s.x, s.y, s.z, h, 0, dx);
  s.x += mx;
  const mz = w.clipAxis(s.x, s.y, s.z, h, 2, dz);
  s.z += mz;
  const bx = mx !== dx;
  const bz = mz !== dz;
  if (!bx && !bz) return;

  const px = s.x;
  const pz = s.z;

  // try stepping up and over
  let tx = sx;
  let ty = sy;
  let tz = sz;
  ty += w.clipAxis(tx, ty, tz, h, 1, STEP_SIZE);
  const smx = w.clipAxis(tx, ty, tz, h, 0, dx);
  tx += smx;
  const smz = w.clipAxis(tx, ty, tz, h, 2, dz);
  tz += smz;
  ty += w.clipAxis(tx, ty, tz, h, 1, -(ty - sy) - 0.5);

  const plain = (px - sx) ** 2 + (pz - sz) ** 2;
  const stepped = (tx - sx) ** 2 + (tz - sz) ** 2;
  if (stepped > plain + 1e-4 && ty >= sy - 0.25) {
    s.x = tx;
    s.y = ty;
    s.z = tz;
    if (smx !== dx) s.vx = 0;
    if (smz !== dz) s.vz = 0;
  } else {
    s.x = px;
    s.y = sy;
    s.z = pz;
    if (bx) s.vx = 0;
    if (bz) s.vz = 0;
  }
}

function airMove(w: CollisionWorld, s: PlayerState, dt: number): void {
  const h = hullHeight(s);
  const dx = s.vx * dt;
  const mx = w.clipAxis(s.x, s.y, s.z, h, 0, dx);
  s.x += mx;
  if (mx !== dx) s.vx = 0;
  const dz = s.vz * dt;
  const mz = w.clipAxis(s.x, s.y, s.z, h, 2, dz);
  s.z += mz;
  if (mz !== dz) s.vz = 0;
}

function verticalMove(w: CollisionWorld, s: PlayerState, dt: number): void {
  const dy = s.vy * dt;
  const my = w.clipAxis(s.x, s.y, s.z, hullHeight(s), 1, dy);
  s.y += my;
  if (my !== dy) s.vy = 0;
}

function wishDir(s: PlayerState, buttons: number): [number, number, boolean] {
  const f = (buttons & BTN.FWD ? 1 : 0) - (buttons & BTN.BACK ? 1 : 0);
  const r = (buttons & BTN.RIGHT ? 1 : 0) - (buttons & BTN.LEFT ? 1 : 0);
  if (f === 0 && r === 0) return [0, 0, false];
  const sy = Math.sin(s.yaw);
  const cy = Math.cos(s.yaw);
  // forward = (-sin, -cos), right = (cos, -sin)
  let wx = -sy * f + cy * r;
  let wz = -cy * f - sy * r;
  const len = Math.hypot(wx, wz);
  wx /= len;
  wz /= len;
  return [wx, wz, true];
}

export function maxSpeedFor(s: PlayerState): number {
  const d = weaponDef(s.weapon);
  if (s.zoom > 0) return d.scopedSpeed;
  return s.aiming && d.ads ? d.ads.speed : d.speed;
}

function skydive(w: CollisionWorld, s: PlayerState, buttons: number, dt: number): void {
  const [wx, wz, moving] = wishDir(s, buttons);
  if (moving) accelerate(s, wx, wz, DROP_AIR_SPEED, DROP_ACCEL, dt);
  else {
    const k = Math.max(0, 1 - 1.5 * dt);
    s.vx *= k;
    s.vz *= k;
  }
  const hs = Math.hypot(s.vx, s.vz);
  if (hs > DROP_AIR_SPEED) {
    s.vx *= DROP_AIR_SPEED / hs;
    s.vz *= DROP_AIR_SPEED / hs;
  }
  const cap = buttons & BTN.DUCK ? DROP_DIVE_SPEED : DROP_FALL_SPEED;
  s.vy -= GRAVITY * dt;
  if (s.vy < -cap) s.vy += (-cap - s.vy) * Math.min(1, 5 * dt);
  airMove(w, s, dt);
  const before = s.vy;
  verticalMove(w, s, dt);
  if (before < 0 && s.vy === 0) {
    // touched down
    s.dropping = false;
    s.onGround = true;
    s.vx *= 0.35;
    s.vz *= 0.35;
    s.protect = SPAWN_PROTECT_TICKS;
  }
}

/**
 * A rider the cab carries is set on its floor after walking across it, so nothing in the shaft pulls them down. They
 * can walk out of the doorway at a stop, where the cab waits, and then the floor is whatever is under the feet.
 */
function rideLift(w: CollisionWorld, s: PlayerState, cab: LiftCab): void {
  if (!liftAt(w.map.lifts, s.x, s.y, s.z)) {
    s.vy = 0;
    s.onGround = checkGround(w, s);
    return;
  }
  s.y = cab.y;
  s.vy = 0;
  s.onGround = true;
}

/** Lowest first, so a higher index is a taller stance. */
const BY_HEIGHT: readonly Stance[] = [STANCE.PRONE, STANCE.CROUCH, STANCE.STAND];
const heightRank = (stance: Stance): number => BY_HEIGHT.indexOf(stance);

function wantedStance(s: PlayerState, buttons: number): Stance {
  if (buttons & BTN.PRONE && s.onGround) return STANCE.PRONE;
  if (buttons & BTN.DUCK || s.slide > 0) return STANCE.CROUCH;
  return STANCE.STAND;
}

/** GoldSrc: ducking in the air tucks the legs up, so the hull's top stays put. */
const AIR_TUCK_UNITS = (STANCES[STANCE.STAND].height - STANCES[STANCE.CROUCH].height) / 2;

/** The tallest stance up to `want` that fits where the player is; the current one when nothing taller does. */
function riseTo(w: CollisionWorld, s: PlayerState, want: Stance): Stance {
  if (!s.onGround && s.stance === STANCE.CROUCH && want === STANCE.STAND && !w.hullOverlaps(s.x, s.y - AIR_TUCK_UNITS, s.z, STANCES[STANCE.STAND].height)) {
    s.y -= AIR_TUCK_UNITS;
    return STANCE.STAND;
  }
  for (let i = heightRank(want); i > heightRank(s.stance); i--) {
    if (!w.hullOverlaps(s.x, s.y, s.z, STANCES[BY_HEIGHT[i]].height)) return BY_HEIGHT[i];
  }
  return s.stance;
}

function updateStance(w: CollisionWorld, s: PlayerState, buttons: number): void {
  if (s.stanceLock > 0) s.stanceLock--;
  const want = wantedStance(s, buttons);
  const from = s.stance;
  if (want === from) return;
  const changesProne = want === STANCE.PRONE || from === STANCE.PRONE;
  // A prone player who falls off an edge may always get up
  if (changesProne && s.stanceLock > 0 && s.onGround) return;
  const lowering = heightRank(want) < heightRank(from);
  const next = lowering ? want : riseTo(w, s, want);
  if (next === from) return;
  if (lowering && !s.onGround) s.y += AIR_TUCK_UNITS;
  s.stance = next;
  if (changesProne) s.stanceLock = PRONE_SWITCH_TICKS;
  if (next === STANCE.PRONE) s.slide = 0;
}

/** The aim button is down on a weapon that has sights and nothing is in the way: no reload, no deploy, no drop. */
function aimHeld(s: PlayerState, buttons: number): boolean {
  return (buttons & BTN.ATTACK2) !== 0 && weaponDef(s.weapon).ads !== undefined && !s.dropping && s.deploy === 0 && s.reload === 0;
}

function canSprint(s: PlayerState, buttons: number): boolean {
  const wants = (buttons & BTN.SPRINT) !== 0 && (buttons & BTN.FWD) !== 0;
  const aimsDownSights = (buttons & BTN.ATTACK2) !== 0 && weaponDef(s.weapon).ads !== undefined;
  const blocked = (buttons & (BTN.BACK | BTN.WALK | BTN.ATTACK)) !== 0 || aimsDownSights;
  return wants && !blocked && s.onGround && s.stance === STANCE.STAND && s.slide === 0 && !s.winded && s.stamina > 0;
}

function endSprint(s: PlayerState): void {
  s.sprinting = false;
  s.nextFire = Math.max(s.nextFire, s.tick + SPRINT_OUT_TICKS);
}

function stepSprint(s: PlayerState, sprinting: boolean): void {
  if (sprinting && !s.sprinting) {
    s.zoom = 0;
    s.resumeZoom = 0;
  }
  if (!sprinting && s.sprinting) endSprint(s);
  const stalled = sprinting && s.sprinting && Math.hypot(s.vx, s.vz) < STAMINA_DRAIN_MIN_SPEED;
  s.sprinting = sprinting;
  const delta = stalled ? 0 : sprinting ? -STAMINA_DRAIN_PER_TICK : STAMINA_REGEN_PER_TICK;
  s.stamina = clamp(s.stamina + delta, 0, STAMINA_MAX);
  if (s.stamina <= 0) s.winded = true;
  else if (s.winded && s.stamina >= STAMINA_RESUME) s.winded = false;
}

/** A crouch pressed during a sprint turns the run into a slide: a push along the current heading. */
function tryStartSlide(s: PlayerState, duckPressed: boolean): void {
  if (!duckPressed || !s.sprinting || !s.onGround || s.slide > 0 || s.stamina < SLIDE_STAMINA_COST) return;
  const speed = Math.hypot(s.vx, s.vz);
  if (speed < SLIDE_MIN_SPEED) return;
  const pushed = Math.max(speed, SLIDE_BOOST_SPEED) / speed;
  s.vx *= pushed;
  s.vz *= pushed;
  s.slide = SLIDE_TICKS;
  s.stamina -= SLIDE_STAMINA_COST;
  if (s.stamina <= 0) s.winded = true;
}

function endSlideIfSpent(s: PlayerState): void {
  if (s.slide === 0) return;
  s.slide--;
  if (!s.onGround || Math.hypot(s.vx, s.vz) < SLIDE_END_SPEED) s.slide = 0;
}

function moveToward(value: number, target: number, step: number): number {
  return value < target ? Math.min(value + step, target) : Math.max(value - step, target);
}

/** Leans toward the wanted side, never further than the free room beside the head. */
function updateLean(w: CollisionWorld, s: PlayerState, buttons: number): void {
  const free = !s.sprinting && s.slide === 0 && s.stance !== STANCE.PRONE && s.onGround;
  const side = (buttons & BTN.LEAN_RIGHT ? 1 : 0) - (buttons & BTN.LEAN_LEFT ? 1 : 0);
  s.lean = moveToward(s.lean, free ? side : 0, LEAN_RATE_PER_TICK);
  if (s.lean === 0) return;
  const dir = Math.sign(s.lean);
  const wall = w.trace(s.x, s.y + eyeHeight(s), s.z, dir * Math.cos(s.yaw), 0, -dir * Math.sin(s.yaw), LEAN_OFFSET_UNITS + LEAN_WALL_MARGIN_UNITS);
  const room = wall ? Math.max(0, wall.t - LEAN_WALL_MARGIN_UNITS) : LEAN_OFFSET_UNITS;
  s.lean = dir * Math.min(Math.abs(s.lean), room / LEAN_OFFSET_UNITS);
}

export function playerMove(w: CollisionWorld, s: PlayerState, buttons: number, dt: number): void {
  const duckDown = (buttons & BTN.DUCK) !== 0;
  const duckPressed = duckDown && !s.duckHeld;
  s.duckHeld = duckDown;
  if (s.dropping) {
    s.aiming = false;
    skydive(w, s, buttons, dt);
    return;
  }

  const shaft = liftAt(w.map.lifts, s.x, s.y, s.z);
  const cab = shaft ? liftCab(shaft, w.liftTick) : null;
  const carried = cab !== null && carriedBy(cab, s.y);
  if (carried) s.onGround = true;

  tryStartSlide(s, duckPressed);
  updateStance(w, s, buttons);
  const sprintWanted = canSprint(s, buttons);
  s.aiming = aimHeld(s, buttons) && !sprintWanted;

  // --- jump (must re-press; CS 1.6 bunnyhop speed cap; none while prone) ---
  let jumped = false;
  if (buttons & BTN.JUMP) {
    if (!shaft && s.onGround && !s.jumpHeld && s.stance !== STANCE.PRONE) {
      const maxs = sprintWanted ? maxSpeedFor(s) * SPRINT_SPEED_MULT : maxSpeedFor(s);
      const spd = Math.hypot(s.vx, s.vz);
      const cap = BUNNYJUMP_MAX_FACTOR * maxs;
      if (spd > cap) {
        const f = (cap / spd) * 0.65;
        s.vx *= f;
        s.vz *= f;
      }
      s.vy = JUMP_SPEED;
      s.onGround = false;
      s.slide = 0;
      jumped = true;
    }
    s.jumpHeld = true;
  } else s.jumpHeld = false;

  const sprinting = sprintWanted && !jumped;
  stepSprint(s, sprinting);

  const [wx, wz, moving] = wishDir(s, buttons);
  let wishspeed = moving ? maxSpeedFor(s) : 0;
  if (sprinting) wishspeed *= SPRINT_SPEED_MULT;
  if (buttons & BTN.WALK) wishspeed *= WALK_SPEED_MULT;
  if (s.onGround || jumped) wishspeed *= STANCES[s.stance].speedMult;

  const wasOnGround = s.onGround;
  if (s.onGround) {
    if (s.slide > 0) friction(s, dt, SLIDE_FRICTION);
    else {
      friction(s, dt);
      if (moving) accelerate(s, wx, wz, wishspeed, ACCELERATE, dt);
    }
    s.vy = 0;
  } else {
    if (moving) airAccelerate(s, wx, wz, wishspeed, dt);
    s.vy -= GRAVITY * dt;
  }

  // clamp
  const hs = Math.hypot(s.vx, s.vz);
  if (hs > MAX_VELOCITY) {
    s.vx *= MAX_VELOCITY / hs;
    s.vz *= MAX_VELOCITY / hs;
  }
  s.vy = clamp(s.vy, -MAX_VELOCITY, MAX_VELOCITY);

  if (s.onGround) {
    const [driftX, driftZ] = escalatorDrift(w.map, s) ?? [0, 0];
    walkMove(w, s, dt, driftX, driftZ);
  } else airMove(w, s, dt);
  if (carried && cab) {
    rideLift(w, s, cab);
  } else {
    verticalMove(w, s, dt);

    s.onGround = checkGround(w, s);
    if (s.onGround && s.vy < 0) s.vy = 0;

    // stick to the floor when walking down stairs
    if (wasOnGround && !s.onGround && !jumped && s.vy <= 0) {
      const h = hullHeight(s);
      const d = w.clipAxis(s.x, s.y, s.z, h, 1, -STEP_SIZE);
      if (d > -STEP_SIZE + 0.001) {
        s.y += d;
        s.onGround = true;
        s.vy = 0;
      }
    }
  }

  if (s.sprinting && !s.onGround) endSprint(s); // a run off a ledge ends the sprint on this command, not the next
  endSlideIfSpent(s);
  updateLean(w, s, buttons);
}

// ---------------------------------------------------------------- weapons

export function computeSpread(s: PlayerState, def: WeaponDef = weaponDef(s.weapon)): number {
  if (def.csSniper) return csSniperSpread(s.onGround, Math.hypot(s.vx, s.vz), isLowered(s.stance), s.zoom > 0);
  const sp = def.spread;
  const base = s.zoom > 0 && sp.scoped !== undefined ? sp.scoped : sp.base;
  const maxs = maxSpeedFor(s);
  const speed = Math.hypot(s.vx, s.vz);
  const moveFrac = clamp((speed - maxs * 0.34) / (maxs * 0.66), 0, 1);
  let spread = base + sp.move * moveFrac + (s.onGround ? 0 : sp.air) + Math.min(sp.perShot * s.recoil, sp.perShotMax);
  if (isLowered(s.stance) && s.onGround) spread *= sp.duckMult;
  if (s.stance === STANCE.PRONE && s.onGround) spread *= PRONE_SPREAD_MULT;
  if (s.aiming && def.ads) spread *= def.ads.spreadMult;
  return spread;
}

/**
 * Magazine weapons count the whole reload down in `s.reload` and swap magazines
 * at the end, so the rounds left in the old magazine are kept. The shotgun
 * counts one shell step at a time instead: `s.reload` is the ticks left in the
 * current step and every shell lands in the magazine as soon as it is loaded.
 */
function reloadReserve(s: PlayerState, def: WeaponDef): number {
  return def.id === WEAPON.MGL && s.infiniteMgl ? magCapacity(def, s.halvedAmmo) : s.reserve[def.id];
}

function startReload(s: PlayerState, def: WeaponDef): void {
  const timing = def.reloadTiming;
  if (!timing || s.reload > 0) return;
  const shells = shellsToLoad(def, s.mag[def.id], reloadReserve(s, def), s.halvedAmmo);
  if (shells <= 0) return;
  s.reload = timing.kind === 'shells' ? timing.startTicks + shellStepTicks(timing, shells) : def.reloadTicks;
  s.zoom = 0;
  s.resumeZoom = 0;
  s.aiming = false;
}

function finishMagazineReload(s: PlayerState, def: WeaponDef): void {
  const take = shellsToLoad(def, s.mag[def.id], reloadReserve(s, def), s.halvedAmmo);
  s.mag[def.id] += take;
  if (def.id !== WEAPON.MGL || !s.infiniteMgl) s.reserve[def.id] -= take;
}

/** The shell goes in where its step ends, or before the pump when it is the last one. */
function loadShell(s: PlayerState, def: WeaponDef, timing: ShellReloadTiming): void {
  const left = shellsToLoad(def, s.mag[def.id], reloadReserve(s, def), s.halvedAmmo);
  if (left <= 0) return;
  const insertAt = left === 1 ? timing.pumpTicks : 0;
  if (s.reload > insertAt) return;
  s.mag[def.id]++;
  s.reserve[def.id]--;
  if (left > 1) s.reload = shellStepTicks(timing, left - 1);
}

function reloadTick(s: PlayerState, def: WeaponDef): void {
  s.reload--;
  const timing = def.reloadTiming;
  if (timing?.kind === 'shells') loadShell(s, def, timing);
  else if (s.reload === 0) finishMagazineReload(s, def);
}

/** CS 1.6 shotgun: pulling the trigger mid-reload stops it and fires the shells already loaded. */
function interruptShellReload(s: PlayerState, def: WeaponDef, attack: boolean): void {
  if (def.reloadTiming?.kind !== 'shells' || s.reload === 0) return;
  if (!attack || s.attackHeld || s.mag[def.id] <= 0) return;
  if (s.deploy === 0 && s.tick >= s.nextFire) s.reload = 0;
}

export function slotWeapon(s: PlayerState, req: number): WeaponId | -1 {
  switch (req) {
    case 1:
      return s.primary;
    case 2:
      return WEAPON.PISTOL;
    case 3:
      return WEAPON.HAMMER;
    case 4:
      return s.lastWeapon;
    default:
      return -1;
  }
}

/** Wheel order, the same as the number keys: primary, pistol, hammer. */
export type WeaponCycleDirection = 'next' | 'previous';

/** The slot request (1 to 3) that steps the wheel from the weapon in hand, wrapping around. */
export function cycleWeaponSlot(s: Pick<PlayerState, 'primary' | 'weapon'>, direction: WeaponCycleDirection): 1 | 2 | 3 {
  const order = [s.primary, WEAPON.PISTOL, WEAPON.HAMMER];
  const here = Math.max(0, order.indexOf(s.weapon));
  const to = (here + (direction === 'next' ? 1 : 2)) % 3;
  return to === 0 ? 1 : to === 1 ? 2 : 3;
}

function switchWeapon(s: PlayerState, req: number): void {
  const target = slotWeapon(s, req);
  if (target === -1 || target === s.weapon) return;
  if (target !== WEAPON.HAMMER && target !== WEAPON.PISTOL && target !== s.primary) return;
  s.lastWeapon = s.weapon;
  s.weapon = target;
  s.deploy = weaponDef(target).deployTicks;
  s.reload = 0;
  s.zoom = 0;
  s.resumeZoom = 0;
  s.aiming = false;
}

function fire(s: PlayerState, def: WeaponDef, seedBase: number, heavy: boolean): ShotInfo {
  const eye = eyePosition(s);
  const [rp, ry] = recoilOffset(def, s.recoil);
  const spread = def.slot === 3 ? 0 : computeSpread(s, def);
  const yaw = s.yaw + ry;
  const pitch = clamp(s.pitch + rp, -MAX_PITCH, MAX_PITCH);
  const f = dirFromAngles(yaw, pitch);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const rx = cy;
  const rz = -sy;
  const ux = sy * sp;
  const uy = cp;
  const uz = cy * sp;
  const rng = mulberry32(hashSeed(seedBase, s.tick));
  const dirs: number[] = [];
  for (let i = 0; i < def.pellets; i++) {
    const a = (rng() + rng() - 1) * spread;
    const b = (rng() + rng() - 1) * spread;
    let dx = f.x + rx * a + ux * b;
    let dy = f.y + uy * b;
    let dz = f.z + rz * a + uz * b;
    const len = Math.hypot(dx, dy, dz);
    dx /= len;
    dy /= len;
    dz /= len;
    dirs.push(dx, dy, dz);
  }
  s.recoil += 1;
  s.lastFire = s.tick;
  s.protect = 0;
  if (def.csSniper && s.zoom > 0) {
    // CS: the scope drops while you work the bolt, then comes back on its own
    s.resumeZoom = s.zoom;
    s.zoom = 0;
  }
  return { weapon: def.id, heavy, ox: eye.x, oy: eye.y, oz: eye.z, dirs, tick: s.tick };
}

function weaponTick(s: PlayerState, buttons: number, seedBase: number): ShotInfo | null {
  const def = weaponDef(s.weapon);
  const attack = (buttons & BTN.ATTACK) !== 0;
  const attack2 = (buttons & BTN.ATTACK2) !== 0;
  let shot: ShotInfo | null = null;

  if (s.deploy > 0) s.deploy--;
  if (s.reload > 0) reloadTick(s, def);
  if (s.recoil > 0 && s.tick - s.lastFire > def.fireTicks + 1) {
    s.recoil = Math.max(0, s.recoil - def.recoil.recovery * TICK_DT);
  }

  if (s.resumeZoom > 0 && s.tick >= s.nextFire && s.deploy === 0 && s.reload === 0) {
    s.zoom = s.resumeZoom;
    s.resumeZoom = 0;
  }
  if (attack2 && !s.attack2Held && def.zoomFov.length > 0 && !s.sprinting && s.deploy === 0 && s.reload === 0) {
    if (s.resumeZoom > 0) s.resumeZoom = 0; // right-click during the bolt cancels the re-scope
    else s.zoom = (s.zoom + 1) % (def.zoomFov.length + 1);
  }
  if (buttons & BTN.RELOAD) startReload(s, def);
  interruptShellReload(s, def, attack);
  s.aiming = aimHeld(s, buttons) && !s.sprinting;

  const ready = !s.dropping && !s.sprinting && s.deploy === 0 && s.reload === 0 && s.tick >= s.nextFire;
  if (def.slot === 3) {
    if (ready && (attack || attack2)) {
      const heavy = attack2 && !attack && !!def.heavy;
      s.nextFire = s.tick + (heavy && def.heavy ? def.heavy.ticks : def.fireTicks);
      shot = fire(s, def, seedBase, heavy);
    }
  } else if (attack && ready && (def.auto || !s.attackHeld)) {
    if (s.mag[def.id] > 0) {
      s.mag[def.id]--;
      s.nextFire = s.tick + def.fireTicks;
      shot = fire(s, def, seedBase, false);
    } else if (s.reserve[def.id] > 0) {
      startReload(s, def);
    } else {
      s.nextFire = s.tick + 15;
    }
  }

  s.attackHeld = attack;
  s.attack2Held = attack2;
  if (s.protect > 0) s.protect--;
  return shot;
}

/**
 * Advances one player by exactly one command (1/60 s). This function is the
 * single source of truth: the server runs it authoritatively and the client
 * runs it for prediction and replays it after every snapshot.
 */
export function applyCmd(w: CollisionWorld, s: PlayerState, cmd: Cmd, seedBase: number): ShotInfo | null {
  s.tick++;
  s.yaw = wrapAngle(cmd.yaw);
  s.pitch = clamp(cmd.pitch, -MAX_PITCH, MAX_PITCH);
  if (cmd.weapon) switchWeapon(s, cmd.weapon);
  playerMove(w, s, cmd.buttons, TICK_DT);
  return weaponTick(s, cmd.buttons, seedBase);
}

// ---------------------------------------------------------------- hitboxes

export const ZONE_HEAD = 0;
export const ZONE_BODY = 1;
export const ZONE_LEGS = 2;
export const ZONE_MULT = [4, 1, 0.75];

/** Head / body / legs AABBs at feet position; a lean moves the head and body sideways, the legs stay. */
export function hitboxes(x: number, y: number, z: number, stance: Stance, lean: number, yaw: number): number[][] {
  const def = STANCES[stance];
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  const box = (b: BodyBox, shift: number): number[] => {
    const cx = x + rx * shift;
    const cz = z + rz * shift;
    return [cx - b.half, y + b.y0, cz - b.half, cx + b.half, y + b.y1, cz + b.half];
  };
  return [box(def.head, LEAN_HEAD_SHIFT_UNITS * lean), box(def.body, LEAN_BODY_SHIFT_UNITS * lean), box(def.legs, 0)];
}

export function rayHitbox(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  x: number,
  y: number,
  z: number,
  stance: Stance,
  lean: number,
  yaw: number,
  maxDist: number,
): { t: number; zone: number } | null {
  // cheap reject against the whole hull first, widened so a leaned head is not cut off
  const r = PLAYER_RADIUS + Math.abs(lean) * LEAN_HEAD_SHIFT_UNITS;
  const top = y + STANCES[stance].head.y1;
  if (rayAabb(ox, oy, oz, dx, dy, dz, x - r, y, z - r, x + r, top, z + r, maxDist) < 0) return null;
  let best: { t: number; zone: number } | null = null;
  const boxes = hitboxes(x, y, z, stance, lean, yaw);
  for (let zone = 0; zone < 3; zone++) {
    const b = boxes[zone];
    const t = rayAabb(ox, oy, oz, dx, dy, dz, b[0], b[1], b[2], b[3], b[4], b[5], maxDist);
    if (t >= 0 && (!best || t < best.t)) best = { t, zone };
  }
  return best;
}
