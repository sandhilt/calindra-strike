import type { Surface } from './surface.ts';

/** One layer of a synthesised impact: a burst of filtered noise or a falling tone. Frequencies are jittered a little on every hit. */
export type ImpactLayer =
  | { kind: 'noise'; filter: BiquadFilterType; hz: number; q: number; decay: number; gain: number; attack?: number }
  | { kind: 'tone'; wave: OscillatorType; from: number; to: number; seconds: number; gain: number };

const noise = (filter: BiquadFilterType, hz: number, q: number, decay: number, gain: number, attack?: number): ImpactLayer => ({ kind: 'noise', filter, hz, q, decay, gain, attack });
const tone = (wave: OscillatorType, from: number, to: number, seconds: number, gain: number): ImpactLayer => ({ kind: 'tone', wave, from, to, seconds, gain });

/** What each surface sounds like when a bullet lands. Layers play together; there are no sample files. */
export const IMPACT_SOUND: Readonly<Record<Surface, readonly ImpactLayer[]>> = {
  ground: [noise('lowpass', 380, 0.6, 0.1, 0.3), noise('bandpass', 1800, 0.7, 0.06, 0.24), tone('sine', 85, 55, 0.09, 0.12)],
  concrete: [noise('lowpass', 700, 0.8, 0.09, 0.38), noise('bandpass', 2300, 1.5, 0.045, 0.34), noise('highpass', 4500, 0.7, 0.02, 0.16), tone('sine', 130, 70, 0.08, 0.14)],
  plaster: [noise('lowpass', 520, 0.7, 0.08, 0.3), noise('bandpass', 1900, 1.2, 0.04, 0.26), tone('sine', 95, 60, 0.07, 0.12)],
  brick: [noise('bandpass', 1500, 1, 0.05, 0.3), noise('lowpass', 900, 0.8, 0.1, 0.26), noise('highpass', 5000, 0.7, 0.02, 0.1), tone('triangle', 170, 90, 0.06, 0.1)],
  tile: [noise('bandpass', 3800, 4, 0.03, 0.3), tone('sine', 2100, 2000, 0.06, 0.1), tone('sine', 900, 850, 0.04, 0.08)],
  metal: [noise('bandpass', 4200, 5, 0.05, 0.3), tone('sine', 1180, 1150, 0.22, 0.1), tone('sine', 1870, 1820, 0.16, 0.07), tone('triangle', 640, 600, 0.12, 0.06)],
  container: [noise('bandpass', 800, 2, 0.12, 0.3), noise('bandpass', 2400, 2, 0.04, 0.2), tone('sine', 150, 110, 0.35, 0.2), tone('sine', 410, 390, 0.3, 0.08), tone('sine', 1180, 1150, 0.2, 0.05)],
  wood: [tone('triangle', 240, 130, 0.07, 0.2), noise('bandpass', 1300, 1.2, 0.06, 0.22), noise('bandpass', 3000, 2, 0.03, 0.2)],
  crate: [tone('triangle', 150, 85, 0.1, 0.24), noise('bandpass', 700, 1, 0.08, 0.24), noise('bandpass', 1700, 1.2, 0.035, 0.2), tone('triangle', 330, 200, 0.05, 0.08)],
  glass: [noise('bandpass', 5200, 3, 0.04, 0.22), tone('sine', 2600, 2500, 0.14, 0.08)],
  water: [noise('bandpass', 1500, 0.7, 0.03, 0.3), noise('bandpass', 3600, 1.2, 0.05, 0.22), tone('sine', 760, 230, 0.16, 0.12)],
  screen: [noise('bandpass', 3200, 2, 0.03, 0.2), tone('square', 1400, 900, 0.05, 0.06), tone('sine', 2400, 2300, 0.08, 0.05)],
  cloth: [noise('lowpass', 450, 0.7, 0.07, 0.22), noise('bandpass', 1600, 0.9, 0.04, 0.2), tone('sine', 70, 50, 0.08, 0.08)],
  plant: [noise('bandpass', 4500, 0.8, 0.12, 0.22, 0.01), noise('bandpass', 2500, 0.6, 0.1, 0.12, 0.01)],
};
