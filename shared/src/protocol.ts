import type { FlagEvent } from './ctf.ts';
import type { BombEvent } from './defuse.ts';
import type { LunchEvent } from './lunch.ts';
import { BTN_MASK, CHAT_MAX_LEN, CMDS_PER_PACKET_MAX, NAME_MAX_LEN, PLAYER_COLORS } from './constants.ts';
import { radioLine } from './radio.ts';
import type { Cmd, PlayerState } from './sim.ts';
import { STANCE, type Stance } from './stance.ts';
import { PRIMARY_CHOICES, WEAPON_COUNT, type WeaponId } from './weapons.ts';

export const MAX_MESSAGE_BYTES = 4096;

// ------------------------------------------------------------ client -> server

export type ClientMsg =
  | { t: 'spray' }
  | { t: 'ready' }
  // At the controls without moving, e.g. an agent's wait: counts as activity for the idle kick.
  | { t: 'active' }
  | { t: 'hello'; v: number; name: string; color: number; primary: WeaponId; code: string; token: string; spectate?: boolean }
  | { t: 'watch'; team: 0 | 1 }
  | { t: 'in'; c: Cmd[] }
  | { t: 'loadout'; primary: WeaponId }
  | { t: 'ping'; c: number }
  | { t: 'chat'; text: string }
  | { t: 'radio'; line: number }
  | { t: 'team'; team: number }
  | { t: 'vote'; option: number };

const isInt = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const isNum = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const isPrimary = (v: unknown): v is WeaponId => typeof v === 'number' && (PRIMARY_CHOICES as readonly number[]).includes(v);

/**
 * Strict parser for everything a browser can send. Anything unexpected returns
 * null and the server drops (and eventually disconnects) the sender.
 */
export function parseClientMessage(raw: string): ClientMsg | null {
  if (raw.length > MAX_MESSAGE_BYTES) return null;
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof m !== 'object' || m === null || Array.isArray(m)) return null;
  const o = m as Record<string, unknown>;
  switch (o.t) {
    case 'in': {
      const c = o.c;
      if (!Array.isArray(c) || c.length < 1 || c.length > CMDS_PER_PACKET_MAX) return null;
      const cmds: Cmd[] = [];
      for (const e of c) {
        if (!Array.isArray(e) || e.length !== 6) return null;
        const [seq, buttons, yaw, pitch, weapon, interp] = e;
        if (!isInt(seq, 0, 2 ** 31) || !isInt(buttons, 0, BTN_MASK) || !isNum(yaw, -10, 10) || !isNum(pitch, -2, 2)) return null;
        if (!isInt(weapon, 0, 4) || !isNum(interp, 0, 1e13)) return null;
        cmds.push({ seq, buttons, yaw, pitch, weapon, interp });
      }
      return { t: 'in', c: cmds };
    }
    case 'spray':
      return Object.keys(o).length === 1 ? { t: 'spray' } : null;
    case 'ready':
      return Object.keys(o).length === 1 ? { t: 'ready' } : null;
    case 'active':
      return Object.keys(o).length === 1 ? { t: 'active' } : null;
    case 'ping':
      return isNum(o.c, 0, 1e13) ? { t: 'ping', c: o.c } : null;
    case 'hello': {
      if (!isInt(o.v, 0, 1000) || !isStr(o.name, 64) || !isInt(o.color, 0, PLAYER_COLORS.length - 1)) return null;
      if (!isPrimary(o.primary)) return null;
      const code = o.code === undefined ? '' : o.code;
      if (!isStr(code, 64)) return null;
      const token = o.token === undefined ? '' : o.token;
      if (!isStr(token, 64) || !/^[0-9a-f]*$/.test(token)) return null;
      if (o.spectate !== undefined && typeof o.spectate !== 'boolean') return null;
      return { t: 'hello', v: o.v, name: o.name, color: o.color, primary: o.primary, code, token, spectate: o.spectate ?? false };
    }
    case 'loadout':
      return isPrimary(o.primary) ? { t: 'loadout', primary: o.primary } : null;
    case 'chat':
      return isStr(o.text, 400) && o.text.length > 0 ? { t: 'chat', text: o.text } : null;
    case 'radio':
      return typeof o.line === 'number' && radioLine(o.line) ? { t: 'radio', line: o.line } : null;
    case 'watch':
      return o.team === 0 || o.team === 1 ? { t: 'watch', team: o.team } : null;
    case 'team':
      return isInt(o.team, 0, 1) ? { t: 'team', team: o.team } : null;
    case 'vote':
      return isInt(o.option, 0, 7) ? { t: 'vote', option: o.option } : null;
    default:
      return null;
  }
}

function cleanText(raw: string, max: number, allow: RegExp): string {
  return raw
    .normalize('NFKC')
    .replace(/[\p{C}\p{M}\p{Zl}\p{Zp}]/gu, '')
    .replace(allow, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

/** Allow-list: letters, numbers, spaces and a little punctuation. No control, bidi or combining chars. */
export function sanitizeName(raw: string): string {
  return cleanText(raw, NAME_MAX_LEN, /[^\p{L}\p{N} _\-.!?#*+]/gu);
}

export function sanitizeChat(raw: string): string {
  return cleanText(raw, CHAT_MAX_LEN, /[^\p{L}\p{N}\p{P}\p{S} ]/gu);
}

export function encodeCmd(c: Cmd): number[] {
  return [c.seq, c.buttons, round(c.yaw, 1e4), round(c.pitch, 1e4), c.weapon, Math.round(c.interp)];
}

// ------------------------------------------------------------ server -> client

export type MatchPhase = 'warmup' | 'live' | 'podium';
export type GameMode = 'ffa' | 'tdm' | 'ctf' | 'defuse' | 'almoco';
export const GAME_MODES: readonly GameMode[] = ['tdm', 'ffa', 'ctf', 'defuse', 'almoco'];

export const MODE_LABEL: Record<GameMode, string> = {
  ffa: 'todos contra todos',
  tdm: 'team deathmatch',
  ctf: 'capture a bandeira',
  defuse: 'debug defusion',
  almoco: 'hora de almoçar',
};

export const MODE_RULES = {
  ffa: { label: MODE_LABEL.ffa, teams: false, killScore: false },
  tdm: { label: MODE_LABEL.tdm, teams: true, killScore: true },
  ctf: { label: MODE_LABEL.ctf, teams: true, killScore: false },
  defuse: { label: MODE_LABEL.defuse, teams: true, killScore: false },
  almoco: { label: MODE_LABEL.almoco, teams: true, killScore: false },
} as const;
export function isTeamMode(mode: GameMode): boolean { return MODE_RULES[mode].teams; }

export interface ResultRow {
  id: number;
  name: string;
  color: number;
  kills: number;
  deaths: number;
  hs: number;
  best: number; // best streak
  team: number; // -1 in free-for-all
  bot: number; // 1 for server bots
}

export interface MatchInfo {
  phase: MatchPhase;
  mode: GameMode;
  map: number;
  endsAt: number; // server time ms
  teams: number[]; // team scores [bulldogs, martelos] (TDM kills, CTF captures or debug defusion rounds)
  limit: number; // TDM kill, CTF capture or defusion round limit, 0 = timer only
  results?: ResultRow[];
  winner?: number; // TDM: winning team, -1 draw
  next?: { map: number; mode: GameMode }; // podium: upcoming match if nobody votes
  vote?: VoteInfo; // podium: map vote for the next match
}

export interface VoteOption {
  map: number;
  mode: GameMode;
}

export interface VoteInfo {
  options: VoteOption[];
  counts: number[];
}

export type GameEvent =
  | { k: 'spray'; id: number; p: number[]; n: number[]; r: number; left: number }
  | FlagEvent
  | BombEvent
  | LunchEvent
  | { k: 'shot'; id: number; w: number; o: number[]; e: number[]; h: number }
  | { k: 'hit'; by: number; to: number; dmg: number; zone: number; hp: number; from: number[] }
  | { k: 'kill'; by: number; to: number; w: number; hs: number; streak: number }
  | { k: 'drop'; id: number; x: number; z: number; w: number }
  | { k: 'loot'; id: number; drop: number; w: number }
  | { k: 'join'; id: number }
  | { k: 'leave'; id: number }
  | { k: 'team'; id: number; team: number; auto: number };

export type SpectatorInfo =
  | { kind: 'choosing'; pickEndsAt: number }
  | { kind: 'watching'; team: number };

export type ServerMsg =
  | { t: 'spectate'; state: SpectatorInfo }
  // idleKickMs: how long a player in play may send no input before being kicked, null when the server never kicks idle players.
  // idleKickWarmupMs: the same during the warmup, which allows longer.
  | { t: 'welcome'; id: number; time: number; roster: RosterEntry[]; match: MatchInfo; maxPlayers: number; token: string; spectator: SpectatorInfo | null; ready: Readiness; idleKickMs: number | null; idleKickWarmupMs: number | null }
  | { t: 'reject'; reason: string; code?: string }
  | { t: 'votes'; counts: number[] }
  // fl rows: [state, carrierId, x, y, z, returnAtMs]; x,y,z = current world position, carrier position when carried.
  // bm (debug defusion only, [] otherwise): [state, actorId, x, y, z, explodeAtMs (handOverAtMs while dropped), defuseDoneAtMs, variant, attackers, plantDoneAtMs, blackFriday (0|1), plantByMs].
  // plantByMs: server ms when the attackers lose the laptop to the other team, 0 once planted or when the limit is off.
  // state: 0 home, 1 carried, 2 planting, 3 dropped, 4 planted. actorId is the carrier (carried, planting) or the defuser (planted), -1 if none.
  // x,y,z follow the carrier while carried or planting. Deadlines are server ms, 0 when not running.
  // lu (hora de almoçar only, [] otherwise): [attackers, roundEndsAtMs]; lc: one colleagueRow per colleague.
  // ps rows: [id, x, y, z, yaw, pitch, flags (RF_*), weapon, lean]. lean (-1 left .. 1 right, 0.01 steps) is absent on older rows, read it with leanOfRow.
  // The stance is in the flags: RF_PRONE, else RF_DUCK (crouch), else standing; read it with stanceFromFlags. RF_SPRINT and RF_SLIDE mark the run and the slide, RF_AIM the held aim (RF_ZOOM is the AWP scope).
  | { t: 'snap'; time: number; ack: number; me: number[] | null; ps: number[][]; ad: number[][]; fl: number[][]; bm: number[]; lu: number[]; lc: number[][] }
  | { t: 'ev'; e: GameEvent[] }
  | { t: 'roster'; roster: RosterEntry[] }
  | { t: 'score'; s: number[][]; ts: number[] }
  | { t: 'match'; match: MatchInfo }
  | { t: 'pong'; c: number; s: number }
  | { t: 'chat'; id: number; text: string }
  | { t: 'radio'; id: number; line: number }
  // The next match asks everybody to confirm "pronto" again, with a fresh kick deadline.
  | { t: 'readiness'; ready: Readiness };

/** A pending player waits on the "pronto" screen, out of the world. kickAt: server ms of the kick, null when the server does not kick. */
export type Readiness = { kind: 'confirmed' } | { kind: 'pending'; kickAt: number | null };

/** Why the server removed a player (never confirmed "pronto", or stood idle). Sent as the close reason with KICK_CLOSE_CODE. */
export type KickReason = 'afk' | 'podium' | 'idle';
export const KICK_CLOSE_CODE = 4004;

export type RosterEntry = [id: number, name: string, color: number, team: number, bot: number];

export const round = (v: number, k: number): number => Math.round(v * k) / k;

// flags for the local player's packed state
const F_GROUND = 1;
const F_DUCK = 2;
const F_JUMP = 4;
const F_DROP = 8;
const F_ATK = 16;
const F_ATK2 = 32;
const F_PRONE = 64;
const F_SPRINT = 128;
const F_WINDED = 256;
const F_DUCKHELD = 512;
const F_AIM = 1024;

export function packState(s: PlayerState): number[] {
  const flags =
    (s.onGround ? F_GROUND : 0) |
    (s.stance === STANCE.CROUCH ? F_DUCK : 0) |
    (s.stance === STANCE.PRONE ? F_PRONE : 0) |
    (s.sprinting ? F_SPRINT : 0) |
    (s.winded ? F_WINDED : 0) |
    (s.duckHeld ? F_DUCKHELD : 0) |
    (s.jumpHeld ? F_JUMP : 0) |
    (s.dropping ? F_DROP : 0) |
    (s.attackHeld ? F_ATK : 0) |
    (s.attack2Held ? F_ATK2 : 0) |
    (s.aiming ? F_AIM : 0);
  return [
    round(s.x, 1e3),
    round(s.y, 1e3),
    round(s.z, 1e3),
    round(s.vx, 1e3),
    round(s.vy, 1e3),
    round(s.vz, 1e3),
    flags,
    Math.ceil(s.health),
    Math.ceil(s.armor),
    s.weapon,
    s.lastWeapon,
    s.primary,
    s.tick,
    s.nextFire,
    s.reload,
    s.deploy,
    round(s.recoil, 1e4),
    s.lastFire,
    s.zoom,
    s.protect,
    s.resumeZoom,
    s.stamina, // exact: the winded threshold reads it, so a rounded copy would resume on another tick
    s.slide,
    s.lean,
    s.stanceLock,
    ...s.mag,
    ...s.reserve,
  ];
}

const PACKED_HEAD_LEN = 25;
export const PACKED_STATE_LEN = PACKED_HEAD_LEN + WEAPON_COUNT * 2;

export function unpackState(a: number[], s: PlayerState): void {
  s.x = a[0];
  s.y = a[1];
  s.z = a[2];
  s.vx = a[3];
  s.vy = a[4];
  s.vz = a[5];
  const f = a[6];
  s.onGround = (f & F_GROUND) !== 0;
  s.stance = (f & F_PRONE) !== 0 ? STANCE.PRONE : (f & F_DUCK) !== 0 ? STANCE.CROUCH : STANCE.STAND;
  s.sprinting = (f & F_SPRINT) !== 0;
  s.winded = (f & F_WINDED) !== 0;
  s.duckHeld = (f & F_DUCKHELD) !== 0;
  s.jumpHeld = (f & F_JUMP) !== 0;
  s.dropping = (f & F_DROP) !== 0;
  s.attackHeld = (f & F_ATK) !== 0;
  s.attack2Held = (f & F_ATK2) !== 0;
  s.aiming = (f & F_AIM) !== 0;
  s.health = a[7];
  s.armor = a[8];
  s.weapon = a[9] as WeaponId;
  s.lastWeapon = a[10] as WeaponId;
  s.primary = a[11] as WeaponId;
  s.tick = a[12];
  s.nextFire = a[13];
  s.reload = a[14];
  s.deploy = a[15];
  s.recoil = a[16];
  s.lastFire = a[17];
  s.zoom = a[18];
  s.protect = a[19];
  s.resumeZoom = a[20];
  s.stamina = a[21];
  s.slide = a[22];
  s.lean = a[23];
  s.stanceLock = a[24];
  for (let i = 0; i < WEAPON_COUNT; i++) {
    s.mag[i] = a[PACKED_HEAD_LEN + i];
    s.reserve[i] = a[PACKED_HEAD_LEN + WEAPON_COUNT + i];
  }
}

// remote player flags
export const RF_DUCK = 1;
export const RF_DROP = 2;
export const RF_ALIVE = 4;
export const RF_PROTECT = 8;
export const RF_GROUND = 16;
export const RF_RELOAD = 32;
export const RF_ZOOM = 64;
export const RF_PRONE = 128;
export const RF_SPRINT = 256;
export const RF_SLIDE = 512;
/** Aim down sights on a weapon with `ads`. RF_ZOOM stays for the AWP scope only. */
export const RF_AIM = 1024;

export function stanceFromFlags(flags: number): Stance {
  if (flags & RF_PRONE) return STANCE.PRONE;
  return flags & RF_DUCK ? STANCE.CROUCH : STANCE.STAND;
}

const ROW_LEAN = 8;
export const LEAN_ROW_PRECISION = 100;

/** The lean of a remote player row; rows without the field lean nowhere. */
export const leanOfRow = (row: readonly number[]): number => row[ROW_LEAN] ?? 0;
