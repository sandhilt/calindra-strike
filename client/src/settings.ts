import { PLAYER_COLORS, PRIMARY_CHOICES, WEAPON, type WeaponId } from '@calindra-strike/shared';

import { type Quality, parseQuality } from './game/render/quality.ts';
import { DEFAULT_SOUND_PACK, isSoundPackId } from './game/sound-packs/index.ts';

export interface Settings {
  name: string;
  color: number;
  primary: WeaponId;
  code: string;
  sensitivity: number; // CS 1.6 scale (m_yaw 0.022)
  volume: number;
  soundPack: string;
  /** Spoken kill-streak lines on top of the chosen sound pack. */
  announcer: boolean;
  /** Other players' radio lines spoken aloud; off keeps only the text in the feed (CS 1.6 ignorerad, for sound). */
  radioVoice: boolean;
  fov: number; // horizontal FOV at 4:3, like CS
  crosshairColor: string;
  crosshairSize: number;
  crosshairGap: number;
  dynamicCrosshair: boolean;
  quality: Quality;
  showNet: boolean;
  /** The gun and its hands sit on the left of the view instead of the right. Only the first-person view changes. */
  leftHanded: boolean;
}

const KEY = 'calindra-strike:settings:v1';

export const CROSSHAIR_COLORS = ['#a5fa00', '#ffffff', '#3ec1ff', '#ff5fc4', '#ffd23f', '#ff5a4e'];

export const defaults = (): Settings => ({
  name: '',
  color: Math.floor(Math.random() * PLAYER_COLORS.length),
  primary: WEAPON.RIFLE,
  code: '',
  sensitivity: 2,
  volume: 0.7,
  soundPack: DEFAULT_SOUND_PACK,
  announcer: false,
  radioVoice: true,
  fov: 90,
  crosshairColor: CROSSHAIR_COLORS[0],
  crosshairSize: 6,
  crosshairGap: 3,
  dynamicCrosshair: true,
  quality: 'high',
  showNet: false,
  leftHanded: false,
});

const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : d);

export function loadSettings(): Settings {
  const d = defaults();
  let raw: unknown = null;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    raw = null;
  }
  if (!raw || typeof raw !== 'object') return d;
  const o = raw as Record<string, unknown>;
  return {
    name: typeof o.name === 'string' ? o.name.slice(0, 16) : d.name,
    color: num(o.color, 0, PLAYER_COLORS.length - 1, d.color),
    primary: (PRIMARY_CHOICES as readonly unknown[]).includes(o.primary) ? (o.primary as WeaponId) : d.primary,
    code: typeof o.code === 'string' ? o.code.slice(0, 64) : '',
    sensitivity: num(o.sensitivity, 0.1, 15, d.sensitivity),
    volume: num(o.volume, 0, 1, d.volume),
    soundPack: isSoundPackId(o.soundPack) ? o.soundPack : d.soundPack,
    // The announcer used to be a sound pack of its own; whoever picked it keeps the voice on top of the classic pack.
    announcer: typeof o.announcer === 'boolean' ? o.announcer : o.soundPack === 'announcer',
    radioVoice: typeof o.radioVoice === 'boolean' ? o.radioVoice : d.radioVoice,
    fov: num(o.fov, 70, 115, d.fov),
    crosshairColor: CROSSHAIR_COLORS.includes(o.crosshairColor as string) ? (o.crosshairColor as string) : d.crosshairColor,
    crosshairSize: num(o.crosshairSize, 2, 16, d.crosshairSize),
    crosshairGap: num(o.crosshairGap, 0, 12, d.crosshairGap),
    dynamicCrosshair: typeof o.dynamicCrosshair === 'boolean' ? o.dynamicCrosshair : d.dynamicCrosshair,
    quality: parseQuality(o.quality),
    showNet: o.showNet === true,
    leftHanded: o.leftHanded === true,
  };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable (private mode etc.): settings just won't persist */
  }
}
