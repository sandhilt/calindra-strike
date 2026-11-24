import { WEAPON, type ReloadCue, type WeaponId } from '@calindra-strike/shared';
import type { Pos, SoundKit } from './sound-packs/types.ts';

/** Reload sounds, synthesized with WebAudio like every other sound (no sampled assets). */

type Family = 'pistol' | 'rifle' | 'smg' | 'sniper' | 'lmg' | 'shotgun';

const FAMILY_OF: Readonly<Record<WeaponId, Family | null>> = {
  [WEAPON.HAMMER]: null,
  [WEAPON.MGL]: 'rifle',
  [WEAPON.PISTOL]: 'pistol',
  [WEAPON.RIFLE]: 'rifle',
  [WEAPON.SMG]: 'smg',
  [WEAPON.SHOTGUN]: 'shotgun',
  [WEAPON.SNIPER]: 'sniper',
  [WEAPON.LMG]: 'lmg',
};

interface Flavour {
  /** Pitch of the metal catches, in Hz. */
  clickHz: number;
  /** Pitch of the thump of a magazine seating or a bolt closing, in Hz. */
  bodyHz: number;
  /** Loudness and heft: light pistol and SMG parts, heavy sniper and belt box parts. */
  weight: number;
  /** Length of the metal slide when a magazine leaves, in seconds. */
  slideSeconds: number;
  /** Time between drawing the bolt back and letting it go, in seconds. */
  rackSeconds: number;
}

const FLAVOUR: Readonly<Record<Family, Flavour>> = {
  pistol: { clickHz: 3600, bodyHz: 150, weight: 0.8, slideSeconds: 0.07, rackSeconds: 0.17 },
  rifle: { clickHz: 3000, bodyHz: 120, weight: 1, slideSeconds: 0.11, rackSeconds: 0.22 },
  smg: { clickHz: 3400, bodyHz: 135, weight: 0.85, slideSeconds: 0.08, rackSeconds: 0.19 },
  sniper: { clickHz: 2500, bodyHz: 100, weight: 1.15, slideSeconds: 0.14, rackSeconds: 0.3 },
  lmg: { clickHz: 2100, bodyHz: 75, weight: 1.4, slideSeconds: 0.2, rackSeconds: 0.25 },
  shotgun: { clickHz: 2700, bodyHz: 105, weight: 1.1, slideSeconds: 0.1, rackSeconds: 0.17 },
};

/** Gain of one sound before the flavour weight, tuned against the shot sounds in audio.ts. */
const BASE_GAIN = 0.2;
/** Distance within which a reload is heard at full level, in world units. */
const HEARING_REF_UNITS = 200;

/** A short metal tick: a narrow noise burst over a tiny square blip. */
function click(kit: SoundKit, out: AudioNode, t: number, hz: number, gain: number): void {
  kit.noiseBurst(out, t, hz, 4, 0.0008, 0.018, gain);
  kit.tone(out, t, 'square', hz / 3, hz / 5, 0.014, gain * 0.2);
}

/** A heavy clack: the tick with a body thump and a wide noise knock under it. */
function clack(kit: SoundKit, out: AudioNode, t: number, f: Flavour, gain: number): void {
  click(kit, out, t, f.clickHz, gain * 0.9);
  kit.noiseBurst(out, t, f.clickHz * 0.35, 1.6, 0.001, 0.05, gain);
  kit.tone(out, t, 'triangle', f.bodyHz * 1.7, f.bodyHz * 0.7, 0.08, gain * 0.9);
}

/** Metal rubbing on metal: a soft band of noise that swells and dies away. */
function slide(kit: SoundKit, out: AudioNode, t: number, seconds: number, hz: number, gain: number): void {
  kit.noiseBurst(out, t, hz, 1.2, seconds * 0.4, seconds * 0.6, gain);
}

function magazineOut(kit: SoundKit, out: AudioNode, family: Family, f: Flavour, t: number, g: number): void {
  click(kit, out, t, f.clickHz, g);
  slide(kit, out, t + 0.03, f.slideSeconds, f.clickHz * 0.9, g * 0.55);
  if (family !== 'lmg') return;
  // belt box: the lid pops up and the loose belt rattles
  kit.tone(out, t, 'triangle', 190, 90, 0.12, g * 0.9);
  for (let i = 0; i < 5; i++) click(kit, out, t + 0.1 + i * 0.04, 2800 - i * 220, g * 0.35);
}

function magazineIn(kit: SoundKit, out: AudioNode, family: Family, f: Flavour, t: number, g: number): void {
  clack(kit, out, t, f, g);
  click(kit, out, t + 0.06, f.clickHz * 0.8, g * 0.5);
  if (family !== 'lmg') return;
  // belt box: the lid slams shut
  clack(kit, out, t + 0.14, f, g * 0.8);
  for (let i = 0; i < 3; i++) click(kit, out, t + 0.22 + i * 0.05, 2400 - i * 250, g * 0.3);
}

function bolt(kit: SoundKit, out: AudioNode, family: Family, f: Flavour, t: number, g: number): void {
  if (family === 'sniper') {
    click(kit, out, t, f.clickHz, g * 0.8);
    slide(kit, out, t + 0.05, 0.2, f.clickHz, g * 0.6);
    slide(kit, out, t + f.rackSeconds, 0.14, f.clickHz * 0.9, g * 0.6);
    clack(kit, out, t + f.rackSeconds + 0.16, f, g);
    return;
  }
  slide(kit, out, t, 0.12, f.clickHz, g * 0.7);
  click(kit, out, t + 0.1, f.clickHz * 1.1, g * 0.6);
  clack(kit, out, t + f.rackSeconds, f, g);
}

function shell(kit: SoundKit, out: AudioNode, f: Flavour, t: number, g: number): void {
  click(kit, out, t, f.clickHz * 0.7, g * 0.8);
  kit.tone(out, t + 0.01, 'triangle', 2700, 2300, 0.07, g * 0.25);
  kit.noiseBurst(out, t, 900, 1.5, 0.002, 0.04, g * 0.5);
}

function pump(kit: SoundKit, out: AudioNode, f: Flavour, t: number, g: number): void {
  slide(kit, out, t, 0.1, f.clickHz, g * 0.8);
  click(kit, out, t + 0.08, f.clickHz, g * 0.7);
  clack(kit, out, t + f.rackSeconds, f, g * 1.1);
}

/** Plays one sound of a reload. `pos` places it in the world; null plays it flat for the local player. */
export function playReloadCue(kit: SoundKit, weapon: WeaponId, cue: ReloadCue, pos: Pos): void {
  const family = FAMILY_OF[weapon];
  if (!family) return;
  const f = FLAVOUR[family];
  const out = kit.out(pos, HEARING_REF_UNITS);
  const t = kit.ctx.currentTime;
  const g = BASE_GAIN * f.weight;
  switch (cue) {
    case 'out':
      return magazineOut(kit, out, family, f, t, g);
    case 'in':
      return magazineIn(kit, out, family, f, t, g);
    case 'bolt':
      return bolt(kit, out, family, f, t, g);
    case 'shell':
      return shell(kit, out, f, t, g);
    case 'pump':
      return pump(kit, out, f, t, g);
  }
}
