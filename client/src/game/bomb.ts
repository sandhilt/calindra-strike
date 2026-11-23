import { BLACK_FRIDAY_DISCOUNT_PERCENT, BLACK_FRIDAY_FUSE_MS, BOMB_SITE_RADIUS_UNITS, DEFUSE_MS, DEFUSE_RADIUS_UNITS, PLANT_MS, TEAMS, fuseMs, inBombReach, type BombAction, type BombPoint, type GameMode } from '@calindra-strike/shared';

export type BombView = { x: number; y: number; z: number; variant: number; attackers: number; blackFriday: boolean; plantByAt: number } & (
  | { state: 'home' }
  | { state: 'carried'; carrier: number }
  | { state: 'planting'; carrier: number; doneAt: number }
  | { state: 'dropped'; handOverAt: number }
  | { state: 'planted'; explodeAt: number; defuser: number; defuseDoneAt: number }
);

/** Parses the snapshot's bm row; an empty row means the mode has no bomb. */
export function bombView(row: readonly number[]): BombView | null {
  if (row.length === 0) return null;
  const [state, actor, x, y, z, explodeAt, defuseDoneAt, variant, attackers, plantDoneAt, blackFriday, plantByAt = 0] = row;
  const at = { x, y, z, variant, attackers, blackFriday: blackFriday === 1, plantByAt };
  if (state === 1) return { ...at, state: 'carried', carrier: actor };
  if (state === 2) return { ...at, state: 'planting', carrier: actor, doneAt: plantDoneAt };
  if (state === 3) return { ...at, state: 'dropped', handOverAt: explodeAt };
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

/** Seconds the attackers still have to plant, null once planted or when the server has no limit. */
export function plantSecondsLeft(bomb: BombView, now: number): number | null {
  return bomb.state === 'planted' || bomb.plantByAt <= 0 ? null : Math.max(0, Math.ceil((bomb.plantByAt - now) / 1000));
}

export function secondsLeft(bomb: BombView, now: number): number {
  return bomb.state === 'planted' ? Math.max(0, Math.ceil((bomb.explodeAt - now) / 1000)) : 0;
}

/** 0 right after planting, 1 at the explosion. */
export function fuseUrgency(bomb: BombView, now: number): number {
  return bomb.state === 'planted' ? 1 - clamp01((bomb.explodeAt - now) / fuseMs(bomb.blackFriday)) : 0;
}

const BEEP_SLOW_MS = 1000;
const BEEP_FAST_MS = 140;

export function beepIntervalMs(urgency: number): number {
  return BEEP_SLOW_MS + (BEEP_FAST_MS - BEEP_SLOW_MS) * clamp01(urgency);
}

/** The Black Friday sale label: the fuse itself is on sale. */
export const BLACK_FRIDAY_TAG = `BLACK FRIDAY ${BLACK_FRIDAY_DISCOUNT_PERCENT}% OFF`;

/** What the Black Friday announcement says: how much of the fuse is left. */
export const BLACK_FRIDAY_PITCH = `${BLACK_FRIDAY_DISCOUNT_PERCENT}% OFF no pavio · só ${BLACK_FRIDAY_FUSE_MS / 1000}s para desarmar`;

export function bombStatus(bomb: BombView, now: number, viewerId: number, viewerTeam: number, name: (id: number) => string, practice = false): string {
  const status = roundStatus(bomb, now, viewerId, viewerTeam, name, practice);
  return bomb.blackFriday ? `${BLACK_FRIDAY_TAG} · ${status}` : status;
}

function roundStatus(bomb: BombView, now: number, viewerId: number, viewerTeam: number, name: (id: number) => string, practice: boolean): string {
  const status = phaseStatus(bomb, now, viewerId, viewerTeam, name, practice);
  const left = bomb.state === 'dropped' ? null : plantSecondsLeft(bomb, now);
  return left === null ? status : `${status} · ${left}s para plantar`;
}

function phaseStatus(bomb: BombView, now: number, viewerId: number, viewerTeam: number, name: (id: number) => string, practice: boolean): string {
  const attacking = practice || viewerTeam === bomb.attackers;
  const watching = viewerTeam < 0;
  if (bomb.state === 'home') return watching ? 'o bug está na base' : attacking ? 'pegue o bug na base' : 'defenda o site';
  if (bomb.state === 'dropped') {
    // The plant window can close before the floor timer runs out; whichever comes first hands the bug over.
    const handOverAt = bomb.plantByAt > 0 ? Math.min(bomb.handOverAt, bomb.plantByAt) : bomb.handOverAt;
    const fallen = attacking ? 'o bug caiu · pegue-o' : 'o bug caiu no chão';
    if (handOverAt <= 0) return fallen;
    return `${fallen} · troca de lado em ${Math.max(0, Math.ceil((handOverAt - now) / 1000))}s`;
  }
  if (bomb.state === 'carried' || bomb.state === 'planting') {
    if (bomb.carrier === viewerId) return bomb.state === 'planting' ? 'plantando…' : 'segure E no site para plantar';
    return bomb.state === 'planting' ? `${name(bomb.carrier)} está plantando` : `${name(bomb.carrier)} leva o bug`;
  }
  if (bomb.defuser === viewerId) return 'desarmando…';
  const clock = practice ? '' : ` · ${secondsLeft(bomb, now)}s`;
  if (bomb.defuser >= 0) return `${name(bomb.defuser)} desarma o bug${clock}`;
  const hint = practice || (!attacking && !watching) ? ' · segure E perto dele' : '';
  return `bug plantado${clock}${hint}`;
}

export interface CarryNotice { title: string; hint: string }

/** The warning shown to the player who holds the bug, null for everyone else (spectators included). */
export function carryNotice(bomb: BombView, viewerId: number): CarryNotice | null {
  if ((bomb.state !== 'carried' && bomb.state !== 'planting') || bomb.carrier !== viewerId) return null;
  return bomb.state === 'planting'
    ? { title: 'plantando o bug', hint: 'não solte o E até terminar' }
    : { title: 'você está com o bug', hint: 'leve até o círculo vermelho e segure E' };
}

export interface BombRole { side: 'attack' | 'defend'; label: string; goal: string }

/** The viewer's side in a defuse round and what it has to do right now, or null for spectators. */
export function bombRole(bomb: BombView, viewerTeam: number, practice = false): BombRole | null {
  if (viewerTeam !== 0 && viewerTeam !== 1) return null;
  const planted = bomb.state === 'planted';
  if (practice) return { side: planted ? 'defend' : 'attack', label: 'treino', goal: planted ? 'desarme o bug' : 'plante o bug' };
  if (viewerTeam === bomb.attackers) return { side: 'attack', label: 'ataque', goal: planted ? 'proteja o bug' : 'plante o bug' };
  return { side: 'defend', label: 'defesa', goal: planted ? 'desarme o bug' : 'impeça o plantio' };
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
    case 'expired': return `o tempo acabou · o bug agora é dos ${winner}`;
    case 'abandoned': return `o bug ficou no chão · agora é dos ${winner}`;
  }
}

export function scoreUnit(mode: GameMode): string {
  if (mode === 'ctf') return 'capturas';
  if (mode === 'defuse') return 'pontos';
  if (mode === 'almoco') return 'rodadas';
  return 'kills';
}

export interface UseAttempt {
  bomb: BombView;
  myId: number;
  myTeam: number;
  me: BombPoint;
  site: BombPoint;
  name: (id: number) => string;
  practice?: boolean;
}

/** Why pressing E does nothing where the player stands, or null when it plants or defuses. */
export function useRefusal({ bomb, myId, myTeam, me, site, name, practice = false }: UseAttempt): string | null {
  if (myTeam !== 0 && myTeam !== 1) return null;
  const planting = practice ? bomb.state !== 'planted' : myTeam === bomb.attackers;
  if (planting) {
    if (bomb.state === 'home' || bomb.state === 'dropped') return 'encoste no bug para pegá-lo';
    if (bomb.state === 'planted') return 'o bug já está plantado · proteja-o';
    if (bomb.carrier !== myId) return `${name(bomb.carrier)} está com o bug`;
    return inBombReach(me, site, BOMB_SITE_RADIUS_UNITS) ? null : 'leve o bug até o site (círculo vermelho)';
  }
  if (bomb.state !== 'planted') return 'só dá para desarmar depois que o bug for plantado';
  if (bomb.defuser >= 0 && bomb.defuser !== myId) return `${name(bomb.defuser)} já está desarmando`;
  return inBombReach(me, bomb, DEFUSE_RADIUS_UNITS) ? null : 'chegue mais perto do laptop para desarmar';
}
