import { type DebrisSpec, GRAVITY_UNITS_PER_S2 } from './fx-tuning.ts';
import { oldestIndex, swapRemove } from './fx-pool.ts';

/** Height of the floor under a point, probed from `y`. */
export type GroundAt = (x: number, y: number, z: number) => number;

export interface DebrisBody {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  wx: number;
  wy: number;
  wz: number;
  scale: number;
  variant: number;
  age: number;
  landed: boolean;
  /** Seconds since it came to rest. */
  landedFor: number;
}

const HALF_PI = Math.PI / 2;
/** How far above the body the floor probe starts, so a body just inside a floor slab still finds it. */
const FLOOR_PROBE_UNITS = 8;
/** Per second, how fast a landed body eases onto its side. */
const LIE_DOWN_RATE_PER_S = 14;
/** Slide speed under which a landed body stops. */
const STOP_SPEED_UNITS_PER_S = 4;
/** A landed body falls again when the floor drops more than this beneath it. */
const LEDGE_DROP_UNITS = 1;

/** Scale 1 while it lies at full size, then down to 0 over the shrink time. */
export function debrisFade(spec: DebrisSpec, landedFor: number): number {
  const over = landedFor - spec.holdSeconds;
  if (over <= 0) return 1;
  return Math.max(0, 1 - over / spec.shrinkSeconds);
}

export function debrisExpired(spec: DebrisSpec, body: DebrisBody): boolean {
  return body.age > spec.maxAgeSeconds || debrisFade(spec, body.landedFor) <= 0;
}

function blankBody(): DebrisBody {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0, scale: 1, variant: 0, age: 0, landed: false, landedFor: 0 };
}

/** Fixed-size pool of tumbling bodies that fall, bounce, lie on the floor for a while and shrink away. */
export class DebrisPool {
  readonly bodies: DebrisBody[] = [];
  readonly spec: DebrisSpec;
  private live = 0;
  private cap: number;
  private readonly random: () => number;

  constructor(spec: DebrisSpec, capacity: number, random: () => number) {
    this.spec = spec;
    this.cap = capacity;
    this.random = random;
    for (let i = 0; i < capacity; i++) this.bodies.push(blankBody());
  }

  get count(): number {
    return this.live;
  }

  /** Lowers or raises the live cap up to the size the pool was built with; the oldest bodies go first. */
  setCapacity(capacity: number): void {
    this.cap = Math.min(capacity, this.bodies.length);
    while (this.live > this.cap) this.live = swapRemove(this.bodies, oldestIndex(this.bodies, this.live), this.live);
  }

  clear(): void {
    this.live = 0;
  }

  spawn(x: number, y: number, z: number, vx: number, vy: number, vz: number, variant = 0, scale = 1): void {
    if (this.cap === 0) return;
    if (this.live >= this.cap) this.live = swapRemove(this.bodies, oldestIndex(this.bodies, this.live), this.live);
    const b = this.bodies[this.live++];
    const spin = this.spec.spinRadPerS;
    const r = this.random;
    b.x = x;
    b.y = y;
    b.z = z;
    b.vx = vx;
    b.vy = vy;
    b.vz = vz;
    b.rx = r() * Math.PI * 2;
    b.ry = r() * Math.PI * 2;
    b.rz = r() * Math.PI * 2;
    b.wx = (r() * 2 - 1) * spin;
    b.wy = (r() * 2 - 1) * spin;
    b.wz = (r() * 2 - 1) * spin;
    b.scale = scale;
    b.variant = variant;
    b.age = 0;
    b.landed = false;
    b.landedFor = 0;
  }

  step(dt: number, groundAt: GroundAt): void {
    for (let i = this.live - 1; i >= 0; i--) {
      const b = this.bodies[i];
      b.age += dt;
      if (b.landed) this.restOn(b, dt, groundAt);
      else this.fall(b, dt, groundAt);
      if (debrisExpired(this.spec, b)) this.live = swapRemove(this.bodies, i, this.live);
    }
  }

  private fall(b: DebrisBody, dt: number, groundAt: GroundAt): void {
    const spec = this.spec;
    b.vy -= GRAVITY_UNITS_PER_S2 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    b.rx += b.wx * dt;
    b.ry += b.wy * dt;
    b.rz += b.wz * dt;
    const rest = spec.halfHeightUnits * b.scale;
    const floor = groundAt(b.x, b.y + FLOOR_PROBE_UNITS, b.z);
    if (b.vy > 0 || b.y - rest > floor) return;
    b.y = floor + rest;
    if (-b.vy > spec.settleSpeedUnitsPerS) {
      b.vy = -b.vy * spec.bounce;
      b.vx *= spec.bounceFriction;
      b.vz *= spec.bounceFriction;
      b.wx *= spec.bounceFriction;
      b.wy *= spec.bounceFriction;
      b.wz *= spec.bounceFriction;
      return;
    }
    b.vy = 0;
    b.landed = true;
    b.wx = b.wy = b.wz = 0;
  }

  private restOn(b: DebrisBody, dt: number, groundAt: GroundAt): void {
    const spec = this.spec;
    b.landedFor += dt;
    const ease = Math.min(1, dt * LIE_DOWN_RATE_PER_S);
    b.rx += (Math.round((b.rx - HALF_PI) / Math.PI) * Math.PI + HALF_PI - b.rx) * ease;
    b.rz += (Math.round(b.rz / Math.PI) * Math.PI - b.rz) * ease;
    if (b.vx === 0 && b.vz === 0) return;
    const drag = Math.exp(-spec.slideDragPerS * dt);
    b.vx *= drag;
    b.vz *= drag;
    if (Math.hypot(b.vx, b.vz) < STOP_SPEED_UNITS_PER_S) b.vx = b.vz = 0;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    const rest = spec.halfHeightUnits * b.scale;
    const floor = groundAt(b.x, b.y + FLOOR_PROBE_UNITS, b.z);
    if (floor < b.y - rest - LEDGE_DROP_UNITS) {
      b.landed = false;
      b.landedFor = 0;
      return;
    }
    b.y = floor + rest;
  }
}
