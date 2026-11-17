import { flagVoice } from './sound-packs/classic.ts';
import { WEAPON, type WeaponId } from '@calindra-strike/shared';

import { DEFAULT_SOUND_PACK, findSoundPack } from './sound-packs/index.ts';
import type { Pos, SoundKit, Sounds } from './sound-packs/types.ts';
import { VOICES } from './sound-packs/voices.ts';

/** Longest sound (sniper tail) ends about 1.2 s after it starts; the margin covers timer jitter. */
const VOICE_LIFETIME_MS = 2000;

/** Length of the shared noise buffer, in seconds. */
const NOISE_BUFFER_SEC = 4;

/** Kill stinger, one per streak tier (see the table in client.ts). */
export type StreakSound = 'kill' | 'double' | 'triple' | 'multi' | 'rampage' | 'unstoppable' | 'godlike';

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

/** Level boost for the synth stingers, which read thin next to the shots. */
const STREAK_LEVEL = 1.5;

/** Sub-octave layer under each stinger, relative to its level. */
const SUB_LEVEL = 0.6;

/**
 * All sound effects are synthesized with WebAudio at runtime: no sampled
 * assets, nothing copyrighted, nothing to download.
 */
export class Sfx {
  readonly ctx: AudioContext;
  private master: GainNode;
  private noise: AudioBuffer;
  private wind: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private listenerPos = { x: 0, y: 0, z: 0 };
  /** Send for the synth stingers into a short feedback echo. */
  private readonly echo: GainNode;
  /** Input for the room reflections that give gunshots a walled-arena slap. */
  private readonly room: GainNode;

  private readonly kit: SoundKit;
  private readonly packs = new Map<string, Partial<Sounds>>();
  private packId: string = '';
  private overrides: Partial<Sounds> = {};

  constructor(volume: number, packId: string) {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(this.ctx.destination);
    this.setVolume(volume);
    this.echo = this.ctx.createGain();
    this.echo.gain.value = 0.35;
    const delay = this.ctx.createDelay(1);
    delay.delayTime.value = 0.28;
    const feedback = this.ctx.createGain();
    feedback.gain.value = 0.4;
    this.echo.connect(delay);
    delay.connect(feedback).connect(delay);
    delay.connect(this.master);
    // Two short, darkening reflections at different distances from the walls.
    this.room = this.ctx.createGain();
    for (const seconds of [0.031, 0.047]) {
      const reflection = this.ctx.createDelay(0.2);
      reflection.delayTime.value = seconds;
      const damp = this.ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = 2500;
      const decay = this.ctx.createGain();
      decay.gain.value = 0.3;
      this.room.connect(reflection);
      reflection.connect(damp);
      damp.connect(decay).connect(reflection);
      damp.connect(this.master);
    }
    // Bursts start up to 1.5 s into this buffer and play at up to 1.2x, so 4 s
    // still leaves over 1.2 s for the longest tail (sniper).
    const len = this.ctx.sampleRate * NOISE_BUFFER_SEC;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.kit = {
      ctx: this.ctx,
      master: this.master,
      out: this.out.bind(this),
      noiseBurst: this.noiseBurst.bind(this),
      tone: this.tone.bind(this),
      release: this.release.bind(this),
    };
    this.setPack(DEFAULT_SOUND_PACK);
    this.setPack(packId);
  }

  setPack(id: string): boolean {
    const pack = findSoundPack(id);
    if (!pack || id === this.packId) return false;
    let overrides = this.packs.get(id);
    if (!overrides) {
      overrides = pack.create(this.kit);
      this.packs.set(id, overrides);
    }
    this.packId = id;
    this.overrides = overrides;
    return true;
  }

  flag(action: 'take' | 'capture' | 'return', ownTeam: boolean): void {
    (this.overrides.flag ?? flagVoice(this.kit))(action, ownTeam);
  }

  resume(): void {
    if (this.ctx.state !== 'running') void this.ctx.resume();
  }

  setVolume(v: number): void {
    this.master.gain.value = v * 0.9;
  }

  setListener(x: number, y: number, z: number, fx: number, fy: number, fz: number): void {
    const l = this.ctx.listener;
    this.listenerPos = { x, y, z };
    if (l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setValueAtTime(x, t);
      l.positionY.setValueAtTime(y, t);
      l.positionZ.setValueAtTime(z, t);
      l.forwardX.setValueAtTime(fx, t);
      l.forwardY.setValueAtTime(fy, t);
      l.forwardZ.setValueAtTime(fz, t);
      l.upX.setValueAtTime(0, t);
      l.upY.setValueAtTime(1, t);
      l.upZ.setValueAtTime(0, t);
    } else {
      l.setPosition(x, y, z);
      l.setOrientation(fx, fy, fz, 0, 1, 0);
    }
  }

  /** Output node for a sound: positional (with distance muffling) or direct. */
  private out(pos: Pos, ref = 220): AudioNode {
    if (!pos) return this.master;
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.rolloffFactor = 1.1;
    p.maxDistance = 8000;
    p.positionX.value = pos.x;
    p.positionY.value = pos.y;
    p.positionZ.value = pos.z;
    const dist = Math.hypot(pos.x - this.listenerPos.x, pos.y - this.listenerPos.y, pos.z - this.listenerPos.z);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.max(900, 16000 - dist * 7);
    lp.connect(p).connect(this.master);
    this.release(p, lp);
    return lp;
  }

  /**
   * Every sound builds fresh nodes. Once it has stopped they are cut from the
   * graph, otherwise a long match keeps thousands of finished panners and
   * filters connected to the master bus.
   */
  private release(...nodes: AudioNode[]): void {
    setTimeout(() => {
      for (const n of nodes) n.disconnect();
    }, VOICE_LIFETIME_MS);
  }

  private noiseBurst(dest: AudioNode, t: number, freq: number, q: number, attack: number, decay: number, gain: number, type: BiquadFilterType = 'bandpass'): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + decay + 0.05);
    this.release(src, f, g);
  }

  private tone(dest: AudioNode, t: number, type: OscillatorType, f0: number, f1: number, dur: number, gain: number, attack = 0.002): void {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    this.release(o, g);
  }

  /** Per-shot bus: the sound plays directly and a little of it reflects off the room. */
  private shotBus(pos: Pos, ref: number): AudioNode {
    const out = this.out(pos, ref);
    const bus = this.ctx.createGain();
    const send = this.ctx.createGain();
    send.gain.value = ROOM_SEND;
    bus.connect(out);
    bus.connect(send).connect(this.room);
    this.release(bus, send);
    return bus;
  }

  /** Random factor in [1 - amount, 1 + amount], so repeated shots never sound identical. */
  private jitter(amount: number): number {
    return 1 + (Math.random() * 2 - 1) * amount;
  }

  shot(weapon: WeaponId, pos: Pos, heavy = false): void {
    if (this.overrides.shot) return this.overrides.shot(weapon, pos, heavy);
    const t = this.ctx.currentTime;
    if (weapon === WEAPON.HAMMER) {
      const bus = this.shotBus(pos, 120);
      this.noiseBurst(bus, t, heavy ? 700 : 1100, 0.6, 0.005, heavy ? 0.22 : 0.14, 0.35, 'bandpass');
      return;
    }
    const v = VOICES[weapon] ?? VOICES[WEAPON.RIFLE];
    const bus = this.shotBus(pos, 260);
    const g = (pos ? v.gain : v.gain * 0.75) * this.jitter(0.08);
    const pitch = this.jitter(0.04);
    // Supersonic crack: a very short, bright click.
    this.noiseBurst(bus, t, v.crack * pitch, 1.2, 0.0005, 0.012, g * 0.8, 'highpass');
    // Muzzle blast: the body of the shot.
    this.noiseBurst(bus, t, v.noiseFreq * pitch * (0.95 + Math.random() * 0.1), v.noiseQ, 0.001, v.decay * this.jitter(0.1), g, 'bandpass');
    // Pressure wave: a falling low tone and a sub boom under it.
    this.tone(bus, t, 'sine', v.thump * 1.6 * pitch, v.thump * 0.6, v.thumpDecay * this.jitter(0.1), g * 1.1);
    this.noiseBurst(bus, t, 180 * pitch, 0.7, 0.002, v.thumpDecay * 1.2, g * 0.9, 'lowpass');
    this.noiseBurst(bus, t + 0.01, 600, 0.4, 0.02, v.tail * this.jitter(0.1), g * 0.18, 'lowpass');
    if (weapon === WEAPON.SNIPER || weapon === WEAPON.SHOTGUN) {
      // bolt / pump mechanics after the shot (only audible up close)
      const mech = pos ? bus : this.master;
      this.noiseBurst(mech, t + 0.42, 2600, 2, 0.002, 0.04, 0.12);
      this.noiseBurst(mech, t + 0.58, 1900, 2, 0.002, 0.05, 0.12);
    }
  }

  footstep(pos: Pos, loud = 1): void {
    const t = this.ctx.currentTime;
    const out = this.out(pos, 160);
    this.noiseBurst(out, t, 420 + Math.random() * 400, 1.4, 0.004, 0.07, 0.22 * loud);
    this.tone(out, t, 'sine', 95, 60, 0.06, 0.12 * loud);
  }

  jump(): void {
    const t = this.ctx.currentTime;
    this.noiseBurst(this.master, t, 700, 1, 0.005, 0.08, 0.08);
  }

  land(heavy: boolean, pos: Pos = null): void {
    const t = this.ctx.currentTime;
    const out = this.out(pos, 160);
    this.tone(out, t, 'sine', heavy ? 120 : 90, 45, heavy ? 0.18 : 0.1, heavy ? 0.35 : 0.18);
    this.noiseBurst(out, t, 500, 0.8, 0.004, heavy ? 0.15 : 0.08, heavy ? 0.25 : 0.14);
  }

  hitmarker(): void {
    const t = this.ctx.currentTime;
    this.tone(this.master, t, 'triangle', 1700, 1500, 0.05, 0.16);
  }

  headshot(): void {
    const t = this.ctx.currentTime;
    this.tone(this.master, t, 'sine', 2350, 2300, 0.35, 0.18);
    this.tone(this.master, t, 'sine', 3920, 3900, 0.22, 0.09);
    this.noiseBurst(this.master, t, 5000, 2, 0.001, 0.03, 0.12);
  }

  /** Kill stinger for the streak tier. Synthesized, not sampled: the announcer clips of the original games are copyrighted. */
  kill(streak: number, sound: StreakSound): void {
    if (this.overrides.kill) return this.overrides.kill(streak);
    this.stingers[sound](this.ctx.currentTime);
  }

  private readonly stingers: Record<StreakSound, (t: number) => void> = {
    kill: (t) => {
      this.synth(t, { wave: 'sine', pitch: [660, 660], cutoff: [5000, 5000], dur: 0.18, gain: 0.25, detune: 0 });
      this.synth(t + 0.08, { wave: 'sine', pitch: [990, 990], cutoff: [5000, 5000], dur: 0.3, gain: 0.25, detune: 0 });
    },
    // "Double Kill" / "Triple Kill": quick plucked beeps, one more per tier.
    double: (t) => this.beeps(t, 2),
    triple: (t) => this.beeps(t, 3),
    // "Multi Kill": a fast saw arpeggio, each note opening and closing the filter.
    multi: (t) => {
      [330, 415, 494, 659].forEach((f, i) => this.synth(t + i * 0.055, { pitch: [f, f], cutoff: [2600, 400], dur: 0.16, gain: 0.16 }));
    },
    // "Rampage": a low power chord that closes its filter, with a hit of noise.
    rampage: (t) => {
      this.synth(t, { pitch: [110, 104], cutoff: [1400, 250], dur: 0.55, gain: 0.28 });
      this.synth(t, { pitch: [165, 158], cutoff: [1400, 250], dur: 0.55, gain: 0.2 });
      this.noiseBurst(this.master, t, 1200, 0.8, 0.005, 0.3, 0.3);
    },
    // "Unstoppable": a two-step siren.
    unstoppable: (t) => {
      this.synth(t, { wave: 'square', pitch: [420, 1250], cutoff: [2200, 2200], resonance: 8, dur: 0.32, gain: 0.14 });
      this.synth(t + 0.34, { wave: 'square', pitch: [1250, 420], cutoff: [2200, 2200], resonance: 8, dur: 0.32, gain: 0.14 });
    },
    // "Godlike": a rising saw whose filter opens, a wide major chord and a crash.
    godlike: (t) => {
      this.synth(t, { pitch: [220, 440], cutoff: [300, 4000], dur: 1.2, gain: 0.22, attack: 0.05, detune: 12 });
      for (const f of [440, 554, 659]) {
        this.synth(t, { wave: 'triangle', pitch: [f, f], cutoff: [5000, 2000], dur: 1.2, gain: 0.14, attack: 0.05, detune: 5 });
      }
      this.noiseBurst(this.master, t, 3000, 0.6, 0.004, 0.45, 0.22, 'highpass');
    },
  };

  private beeps(t: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const f = 880 * 1.25 ** i;
      this.synth(t + i * 0.09, { wave: 'square', pitch: [f, f], cutoff: [3500, 600], dur: 0.12, gain: 0.18, detune: 6 });
    }
  }

  /** Two detuned oscillators through a resonant low-pass sweep, with an amp envelope and a send to the echo. */
  private synth(t: number, patch: Partial<SynthPatch> & Pick<SynthPatch, 'pitch' | 'cutoff' | 'dur' | 'gain'>): void {
    const p = { ...SYNTH_DEFAULTS, ...patch };
    const level = p.gain * STREAK_LEVEL;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(level, t + p.attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + p.dur);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = p.resonance;
    lp.frequency.setValueAtTime(p.cutoff[0], t);
    lp.frequency.exponentialRampToValueAtTime(p.cutoff[1], t + p.dur);
    lp.connect(amp);
    amp.connect(this.master);
    amp.connect(this.echo);
    const nodes: AudioNode[] = [amp, lp];
    for (const detune of [-p.detune, p.detune]) {
      const o = this.ctx.createOscillator();
      o.type = p.wave;
      o.detune.value = detune;
      o.frequency.setValueAtTime(p.pitch[0], t);
      if (p.pitch[1] !== p.pitch[0]) o.frequency.exponentialRampToValueAtTime(p.pitch[1], t + p.dur);
      o.connect(lp);
      o.start(t);
      o.stop(t + p.dur + 0.05);
      nodes.push(o);
    }
    // Sub layer an octave down: the weight the stingers were missing.
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(p.pitch[0] / 2, t);
    if (p.pitch[1] !== p.pitch[0]) sub.frequency.exponentialRampToValueAtTime(p.pitch[1] / 2, t + p.dur);
    const subGain = this.ctx.createGain();
    subGain.gain.value = SUB_LEVEL;
    sub.connect(subGain).connect(amp);
    sub.start(t);
    sub.stop(t + p.dur + 0.05);
    nodes.push(sub, subGain);
    this.release(...nodes);
  }

  hurt(): void {
    const t = this.ctx.currentTime;
    this.tone(this.master, t, 'sine', 160, 70, 0.14, 0.3);
    this.noiseBurst(this.master, t, 300, 0.7, 0.003, 0.12, 0.2);
  }

  dryFire(): void {
    this.noiseBurst(this.master, this.ctx.currentTime, 3000, 3, 0.001, 0.03, 0.15);
  }

  reload(stage: number): void {
    const t = this.ctx.currentTime;
    const f = [1800, 2400, 3100][stage] ?? 2000;
    this.noiseBurst(this.master, t, f, 3, 0.001, 0.05, 0.2);
    this.tone(this.master, t, 'square', f / 4, f / 5, 0.03, 0.04);
  }

  /** Scope zoom click, like the CS 1.6 zoom sound. */
  zoom(): void {
    const t = this.ctx.currentTime;
    this.noiseBurst(this.master, t, 3600, 4, 0.001, 0.025, 0.16);
    this.tone(this.master, t, 'square', 900, 700, 0.03, 0.035);
  }

  deploy(): void {
    this.noiseBurst(this.master, this.ctx.currentTime, 2200, 2, 0.002, 0.06, 0.1);
  }

  airdrop(): void {
    const t = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(380, t + i * 0.9);
      o.frequency.linearRampToValueAtTime(820, t + i * 0.9 + 0.75);
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 1800;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.9);
      g.gain.exponentialRampToValueAtTime(0.08, t + i * 0.9 + 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.9 + 0.85);
      o.connect(f).connect(g).connect(this.master);
      o.start(t + i * 0.9);
      o.stop(t + i * 0.9 + 0.9);
      this.release(o, f, g);
    }
  }

  loot(): void {
    const t = this.ctx.currentTime;
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(this.master, t + i * 0.06, 'triangle', f, f, 0.25, 0.14));
  }

  beep(high = false): void {
    this.tone(this.master, this.ctx.currentTime, 'sine', high ? 1320 : 880, high ? 1320 : 880, 0.12, 0.15);
  }

  fanfare(): void {
    const t = this.ctx.currentTime;
    [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => {
      this.tone(this.master, t + i * 0.13, 'triangle', f, f, 0.32, 0.16);
      this.tone(this.master, t + i * 0.13, 'sine', f / 2, f / 2, 0.32, 0.08);
    });
  }

  click(): void {
    this.tone(this.master, this.ctx.currentTime, 'sine', 1200, 900, 0.04, 0.06);
  }

  /** Continuous wind while skydiving; level 0..1. */
  setWind(level: number): void {
    if (level <= 0.001) {
      if (this.wind) {
        this.wind.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
      }
      return;
    }
    if (!this.wind) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 0.6;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.master);
      src.start();
      this.wind = { src, gain, filter };
    }
    const t = this.ctx.currentTime;
    this.wind.gain.gain.setTargetAtTime(0.05 + level * 0.18, t, 0.1);
    this.wind.filter.frequency.setTargetAtTime(400 + level * 900, t, 0.1);
  }

  dispose(): void {
    void this.ctx.close();
  }
}
