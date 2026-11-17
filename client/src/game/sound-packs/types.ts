import type { WeaponId } from '@calindra-strike/shared';

export type Pos = { x: number; y: number; z: number } | null;

export interface SoundKit {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  out(pos: Pos, ref?: number): AudioNode;
  noiseBurst(dest: AudioNode, t: number, freq: number, q: number, attack: number, decay: number, gain: number, type?: BiquadFilterType): void;
  tone(dest: AudioNode, t: number, type: OscillatorType, f0: number, f1: number, dur: number, gain: number, attack?: number): void;
  release(...nodes: AudioNode[]): void;
}

export interface Sounds {
  shot(weapon: WeaponId, pos: Pos, heavy: boolean): void;
  kill(streak: number): void;
}

export interface SoundPack {
  readonly id: string;
  readonly label: string;
  create(kit: SoundKit): Partial<Sounds>;
}
