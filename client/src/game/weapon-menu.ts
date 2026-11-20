import { PRIMARY_CHOICES, type WeaponId } from '@calindra-strike/shared';

const DIGIT = /^(?:Digit|Numpad)([1-9])$/;

/** The primary weapon a key picks from the numbered menu, or null when the key is not a menu line. */
export function weaponMenuKey(code: string, choices: readonly WeaponId[] = PRIMARY_CHOICES): WeaponId | null {
  const digit = DIGIT.exec(code);
  if (!digit) return null;
  return choices[Number(digit[1]) - 1] ?? null;
}
