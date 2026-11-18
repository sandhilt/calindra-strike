import { type ReloadCue, type ReloadCueAt, type WeaponDef, reloadCues, reloadTotalTicks } from '@calindra-strike/shared';

/**
 * One reload as the client plays it: when it began, how many rounds it loads
 * and which of its sounds are still to come. Time is counted in ticks, so the
 * local player feeds it the simulation tick and other players' reloads feed it
 * wall-clock time converted to ticks.
 */
export class ReloadPlayback {
  private def: WeaponDef | null = null;
  private cues: ReloadCueAt[] = [];
  private nextCue = 0;
  private origin = 0;
  private plannedShells = 0;

  get active(): boolean {
    return this.def !== null;
  }

  /** Rounds this reload loads; the shotgun animation loops once per round. */
  get shells(): number {
    return this.plannedShells;
  }

  begin(def: WeaponDef, shells: number, nowTicks: number): void {
    if (!def.reloadTiming) return;
    this.def = def;
    this.plannedShells = shells;
    this.cues = reloadCues(def.reloadTiming, shells);
    this.nextCue = 0;
    this.origin = nowTicks;
  }

  end(): void {
    this.def = null;
    this.cues = [];
    this.nextCue = 0;
  }

  /** Ticks since the reload began, or -1 when none is playing. */
  elapsed(nowTicks: number): number {
    return this.def ? Math.max(0, nowTicks - this.origin) : -1;
  }

  /** 0..1 over the planned reload, or -1 when none is playing. */
  progress(nowTicks: number): number {
    if (!this.def?.reloadTiming) return -1;
    return Math.min(1, this.elapsed(nowTicks) / reloadTotalTicks(this.def.reloadTiming, this.plannedShells));
  }

  /** Sounds that have come due since the last call, in order. */
  due(nowTicks: number): ReloadCue[] {
    const elapsed = this.elapsed(nowTicks);
    const due: ReloadCue[] = [];
    while (this.nextCue < this.cues.length && this.cues[this.nextCue].tick <= elapsed) due.push(this.cues[this.nextCue++].cue);
    return due;
  }

  /**
   * Follows another player's reload from the one thing their snapshots say:
   * whether the flag is on. Their ammo is unknown, so a shotgun is assumed to
   * load a full magazine and simply stops when the flag drops.
   */
  follow(reloading: boolean, def: WeaponDef, nowTicks: number): void {
    if (!reloading) {
      if (this.def) this.end();
      return;
    }
    if (this.def?.id !== def.id) this.begin(def, def.mag, nowTicks);
  }
}
