import type { SoundKit, Sounds, SoundPack } from './types.ts';

export function flagVoice(kit: SoundKit): Sounds['flag'] {
  const notes = { take: [440, 660], capture: [523, 659, 784, 1047], return: [784, 523, 392] };
  const NOTE_SECONDS = 0.12;
  return (action, ownTeam) => {
    notes[action].forEach((frequency, i) => kit.tone(kit.master, kit.ctx.currentTime + i * NOTE_SECONDS, 'triangle', frequency, frequency, NOTE_SECONDS, ownTeam ? 0.22 : 0.13));
  };
}

export const classic = {
  id: 'classic',
  label: 'clássico',
  create: (kit) => ({ flag: flagVoice(kit) }),
} as const satisfies SoundPack;
