import { IMPACT_DUST, type SmokeStyle } from './fx-tuning.ts';
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
  /** Where in its sideways curl this puff starts, in radians. */
  swayPhase: number;
}

/** Opacity over a puff's life: a quick fade in, then an ease out to nothing. t runs 0..1. */
export function smokeAlpha(t: number, alphaPeak: number, attackShare: number): number {
  if (t <= 0 || t >= 1) return 0;
  if (t < attackShare) return alphaPeak * (t / attackShare);
  const u = (t - attackShare) / (1 - attackShare);
  return alphaPeak * (1 - u) * (1 - u);
}

/** Puff diameter in world units; it swells fast and then slows. */
export function smokeSize(p: Puff): number {
  const t = Math.min(1, p.age / p.life);
  return p.sizeStartUnits + (p.sizeEndUnits - p.sizeStartUnits) * Math.sqrt(t);
}

/** Puffs one shot lets out at this heat. */
export function puffsForHeat(heat: number, style: SmokeStyle): number {
  let n = 1;
  for (const [from, puffs] of style.puffsByHeat) if (heat >= from) n = puffs;
  return n;
}

/** Barrel heat per shooter, 0..1. It decays lazily from timestamps, so nothing runs per frame. */
export class HeatTracker {
  private readonly shooters = new Map<number, { value: number; at: number }>();

  /** Registers a shot and returns the heat after it. `nowSeconds` is any monotonic clock. */
  shot(shooter: number, nowSeconds: number, heatPerShot: number, decayPerS: number): number {
    const entry = this.shooters.get(shooter);
    const before = entry ? Math.max(0, entry.value - decayPerS * (nowSeconds - entry.at)) : 0;
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
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, sizeStartUnits: 1, sizeEndUnits: 1, alphaPeak: 0, swayPhase: 0 };
}

const between = (range: readonly [number, number], t: number): number => range[0] + (range[1] - range[0]) * t;

/** Fixed-size pool of drifting smoke puffs, shaped by the current quality's style. */
export class SmokePool {
  readonly puffs: Puff[] = [];
  private live = 0;
  private cap: number;
  private readonly random: () => number;
  style: SmokeStyle;

  constructor(capacity: number, random: () => number, style: SmokeStyle) {
    this.cap = capacity;
    this.random = random;
    this.style = style;
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

  private take(): Puff | null {
    if (this.cap === 0) return null;
    if (this.live >= this.cap) this.live = swapRemove(this.puffs, oldestIndex(this.puffs, this.live), this.live);
    const p = this.puffs[this.live++];
    p.age = 0;
    p.swayPhase = this.random() * Math.PI * 2;
    return p;
  }

  /** One puff leaving the muzzle along the unit vector (dx, dy, dz). */
  emit(x: number, y: number, z: number, dx: number, dy: number, dz: number, heat: number, sizeScale: number): void {
    const p = this.take();
    if (!p) return;
    const s = this.style;
    const r = this.random;
    const speed = between(s.forwardSpeedUnitsPerS, r());
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = dx * speed + (r() * 2 - 1) * s.jitterUnitsPerS;
    p.vy = dy * speed + s.riseSpeedUnitsPerS + (r() * 2 - 1) * s.jitterUnitsPerS;
    p.vz = dz * speed + (r() * 2 - 1) * s.jitterUnitsPerS;
    p.life = between(s.lifeSeconds, r()) * (1 + s.lifeHeatBonus * heat);
    p.sizeStartUnits = between(s.startSizeUnits, r()) * sizeScale;
    p.sizeEndUnits = p.sizeStartUnits + (s.growthUnits + s.growthHeatUnits * heat) * sizeScale;
    p.alphaPeak = s.alphaCalm + (s.alphaHot - s.alphaCalm) * heat;
  }

  /** Dust blown off a surface a bullet hit, along its unit normal (nx, ny, nz). */
  emitDust(x: number, y: number, z: number, nx: number, ny: number, nz: number): void {
    const p = this.take();
    if (!p) return;
    const s = this.style;
    const r = this.random;
    const speed = between(IMPACT_DUST.speedUnitsPerS, r());
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = nx * speed + (r() * 2 - 1) * s.jitterUnitsPerS;
    p.vy = ny * speed + s.riseSpeedUnitsPerS * 0.5 + (r() * 2 - 1) * s.jitterUnitsPerS;
    p.vz = nz * speed + (r() * 2 - 1) * s.jitterUnitsPerS;
    p.life = between(IMPACT_DUST.lifeSeconds, r());
    p.sizeStartUnits = between(IMPACT_DUST.startSizeUnits, r());
    p.sizeEndUnits = p.sizeStartUnits + IMPACT_DUST.growthUnits;
    p.alphaPeak = IMPACT_DUST.alpha;
  }

  step(dt: number): void {
    const s = this.style;
    const drag = Math.exp(-s.dragPerS * dt);
    const sway = s.swayAccelUnitsPerS2 * dt;
    for (let i = this.live - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.live = swapRemove(this.puffs, i, this.live);
        continue;
      }
      const curl = p.swayPhase + p.age * s.swayHz * Math.PI * 2;
      p.vx = p.vx * drag + Math.cos(curl) * sway;
      p.vy *= drag;
      p.vz = p.vz * drag + Math.sin(curl) * sway;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
    }
  }
}
