/**
 * Matches a secret key sequence typed one key at a time. A wrong key starts over, and a wrong key that is the first of the
 * sequence counts as that first key, so a repeated start does not swallow the attempt.
 */
export function sequenceMatcher(sequence: readonly string[]): (code: string) => boolean {
  let at = 0;
  return (code) => {
    at = code === sequence[at] ? at + 1 : code === sequence[0] ? 1 : 0;
    if (at < sequence.length) return false;
    at = 0;
    return true;
  };
}

/** The classic: up, up, down, down, left, right, left, right, B, A. Opens the weapon viewer from the lobby. */
export const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'] as const;
