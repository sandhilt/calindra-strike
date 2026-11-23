import { DEG, clamp } from './math.ts';

export const WEAPON = {
  HAMMER: 0,
  PISTOL: 1,
  RIFLE: 2,
  SMG: 3,
  SHOTGUN: 4,
  SNIPER: 5,
  LMG: 6,
} as const;
export type WeaponId = (typeof WEAPON)[keyof typeof WEAPON];
export const WEAPON_COUNT = 7;

export interface SpreadDef {
  base: number; // radians, standing still
  move: number; // added at full run speed
  air: number; // added while airborne
  duckMult: number;
  perShot: number; // added per consecutive shot (spray inaccuracy)
  perShotMax: number;
  scoped?: number; // replaces base while zoomed
}

export interface RecoilDef {
  climb: number; // degrees per shot at the start of a spray
  maxPitch: number; // degrees, asymptotic climb
  sway: number; // degrees of horizontal wander once the climb settles
  swayPeriod: number; // shots per full horizontal cycle
  swayStart: number; // shot index where the wander begins
  recovery: number; // recoil index recovered per second when not firing
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  tag: string; // short HUD label
  slot: 1 | 2 | 3;
  legendary: boolean;
  damage: number;
  pellets: number;
  headMult: number;
  rangeMod: number; // damage *= rangeMod ^ (distance / 500)
  range: number;
  armorPen: number; // CS "armor ratio": share of damage that goes through armor
  fireTicks: number;
  auto: boolean;
  mag: number;
  reserve: number;
  /** Ticks to reload from an empty magazine. Derived from `reloadTiming`, never set by hand. */
  reloadTicks: number;
  /** Null when the weapon cannot reload. */
  reloadTiming: ReloadTiming | null;
  deployTicks: number;
  speed: number;
  scopedSpeed: number;
  zoomFov: number[]; // CS-style FOV per zoom level: horizontal degrees at 4:3 (default view is 90)
  /** CS 1.6 AWP behaviour: discrete accuracy table and automatic re-scope after each bolt cycle. */
  csSniper?: boolean;
  spread: SpreadDef;
  recoil: RecoilDef;
  heavy?: { damage: number; ticks: number }; // melee alt attack
}

/**
 * Reload phases in ticks (60 per second), one row per weapon. Magazine weapons
 * swap the magazine out, push the fresh one in, then rack the slide or bolt.
 * The shotgun loads one shell per step like the CS 1.6 M3: a short start, one
 * shell step per round and a pump after the last one.
 */
export type ReloadTiming =
  | { kind: 'magazine'; outTicks: number; inTicks: number; boltTicks: number }
  | { kind: 'shells'; startTicks: number; shellTicks: number; pumpTicks: number };

export type ShellReloadTiming = Extract<ReloadTiming, { kind: 'shells' }>;

export const RELOAD_TIMING: Readonly<Record<WeaponId, ReloadTiming | null>> = {
  [WEAPON.HAMMER]: null,
  [WEAPON.PISTOL]: { kind: 'magazine', outTicks: 42, inTicks: 52, boltTicks: 36 },
  [WEAPON.RIFLE]: { kind: 'magazine', outTicks: 55, inTicks: 55, boltTicks: 40 },
  [WEAPON.SMG]: { kind: 'magazine', outTicks: 45, inTicks: 45, boltTicks: 35 },
  [WEAPON.SHOTGUN]: { kind: 'shells', startTicks: 20, shellTicks: 20, pumpTicks: 20 },
  [WEAPON.SNIPER]: { kind: 'magazine', outTicks: 50, inTicks: 55, boltTicks: 45 },
  [WEAPON.LMG]: { kind: 'magazine', outTicks: 100, inTicks: 110, boltTicks: 70 },
};

/** Total ticks of a reload that loads `shells` rounds (ignored by magazine weapons). */
export function reloadTotalTicks(t: ReloadTiming, shells: number): number {
  return t.kind === 'magazine' ? t.outTicks + t.inTicks + t.boltTicks : t.startTicks + shells * t.shellTicks + t.pumpTicks;
}

/** Ticks of one shell step. The step that loads the last round also includes the pump. */
export function shellStepTicks(t: ShellReloadTiming, shellsLeft: number): number {
  return t.shellTicks + (shellsLeft === 1 ? t.pumpTicks : 0);
}

export type ReloadPhase = 'out' | 'in' | 'bolt' | 'start' | 'shell' | 'pump';

export interface ReloadCursor {
  phase: ReloadPhase;
  /** 0..1 inside the phase. */
  t: number;
  /** Shell step index while phase is 'shell', 0 otherwise. */
  shell: number;
}

/** Where a reload that began `elapsedTicks` ago is, or null before it starts and after it ends. */
export function reloadCursor(timing: ReloadTiming, elapsedTicks: number, shells: number): ReloadCursor | null {
  if (elapsedTicks < 0 || elapsedTicks >= reloadTotalTicks(timing, shells)) return null;
  const at = (phase: ReloadPhase, from: number, len: number, shell = 0): ReloadCursor => ({ phase, t: (elapsedTicks - from) / len, shell });
  if (timing.kind === 'magazine') {
    const { outTicks, inTicks, boltTicks } = timing;
    if (elapsedTicks < outTicks) return at('out', 0, outTicks);
    if (elapsedTicks < outTicks + inTicks) return at('in', outTicks, inTicks);
    return at('bolt', outTicks + inTicks, boltTicks);
  }
  const { startTicks, shellTicks, pumpTicks } = timing;
  if (elapsedTicks < startTicks) return at('start', 0, startTicks);
  const loadEnd = startTicks + shells * shellTicks;
  if (elapsedTicks >= loadEnd) return at('pump', loadEnd, pumpTicks);
  const shell = Math.floor((elapsedTicks - startTicks) / shellTicks);
  return at('shell', startTicks + shell * shellTicks, shellTicks, shell);
}

/** Moments of a reload that make a sound, as a fraction of the phase they belong to. */
export const RELOAD_CUE_AT = { out: 0.35, in: 0.75, bolt: 0.08, shell: 0.85, pump: 0.05 } as const;
export type ReloadCue = keyof typeof RELOAD_CUE_AT;
export interface ReloadCueAt {
  tick: number;
  cue: ReloadCue;
}

/** Every sound of a reload that loads `shells` rounds, in order, as ticks since the reload began. */
export function reloadCues(timing: ReloadTiming, shells: number): ReloadCueAt[] {
  if (timing.kind === 'magazine') {
    const { outTicks, inTicks, boltTicks } = timing;
    return [
      { tick: outTicks * RELOAD_CUE_AT.out, cue: 'out' },
      { tick: outTicks + inTicks * RELOAD_CUE_AT.in, cue: 'in' },
      { tick: outTicks + inTicks + boltTicks * RELOAD_CUE_AT.bolt, cue: 'bolt' },
    ];
  }
  const { startTicks, shellTicks, pumpTicks } = timing;
  const cues: ReloadCueAt[] = [];
  for (let i = 0; i < shells; i++) cues.push({ tick: startTicks + (i + RELOAD_CUE_AT.shell) * shellTicks, cue: 'shell' });
  cues.push({ tick: startTicks + shells * shellTicks + pumpTicks * RELOAD_CUE_AT.pump, cue: 'pump' });
  return cues;
}

type WeaponSpec = Omit<WeaponDef, 'reloadTicks' | 'reloadTiming'>;

const W = (d: WeaponSpec): WeaponDef => {
  const reloadTiming = RELOAD_TIMING[d.id];
  return { ...d, reloadTiming, reloadTicks: reloadTiming ? reloadTotalTicks(reloadTiming, d.mag) : 0 };
};

export const WEAPONS: readonly WeaponDef[] = [
  W({
    id: WEAPON.HAMMER,
    name: 'Martelo do Eitri',
    tag: 'MARTELO',
    slot: 3,
    legendary: false,
    damage: 55,
    pellets: 1,
    headMult: 1.4,
    rangeMod: 1,
    range: 72,
    armorPen: 0.85,
    fireTicks: 27,
    auto: true,
    mag: 0,
    reserve: 0,
    deployTicks: 30,
    speed: 280,
    scopedSpeed: 280,
    zoomFov: [],
    spread: { base: 0, move: 0, air: 0, duckMult: 1, perShot: 0, perShotMax: 0 },
    recoil: { climb: 0, maxPitch: 0, sway: 0, swayPeriod: 1, swayStart: 99, recovery: 10 },
    heavy: { damage: 95, ticks: 60 },
  }),
  W({
    id: WEAPON.PISTOL,
    name: 'Faísca P9',
    tag: 'FAÍSCA',
    slot: 2,
    legendary: false,
    damage: 34,
    pellets: 1,
    headMult: 4,
    rangeMod: 0.79,
    range: 4096,
    armorPen: 0.5,
    fireTicks: 9,
    auto: false,
    mag: 12,
    reserve: 48,
    deployTicks: 40,
    speed: 250,
    scopedSpeed: 250,
    zoomFov: [],
    spread: { base: 0.006, move: 0.05, air: 0.18, duckMult: 0.8, perShot: 0.018, perShotMax: 0.06 },
    recoil: { climb: 1.4, maxPitch: 6, sway: 0.6, swayPeriod: 6, swayStart: 2, recovery: 7 },
  }),
  W({
    id: WEAPON.RIFLE,
    name: 'Forja R7',
    tag: 'R7',
    slot: 1,
    legendary: false,
    damage: 36,
    pellets: 1,
    headMult: 4,
    rangeMod: 0.98,
    range: 8192,
    armorPen: 0.775,
    fireTicks: 6,
    auto: true,
    mag: 30,
    reserve: 90,
    deployTicks: 60,
    speed: 221,
    scopedSpeed: 221,
    zoomFov: [],
    spread: { base: 0.0035, move: 0.11, air: 0.25, duckMult: 0.75, perShot: 0.004, perShotMax: 0.035 },
    recoil: { climb: 0.75, maxPitch: 7, sway: 1.6, swayPeriod: 14, swayStart: 7, recovery: 8 },
  }),
  W({
    id: WEAPON.SMG,
    name: 'Brokkr SMG',
    tag: 'BROKKR',
    slot: 1,
    legendary: false,
    damage: 26,
    pellets: 1,
    headMult: 4,
    rangeMod: 0.84,
    range: 4096,
    armorPen: 0.6,
    fireTicks: 5,
    auto: true,
    mag: 30,
    reserve: 120,
    deployTicks: 45,
    speed: 240,
    scopedSpeed: 240,
    zoomFov: [],
    spread: { base: 0.009, move: 0.04, air: 0.15, duckMult: 0.8, perShot: 0.002, perShotMax: 0.02 },
    recoil: { climb: 0.45, maxPitch: 4, sway: 1, swayPeriod: 10, swayStart: 5, recovery: 9 },
  }),
  W({
    id: WEAPON.SHOTGUN,
    name: 'Trovão 12',
    tag: 'TROVÃO',
    slot: 1,
    legendary: false,
    damage: 22,
    pellets: 9,
    headMult: 2,
    rangeMod: 0.6,
    range: 3000,
    armorPen: 0.5,
    fireTicks: 50,
    auto: false,
    mag: 7,
    reserve: 28,
    deployTicks: 50,
    speed: 230,
    scopedSpeed: 230,
    zoomFov: [],
    spread: { base: 0.065, move: 0.02, air: 0.06, duckMult: 0.9, perShot: 0, perShotMax: 0 },
    recoil: { climb: 3, maxPitch: 6, sway: 0, swayPeriod: 1, swayStart: 99, recovery: 3 },
  }),
  W({
    id: WEAPON.SNIPER,
    name: 'Mjölnir',
    tag: 'AWP',
    slot: 1,
    legendary: true,
    damage: 115,
    pellets: 1,
    headMult: 4,
    rangeMod: 0.99,
    range: 8192,
    armorPen: 0.97,
    fireTicks: 87,
    auto: false,
    mag: 10,
    reserve: 20,
    deployTicks: 70,
    speed: 210,
    scopedSpeed: 150,
    zoomFov: [40, 10],
    csSniper: true,
    spread: { base: 0.001, move: 0, air: 0, duckMult: 1, perShot: 0, perShotMax: 0 },
    recoil: { climb: 2, maxPitch: 2, sway: 0, swayPeriod: 1, swayStart: 99, recovery: 2 },
  }),
  W({
    id: WEAPON.LMG,
    name: 'Ragnarök',
    tag: 'RAGNARÖK',
    slot: 1,
    legendary: true,
    damage: 33,
    pellets: 1,
    headMult: 4,
    rangeMod: 0.97,
    range: 8192,
    armorPen: 0.8,
    fireTicks: 5,
    auto: true,
    mag: 100,
    reserve: 100,
    deployTicks: 75,
    speed: 215,
    scopedSpeed: 215,
    zoomFov: [],
    spread: { base: 0.012, move: 0.08, air: 0.25, duckMult: 0.7, perShot: 0.001, perShotMax: 0.02 },
    recoil: { climb: 0.5, maxPitch: 5, sway: 2.2, swayPeriod: 18, swayStart: 8, recovery: 7 },
  }),
];

export const PRIMARY_CHOICES: readonly WeaponId[] = [WEAPON.RIFLE, WEAPON.SMG, WEAPON.SHOTGUN];
export const LEGENDARIES: readonly WeaponId[] = [WEAPON.SNIPER, WEAPON.LMG];

/** Airdrop contents: the AWP-style Mjölnir is the headline item (about 2 in 3 crates). */
export function pickLegendary(r: number): WeaponId {
  return r < 0.65 ? WEAPON.SNIPER : WEAPON.LMG;
}

/** CS 1.6 AWP accuracy (cone units), straight from the 1.6 logic: stand still and scope. */
export function csSniperSpread(onGround: boolean, speed: number, lowered: boolean, zoomed: boolean): number {
  let spread: number;
  if (!onGround) spread = 0.85;
  else if (speed > 140) spread = 0.25;
  else if (speed > 10) spread = 0.1;
  else if (lowered) spread = 0;
  else spread = 0.001;
  if (!zoomed) spread += 0.08;
  return spread;
}

export function weaponDef(id: number): WeaponDef {
  return WEAPONS[id] ?? WEAPONS[WEAPON.HAMMER];
}

/** Rounds a reload still has to load: the room in the magazine, limited by the reserve. */
export function shellsToLoad(def: WeaponDef, mag: number, reserve: number): number {
  return Math.max(0, Math.min(def.mag - mag, reserve));
}

export function isWeaponId(v: unknown): v is WeaponId {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < WEAPON_COUNT;
}

/**
 * Recoil as a smooth, learnable pattern: a fast vertical climb that settles,
 * then a slow horizontal wander, like a CS spray. Returns [pitch, yaw] in radians.
 */
export function recoilOffset(def: WeaponDef, index: number): [number, number] {
  if (index <= 0 || def.recoil.climb === 0) return [0, 0];
  const r = def.recoil;
  const pitch = r.maxPitch * (1 - Math.exp((-index * r.climb) / r.maxPitch));
  let yaw = 0;
  if (index > r.swayStart && r.sway > 0) {
    const k = index - r.swayStart;
    const ramp = clamp(k / 3, 0, 1);
    yaw = r.sway * ramp * Math.sin((k / r.swayPeriod) * Math.PI * 2);
  }
  return [pitch * DEG, yaw * DEG];
}

/** CS-style armour absorption. Returns health damage and armour consumed. */
export function absorbArmor(damage: number, armor: number, armorPen: number): { hp: number; armorLoss: number } {
  if (armor <= 0) return { hp: damage, armorLoss: 0 };
  let hp = damage * armorPen;
  let armorLoss = (damage - hp) * 0.5;
  if (armorLoss > armor) {
    armorLoss = armor;
    hp = damage - armor * 2;
  }
  return { hp, armorLoss };
}
