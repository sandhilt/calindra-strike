import { BOMB_PLANT_TIMEOUT_SECONDS, IDLE_KICK_SECONDS, READY_KICK_SECONDS, RADIO_COOLDOWN_MS, RADIO_MAX_PER_WINDOW, RADIO_WINDOW_MS, type GameMode, GAME_MODES, getMaps } from '@calindra-strike/shared';

export interface Config {
  port: number;
  host: string;
  allowedOrigins: Set<string>;
  maxPlayers: number;
  maxPerIp: number;
  joinCode: string;
  matchMs: number;
  podiumMs: number;
  warmupMinPlayers: number;
  modes: GameMode[];
  maps: string[]; // empty = every map
  ctfLimit: number;
  defuseLimit: number;
  plantTimeoutMs: number;
  tdmLimit: number;
  airdropFirstMs: number;
  botFill: number;
  botSkill: number;
  trustProxy: boolean;
  friendlyFire: boolean;
  readyKickMs: number; // 0 = never kick players who do not confirm "pronto"
  idleKickMs: number; // 0 = never kick idle players
  radio: { cooldownMs: number; maxPerWindow: number; windowMs: number };
}

function int(name: string, def: number, lo: number, hi: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return def;
  const v = Number(raw);
  if (!Number.isInteger(v) || v < lo || v > hi) throw new Error(`Invalid ${name}: ${raw}`);
  return v;
}

/** Like int, but accepts decimals (e.g. 1.5 seconds). */
function decimal(name: string, def: number, lo: number, hi: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return def;
  const v = Number(raw);
  if (!Number.isFinite(v) || v < lo || v > hi) throw new Error(`Invalid ${name}: ${raw}`);
  return v;
}

/** A switch: empty keeps the default, 0 and false are off, 1 and true are on, anything else is a typo. */
function flag(name: string, def = false): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase();
  if (raw === '') return def;
  if (raw === '0' || raw === 'false') return false;
  if (raw === '1' || raw === 'true') return true;
  throw new Error(`Invalid ${name}: ${process.env[name]} (use 1 or 0)`);
}

const ALL_MODES = GAME_MODES;

function list(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * GAME_MODES picks any set of modes (e.g. "tdm,ffa"). The older single GAME_MODE
 * still works: "mixed" = TDM + FFA, or one mode. Default: TDM + FFA + CTF + debug defusion.
 */
export function modeList(modesRaw: string | undefined, legacyRaw: string | undefined): GameMode[] {
  const items = list(modesRaw);
  if (items.length === 0) {
    const legacy = (legacyRaw ?? '').trim().toLowerCase();
    if (!legacy) return [...ALL_MODES];
    if (legacy === 'mixed') return ['tdm', 'ffa'];
    items.push(legacy);
  }
  if (items.includes('all')) return [...ALL_MODES];
  for (const m of items) {
    if (!(ALL_MODES as string[]).includes(m)) throw new Error(`Invalid game mode: ${m} (use ${ALL_MODES.join(', ')})`);
  }
  return [...new Set(items)] as GameMode[];
}

export function mapList(raw: string | undefined): string[] {
  const items = list(raw);
  if (items.includes('all')) return [];
  const known = getMaps().map((m) => m.id);
  for (const id of items) if (!known.includes(id)) throw new Error(`Invalid map: ${id} (use ${known.join(', ')})`);
  return [...new Set(items)];
}

export function loadConfig(): Config {
  const origins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const o of origins) {
    const u = new URL(o);
    if (u.origin !== o) throw new Error(`ALLOWED_ORIGINS entries must be bare origins, got ${o}`);
  }
  return {
    port: int('PORT', 7350, 1, 65535),
    host: process.env.HOST ?? '127.0.0.1',
    allowedOrigins: new Set(origins),
    maxPlayers: int('MAX_PLAYERS', 24, 1, 64),
    maxPerIp: int('MAX_PER_IP', 32, 1, 128),
    joinCode: (process.env.JOIN_CODE ?? '').trim(),
    matchMs: int('MATCH_SECONDS', 300, 20, 3600) * 1000,
    podiumMs: int('PODIUM_SECONDS', 15, 3, 120) * 1000,
    warmupMinPlayers: int('WARMUP_MIN_PLAYERS', 2, 1, 64),
    modes: modeList(process.env.GAME_MODES, process.env.GAME_MODE),
    maps: mapList(process.env.GAME_MAPS),
    ctfLimit: int('CTF_CAPTURE_LIMIT', 3, 0, 50),
    defuseLimit: int('DEFUSE_SCORE_LIMIT', 5, 0, 50),
    plantTimeoutMs: int('DEFUSE_PLANT_TIMEOUT_SECONDS', BOMB_PLANT_TIMEOUT_SECONDS, 0, 3600) * 1000,
    tdmLimit: int('TDM_SCORE_LIMIT', 50, 0, 1000),
    airdropFirstMs: int('AIRDROP_FIRST_SECONDS', 25, 1, 600) * 1000,
    botFill: int('BOT_FILL', 0, 0, 64),
    botSkill: int('BOT_SKILL', 50, 0, 100) / 100,
    trustProxy: process.env.TRUST_PROXY === '1',
    friendlyFire: flag('FRIENDLY_FIRE'),
    readyKickMs: flag('READY_KICK', true) ? int('READY_KICK_SECONDS', READY_KICK_SECONDS, 5, 600) * 1000 : 0,
    radio: {
      cooldownMs: Math.round(decimal('RADIO_COOLDOWN_SECONDS', RADIO_COOLDOWN_MS / 1000, 0, 30) * 1000),
      maxPerWindow: int('RADIO_MAX_PER_WINDOW', RADIO_MAX_PER_WINDOW, 0, 100),
      windowMs: int('RADIO_WINDOW_SECONDS', RADIO_WINDOW_MS / 1000, 1, 600) * 1000,
    },
    idleKickMs: flag('IDLE_KICK', true) ? int('IDLE_KICK_SECONDS', IDLE_KICK_SECONDS, 10, 3600) * 1000 : 0,
  };
}
