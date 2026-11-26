import {
  BTN, SLIDE_MIN_SPEED, SLIDE_STAMINA_COST, STAMINA_MAX, TICK_MS, WEAPON, slotWeapon, weaponDef,
  type Cmd, type PlayerState, type WeaponId,
} from '../../shared/src/index.ts';

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

const LEAN_BUTTON = { left: BTN.LEAN_LEFT, right: BTN.LEAN_RIGHT, off: 0 } as const;
export type LeanSide = keyof typeof LEAN_BUTTON;
export const LEAN_SIDES: readonly LeanSide[] = Object.keys(LEAN_BUTTON) as LeanSide[];

/** What the agent has asked for, echoed by every action tool and by get_state `you.actions`. */
export interface ActionEcho {
  crouch: boolean;
  walk: boolean;
  /** Requested ADS or scope level. Null leaves automatic scoping in control. */
  zoom: number | null;
  sprint: boolean;
  lean: LeanSide;
  prone: boolean;
}

export const NO_ACTIONS: ActionEcho = { crouch: false, walk: false, zoom: null, sprint: false, lean: 'off', prone: false };

/**
 * Agent-controlled keys on top of the bot brain's cmd: latched crouch, walk, sprint, lean and prone,
 * one-shot jump, slide, reload and weapon switch, held ADS, manual AWP scope, and free aim with timed fire.
 */
export class ActionOverlay {
  use = false;
  crouch = false;
  walk = false;
  sprint = false;
  lean: LeanSide = 'off';
  prone = false;
  /** null leaves the bot's auto-scope alone, 0 forces it off, 1..n is the wanted level. */
  zoom: number | null = null;
  adsZoom: 0 | 1 | null = null;
  /** Where the agent holds the crosshair, in radians; replaces the view the brain wanted until cleared. */
  aim: { yaw: number; pitch: number } | null = null;
  private fireTicks = 0;
  /** The pending trigger hold is the melee alt attack: the right button, and only on a weapon that has one. */
  private heavy = false;
  /** Last cmd seq the server reports as processed (snapshot `ack`). */
  ack = 0;
  private jumpPending = false;
  private slidePending = false;
  private reloadPending = false;
  private weaponPending: WeaponRequest | null = null;
  /** Seq of the last scope press; the snapshot only shows its effect once `ack` reaches it. */
  private pressSeq = 0;
  private weaponSeq = 0;
  private adsSwitchSeq = 0;
  private awaySeq = 0;

  /** A switch to another slot is queued or not yet acknowledged, so a snapshot may still show the hammer. */
  leavingHammer(): boolean {
    const queued = this.weaponPending !== null && this.weaponPending !== WEAPON_SLOT_REQUEST.hammer;
    return queued || this.ack < this.awaySeq;
  }

  get manualWeaponControl(): boolean {
    return this.use || this.reloadPending || this.fireTicks > 0
      || this.weaponPending !== null || this.ack < this.weaponSeq;
  }

  requestJump(): void {
    this.jumpPending = true;
  }

  requestSlide(): void {
    this.slidePending = true;
  }

  /**
   * Why a slide would not start now, or null when it would. Mirrors `tryStartSlide` in the sim, which a test pins:
   * the sim starts one on the tick DUCK is pressed (an edge), so a latched crouch hides the press.
   */
  slideBlocker(self: PlayerState): string | null {
    if (this.crouch) return 'Crouch is latched on, so DUCK is already held and a slide needs a fresh press; call crouch(false) first';
    if (this.prone) return 'Prone is latched on, and a prone player cannot sprint; call prone(false) first';
    if (self.dropping) return 'Player is dropping';
    if (!self.onGround) return 'Not on the ground';
    if (self.slide > 0) return 'Already sliding';
    if (!self.sprinting) return 'Not sprinting; call sprint(true) and move forward (get_state you.sprinting shows it)';
    const speed = Math.hypot(self.vx, self.vz);
    if (speed < SLIDE_MIN_SPEED) return `Too slow: ${Math.round(speed)} units/s, a slide needs ${SLIDE_MIN_SPEED}`;
    if (self.stamina < SLIDE_STAMINA_COST) return `Not enough stamina: ${self.stamina / STAMINA_MAX} of 1, a slide costs ${SLIDE_STAMINA_COST / STAMINA_MAX}`;
    return null;
  }

  /** The latched actions that stop a sprint right now; sprint has no effect until they are off. */
  sprintBlockers(weapon: WeaponId): string[] {
    return [
      this.walk ? 'walk' : '',
      this.crouch ? 'crouch' : '',
      this.prone ? 'prone' : '',
      weaponDef(weapon).ads && this.adsZoom === 1 ? 'zoom' : '',
    ].filter(Boolean);
  }

  echo(weapon?: WeaponId): ActionEcho {
    const zoom = weapon !== undefined && weaponDef(weapon).ads ? this.adsZoom : this.zoom;
    return { crouch: this.crouch, walk: this.walk, zoom, sprint: this.sprint, lean: this.lean, prone: this.prone };
  }

  requestReload(): void {
    this.reloadPending = true;
  }

  /**
   * Holds the trigger for `ms`, rounded up to whole commands so even a short burst presses at least once.
   * `heavy` holds the right button instead, the hammer's heavy swing.
   */
  requestFire(ms: number, heavy = false): void {
    this.fireTicks = Math.max(1, Math.ceil(ms / TICK_MS));
    this.heavy = heavy;
  }

  requestWeapon(request: WeaponRequest): void {
    this.weaponPending = request;
  }

  reset(): void {
    this.use = false;
    this.walk = false;
    this.aim = null;
    this.fireTicks = 0;
    this.heavy = false;
    this.reloadPending = false;
    this.weaponPending = null;
    this.crouch = false;
    this.sprint = false;
    this.lean = 'off';
    this.prone = false;
    this.zoom = null;
    this.adsZoom = null;
    this.jumpPending = false;
    this.slidePending = false;
    this.pressSeq = 0;
    this.weaponSeq = 0;
    this.adsSwitchSeq = 0;
    this.awaySeq = 0;
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
      if (this.weaponPending !== WEAPON_SLOT_REQUEST.hammer) this.awaySeq = cmd.seq;
      this.weaponPending = null;
    }
    if (this.crouch) buttons |= BTN.DUCK;
    if (this.sprint) buttons |= BTN.SPRINT;
    buttons |= LEAN_BUTTON[this.lean];
    if (this.prone) buttons |= BTN.PRONE;
    if (this.slidePending) {
      this.slidePending = false;
      // One command only: the sim needs DUCK to go from released to pressed while sprinting.
      if (self && !(buttons & BTN.DUCK) && this.slideBlocker(self) === null) buttons |= BTN.DUCK;
    }
    if (this.jumpPending) {
      this.jumpPending = false;
      if (self?.onGround) buttons |= BTN.JUMP;
    }
    if (self && weaponDef(self.weapon).ads) {
      const target = slotWeapon(self, weapon);
      if (target !== -1 && target !== self.weapon) {
        this.adsZoom = null;
        this.adsSwitchSeq = cmd.seq;
      }
      if (this.adsZoom !== null) {
        buttons &= ~BTN.ATTACK2;
        // A stale snapshot can show ADS while the server already has the hammer equipped.
        if (this.adsZoom === 1 && this.ack >= this.adsSwitchSeq) buttons |= BTN.ATTACK2;
      }
    } else if (this.zoom !== null) {
      buttons &= ~BTN.ATTACK2;
      if (self && this.ack >= this.pressSeq && this.needsScopePress(self, this.zoom)) {
        buttons |= BTN.ATTACK2;
        this.pressSeq = cmd.seq;
      }
    }
    // On any other weapon the right button would aim or scope, so leaving the hammer cancels the swing.
    if (this.heavy && self) {
      const target = slotWeapon(self, weapon);
      const switching = this.leavingHammer() || (target !== -1 && target !== self.weapon);
      if (switching || !weaponDef(self.weapon).heavy) this.fireTicks = 0;
    }
    if (this.fireTicks > 0 && self && self.health > 0 && !self.dropping) {
      // The sim only swings heavy when ATTACK is up, so the pilot's trigger is dropped.
      buttons = this.heavy ? (buttons & ~BTN.ATTACK) | BTN.ATTACK2 : buttons | BTN.ATTACK;
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
