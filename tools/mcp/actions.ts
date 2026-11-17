import { BTN, weaponDef, type Cmd, type PlayerState } from '../../shared/src/index.ts';

export const WEAPON_SLOT_REQUEST = { primary: 1, pistol: 2, hammer: 3, last: 4 } as const;
export type WeaponSlot = keyof typeof WEAPON_SLOT_REQUEST;
type WeaponRequest = (typeof WEAPON_SLOT_REQUEST)[WeaponSlot];

/**
 * Agent-controlled keys on top of the bot brain's cmd: latched crouch and walk,
 * one-shot jump, reload and weapon switch, and a manual scope level that
 * replaces the brain's auto-scope.
 */
export class ActionOverlay {
  crouch = false;
  walk = false;
  /** null leaves the bot's auto-scope alone, 0 forces it off, 1..n is the wanted level. */
  zoom: number | null = null;
  /** Last cmd seq the server reports as processed (snapshot `ack`). */
  ack = 0;
  private jumpPending = false;
  private reloadPending = false;
  private weaponPending: WeaponRequest | null = null;
  /** Seq of the last scope press; the snapshot only shows its effect once `ack` reaches it. */
  private pressSeq = 0;

  requestJump(): void {
    this.jumpPending = true;
  }

  requestReload(): void {
    this.reloadPending = true;
  }

  requestWeapon(request: WeaponRequest): void {
    this.weaponPending = request;
  }

  reset(): void {
    this.walk = false;
    this.reloadPending = false;
    this.weaponPending = null;
    this.crouch = false;
    this.zoom = null;
    this.jumpPending = false;
    this.pressSeq = 0;
    this.ack = 0;
  }

  apply(cmd: Cmd, self: PlayerState | null): Cmd {
    let buttons = cmd.buttons;
    if (this.walk) buttons |= BTN.WALK;
    if (this.reloadPending) {
      buttons |= BTN.RELOAD;
      this.reloadPending = false;
    }
    const weapon = this.weaponPending ?? cmd.weapon;
    this.weaponPending = null;
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
    return { ...cmd, buttons, weapon };
  }

  private needsScopePress(self: PlayerState, wanted: number): boolean {
    if (weaponDef(self.weapon).zoomFov.length === 0) return false;
    // AWP bolt cycle: the scope returns by itself, a press only cancels that.
    if (self.resumeZoom > 0) return wanted === 0;
    return self.zoom !== wanted;
  }
}
