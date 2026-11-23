import { BTN, DEG, MAX_PITCH, clamp, wrapAngle } from '@calindra-strike/shared';
import { CROUCH_TAPS_IDLE, type CrouchTapState, pressCrouch } from './crouch-taps.ts';
import { PRONE_CANCEL_BUTTONS, nextProne } from './prone-input.ts';

import { ACTIONS, ACTION_IDS, type ActionId, type Bindings, effectiveBindings, mouseBinding } from './bindings.ts';

const BUTTON_ACTIONS = ACTION_IDS.flatMap((id) => {
  const bit = ACTIONS[id].bit;
  return bit === undefined ? [] : [{ id, bit }];
});

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select') !== null);
}

/** Keyboard + mouse state. Uses `code` so WASD works on any keyboard layout. */
export class Input {
  private readonly held = new Set<string>();
  private bindings: Bindings;
  private prone = false;
  private crouchTap: CrouchTapState = CROUCH_TAPS_IDLE;
  yaw = 0;
  pitch = 0;
  sensitivity = 2;
  zoomSensScale = 1;
  locked = false;
  /** Dev-only: behave as if the pointer were locked (automated browser tests). */
  debug = false;
  enabled = true;
  private weaponReq = 0;
  private wheelAcc = 0;
  lookDX = 0; // accumulated for viewmodel sway
  lookDY = 0;
  onKey: (code: string, down: boolean, e: KeyboardEvent) => boolean = () => false;
  onPress: (code: string) => void = () => {};
  private readonly el: HTMLElement;
  private readonly disposers: (() => void)[] = [];

  constructor(el: HTMLElement, bindings: Bindings) {
    this.el = el;
    this.bindings = bindings;
    const on = <K extends keyof DocumentEventMap>(t: K, f: (e: DocumentEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      document.addEventListener(t, f, opts);
      this.disposers.push(() => document.removeEventListener(t, f, opts));
    };
    on('keydown', (e) => {
      if (isTyping(e.target) || e.isComposing) return;
      if (this.onKey(e.code, true, e) || !this.active) return;
      if (e.code !== 'Escape' && (e.code === 'Tab' || e.code === 'Space' || e.ctrlKey
        || e.code === 'AltLeft' || e.code === 'AltRight' || e.code.startsWith('Arrow') || ACTION_IDS.some((id) => this.matches(id, e.code)))) e.preventDefault();
      if (!e.repeat) this.press(e.code);
    });
    on('keyup', (e) => {
      this.held.delete(e.code);
      if (this.locked && (e.code === 'AltLeft' || e.code === 'AltRight')) e.preventDefault();
      this.onKey(e.code, false, e);
    });
    on('mousedown', (e) => {
      if (!this.active || isTyping(e.target)) return;
      const code = mouseBinding(e.button);
      if (!code) return;
      e.preventDefault();
      this.press(code);
    });
    on('mouseup', (e) => this.held.delete(mouseBinding(e.button)));
    on('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      const k = this.sensitivity * 0.022 * DEG * this.zoomSensScale;
      this.yaw = wrapAngle(this.yaw - e.movementX * k);
      this.pitch = clamp(this.pitch - e.movementY * k, -MAX_PITCH, MAX_PITCH);
      this.lookDX += e.movementX;
      this.lookDY += e.movementY;
    });
    on(
      'wheel',
      (e) => {
        if (!this.locked || !this.enabled) return;
        this.wheelAcc += e.deltaY;
        if (Math.abs(this.wheelAcc) > 40) {
          this.requestWeapon(this.wheelAcc > 0 ? 'WheelDown' : 'WheelUp');
          this.wheelAcc = 0;
        }
      },
      { passive: true },
    );
    on('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.el;
      if (!this.locked) this.releaseAll();
    });
    on('auxclick', (e) => {
      if (this.active) e.preventDefault();
    });
    on('contextmenu', (e) => {
      if (this.locked) e.preventDefault();
    });
    const blur = () => this.releaseAll();
    window.addEventListener('blur', blur);
    this.disposers.push(() => window.removeEventListener('blur', blur));
  }

  releaseAll(): void {
    this.held.clear();
    this.weaponReq = 0;
    this.wheelAcc = 0;
    this.clearProne();
  }

  clearProne(): void {
    this.prone = false;
    this.crouchTap = CROUCH_TAPS_IDLE;
  }

  async lock(): Promise<void> {
    try {
      // raw input when supported: no OS acceleration, like CS m_rawinput 1
      await this.el.requestPointerLock({ unadjustedMovement: true });
    } catch {
      try {
        await this.el.requestPointerLock();
      } catch {
        /* user must click again (browser cooldown after Esc) */
      }
    }
  }

  setBindings(bindings: Bindings): void {
    if (this.bindings === bindings) return;
    this.bindings = bindings;
    this.releaseAll();
  }

  matches(id: ActionId, code: string): boolean {
    return effectiveBindings(this.bindings, id).includes(code);
  }

  down(id: ActionId): boolean {
    for (const code of effectiveBindings(this.bindings, id)) {
      if (this.held.has(code)) return true;
    }
    return false;
  }

  private get active(): boolean {
    return this.enabled && (this.locked || this.debug);
  }

  private press(code: string): void {
    this.held.add(code);
    const buttons = this.boundButtons();
    if (this.matches('crouch', code)) {
      const next = pressCrouch(this.crouchTap, { now: performance.now(), sprinting: (buttons & BTN.SPRINT) !== 0, prone: this.prone });
      this.crouchTap = next.state;
      this.prone = next.prone;
    }
    this.prone = nextProne(this.prone, this.matches('prone', code), buttons);
    if (buttons & PRONE_CANCEL_BUTTONS) this.crouchTap = CROUCH_TAPS_IDLE;
    this.requestWeapon(code);
    this.onPress(code);
  }

  private requestWeapon(code: string): void {
    for (const id of ACTION_IDS) {
      const req = ACTIONS[id].weapon;
      if (req !== undefined && this.matches(id, code)) {
        this.weaponReq = req;
        return;
      }
    }
  }

  private boundButtons(): number {
    let buttons = 0;
    for (const { id, bit } of BUTTON_ACTIONS) {
      if (this.down(id)) buttons |= bit;
    }
    return buttons;
  }

  buttons(): number {
    if (!this.active) return 0;
    return this.boundButtons() | (this.prone ? BTN.PRONE : 0);
  }

  takeWeaponRequest(): number {
    const r = this.weaponReq;
    this.weaponReq = 0;
    return r;
  }

  takeLook(): [number, number] {
    const r: [number, number] = [this.lookDX, this.lookDY];
    this.lookDX = 0;
    this.lookDY = 0;
    return r;
  }

  dispose(): void {
    for (const d of this.disposers) d();
  }
}
