import { DEFUSE_MS, FUSE_MS, PLANT_MS, TEAMS, type BombAction, type GameMode } from '@calindra-strike/shared';

export type BombView = { x: number; y: number; z: number; variant: number; attackers: number } & (
  | { state: 'home' }
  | { state: 'carried'; carrier: number }
  | { state: 'planting'; carrier: number; doneAt: number }
  | { state: 'dropped' }
  | { state: 'planted'; explodeAt: number; defuser: number; defuseDoneAt: number }
);

/** Parses the snapshot's bm row; an empty row means the mode has no bomb. */
export function bombView(row: readonly number[]): BombView | null {
  if (row.length === 0) return null;
  const [state, actor, x, y, z, explodeAt, defuseDoneAt, variant, attackers, plantDoneAt] = row;
  const at = { x, y, z, variant, attackers };
  if (state === 1) return { ...at, state: 'carried', carrier: actor };
  if (state === 2) return { ...at, state: 'planting', carrier: actor, doneAt: plantDoneAt };
  if (state === 3) return { ...at, state: 'dropped' };
  if (state === 4) return { ...at, state: 'planted', explodeAt, defuser: actor, defuseDoneAt };
  return { ...at, state: 'home' };
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** How long the defuser keeps seeing the "bug corrigido" banner after the defuse lands, in ms. */
export const DEFUSE_BANNER_MS = 3000;

export interface DefuseBanner { variant: number; until: number }

/** The finished laptop screen while the banner is still due, null afterwards. */
export function defuseBannerScene(banner: DefuseBanner | null, now: number): { variant: number; progress: number; timeMs: number } | null {
  return banner && now < banner.until ? { variant: banner.variant, progress: 1, timeMs: now } : null;
}

export function defuseProgress(bomb: BombView, now: number): number {
  if (bomb.state !== 'planted' || bomb.defuser < 0) return 0;
  return clamp01(1 - (bomb.defuseDoneAt - now) / DEFUSE_MS);
}

/** -1 when nobody is planting. */
export function plantProgress(bomb: BombView, now: number): number {
  return bomb.state === 'planting' ? clamp01(1 - (bomb.doneAt - now) / PLANT_MS) : -1;
}

export function secondsLeft(bomb: BombView, now: number): number {
  return bomb.state === 'planted' ? Math.max(0, Math.ceil((bomb.explodeAt - now) / 1000)) : 0;
}

/** 0 right after planting, 1 at the explosion. */
export function fuseUrgency(bomb: BombView, now: number): number {
  return bomb.state === 'planted' ? 1 - clamp01((bomb.explodeAt - now) / FUSE_MS) : 0;
}

const BEEP_SLOW_MS = 1000;
const BEEP_FAST_MS = 140;

export function beepIntervalMs(urgency: number): number {
  return BEEP_SLOW_MS + (BEEP_FAST_MS - BEEP_SLOW_MS) * clamp01(urgency);
}

export function bombStatus(bomb: BombView, now: number, viewerId: number, viewerTeam: number, name: (id: number) => string): string {
  const attacking = viewerTeam === bomb.attackers;
  const watching = viewerTeam < 0;
  if (bomb.state === 'home') return watching ? 'o bug está na base' : attacking ? 'pegue o bug na base' : 'defenda o site';
  if (bomb.state === 'dropped') return attacking ? 'o bug caiu · pegue-o' : 'o bug caiu no chão';
  if (bomb.state === 'carried' || bomb.state === 'planting') {
    if (bomb.carrier === viewerId) return bomb.state === 'planting' ? 'plantando…' : 'segure E no site para plantar';
    return bomb.state === 'planting' ? `${name(bomb.carrier)} está plantando` : `${name(bomb.carrier)} leva o bug`;
  }
  if (bomb.defuser === viewerId) return 'desarmando…';
  const left = secondsLeft(bomb, now);
  if (bomb.defuser >= 0) return `${name(bomb.defuser)} desarma o bug · ${left}s`;
  const hint = !attacking && !watching ? ' · segure E perto dele' : '';
  return `bug plantado · ${left}s${hint}`;
}

export function bombMessage(what: BombAction, team: number, name: string): string {
  const winner = TEAMS[team]?.name ?? '';
  switch (what) {
    case 'take': return `${name} pegou o bug`;
    case 'drop': return `${name} derrubou o bug`;
    case 'return': return 'o bug voltou para a base';
    case 'plant': return `${name} plantou o bug!`;
    case 'defuse': return `${name} começou a desarmar o bug`;
    case 'defused': return `${name} desarmou o bug · ponto dos ${winner}`;
    case 'exploded': return `o bug explodiu · ponto dos ${winner}`;
  }
}

export function scoreUnit(mode: GameMode): string {
  if (mode === 'ctf') return 'capturas';
  if (mode === 'defuse') return 'pontos';
  return 'kills';
}
