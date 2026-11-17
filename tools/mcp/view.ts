import { scene } from './scene.ts';
import { weaponSlots } from './actions.ts';
import type { LastSeen } from './perception.ts';
import {
  createPlayerState,
  type CollisionWorld,
  unpackState,
  RF_ALIVE,
  getMap,
  weaponDef,
  wrapAngle,
  type PlayerState,
  type ServerMsg,
  type MatchInfo,
  type GameEvent,
  type RosterEntry,
  type FlagState,
  isTeamMode,
  TICK_MS,
  PLANT_MS, DEFUSE_MS, PLAYER_RADIUS, type BombState,
} from '../../shared/src/index.ts';
import type { Intent } from './pilot.ts';
export interface Peer {
  id: number;
  name: string;
  team: number;
  enemy: boolean;
  alive: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  flags: number;
  pitch: number;
  weapon: number;
  via?: 'sight' | 'sound' | 'team';
}
export interface Airdrop {
  id: number;
  x: number;
  y: number;
  z: number;
  weapon: number;
  landed: boolean;
}
export type ViewEvent =
  | (Extract<GameEvent, { k: 'kill' }> & { byName?: string; toName?: string })
  | (Extract<GameEvent, { k: 'join' | 'leave' }> & { name?: string })
  | (Extract<GameEvent, { k: 'flag' | 'bomb' }> & { byName?: string })
  | { k: 'intent'; reason: string; id: number };
export interface ChatLine {
  t: 'chat';
  id: number;
  text: string;
  name?: string;
}
export interface ViewSpray {
  id: number;
  by: string;
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}
export interface WorldView {
  sprays: ViewSpray[];
  id: number;
  time: number;
  match: MatchInfo;
  roster: RosterEntry[];
  self: PlayerState | null;
  peers: Peer[];
  lastSeen: Map<number, LastSeen>;
  perception: 'line-of-sight' | 'omniscient';
  airdrops: Airdrop[];
  flags: number[][];
  bomb: number[];
  scores: number[][];
  events: ViewEvent[];
  chat: ChatLine[];
}
export function welcome(m: Extract<ServerMsg, { t: 'welcome' }>): WorldView {
  return {
    id: m.id,
    time: m.time,
    match: m.match,
    roster: m.roster,
    self: null,
    peers: [],
    lastSeen: new Map(),
    perception: 'line-of-sight',
    airdrops: [],
    flags: [],
    bomb: [],
    sprays: [],
    scores: [],
    events: [],
    chat: [],
  };
}
export function decodeSnapshot(v: WorldView, m: Extract<ServerMsg, { t: 'snap' }>): Peer[] {
  v.time = m.time;
  v.self = m.me ? createPlayerState() : null;
  if (v.self && m.me) {
    unpackState(m.me, v.self);
    const row = m.ps.find((p) => p[0] === v.id);
    if (row) {
      v.self.yaw = row[4];
      v.self.pitch = row[5];
    }
  }
  const team = v.roster.find((r) => r[0] === v.id)?.[3];
  const peers = m.ps
    .filter((p) => p[0] !== v.id)
    .map((p) => {
      const r = v.roster.find((r) => r[0] === p[0]);
      return {
        id: p[0],
        name: r?.[1] ?? String(p[0]),
        team: r?.[3] ?? -1,
        enemy: v.match.mode === 'ffa' || r?.[3] !== team,
        alive: !!(p[6] & RF_ALIVE),
        x: p[1],
        y: p[2],
        z: p[3],
        yaw: p[4],
        pitch: p[5],
        flags: p[6],
        weapon: p[7],
      };
    });
  v.flags = m.fl ?? [];
  v.bomb = m.bm ?? [];
  v.airdrops = m.ad.map((p) => ({ id: p[0], x: p[1], y: p[2], z: p[3], weapon: p[4], landed: !!p[5] }));
  return peers;
}
export const relative = (s: PlayerState | null) => (p: { x: number; z: number }) =>
    s
      ? {
          distance: Math.round(Math.hypot(p.x - s.x, p.z - s.z)),
          bearingDeg: Math.round(
            (-wrapAngle(Math.atan2(-(p.x - s.x), -(p.z - s.z)) - s.yaw) * 180) / Math.PI,
          ),
        }
      : { distance: null, bearingDeg: null };

export function renderView(
  v: WorldView,
  intent: Intent,
  actions: { crouch: boolean; walk: boolean; zoom: number | null } = { crouch: false, walk: false, zoom: null },
  world?: CollisionWorld,
): object {
  const s = v.self;
  const slots = s ? weaponSlots(s) : null;
  const describeRelative = relative(s);
  const me = v.roster.find((r) => r[0] === v.id);
  const score = v.scores.find((r) => r[0] === v.id);
  const yawDeg = s ? (s.yaw * 180) / Math.PI : null;
  return {
    scene: world && s && s.health > 0 && !s.dropping ? scene(world, world.map, s, v.sprays, describeRelative) : null,
    perception: v.perception,
    lastSeen: [...v.lastSeen]
      .filter(([id]) => !v.peers.some((p) => p.id === id))
      .sort(([, a], [, b]) => s
        ? Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z)
        : 0)
      .slice(0, 10)
      .map(([id, seen]) => ({
        id,
        name: v.roster.find((r) => r[0] === id)?.[1] ?? String(id),
        pos: [seen.x, seen.y, seen.z],
        secondsAgo: Math.max(0, (v.time - seen.time) / 1000),
      })),
    phase: v.match.phase,
    mode: v.match.mode,
    map: getMap(v.match.map).name,
    endsInMs: v.match.phase === 'warmup' ? null : Math.max(0, v.match.endsAt - v.time),
    ...(v.match.phase === 'podium'
      ? {
          vote: v.match.vote
            ? {
                options: v.match.vote.options.map((o, index) => ({
                  index,
                  map: getMap(o.map).name,
                  mode: o.mode,
                })),
                counts: v.match.vote.counts,
              }
            : undefined,
          results: v.match.results,
          winner: v.match.winner,
          next: v.match.next,
        }
      : {}),
    you: {
      id: v.id,
      name: me?.[1],
      team: me?.[3],
      alive: !!s,
      hp: s?.health ?? 0,
      armor: s?.armor ?? 0,
      pos: s ? [s.x, s.y, s.z] : null,
      yawDeg,
      weapon: s ? weaponDef(s.weapon).name : null,
      slots: slots ? {
        primary: weaponDef(slots.primary).name,
        pistol: weaponDef(slots.pistol).name,
        hammer: weaponDef(slots.hammer).name,
        last: slots.last === null ? null : weaponDef(slots.last).name,
      } : null,
      mag: s?.mag[s.weapon],
      reserve: s?.reserve[s.weapon],
      reloading: s ? s.reload > 0 : false,
      ducked: s?.ducked ?? false,
      onGround: s?.onGround ?? false,
      zoom: s?.zoom ?? 0,
      maxZoom: s ? weaponDef(s.weapon).zoomFov.length : 0,
      actions,
      intent,
    },
    others: v.peers
      .map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        enemy: p.enemy,
        via: p.via,
        alive: p.alive,
        ...describeRelative(p),
        pos: [p.x, p.y, p.z],
      }))
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)),
    airdrops: v.airdrops.map((p) => ({ x: p.x, z: p.z, ...describeRelative(p) })),
    bomb: describeBomb(v, world),
    flags: v.flags.map((row, team) => ({
      team,
      state: row[0] === 0 ? 'at_base' : row[0] === 1 ? 'carried' : 'dropped',
      carrierId: row[0] === 1 ? row[1] : null,
      carrierName: row[0] === 1 ? v.roster.find(r => r[0] === row[1])?.[1] ?? String(row[1]) : null,
      pos: row.slice(2, 5),
      ...describeRelative({ x: row[2], z: row[4] }),
    })),
    score: {
      me: { kills: score?.[1] ?? 0, deaths: score?.[2] ?? 0 },
      ...(isTeamMode(v.match.mode) ? { teams: v.match.teams } : {}),
    },
    events: v.events.splice(0),
    chat: v.chat.splice(0),
  };
}

export function flagStates(v: WorldView): FlagState[] {
  return v.flags.map(row => row[0] === 0 ? { kind: 'home' }
    : row[0] === 1 ? { kind: 'carried', carrier: row[1] }
    : { kind: 'dropped', x: row[2], y: row[3], z: row[4], returnAtTick: row[5] / TICK_MS });
}

export function bombState(v: WorldView): BombState | undefined {
  const [state, actor, x, y, z, explodeAt, defuseDoneAt, variant, , plantDoneAt] = v.bomb;
  if (!v.bomb.length || v.match.mode !== 'defuse') return undefined;
  if (state === 1) return { kind: 'carried', carrier: actor };
  if (state === 2) return { kind: 'planting', carrier: actor, doneAtTick: plantDoneAt / TICK_MS };
  if (state === 3) return { kind: 'dropped', x, y, z, returnAtTick: Infinity };
  if (state === 4) return { kind: 'planted', x, y, z, explodeAtTick: explodeAt / TICK_MS,
    variant, defuse: actor < 0 ? null : { by: actor, doneAtTick: defuseDoneAt / TICK_MS } };
  return { kind: 'home' };
}
export function bombPlaces(v: WorldView, world: CollisionWorld) {
  const map = getMap(v.match.map);
  const bases = map.flagBases.map(b => ({ ...b, y: world.groundBelow(b.x, map.dropHeight, b.z, PLAYER_RADIUS) }));
  const attackers = v.bomb[8];
  return { home: bases[attackers], site: bases[1 - attackers], attackers };
}
function describeBomb(v: WorldView, world?: CollisionWorld): object | null {
  const bomb = bombState(v);
  if (!bomb) return null;
  const [, actor, x, y, z, explodeAt, defuseDoneAt, , attackers, plantDoneAt] = v.bomb;
  const name = (id: number) => v.roster.find(r => r[0] === id)?.[1] ?? String(id);
  const carrier = bomb.kind === 'carried' || bomb.kind === 'planting';
  const defuser = bomb.kind === 'planted' && actor >= 0;
  const team = v.roster.find(r => r[0] === v.id)?.[3];
  const site = world ? bombPlaces(v, world).site : null;
  const progress = (end: number, duration: number) => Math.max(0, Math.min(1, 1 - (end - v.time) / duration));
  return { state: bomb.kind, carrierId: carrier ? actor : null, carrierName: carrier ? name(actor) : null,
    defuserId: defuser ? actor : null, defuserName: defuser ? name(actor) : null,
    pos: [x, y, z], ...relative(v.self)({ x, z }),
    site: site ? { pos: [site.x, site.y, site.z], ...relative(v.self)(site) } : null,
    attackersTeam: attackers, role: team === attackers ? 'attacker' : team === 1 - attackers ? 'defender' : 'spectator',
    secondsToExplosion: bomb.kind === 'planted' ? Math.max(0, (explodeAt - v.time) / 1000) : null,
    plantProgress: bomb.kind === 'planting' ? progress(plantDoneAt, PLANT_MS) : 0,
    defuseProgress: defuser ? progress(defuseDoneAt, DEFUSE_MS) : 0 };
}
