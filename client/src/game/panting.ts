/** Seconds per breath (in and out) while winded, tuning value. */
const WINDED_BREATH_S = 0.9;
/** After the meter recovers the breathing slows to this and fades out over RECOVERY_S, tuning values. */
const RECOVERY_BREATH_S = 1.5;
const RECOVERY_S = 3;

export type Breath = 'in' | 'out';

/** Deep, quick breaths while the sprint meter is spent, slowing down for a few seconds once it recovers. */
export class Panting {
  private phase = 0;
  private sinceWinded = Infinity;
  private next: Breath = 'in';

  /** Advances by `dt` seconds and returns the breath that starts now, with its loudness (0 to 1), or null. */
  step(dt: number, winded: boolean, alive: boolean): { breath: Breath; loud: number } | null {
    if (!alive) {
      this.reset();
      return null;
    }
    this.sinceWinded = winded ? 0 : this.sinceWinded + dt;
    if (this.sinceWinded >= RECOVERY_S) {
      this.reset(this.sinceWinded);
      return null;
    }
    const loud = winded ? 1 : 1 - this.sinceWinded / RECOVERY_S;
    const half = (winded ? WINDED_BREATH_S : RECOVERY_BREATH_S) / 2;
    const fresh = this.phase === 0;
    this.phase += dt;
    if (!fresh && this.phase < half) return null;
    this.phase = fresh ? dt : this.phase - half;
    const breath = this.next;
    this.next = breath === 'in' ? 'out' : 'in';
    return { breath, loud };
  }

  private reset(since = Infinity): void {
    this.phase = 0;
    this.sinceWinded = since;
    this.next = 'in';
  }
}
