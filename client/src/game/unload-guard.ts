/**
 * Decides whether closing or reloading the page asks "leave site?". A running match is guarded because Ctrl+W (crouch + forward)
 * closes the tab and browsers never let a keydown cancel it. A reload the dev server starts itself is not the player leaving.
 */
export interface UnloadGuard {
  /** The dev server is about to reload the page on its own. */
  expectReload(): void;
  shouldPrompt(running: boolean): boolean;
}

export function createUnloadGuard(): UnloadGuard {
  let devReload = false;
  return {
    expectReload() { devReload = true; },
    shouldPrompt: (running) => running && !devReload,
  };
}

export const unloadGuard = createUnloadGuard();

