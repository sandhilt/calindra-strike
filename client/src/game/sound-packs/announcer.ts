import { createSpeaker, type Speak } from '../speech.ts';
import type { StreakSound } from './types.ts';

/**
 * Original lines the announcer voice speaks on top of any sound pack's kill sound. A single kill stays
 * silent, so the voice is kept for the moments worth announcing.
 */
export const ANNOUNCER_LINES: Readonly<Record<StreakSound, string | null>> = {
  kill: null,
  double: 'Dobradinha!',
  triple: 'Trinca na forja!',
  multi: 'Fornalha acesa!',
  rampage: 'Martelada geral!',
  unstoppable: 'Ninguém segura!',
  godlike: 'Deus da forja!',
};

/** A deep, slow arena voice. */
const VOICE = { lang: 'pt-BR', pitch: 0.5, rate: 0.95 } as const;

/** Speaks through the browser's speech synthesis; silent where it is missing (tests, old browsers). */
export const browserSpeaker = (): Speak => createSpeaker(VOICE, 'announcer');

/** Speaks the line for this streak tier, if it has one. */
export function announceStreak(sound: StreakSound, speak: Speak, volume: number): void {
  const line = ANNOUNCER_LINES[sound];
  if (line) speak(line, volume);
}
