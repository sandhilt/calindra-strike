/** The pause menu's pages, in tab order. Ids are ASCII so they can sit in DOM ids; the labels live with the menu. */
export const MENU_TAB_IDS = ['game', 'audio', 'video', 'aim', 'controls'] as const;

export type MenuTabId = (typeof MENU_TAB_IDS)[number];

/** The page the menu opens on the first time. */
export const FIRST_MENU_TAB: MenuTabId = 'game';

/** The tab `delta` places from `current`, wrapping around both ends. */
export function stepMenuTab(current: MenuTabId, delta: number): MenuTabId {
  const count = MENU_TAB_IDS.length;
  const next = (((MENU_TAB_IDS.indexOf(current) + delta) % count) + count) % count;
  return MENU_TAB_IDS[next];
}

/** The tab a key on the tab list moves to, or null for a key that is not a tab key (Tab and Escape keep their meaning). */
export function menuTabForKey(key: string, current: MenuTabId): MenuTabId | null {
  switch (key) {
    case 'ArrowRight':
      return stepMenuTab(current, 1);
    case 'ArrowLeft':
      return stepMenuTab(current, -1);
    case 'Home':
      return MENU_TAB_IDS[0];
    case 'End':
      return MENU_TAB_IDS[MENU_TAB_IDS.length - 1];
    default:
      return null;
  }
}
