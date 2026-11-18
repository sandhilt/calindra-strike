import { SMOKE } from './fx-tuning.ts';
import type { FxProfile } from './quality.ts';
import { oldestIndex, swapRemove } from './fx-pool.ts';

export interface Puff {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  sizeStartUnits: number;
  sizeEndUnits: number;
  alphaPeak: number;
}

/** Opacity over a puff's life: a quick fade in, then an ease out to nothing. t runs 0..1. */
export function smokeAlpha(t: number, alphaPeak: number): number {
  if (t <= 0 || t >= 1) return 0;
  if (t < SMOKE.attackShare) return alphaPeak * (t / SMOKE.attackShare);
  const u = (t - SMOKE.attackShare) / (1 - SMOKE.attackShare);
  return alphaPeak * (1 - u) * (1 - u);
}

/** Puff diameter in world units; it swells fast and then slows. */
export function smokeSize(p: Puff): number {
  const t = Math.min(1, p.age / p.life);
  return p.sizeStartUnits + (p.sizeEndUnits - p.sizeStartUnits) * Math.sqrt(t);
}

/** Puffs one shot lets out at this heat. */
export function puffsForHeat(heat: number, steps: FxProfile['puffsByHeat']): number {
  let n = 0;
  for (const [from, puffs] of steps) if (heat >= from) n = puffs;
  return n;
}

/** Barrel heat per shooter, 0..1. It decays lazily from timestamps, so nothing runs per frame. */
export class HeatTracker {
  private readonly shooters = new Map<number, { value: number; at: number }>();

  /** Registers a shot and returns the heat after it. `nowSeconds` is any monotonic clock. */
  shot(shooter: number, nowSeconds: number, heatPerShot: number): number {
    const entry = this.shooters.get(shooter);
    const before = entry ? Math.max(0, entry.value - SMOKE.heatDecayPerS * (nowSeconds - entry.at)) : 0;
    const value = Math.min(1, before + heatPerShot);
    if (entry) {
      entry.value = value;
      entry.at = nowSeconds;
    } else this.shooters.set(shooter, { value, at: nowSeconds });
    return value;
  }

  clear(): void {
    this.shooters.clear();
  }
}

function blankPuff(): Puff {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, sizeStartUnits: 1, sizeEndUnits: 1, alphaPeak: 0 };
}

const between = (range: readonly [number, number], t: number): number => range[0] + (range[1] - range[0]) * t;

/** Fixed-size pool of drifting smoke puffs. */
export class SmokePool {
  readonly puffs: Puff[] = [];
  private live = 0;
  private cap: number;
  private readonly random: () => number;

  constructor(capacity: number, random: () => number) {
    this.cap = capacity;
    this.random = random;
    for (let i = 0; i < capacity; i++) this.puffs.push(blankPuff());
  }

  get count(): number {
    return this.live;
  }

  setCapacity(capacity: number): void {
    this.cap = Math.min(capacity, this.puffs.length);
    while (this.live > this.cap) this.live = swapRemove(this.puffs, oldestIndex(this.puffs, this.live), this.live);
  }

  clear(): void {
    this.live = 0;
  }

  /** One puff leaving the muzzle along the unit vector (dx, dy, dz). */
  emit(x: number, y: number, z: number, dx: number, dy: number, dz: number, heat: number, sizeScale: number): void {
    if (this.cap === 0) return;
    if (this.live >= this.cap) this.live = swapRemove(this.puffs, oldestIndex(this.puffs, this.live), this.live);
    const p = this.puffs[this.live++];
    const r = this.random;
    const speed = between(SMOKE.forwardSpeedUnitsPerS, r());
    const jitter = SMOKE.jitterUnitsPerS;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = dx * speed + (r() * 2 - 1) * jitter;
    p.vy = dy * speed + SMOKE.riseSpeedUnitsPerS + (r() * 2 - 1) * jitter;
    p.vz = dz * speed + (r() * 2 - 1) * jitter;
    p.age = 0;
    p.life = between(SMOKE.lifeSeconds, r()) * (1 + SMOKE.lifeHeatBonus * heat);
    p.sizeStartUnits = between(SMOKE.startSizeUnits, r()) * sizeScale;
    p.sizeEndUnits = p.sizeStartUnits + (SMOKE.growthUnits + SMOKE.growthHeatUnits * heat) * sizeScale;
    p.alphaPeak = SMOKE.alphaCalm + (SMOKE.alphaHot - SMOKE.alphaCalm) * heat;
  }

  step(dt: number): void {
    const drag = Math.exp(-SMOKE.dragPerS * dt);
    for (let i = this.live - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.live = swapRemove(this.puffs, i, this.live);
        continue;
      }
      p.vx *= drag;
      p.vy *= drag;
      p.vz *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
  }
}
