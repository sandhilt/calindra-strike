import { createSpeaker, type Speak } from '../speech.ts';
import type { SoundKit, SoundPack, Sounds, StreakSound } from './types.ts';

/**
 * Original lines for each kill-streak tier. A single kill gets only the stinger, so the voice is kept for
 * the moments worth announcing.
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

/** Stinger weight per tier: 0 for a single kill, growing to 1 at the top of the table. */
const TIER: Readonly<Record<StreakSound, number>> = { kill: 0, double: 0.2, triple: 0.35, multi: 0.5, rampage: 0.7, unstoppable: 0.85, godlike: 1 };

/** A deep, slow arena voice. */
const VOICE = { lang: 'pt-BR', pitch: 0.5, rate: 0.95 } as const;
/** Settings volume maps to master gain as volume * 0.9 (see Sfx.setVolume); the voice follows the same knob. */
const MASTER_GAIN_PER_VOLUME = 0.9;

/** Speaks through the browser's speech synthesis; silent where it is missing (tests, old browsers). */
export const browserSpeaker = (): Speak => createSpeaker(VOICE, 'announcer');

/** Kill announcer: a synthesized arena hit under a spoken line. */
export function announcerKill(kit: SoundKit, speak: Speak): Sounds['kill'] {
  return (_streak, sound) => {
    const t = kit.ctx.currentTime;
    const weight = TIER[sound];
    kit.tone(kit.master, t, 'sine', 110, 55, 0.35 + weight * 0.4, 0.16 + weight * 0.12);
    kit.tone(kit.master, t, 'triangle', 880, 880 * (1 + weight * 0.5), 0.25, 0.08);
    if (weight > 0) kit.noiseBurst(kit.master, t, 2400, 0.7, 0.003, 0.3 + weight * 0.3, 0.1 + weight * 0.08, 'highpass');
    const line = ANNOUNCER_LINES[sound];
    if (line) speak(line, Math.min(1, kit.master.gain.value / MASTER_GAIN_PER_VOLUME));
  };
}

/** Only the kill announcements change: shots and flags stay as in the classic pack, so no pack hears more of the match. */
export const announcer = {
  id: 'announcer',
  label: 'anunciador',
  create: (kit) => ({ kill: announcerKill(kit, browserSpeaker()) }),
} as const satisfies SoundPack;
