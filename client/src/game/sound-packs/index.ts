import { announcer } from './announcer.ts';
import { classic } from './classic.ts';
import { soundNew } from './sound-new.ts';
import type { SoundPack } from './types.ts';

/** Add a mod with one file exporting a SoundPack and one line in SOUND_PACKS. */
export const SOUND_PACKS = [classic, soundNew, announcer] as const satisfies readonly SoundPack[];

export const DEFAULT_SOUND_PACK = classic.id;

export function findSoundPack(id: string): SoundPack | undefined {
  return SOUND_PACKS.find((pack) => pack.id === id);
}

export function isSoundPackId(v: unknown): v is string {
  return typeof v === 'string' && findSoundPack(v) !== undefined;
}
