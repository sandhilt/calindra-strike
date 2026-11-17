import type { LastSeen } from './perception.ts';
import {
  createPlayerState,
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
  | { k: 'intent'; reason: string; id: number };
export interface ChatLine {
  t: 'chat';
  id: number;
  text: string;
  name?: string;
}
export interface WorldView {
  id: number;
  time: number;
  match: MatchInfo;
  roster: RosterEntry[];
  self: PlayerState | null;
  peers: Peer[];
  lastSeen: Map<number, LastSeen>;
  perception: 'line-of-sight' | 'omniscient';
  airdrops: Airdrop[];
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
  v.airdrops = m.ad.map((p) => ({ id: p[0], x: p[1], y: p[2], z: p[3], weapon: p[4], landed: !!p[5] }));
  return peers;
}
export function renderView(
  v: WorldView,
  intent: Intent,
  actions: { crouch: boolean; zoom: number | null } = { crouch: false, zoom: null },
): object {
  const s = v.self;
  const relative = (p: { x: number; z: number }) =>
    s
      ? {
          distance: Math.round(Math.hypot(p.x - s.x, p.z - s.z)),
          bearingDeg: Math.round(
            (-wrapAngle(Math.atan2(-(p.x - s.x), -(p.z - s.z)) - s.yaw) * 180) / Math.PI,
          ),
        }
      : { distance: null, bearingDeg: null };
  const me = v.roster.find((r) => r[0] === v.id);
  const score = v.scores.find((r) => r[0] === v.id);
  const yawDeg = s ? (s.yaw * 180) / Math.PI : null;
  return {
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
        ...relative(p),
        pos: [p.x, p.y, p.z],
      }))
      .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)),
    airdrops: v.airdrops.map((p) => ({ x: p.x, z: p.z, ...relative(p) })),
    score: {
      me: { kills: score?.[1] ?? 0, deaths: score?.[2] ?? 0 },
      ...(v.match.mode === 'tdm' ? { teams: v.match.teams } : {}),
    },
    events: v.events.splice(0),
    chat: v.chat.splice(0),
  };
}
