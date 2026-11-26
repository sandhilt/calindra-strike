/** How long a shot duct keeps leaking (s). */
export const DUCT_LEAK_SECONDS = 2;
/** Puffs a leak gives off per second while it lasts, tuning value. */
const PUFFS_PER_SECOND = 10;
/** Leaks running at once; a new one replaces the oldest. */
const MAX_LEAKS = 6;

interface Leak { x: number; y: number; z: number; nx: number; ny: number; nz: number; age: number; owed: number }

export type EmitPuff = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => void;

/** Bullet holes in the air conditioning ducts, each hissing a thin stream of air for two seconds. */
export class DuctLeaks {
  private readonly leaks: Leak[] = [];

  get active(): number {
    return this.leaks.length;
  }

  open(x: number, y: number, z: number, nx: number, ny: number, nz: number): void {
    if (this.leaks.length >= MAX_LEAKS) this.leaks.shift();
    this.leaks.push({ x, y, z, nx, ny, nz, age: 0, owed: 1 });
  }

  step(dt: number, emit: EmitPuff): void {
    for (let i = this.leaks.length - 1; i >= 0; i--) {
      const l = this.leaks[i];
      const live = Math.min(dt, DUCT_LEAK_SECONDS - l.age);
      l.age += dt;
      l.owed += Math.max(0, live) * PUFFS_PER_SECOND;
      for (; l.owed >= 1; l.owed--) emit(l.x, l.y, l.z, l.nx, l.ny, l.nz);
      if (l.age >= DUCT_LEAK_SECONDS) this.leaks.splice(i, 1);
    }
  }

  clear(): void {
    this.leaks.length = 0;
  }
}
