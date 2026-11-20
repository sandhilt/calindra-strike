import { BTN, TICK_MS, WEAPON, weaponDef, type Cmd, type PlayerState, type WeaponId } from '../../shared/src/index.ts';

export const WEAPON_SLOT_REQUEST = { primary: 1, pistol: 2, hammer: 3, last: 4 } as const;
export type WeaponSlot = keyof typeof WEAPON_SLOT_REQUEST;
type WeaponRequest = (typeof WEAPON_SLOT_REQUEST)[WeaponSlot];

export function weaponSlots(self: PlayerState): {
  primary: WeaponId; pistol: WeaponId; hammer: WeaponId; last: WeaponId | null;
} {
  const last = self.lastWeapon;
  return {
    primary: self.primary,
    pistol: WEAPON.PISTOL,
    hammer: WEAPON.HAMMER,
    last: last !== self.weapon && (last === WEAPON.HAMMER || last === WEAPON.PISTOL || last === self.primary)
      ? last : null,
  };
}

/**
 * Agent-controlled keys on top of the bot brain's cmd: latched crouch and walk,
 * one-shot jump, reload and weapon switch, a manual scope level that
 * replaces the brain's auto-scope, and a held free aim with timed fire.
 */
export class ActionOverlay {
  use = false;
  crouch = false;
  walk = false;
  /** null leaves the bot's auto-scope alone, 0 forces it off, 1..n is the wanted level. */
  zoom: number | null = null;
  /** Where the agent holds the crosshair, in radians; replaces the view the brain wanted until cleared. */
  aim: { yaw: number; pitch: number } | null = null;
  private fireTicks = 0;
  /** Last cmd seq the server reports as processed (snapshot `ack`). */
  ack = 0;
  private jumpPending = false;
  private reloadPending = false;
  private weaponPending: WeaponRequest | null = null;
  /** Seq of the last scope press; the snapshot only shows its effect once `ack` reaches it. */
  private pressSeq = 0;
  private weaponSeq = 0;

  requestJump(): void {
    this.jumpPending = true;
  }

  requestReload(): void {
    this.reloadPending = true;
  }

  /** Holds the trigger for `ms`, rounded up to whole commands so even a short burst presses at least once. */
  requestFire(ms: number): void {
    this.fireTicks = Math.max(1, Math.ceil(ms / TICK_MS));
  }

  requestWeapon(request: WeaponRequest): void {
    this.weaponPending = request;
  }

  reset(): void {
    this.use = false;
    this.walk = false;
    this.aim = null;
    this.fireTicks = 0;
    this.reloadPending = false;
    this.weaponPending = null;
    this.crouch = false;
    this.zoom = null;
    this.jumpPending = false;
    this.pressSeq = 0;
    this.weaponSeq = 0;
    this.ack = 0;
  }

  apply(cmd: Cmd, self: PlayerState | null): Cmd {
    let buttons = cmd.buttons;
    if (this.walk) buttons |= BTN.WALK;
    if (this.reloadPending) {
      buttons |= BTN.RELOAD;
      this.reloadPending = false;
    }
    let weapon = this.ack < this.weaponSeq ? 0 : cmd.weapon;
    if (this.weaponPending !== null) {
      weapon = this.weaponPending;
      this.weaponSeq = cmd.seq;
      this.weaponPending = null;
    }
    if (this.crouch) buttons |= BTN.DUCK;
    if (this.jumpPending) {
      this.jumpPending = false;
      if (self?.onGround) buttons |= BTN.JUMP;
    }
    if (this.zoom !== null) {
      buttons &= ~BTN.ATTACK2;
      if (self && this.ack >= this.pressSeq && this.needsScopePress(self, this.zoom)) {
        buttons |= BTN.ATTACK2;
        this.pressSeq = cmd.seq;
      }
    }
    if (this.fireTicks > 0 && self && self.health > 0 && !self.dropping) {
      buttons |= BTN.ATTACK;
      this.fireTicks--;
    }
    if (this.use && self && self.health > 0 && !self.dropping) {
      buttons &= ~(BTN.FWD | BTN.BACK | BTN.LEFT | BTN.RIGHT | BTN.JUMP | BTN.ATTACK | BTN.ATTACK2);
      buttons |= BTN.USE;
    }
    return this.aim ? { ...cmd, buttons, weapon, yaw: this.aim.yaw, pitch: this.aim.pitch } : { ...cmd, buttons, weapon };
  }

  private needsScopePress(self: PlayerState, wanted: number): boolean {
    if (weaponDef(self.weapon).zoomFov.length === 0) return false;
    // AWP bolt cycle: the scope returns by itself, a press only cancels that.
    if (self.resumeZoom > 0) return wanted === 0;
    return self.zoom !== wanted;
  }
}
