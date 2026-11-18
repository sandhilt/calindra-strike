/** What a spectator can ask for with the keyboard or the bar buttons. */
export type SpectatorAction =
  | { kind: 'mode' }
  | { kind: 'next' }
  | { kind: 'prev' }
  | { kind: 'team'; team: 0 | 1 }
  | { kind: 'join' }
  | { kind: 'menu' };

const KEY_ACTIONS: Record<string, SpectatorAction> = {
  Space: { kind: 'mode' },
  ArrowRight: { kind: 'next' },
  ArrowLeft: { kind: 'prev' },
  Digit1: { kind: 'team', team: 0 },
  Numpad1: { kind: 'team', team: 0 },
  Digit2: { kind: 'team', team: 1 },
  Numpad2: { kind: 'team', team: 1 },
  KeyJ: { kind: 'join' },
  Escape: { kind: 'menu' },
};

/** Keys that would scroll the page if left alone. */
const PAGE_SCROLL_CODES: ReadonlySet<string> = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function spectatorAction(code: string): SpectatorAction | null {
  return KEY_ACTIONS[code] ?? null;
}

export function scrollsPage(code: string): boolean {
  return PAGE_SCROLL_CODES.has(code);
}

/**
 * The player to follow after stepping through `ids` (in the order given).
 * Starts at the first (or last, going back) when the current one is gone; -1 when nobody can be followed.
 */
export function stepTarget(ids: readonly number[], current: number, dir: 1 | -1): number {
  if (ids.length === 0) return -1;
  const at = ids.indexOf(current);
  if (at < 0) return dir === 1 ? ids[0] : ids[ids.length - 1];
  return ids[(at + dir + ids.length) % ids.length];
}
