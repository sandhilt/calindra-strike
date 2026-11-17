import { WEAPON, type WeaponId } from '@calindra-strike/shared';
import type { Pos, SoundKit, SoundPack } from './types.ts';
import { VOICES } from './voices.ts';

type StreakSound = 'kill' | 'double' | 'triple' | 'multi' | 'rampage' | 'unstoppable' | 'godlike';
const STINGERS: Readonly<Partial<Record<number, StreakSound>>> = {
  2: 'double', 3: 'triple', 4: 'multi', 5: 'rampage', 7: 'unstoppable', 10: 'godlike',
};

/** A synth voice: detuned oscillator pair, resonant low-pass with a sweep, amp envelope. */
interface SynthPatch {
  wave: OscillatorType;
  pitch: [number, number]; // Hz, start and end of the glide
  cutoff: [number, number]; // filter Hz, start and end of the sweep
  resonance: number; // filter Q
  detune: number; // cents, the two oscillators sit at +/- this
  attack: number; // s
  dur: number; // s
  gain: number;
}

const SYNTH_DEFAULTS: Omit<SynthPatch, 'pitch' | 'cutoff' | 'dur' | 'gain'> = {
  wave: 'sawtooth',
  resonance: 4,
  detune: 8,
  attack: 0.005,
};

/** How much of each shot goes into the room reflections. */
const ROOM_SEND = 0.3;

export const soundNew = {
  id: 'sound-new',
  label: 'sound-new',
  create(kit: SoundKit) {
    const echo = kit.ctx.createGain();
    echo.gain.value = 0.35;
    const delay = kit.ctx.createDelay(1);
    delay.delayTime.value = 0.28;
    const feedback = kit.ctx.createGain();
    feedback.gain.value = 0.4;
    echo.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(kit.master);
    // Two short, darkening reflections at different distances from the walls.
    const room = kit.ctx.createGain();
    for (const seconds of [0.031, 0.047]) {
      const reflection = kit.ctx.createDelay(0.2);
      reflection.delayTime.value = seconds;
      const damp = kit.ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = 2500;
      const decay = kit.ctx.createGain();
      decay.gain.value = 0.3;
      room.connect(reflection);
      reflection.connect(damp);
      damp.connect(decay).connect(reflection);
      damp.connect(kit.master);
    }

    /** Per-shot bus: the sound plays directly and a little of it reflects off the room. */
    function shotBus(pos: Pos, ref: number): AudioNode {
      const out = kit.out(pos, ref);
      const bus = kit.ctx.createGain();
      const send = kit.ctx.createGain();
      send.gain.value = ROOM_SEND;
      bus.connect(out);
      bus.connect(send).connect(room);
      kit.release(bus, send);
      return bus;
    }

    /** Random factor in [1 - amount, 1 + amount], so repeated shots never sound identical. */
    function jitter(amount: number): number {
      return 1 + (Math.random() * 2 - 1) * amount;
    }

    function shot(weapon: WeaponId, pos: Pos, heavy = false): void {
      const t = kit.ctx.currentTime;
      if (weapon === WEAPON.HAMMER) {
        const bus = shotBus(pos, 120);
        kit.noiseBurst(bus, t, heavy ? 700 : 1100, 0.6, 0.005, heavy ? 0.22 : 0.14, 0.35, 'bandpass');
        return;
      }
      const v = VOICES[weapon] ?? VOICES[WEAPON.RIFLE];
      const bus = shotBus(pos, 260);
      const g = (pos ? v.gain : v.gain * 0.75) * jitter(0.08);
      const pitch = jitter(0.04);
      // Supersonic crack: a very short, bright click.
      kit.noiseBurst(bus, t, v.crack * pitch, 1.2, 0.0005, 0.012, g * 0.8, 'highpass');
      // Muzzle blast: the body of the shot.
      kit.noiseBurst(bus, t, v.noiseFreq * pitch * (0.95 + Math.random() * 0.1), v.noiseQ, 0.001, v.decay * jitter(0.1), g, 'bandpass');
      // Pressure wave: a falling low tone.
      kit.tone(bus, t, 'sine', v.thump * 1.6 * pitch, v.thump * 0.6, v.thumpDecay * jitter(0.1), g * 0.9);
      kit.noiseBurst(bus, t + 0.01, 600, 0.4, 0.02, v.tail * jitter(0.1), g * 0.18, 'lowpass');
      if (weapon === WEAPON.SNIPER || weapon === WEAPON.SHOTGUN) {
        // bolt / pump mechanics after the shot (only audible up close)
        const mech = pos ? bus : kit.master;
        kit.noiseBurst(mech, t + 0.42, 2600, 2, 0.002, 0.04, 0.12);
        kit.noiseBurst(mech, t + 0.58, 1900, 2, 0.002, 0.05, 0.12);
      }
    }

    const stingers: Record<StreakSound, (t: number) => void> = {
      kill: (t) => {
        synth(t, { wave: 'sine', pitch: [660, 660], cutoff: [5000, 5000], dur: 0.18, gain: 0.25, detune: 0 });
        synth(t + 0.08, { wave: 'sine', pitch: [990, 990], cutoff: [5000, 5000], dur: 0.3, gain: 0.25, detune: 0 });
      },
      // "Double Kill" / "Triple Kill": quick plucked beeps, one more per tier.
      double: (t) => beeps(t, 2),
      triple: (t) => beeps(t, 3),
      // "Multi Kill": a fast saw arpeggio, each note opening and closing the filter.
      multi: (t) => {
        [330, 415, 494, 659].forEach((f, i) => synth(t + i * 0.055, { pitch: [f, f], cutoff: [2600, 400], dur: 0.16, gain: 0.16 }));
      },
      // "Rampage": a low power chord that closes its filter, with a hit of noise.
      rampage: (t) => {
        synth(t, { pitch: [110, 104], cutoff: [1400, 250], dur: 0.55, gain: 0.28 });
        synth(t, { pitch: [165, 158], cutoff: [1400, 250], dur: 0.55, gain: 0.2 });
        kit.noiseBurst(kit.master, t, 1200, 0.8, 0.005, 0.3, 0.3);
      },
      // "Unstoppable": a two-step siren.
      unstoppable: (t) => {
        synth(t, { wave: 'square', pitch: [420, 1250], cutoff: [2200, 2200], resonance: 8, dur: 0.32, gain: 0.14 });
        synth(t + 0.34, { wave: 'square', pitch: [1250, 420], cutoff: [2200, 2200], resonance: 8, dur: 0.32, gain: 0.14 });
      },
      // "Godlike": a rising saw whose filter opens, a wide major chord and a crash.
      godlike: (t) => {
        synth(t, { pitch: [220, 440], cutoff: [300, 4000], dur: 1.2, gain: 0.22, attack: 0.05, detune: 12 });
        for (const f of [440, 554, 659]) {
          synth(t, { wave: 'triangle', pitch: [f, f], cutoff: [5000, 2000], dur: 1.2, gain: 0.14, attack: 0.05, detune: 5 });
        }
        kit.noiseBurst(kit.master, t, 3000, 0.6, 0.004, 0.45, 0.22, 'highpass');
      },
    };

    function beeps(t: number, count: number): void {
      for (let i = 0; i < count; i++) {
        const f = 880 * 1.25 ** i;
        synth(t + i * 0.09, { wave: 'square', pitch: [f, f], cutoff: [3500, 600], dur: 0.12, gain: 0.18, detune: 6 });
      }
    }

    /** Two detuned oscillators through a resonant low-pass sweep, with an amp envelope and a send to the echo. */
    function synth(t: number, patch: Partial<SynthPatch> & Pick<SynthPatch, 'pitch' | 'cutoff' | 'dur' | 'gain'>): void {
      const p = { ...SYNTH_DEFAULTS, ...patch };
      const amp = kit.ctx.createGain();
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(p.gain, t + p.attack);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + p.dur);
      const lp = kit.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = p.resonance;
      lp.frequency.setValueAtTime(p.cutoff[0], t);
      lp.frequency.exponentialRampToValueAtTime(p.cutoff[1], t + p.dur);
      lp.connect(amp);
      amp.connect(kit.master);
      amp.connect(echo);
      const nodes: AudioNode[] = [amp, lp];
      for (const detune of [-p.detune, p.detune]) {
        const o = kit.ctx.createOscillator();
        o.type = p.wave;
        o.detune.value = detune;
        o.frequency.setValueAtTime(p.pitch[0], t);
        if (p.pitch[1] !== p.pitch[0]) o.frequency.exponentialRampToValueAtTime(p.pitch[1], t + p.dur);
        o.connect(lp);
        o.start(t);
        o.stop(t + p.dur + 0.05);
        nodes.push(o);
      }
      kit.release(...nodes);
    }

    return {
      shot,
      kill(streak: number): void {
        stingers[STINGERS[streak] ?? 'kill'](kit.ctx.currentTime);
      },
    };
  },
} as const satisfies SoundPack;
