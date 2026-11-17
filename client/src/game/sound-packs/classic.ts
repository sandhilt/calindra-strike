import type { SoundPack } from './types.ts';

export const classic = {
  id: 'classic',
  label: 'clássico',
  create: () => ({}),
} as const satisfies SoundPack;
