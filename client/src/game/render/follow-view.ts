import { RF_DROP, RF_RELOAD, RF_ZOOM, TICK_MS, type WeaponId, weaponDef } from '@calindra-strike/shared';
import type { ViewPose } from './viewmodel.ts';

/** What a snapshot says about the followed player's hands. */
export interface FollowedFrame {
  weapon: WeaponId;
  flags: number;
  speed: number;
  onGround: boolean;
}

/**
 * Snapshots carry no reload or deploy progress, so the spectator view times
 * them locally from the moment the flag or weapon changes.
 */
export class FollowedViewTracker {
  private targetId = -1;
  private weapon: WeaponId | -1 = -1;
  private weaponSince = 0;
  private reloadSince = -1;

  /** Pose for the viewmodel, with the weapon to hold. Resets when the target changes. */
  pose(id: number, f: FollowedFrame, nowMs: number, dt: number): ViewPose & { weapon: WeaponId } {
    const def = weaponDef(f.weapon);
    const switched = id !== this.targetId;
    if (switched) {
      this.targetId = id;
      this.weapon = f.weapon;
      this.weaponSince = -Infinity;
      this.reloadSince = -1;
    } else if (f.weapon !== this.weapon) {
      this.weapon = f.weapon;
      this.weaponSince = nowMs;
    }
    const reloading = (f.flags & RF_RELOAD) !== 0;
    if (!reloading) this.reloadSince = -1;
    else if (this.reloadSince < 0) this.reloadSince = nowMs;

    const progress = (since: number, ticks: number) => (ticks > 0 ? Math.min(1, (nowMs - since) / (ticks * TICK_MS)) : -1);
    const deploy = progress(this.weaponSince, def.deployTicks);
    return {
      weapon: f.weapon,
      dt,
      speed: f.speed,
      onGround: f.onGround,
      lookDX: 0,
      lookDY: 0,
      reloadFrac: reloading ? progress(this.reloadSince, def.reloadTicks) : -1,
      deployFrac: deploy >= 1 ? -1 : deploy,
      hidden: (f.flags & (RF_ZOOM | RF_DROP)) !== 0,
    };
  }
}
