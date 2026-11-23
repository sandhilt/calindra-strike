import { RF_DROP, RF_SLIDE, RF_SPRINT, RF_ZOOM, stanceFromFlags, TICK_MS, type WeaponId, weaponDef } from '@calindra-strike/shared';
import type { ViewPose } from './viewmodel.ts';

/** What a snapshot says about the followed player's hands. */
export interface FollowedFrame {
  weapon: WeaponId;
  flags: number;
  speed: number;
  onGround: boolean;
  /** Ticks since their reload began and the rounds it loads, timed locally from the reload flag (-1 when not reloading). */
  reloadElapsed: number;
  reloadShells: number;
}

/**
 * Snapshots carry no reload or deploy progress, so the spectator view times
 * the deploy locally from the moment the weapon changes. The reload clock
 * lives with the player's reload sounds and arrives in the frame.
 */
export class FollowedViewTracker {
  private targetId = -1;
  private weapon: WeaponId | -1 = -1;
  private weaponSince = 0;

  /** Pose for the viewmodel, with the weapon to hold. Resets when the target changes. */
  pose(id: number, f: FollowedFrame, nowMs: number, dt: number): ViewPose & { weapon: WeaponId } {
    const def = weaponDef(f.weapon);
    const switched = id !== this.targetId;
    if (switched) {
      this.targetId = id;
      this.weapon = f.weapon;
      this.weaponSince = -Infinity;
    } else if (f.weapon !== this.weapon) {
      this.weapon = f.weapon;
      this.weaponSince = nowMs;
    }

    const deploy = def.deployTicks > 0 ? Math.min(1, (nowMs - this.weaponSince) / (def.deployTicks * TICK_MS)) : -1;
    return {
      weapon: f.weapon,
      dt,
      speed: f.speed,
      stance: stanceFromFlags(f.flags),
      sprinting: (f.flags & RF_SPRINT) !== 0,
      sliding: (f.flags & RF_SLIDE) !== 0,
      firing: false,
      onGround: f.onGround,
      lookDX: 0,
      lookDY: 0,
      reloadElapsed: f.reloadElapsed,
      reloadShells: f.reloadShells,
      deployFrac: deploy >= 1 ? -1 : deploy,
      hidden: (f.flags & (RF_ZOOM | RF_DROP)) !== 0,
    };
  }
}
