import { RADIO_MENUS, radioLineAt, type RadioMenuId } from '@calindra-strike/shared';

/** Which radio menu is on screen, if any. */
export type OpenRadioMenu = RadioMenuId | null;

export interface RadioKeyResult {
  /** The menu after the key. */
  readonly open: OpenRadioMenu;
  /** True when the radio took the key, so it must not reach movement or weapon switching. */
  readonly consumed: boolean;
  /** Wire id of the line the player picked. The menu is already closed when this is set. */
  readonly pick?: number;
}

const DIGIT = /^(?:Digit|Numpad)([0-9])$/;

/**
 * Radio menu key handling, as pure as the rest of the input rules. A menu key opens or switches
 * the menu (only when `canOpen`: playing, pointer locked, not chatting). While a menu is open the
 * digits belong to it, so 1-3 pick a line instead of switching weapons. The same key again, 0 or
 * Escape close it. Other keys pass through so the player keeps moving.
 */
export function radioMenuKey(open: OpenRadioMenu, code: string, canOpen: boolean): RadioKeyResult {
  const menu = RADIO_MENUS.find((m) => m.key === code);
  if (open === null) {
    if (menu && canOpen) return { open: menu.id, consumed: true };
    return { open, consumed: false };
  }
  if (menu) return { open: menu.id === open ? null : menu.id, consumed: true };
  if (code === 'Escape') return { open: null, consumed: true };
  const digit = DIGIT.exec(code);
  if (!digit) return { open, consumed: false };
  const slot = Number(digit[1]);
  if (slot === 0) return { open: null, consumed: true };
  const line = radioLineAt(open, slot);
  if (!line) return { open, consumed: true };
  return { open: null, consumed: true, pick: line.id };
}
