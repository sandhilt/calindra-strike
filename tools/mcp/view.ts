import { scene } from './scene.ts';
import { NO_ACTIONS, weaponSlots, type ActionEcho } from './actions.ts';
import type { LastSeen } from './perception.ts';
import {
  createPlayerState,
  CollisionWorld,
  type MapDef,
  type Mat,
  type Surface,
  AUDIBLE_INTENSITY,
  dayCycleAt,
  heardIntensity,
  type BombPoint,
  unpackState,
  RF_ALIVE,
  STAMINA_MAX,
  STANCE,
  type Stance,
  getMap,
  isLowered,
  leanOfRow,
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
  PLANT_MS, DEFUSE_MS, PLAYER_RADIUS, bombStandBox, BOMB_STAND_SIZE, fuseMs, type BombState,
  LUNCH_COLLEAGUES, LUNCH_SEAT_RADIUS_UNITS, LUNCH_USE_RADIUS_UNITS, colleagueFromRow, type Colleague, type LunchEvent,
  floorAt, inSupplyReach, liftAt, liftRideSeconds, needsSupply, SUPPLY_COOLDOWN_SECONDS,
} from '../../shared/src/index.ts';
import type { Intent } from './pilot.ts';
const STANCE_NAMES: Readonly<Record<Stance, 'stand' | 'crouch' | 'prone'>> = {
  [STANCE.STAND]: 'stand',
  [STANCE.CROUCH]: 'crouch',
  [STANCE.PRONE]: 'prone',
};

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
  lean: number;
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
  | (LunchEvent & { byName?: string; colleague?: string })
  | (Extract<GameEvent, { k: 'supply' }> & { name?: string })
  | { k: 'intent'; reason: string; id: number };
export interface ChatLine {
  t: 'chat';
  id: number;
  text: string;
  name?: string;
  /** True for a radio menu line, so agents can tell it from typed chat. */
  radio?: true;
}
/** A sound the server told us about, kept where it happened; its distance and loudness are worked out when the agent reads it. */
export type ViewSound =
  | { kind: 'shot'; pos: number[]; ref: number; weapon: string; by?: string; own: boolean }
  | { kind: 'impact'; pos: number[]; ref: number; material: Mat; surface: Surface; by?: string }
  | { kind: 'hurt'; pos: number[]; ref: number };
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
  /** One entry per supply stand of the map: 0 while full, or the server ms when it fills again. */
  supplies: number[];
  flags: number[][];
  bomb: number[];
  /** Hora de almoçar header `[attackers, endsAt]` and one row per colleague, empty in other modes. */
  lunch: number[];
  colleagues: number[][];
  scores: number[][];
  events: ViewEvent[];
  sounds: ViewSound[];
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
    supplies: [],
    flags: [],
    bomb: [],
    lunch: [],
    colleagues: [],
    sprays: [],
    scores: [],
    events: [],
    sounds: [],
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
        lean: leanOfRow(p),
      };
    });
  v.flags = m.fl ?? [];
  v.bomb = m.bm ?? [];
  v.lunch = m.lu ?? [];
  v.colleagues = m.lc ?? [];
  v.supplies = m.su ?? [];
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

const LOUD = 0.5;
const MEDIUM = 0.2;
const MAX_HEARD = 12;
type Relative = (p: { x: number; z: number }) => { distance: number | null; bearingDeg: number | null };

/** The light of the map now: only its look changes with it, what an agent perceives does not. */
function timeOfDay(serverMs: number): { phase: string; next: string; blend: number } {
  const { phase, next, blend } = dayCycleAt(serverMs);
  return { phase, next, blend: Math.round(blend * 100) / 100 };
}

/** The sounds above the audible floor, loudest first, with where they came from and how loud they were. */
function heardSounds(sounds: readonly ViewSound[], relative: Relative, listening: boolean): object[] {
  if (!listening) return [];
  return sounds
    .flatMap((sound) => {
      const { pos, ref, ...detail } = sound;
      const { distance, bearingDeg } = relative({ x: pos[0], z: pos[2] });
      if (distance === null) return [];
      const intensity = heardIntensity(distance, ref);
      if (intensity < AUDIBLE_INTENSITY) return [];
      const loudness = intensity >= LOUD ? 'loud' : intensity >= MEDIUM ? 'medium' : 'faint';
      return [{ ...detail, pos, distance, bearingDeg, intensity: Math.round(intensity * 100) / 100, loudness }];
    })
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, MAX_HEARD);
}

export function renderView(
  v: WorldView,
  intent: Intent,
  actions: ActionEcho = NO_ACTIONS,
  world?: CollisionWorld,
): object {
  const s = v.self;
  const equipped = s && weaponDef(s.weapon);
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
    timeOfDay: timeOfDay(v.time),
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
      weapon: equipped?.name ?? null,
      slots: slots ? {
        primary: weaponDef(slots.primary).name,
        pistol: weaponDef(slots.pistol).name,
        hammer: weaponDef(slots.hammer).name,
        last: slots.last === null ? null : weaponDef(slots.last).name,
      } : null,
      mag: s?.mag[s.weapon],
      reserve: s?.reserve[s.weapon],
      reloading: s ? s.reload > 0 : false,
      ducked: s ? isLowered(s.stance) : false,
      stance: STANCE_NAMES[s?.stance ?? STANCE.STAND],
      sprinting: s?.sprinting ?? false,
      winded: s?.winded ?? false,
      sliding: (s?.slide ?? 0) > 0,
      stamina: s ? Math.round((s.stamina / STAMINA_MAX) * 100) / 100 : 0,
      lean: s ? Math.round(s.lean * 100) / 100 : 0,
      onGround: s?.onGround ?? false,
      floor: s ? floorOf(v, s) : null,
      aiming: s?.aiming ?? false,
      zoom: equipped?.ads ? Number(s?.aiming ?? false) : s?.zoom ?? 0,
      maxZoom: equipped?.ads ? 1 : equipped?.zoomFov.length ?? 0,
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
    lifts: describeLifts(v, describeRelative),
    supplies: describeSupplies(v, describeRelative),
    bomb: describeBomb(v, world),
    lunch: describeLunch(v, describeRelative),
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
    sounds: heardSounds(v.sounds.splice(0), describeRelative, !!s && s.health > 0),
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
  if (state === 3) return { kind: 'dropped', x, y, z, returnAtTick: explodeAt / TICK_MS };
  if (state === 4) return { kind: 'planted', x, y, z, explodeAtTick: explodeAt / TICK_MS,
    variant, defuse: actor < 0 ? null : { by: actor, doneAtTick: defuseDoneAt / TICK_MS } };
  return { kind: 'home' };
}
export function bombProp(v: WorldView, bomb = bombState(v)) {
  if (!bomb) return null;
  const [, , x, y, z] = v.bomb;
  return bombStandBox(bomb.kind, { x, y, z });
}

const bombBases = new WeakMap<MapDef, BombPoint[]>();

export function bombPlaces(v: WorldView, world: CollisionWorld) {
  const map = world.map;
  let bases = bombBases.get(map);
  if (!bases) {
    // The desk or crate can sit over a base, whose height must stay fixed.
    const terrain = new CollisionWorld(map);
    bases = map.flagBases.map(b => ({ ...b, y: Math.max(0, terrain.groundBelow(b.x, map.dropHeight, b.z, PLAYER_RADIUS)) }));
    bombBases.set(map, bases);
  }
  const attackers = v.match.mode === 'almoco' ? v.lunch[0] : v.bomb[8];
  return { home: bases[attackers], site: bases[1 - attackers], attackers };
}
/** The colleagues of a running hora de almoçar round; undefined in other modes and on the podium, where no round runs. */
export function lunchColleagues(v: WorldView): Colleague[] | undefined {
  if (v.match.mode !== 'almoco' || v.match.phase === 'podium' || v.lunch.length < 2) return undefined;
  return v.colleagues.map(colleagueFromRow);
}

const LUNCH_RULES = {
  attacker: `Take every colleague to lunch before secondsLeft runs out. Stand within ${LUNCH_USE_RADIUS_UNITS} units of a waiting colleague and call use: it follows your path, escalators included. Walk to the restaurant marked target: true (named in restaurants); a following colleague sits only when within ${LUNCH_SEAT_RADIUS_UNITS} units of that one on its floor, any other restaurant does not count. The target changes every round. All seated wins the round. If you die, the colleagues you led stop and wait where they are.`,
  defender: 'Keep the colleagues from lunch until secondsLeft reaches 0: the food court fills up and your team wins the round. Kill whoever leads colleagues; they stop where their leader dies and must be called again.',
} as const;

/** The named floor the player stands on, null on a map with a single level and while skydiving. */
function floorOf(v: WorldView, s: PlayerState): { index: number; name: string; y: number } | null {
  if (s.dropping) return null;
  const map = getMap(v.match.map);
  const floor = floorAt(map.floors, s.y);
  return floor && { ...floor, y: map.floors[floor.index].y };
}

const LIFT_RULES =
  'Walk into the shaft: the cab carries you up by itself and holds at the top floor; hold crouch (the crouch tool) to go down. It crawls at every floor, so step out through that floor\'s doorway while its height is level with you (jumping is off inside). The ground floor doorway faces the atrium; the others open onto their floor across the edge. move_to (give y for the floor) and hunt ride it for you.';

function describeLifts(v: WorldView, describeRelative: Relative): object[] {
  const map = getMap(v.match.map);
  const s = v.self;
  return map.lifts
    .map((lift) => {
      const centre = { x: (lift.minX + lift.maxX) / 2, z: (lift.minZ + lift.maxZ) / 2 };
      const floors = lift.stops.map((y) => ({ y, name: map.floors.find((f) => f.y === y)?.name ?? null }));
      const riding = !!s && !!liftAt([lift], s.x, s.y, s.z);
      return {
        pos: [centre.x, centre.z],
        ...describeRelative(centre),
        floors,
        riding,
        secondsToTop: riding && s ? Math.round(liftRideSeconds(lift, s.y, lift.stops[lift.stops.length - 1]) * 10) / 10 : null,
        rules: LIFT_RULES,
      };
    })
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
}

function describeSupplies(v: WorldView, describeRelative: Relative): object[] {
  const map = getMap(v.match.map);
  const s = v.self;
  return map.supplies
    .map((stand, i) => {
      const readyAt = v.supplies[i] ?? 0;
      return {
        pos: [stand.x, stand.y, stand.z],
        floor: floorAt(map.floors, stand.y)?.name ?? null,
        ...describeRelative(stand),
        ready: readyAt === 0,
        secondsLeft: readyAt === 0 ? 0 : Math.max(0, Math.round((readyAt - v.time) / 100) / 10),
        inReach: !!s && inSupplyReach(s, stand),
        youNeedIt: !!s && needsSupply(s),
        about: `Walk onto it to restock health, armour and ammunition (only when you need it); it refills ${SUPPLY_COOLDOWN_SECONDS} s after someone takes it.`,
      };
    })
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
}

function describeLunch(v: WorldView, describeRelative: Relative): object | null {
  const colleagues = lunchColleagues(v);
  if (!colleagues) return null;
  const [attackers, endsAt, targetIndex = 0] = v.lunch;
  const s = v.self;
  const role = v.roster.find((r) => r[0] === v.id)?.[3] === attackers ? 'attacker' : 'defender';
  const name = (id: number) => v.roster.find((r) => r[0] === id)?.[1] ?? String(id);
  return {
    role,
    attackersTeam: attackers,
    rules: LUNCH_RULES[role],
    secondsLeft: Math.max(0, (endsAt - v.time) / 1000),
    seated: colleagues.filter((c) => c.kind === 'seated').length,
    total: colleagues.length,
    colleagues: colleagues.map((c, i) => ({
      name: LUNCH_COLLEAGUES[i] ?? 'Colega',
      state: c.kind,
      leaderId: c.kind === 'following' ? c.leader : null,
      leaderName: c.kind === 'following' ? name(c.leader) : null,
      pos: [c.x, c.y, c.z],
      ...describeRelative(c),
      inUseReach: c.kind === 'waiting' && !!s && Math.hypot(c.x - s.x, c.y - s.y, c.z - s.z) <= LUNCH_USE_RADIUS_UNITS,
    })),
    restaurants: getMap(v.match.map).restaurants
      .map((r, i) => ({ name: r.name, target: i === targetIndex, pos: [r.x, r.y, r.z], ...describeRelative(r) }))
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0)),
  };
}

function describeBomb(v: WorldView, world?: CollisionWorld): object | null {
  const bomb = bombState(v);
  if (!bomb) return null;
  const [, actor, x, y, z, explodeAt, defuseDoneAt, , attackers, plantDoneAt, blackFridayBit, plantBy = 0] = v.bomb;
  const blackFriday = blackFridayBit === 1;
  const prop = bombProp(v, bomb);
  const dimensions = prop && BOMB_STAND_SIZE[prop.stand];
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
    blackFriday, fuseSeconds: Math.round(fuseMs(blackFriday) / 1000),
    stand: prop && dimensions ? {
      kind: prop.stand, solid: true, size: [dimensions.size, dimensions.height, dimensions.size],
      about: prop.stand === 'desk'
        ? 'Solid cover that blocks movement, bullets and sight. Walk around it and hold USE to defuse from any side or corner.'
        : 'Solid cover that blocks movement, bullets and sight. Walk around it and touch any side or corner to take the laptop.',
    } : null,
    secondsToPlant: bomb.kind !== 'planted' && plantBy > 0 ? Math.max(0, (plantBy - v.time) / 1000) : null,
    secondsToExplosion: bomb.kind === 'planted' ? Math.max(0, (explodeAt - v.time) / 1000) : null,
    plantProgress: bomb.kind === 'planting' ? progress(plantDoneAt, PLANT_MS) : 0,
    defuseProgress: defuser ? progress(defuseDoneAt, DEFUSE_MS) : 0 };
}
