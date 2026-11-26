import { flagVoice } from './sound-packs/classic.ts';
import { SPRAY_EMPTY_BURSTS, WEAPON, type CookVoice, type ReloadCue, type StationId, type WeaponId } from '@calindra-strike/shared';

import { playReloadCue } from './reload-sounds.ts';
import { announceStreak, browserSpeaker } from './sound-packs/announcer.ts';
import { DEFAULT_SOUND_PACK, findSoundPack } from './sound-packs/index.ts';
import type { Speak } from './speech.ts';
import type { Pos, SoundKit, Sounds, StreakSound } from './sound-packs/types.ts';
import { VOICES } from './sound-packs/voices.ts';
import type { Surface } from './surface.ts';
import { IMPACT_SOUND } from './surface-sound.ts';
import { SPEAKER_AUDIBLE_UNITS, trackOffsetSeconds } from './station-tracks.ts';
import { AIR_AUDIBLE_UNITS } from './render/prop-motion.ts';

/** Longest sound (sniper tail) ends about 1.2 s after it starts; the margin covers timer jitter. */
const VOICE_LIFETIME_MS = 2000;
/** Two impacts closer than this are one: a shotgun's pellets land together and would stack into a burst of noise. */
const IMPACT_GAP_SECONDS = 0.02;

/** Length of the shared noise buffer, in seconds. */
const NOISE_BUFFER_SEC = 4;
const MUSIC_BASE_GAIN = 0.04;
const AMBIENT_FULL_LEVEL_UNITS = 40;
const AMBIENT_FADE_SECONDS = 0.25;
const NOISE_OFFSET_MARGIN_SECONDS = 0.5;
const COOK_AUDIBLE_UNITS = 380;

export type AmbientVoice = 'air' | 'water' | 'fan' | CookVoice;

type AmbientFilter =
  | { type: 'bandpass'; hz: number; q: number }
  | { type: 'lowpass' | 'highpass'; hz: number };

interface VoiceSpec {
  filters: readonly [AmbientFilter, AmbientFilter];
  gain: number;
  fadeSeconds: number;
  audibleUnits: number;
  /** Heard only from the floor it sounds on: a kitchen is not heard through the slab by the shop below it. */
  sameFloor?: boolean;
  lfo?: { hz: number; depth: number };
}

export const AMBIENT_VOICES: Record<AmbientVoice, VoiceSpec> = {
  air: {
    filters: [{ type: 'bandpass', hz: 380, q: 0.5 }, { type: 'lowpass', hz: 1100 }],
    gain: 0.05, fadeSeconds: AMBIENT_FADE_SECONDS, audibleUnits: AIR_AUDIBLE_UNITS,
  },
  fan: {
    filters: [{ type: 'bandpass', hz: 110, q: 2 }, { type: 'lowpass', hz: 320 }],
    gain: 0.022, fadeSeconds: AMBIENT_FADE_SECONDS, audibleUnits: 210, sameFloor: true,
    lfo: { hz: 3, depth: 0.12 },
  },
  boil: {
    filters: [{ type: 'highpass', hz: 950 }, { type: 'bandpass', hz: 2400, q: 0.65 }],
    gain: 0.055, fadeSeconds: AMBIENT_FADE_SECONDS, audibleUnits: COOK_AUDIBLE_UNITS, sameFloor: true,
    lfo: { hz: 5, depth: 0.45 },
  },
  water: {
    filters: [{ type: 'bandpass', hz: 1600, q: 0.5 }, { type: 'lowpass', hz: 5000 }],
    gain: 0.07, fadeSeconds: AMBIENT_FADE_SECONDS, audibleUnits: 640,
    lfo: { hz: 0.7, depth: 0.15 },
  },
  fryer: {
    filters: [{ type: 'highpass', hz: 3000 }, { type: 'bandpass', hz: 6000, q: 0.8 }],
    gain: 0.08, fadeSeconds: AMBIENT_FADE_SECONDS, audibleUnits: COOK_AUDIBLE_UNITS, sameFloor: true,
    lfo: { hz: 13, depth: 0.4 },
  },
  griddle: {
    filters: [{ type: 'highpass', hz: 2200 }, { type: 'bandpass', hz: 8000, q: 0.7 }],
    gain: 0.07, fadeSeconds: AMBIENT_FADE_SECONDS, audibleUnits: COOK_AUDIBLE_UNITS, sameFloor: true,
    lfo: { hz: 7, depth: 0.3 },
  },
  charcoal: {
    filters: [{ type: 'bandpass', hz: 900, q: 0.6 }, { type: 'lowpass', hz: 2500 }],
    gain: 0.07, fadeSeconds: AMBIENT_FADE_SECONDS, audibleUnits: COOK_AUDIBLE_UNITS, sameFloor: true,
    lfo: { hz: 9, depth: 0.5 },
  },
  wood: {
    filters: [{ type: 'lowpass', hz: 1200 }, { type: 'bandpass', hz: 500, q: 0.5 }],
    gain: 0.065, fadeSeconds: AMBIENT_FADE_SECONDS, audibleUnits: COOK_AUDIBLE_UNITS, sameFloor: true,
    lfo: { hz: 4.5, depth: 0.5 },
  },
};

/** A looping sound that keeps running until stopped. */
export interface AmbientLoop {
  stop(): void;
}

/** Settings volume 0..1 maps to master gain by this factor; the announcer voice reads the same knob back. */
const MASTER_GAIN_PER_VOLUME = 0.9;

/**
 * All sound effects are synthesized with WebAudio at runtime: no sampled
 * assets, nothing copyrighted, nothing to download.
 */
export class Sfx {
  readonly ctx: AudioContext;
  private master: GainNode;
  private readonly music: GainNode;
  private readonly trackClocks = new Map<StationId, {
    serverMs: number; audioSeconds: number; active: number; fadesUntil: number;
  }>();
  private noise: AudioBuffer;
  private wind: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private listenerPos = { x: 0, y: 0, z: 0 };
  private lastImpactAt = -1;

  private readonly kit: SoundKit;
  private readonly packs = new Map<string, Partial<Sounds>>();
  private packId: string = '';
  private overrides: Partial<Sounds> = {};
  private announcer: Speak | null = null;

  constructor(volume: number, packId: string) {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain();
    this.music = this.ctx.createGain();
    this.music.connect(this.master);
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(this.ctx.destination);
    this.setVolume(volume);
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
    this.master.gain.value = v * MASTER_GAIN_PER_VOLUME;
  }

  setMusicVolume(volume: number): void {
    this.music.gain.value = volume * MUSIC_BASE_GAIN;
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

  shot(weapon: WeaponId, pos: Pos, heavy = false): void {
    if (this.overrides.shot) return this.overrides.shot(weapon, pos, heavy);
    const t = this.ctx.currentTime;
    if (weapon === WEAPON.HAMMER) {
      const out = this.out(pos, 120);
      this.noiseBurst(out, t, heavy ? 700 : 1100, 0.6, 0.005, heavy ? 0.22 : 0.14, 0.35, 'bandpass');
      return;
    }
    const v = VOICES[weapon] ?? VOICES[WEAPON.RIFLE];
    const out = this.out(pos, 260);
    const g = pos ? v.gain : v.gain * 0.75;
    this.noiseBurst(out, t, v.crack, 1.2, 0.0008, 0.025, g * 0.8, 'highpass');
    this.noiseBurst(out, t, v.noiseFreq * (0.95 + Math.random() * 0.1), v.noiseQ, 0.001, v.decay, g, 'bandpass');
    this.tone(out, t, 'sine', v.thump * 1.6, v.thump * 0.6, v.thumpDecay, g * 0.9);
    this.noiseBurst(out, t + 0.01, 600, 0.4, 0.02, v.tail, g * 0.18, 'lowpass');
    if (weapon === WEAPON.SNIPER || weapon === WEAPON.SHOTGUN) {
      // bolt / pump mechanics after the shot (only audible up close)
      const mech = pos ? out : this.master;
      this.noiseBurst(mech, t + 0.42, 2600, 2, 0.002, 0.04, 0.12);
      this.noiseBurst(mech, t + 0.58, 1900, 2, 0.002, 0.05, 0.12);
    }
  }

  spray(pos: Pos, last: boolean): void {
    const t = this.ctx.currentTime;
    const out = this.out(pos, 160);
    [2800, 3600, 3100].forEach((freq, i) => this.noiseBurst(out, t + i * 0.05, freq, 3, 0.001, 0.018, 0.1));
    this.noiseBurst(out, t + 0.15, 6000, 0.7, 0.015, 0.9, 0.16);
    if (last) {
      for (const burst of SPRAY_EMPTY_BURSTS) {
        this.noiseBurst(out, t + burst.delaySeconds, burst.frequencyHz, 3, 0.001, burst.durationSeconds, burst.gain);
      }
    }
  }

  /** A bullet landing on `surface`. Pellets of one blast land together, so a short gap keeps a shotgun from stacking into noise. */
  impact(surface: Surface, pos: Pos): void {
    const now = this.ctx.currentTime;
    if (now - this.lastImpactAt < IMPACT_GAP_SECONDS) return;
    this.lastImpactAt = now;
    const out = this.out(pos, 200);
    const jitter = 0.9 + Math.random() * 0.2;
    for (const layer of IMPACT_SOUND[surface]) {
      if (layer.kind === 'noise') this.noiseBurst(out, now, layer.hz * jitter, layer.q, layer.attack ?? 0.001, layer.decay, layer.gain, layer.filter);
      else this.tone(out, now, layer.wave, layer.from * jitter, layer.to * jitter, layer.seconds, layer.gain);
    }
  }

  footstep(pos: Pos, loud = 1): void {
    const t = this.ctx.currentTime;
    const out = this.out(pos, 160);
    this.noiseBurst(out, t, 420 + Math.random() * 400, 1.4, 0.004, 0.07, 0.22 * loud);
    this.tone(out, t, 'sine', 95, 60, 0.06, 0.12 * loud);
  }

  slide(pos: Pos = null): void {
    this.noiseBurst(this.out(pos, 160), this.ctx.currentTime, 850, 0.7, 0.012, 0.18, 0.18);
  }

  /** Lighter than a footstep on a floor: a soft slosh of low noise with a short dip. */
  wetStep(pos: Pos, loud = 1): void {
    const t = this.ctx.currentTime;
    const out = this.out(pos, 160);
    this.noiseBurst(out, t, 900 + Math.random() * 500, 0.9, 0.006, 0.11, 0.16 * loud);
    this.tone(out, t, 'sine', 330, 170, 0.07, 0.07 * loud);
  }

  /** Feet or a landing into water: a burst of noise, a bright spatter and a falling blip. */
  splash(heavy: boolean, pos: Pos = null): void {
    const t = this.ctx.currentTime;
    const out = this.out(pos, 200);
    const gain = heavy ? 1 : 0.7;
    this.noiseBurst(out, t, 1500, 0.7, 0.004, 0.4, 0.3 * gain);
    this.noiseBurst(out, t + 0.03, 3600, 1.2, 0.004, 0.22, 0.12 * gain);
    this.tone(out, t, 'sine', 760, 230, 0.16, 0.12 * gain);
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

  /** Turns the spoken kill-streak announcer on or off, on top of whichever sound pack is chosen. */
  setAnnouncer(on: boolean): void {
    this.announcer = on ? (this.announcer ?? browserSpeaker()) : null;
  }

  kill(streak: number, sound: StreakSound): void {
    this.killSound(streak, sound);
    if (this.announcer) announceStreak(sound, this.announcer, Math.min(1, this.master.gain.value / MASTER_GAIN_PER_VOLUME));
  }

  private killSound(streak: number, sound: StreakSound): void {
    if (this.overrides.kill) return this.overrides.kill(streak, sound);
    const t = this.ctx.currentTime;
    const base = 660 * 2 ** (Math.min(streak - 1, 5) / 12);
    this.tone(this.master, t, 'sine', base, base, 0.18, 0.2);
    this.tone(this.master, t + 0.08, 'sine', base * 1.5, base * 1.5, 0.3, 0.2);
  }

  /** One deep breath of a winded player: a slow airy draw in, or a longer, lower push out. */
  breath(breath: 'in' | 'out', loud: number): void {
    const t = this.ctx.currentTime;
    if (breath === 'in') this.noiseBurst(this.master, t, 1300, 1.1, 0.22, 0.28, 0.07 * loud);
    else {
      this.noiseBurst(this.master, t, 650, 0.9, 0.05, 0.45, 0.1 * loud);
      this.noiseBurst(this.master, t, 260, 1.2, 0.05, 0.3, 0.05 * loud, 'lowpass');
    }
  }

  hurt(): void {
    const t = this.ctx.currentTime;
    this.tone(this.master, t, 'sine', 160, 70, 0.14, 0.3);
    this.noiseBurst(this.master, t, 300, 0.7, 0.003, 0.12, 0.2);
  }

  dryFire(): void {
    this.noiseBurst(this.master, this.ctx.currentTime, 3000, 3, 0.001, 0.03, 0.15);
  }

  reload(weapon: WeaponId, cue: ReloadCue, pos: Pos = null): void {
    playReloadCue(this.kit, weapon, cue, pos);
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

  /** Armed bug ticking: a short blip that gets higher as the fuse burns down (urgency 0..1). */
  bombBeep(pos: Pos, urgency: number): void {
    const t = this.ctx.currentTime;
    const out = this.out(pos, 320);
    const f = 1000 + urgency * 900;
    this.tone(out, t, 'square', f, f, 0.07, 0.07 + urgency * 0.05);
  }

  rushBeep(pos: Pos, urgency: number): void {
    const start = this.ctx.currentTime;
    const out = this.out(pos, 320);
    const frequency = 1400 + urgency * 900;
    const gain = 0.07 + urgency * 0.05;
    this.tone(out, start, 'square', frequency, frequency, 0.04, gain);
    this.tone(out, start + 0.06, 'square', frequency * 1.15, frequency * 1.15, 0.04, gain);
  }

  blackFriday(): void {
    const start = this.ctx.currentTime;
    this.noiseBurst(this.master, start, 2300, 2, 0.001, 0.065, 0.14);
    this.tone(this.master, start + 0.06, 'sine', 2350, 2320, 0.27, 0.16);
    this.tone(this.master, start + 0.06, 'sine', 3900, 3880, 0.19, 0.08);
    this.tone(this.master, start + 0.19, 'triangle', 500, 1450, 0.35, 0.14, 0.03);
  }

  boom(pos: Pos): void {
    const t = this.ctx.currentTime;
    const out = this.out(pos, 700);
    this.tone(out, t, 'sine', 110, 28, 1.1, 0.9);
    this.noiseBurst(out, t, 220, 0.5, 0.004, 1.1, 0.7, 'lowpass');
    this.noiseBurst(out, t, 1400, 0.7, 0.002, 0.35, 0.45, 'bandpass');
  }

  /** One keystroke on the bug's keyboard; played in quick runs while someone plants or defuses. */
  keystroke(pos: Pos): void {
    const t = this.ctx.currentTime;
    const out = this.out(pos, 260);
    this.noiseBurst(out, t, 3200 + Math.random() * 1800, 2.5, 0.001, 0.035, 0.22, 'bandpass');
    this.tone(out, t, 'square', 180, 120, 0.02, 0.03);
  }

  bombTaken(): void {
    const t = this.ctx.currentTime;
    this.tone(this.master, t, 'triangle', 660, 660, 0.09, 0.12);
    this.tone(this.master, t + 0.08, 'triangle', 990, 990, 0.12, 0.12);
  }

  denied(): void {
    const t = this.ctx.currentTime;
    this.tone(this.master, t, 'square', 220, 160, 0.12, 0.08);
    this.tone(this.master, t + 0.13, 'square', 180, 130, 0.14, 0.08);
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

  private ambientFilter(spec: AmbientFilter): BiquadFilterNode {
    const filter = this.ctx.createBiquadFilter();
    filter.type = spec.type;
    filter.frequency.value = spec.hz;
    if (spec.type === 'bandpass') filter.Q.value = spec.q;
    return filter;
  }

  private ambientModulation(input: AudioNode, output: AudioNode, spec: VoiceSpec['lfo']): AmbientLoop | undefined {
    if (!spec) {
      input.connect(output);
      return;
    }
    // Keep modulation upstream of the fade so it falls silent with the loop.
    const gain = this.ctx.createGain();
    const depth = this.ctx.createGain();
    depth.gain.value = spec.depth;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = spec.hz;
    lfo.connect(depth).connect(gain.gain);
    input.connect(gain).connect(output);
    lfo.start();
    return {
      stop: () => {
        lfo.stop();
        lfo.disconnect();
        depth.disconnect();
        gain.disconnect();
      },
    };
  }

  private ambientPanner(pos: NonNullable<Pos>, audibleUnits: number): PannerNode {
    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'linear';
    panner.refDistance = AMBIENT_FULL_LEVEL_UNITS;
    panner.maxDistance = audibleUnits;
    panner.rolloffFactor = 1;
    panner.positionX.value = pos.x;
    panner.positionY.value = pos.y;
    panner.positionZ.value = pos.z;
    return panner;
  }

  trackLoop(buffer: AudioBuffer, pos: NonNullable<Pos>, station: StationId, serverMs: number): AmbientLoop {
    const now = this.ctx.currentTime;
    let clock = this.trackClocks.get(station);
    if (!clock || (clock.active === 0 && now >= clock.fadesUntil)) {
      clock = { serverMs, audioSeconds: now, active: 0, fadesUntil: now };
      this.trackClocks.set(station, clock);
    }
    const timeline = clock;
    timeline.active += 1;
    // Keep overlaps sample-aligned even when network clock estimates are corrected.
    const trackMs = timeline.serverMs + (now - timeline.audioSeconds) * 1000;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = this.ctx.createGain();
    const panner = this.ambientPanner(pos, SPEAKER_AUDIBLE_UNITS);
    source.connect(gain).connect(panner).connect(this.music);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + AMBIENT_FADE_SECONDS);
    source.addEventListener('ended', () => {
      for (const node of [source, gain, panner]) node.disconnect();
    }, { once: true });
    source.start(now, trackOffsetSeconds(trackMs, buffer.duration));
    let stopped = false;
    return {
      stop: () => {
        if (stopped) return;
        stopped = true;
        const stopAt = this.ctx.currentTime;
        const end = stopAt + AMBIENT_FADE_SECONDS;
        timeline.active -= 1;
        timeline.fadesUntil = end;
        gain.gain.cancelAndHoldAtTime(stopAt);
        gain.gain.linearRampToValueAtTime(0, end);
        source.stop(end);
      },
    };
  }

  ambientLoop(voice: AmbientVoice, pos: NonNullable<Pos>): AmbientLoop {
    const spec = AMBIENT_VOICES[voice];
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const first = this.ambientFilter(spec.filters[0]);
    const second = this.ambientFilter(spec.filters[1]);
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    const panner = this.ambientPanner(pos, spec.audibleUnits);
    src.connect(first).connect(second);
    const modulation = this.ambientModulation(second, gain, spec.lfo);
    gain.connect(panner).connect(this.master);
    src.start(0, Math.random() * (NOISE_BUFFER_SEC - NOISE_OFFSET_MARGIN_SECONDS));
    gain.gain.setTargetAtTime(spec.gain, this.ctx.currentTime, spec.fadeSeconds / 3);
    let stopped = false;
    return {
      stop: () => {
        if (stopped) return;
        stopped = true;
        const now = this.ctx.currentTime;
        gain.gain.setTargetAtTime(0, now, spec.fadeSeconds / 3);
        // Retired on the audio clock, so a suspended context cannot cut the fade short.
        src.stop(now + spec.fadeSeconds * 2);
        src.addEventListener('ended', () => {
          modulation?.stop();
          for (const node of [src, first, second, gain, panner]) node.disconnect();
        });
      },
    };
  }

  dispose(): void {
    void this.ctx.close();
  }
}
