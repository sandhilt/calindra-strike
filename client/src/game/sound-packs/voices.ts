import { WEAPON } from '@calindra-strike/shared';

export interface ShotVoice {
  noiseFreq: number;
  noiseQ: number;
  decay: number;
  thump: number;
  thumpDecay: number;
  tail: number;
  gain: number;
  crack: number;
}

export const VOICES: Record<number, ShotVoice> = {
  [WEAPON.PISTOL]: { noiseFreq: 2400, noiseQ: 0.9, decay: 0.09, thump: 140, thumpDecay: 0.06, tail: 0.25, gain: 0.55, crack: 3200 },
  [WEAPON.RIFLE]: { noiseFreq: 1500, noiseQ: 0.7, decay: 0.13, thump: 95, thumpDecay: 0.09, tail: 0.45, gain: 0.75, crack: 2600 },
  [WEAPON.SMG]: { noiseFreq: 2100, noiseQ: 0.8, decay: 0.08, thump: 120, thumpDecay: 0.05, tail: 0.3, gain: 0.55, crack: 3000 },
  [WEAPON.SHOTGUN]: { noiseFreq: 900, noiseQ: 0.5, decay: 0.22, thump: 70, thumpDecay: 0.16, tail: 0.6, gain: 0.95, crack: 1800 },
  [WEAPON.SNIPER]: { noiseFreq: 1100, noiseQ: 0.6, decay: 0.25, thump: 60, thumpDecay: 0.2, tail: 1.1, gain: 1.0, crack: 4200 },
  [WEAPON.LMG]: { noiseFreq: 1300, noiseQ: 0.7, decay: 0.12, thump: 85, thumpDecay: 0.1, tail: 0.5, gain: 0.75, crack: 2400 },
};
