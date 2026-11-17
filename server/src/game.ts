import { randomBytes } from 'node:crypto';
import {
  dropCarried, stepFlags, type FlagState, type FlagBase, PLAYER_RADIUS, isTeamMode, MODE_RULES,
  BTN, DEBUG_SCENARIO_COUNT, dropBomb, stepBomb, type BombState, type BombPlaces,
  MAX_SPECTATORS, SPECTATOR_PICK_MS, type SpectatorInfo,
  AIRDROP_FALL_SPEED,
  AIRDROP_HALF,
  AIRDROP_PICKUP_RADIUS,
  type Cmd,
  CollisionWorld,
  type GameEvent,
  type GameMode,
  LAGCOMP_MAX_MS,
  MAX_ARMOR,
  MAX_HEALTH,
  type MapDef,
  type MatchInfo,
  type MatchPhase,
  PLAYER_COLORS,
  PRIMARY_CHOICES,
  type PlayerState,
  RESPAWN_TICKS,
  RF_ALIVE,
  RF_DROP,
  RF_DUCK,
  RF_GROUND,
  RF_PROTECT,
  RF_RELOAD,
  RF_ZOOM,
  type ResultRow,
  type RosterEntry,
  SNAPSHOT_EVERY_TICKS,
  SPRAY_RANGE,
  SPRAYS_PER_SPAWN,
  SPRAY_COOLDOWN_TICKS,
  sprayPlacement,
  type ShotInfo,
  type VoteOption,
  TICK_DT,
  TICK_MS,
  WEAPON,
  type WeaponId,
  ZONE_HEAD,
  ZONE_LEGS,
  absorbArmor,
  applyCmd,
  clamp,
  createPlayerState,
  getMap,
  getMaps,
  giveWeapon,
  packState,
  pickLegendary,
  rayHitbox,
  round,
  spawnState,
  weaponDef,
} from '@calindra-strike/shared';
import { BOT_NAMES, type BotEnv, BotBrain } from './bot.ts';
import { NavGrid } from './nav.ts';

const HISTORY = 64; // ~1s of positions for lag compensation
const MAX_QUEUE = 48;
const CMD_BURST = 24;
const MAX_CMDS_PER_TICK = 8;
const AIRDROP_EVERY_MS = 35_000;
const AIRDROP_MAX_ACTIVE = 2;
const TEAM_SWITCH_RESPAWN_TICKS = 90;
const GHOST_TICKS = 90 * 60; // a dropped player can rejoin with their score for 90 s

/** Navigation grids are pure functions of the map, shared by every game in the process. */
const navCache = new Map<string, NavGrid>();
function navFor(map: MapDef, world: CollisionWorld): NavGrid {
  let n = navCache.get(map.id);
  if (!n) {
    n = new NavGrid(world, map);
    navCache.set(map.id, n);
  }
  return n;
}

export type SpectatorView = { kind: 'choosing'; deadline: number } | { kind: 'watching'; team: number };
export interface Spectator { id: number; name: string; view: SpectatorView; send: (data: string) => void }

interface Ghost {
  name: string;
  team: number;
  kills: number;
  deaths: number;
  headshots: number;
  bestStreak: number;
  matchId: number;
  expires: number;
}

export type ModeSetting = 'mixed' | GameMode;

/** 'mixed' keeps the original TDM + FFA pair; a list picks any modes. */
export function resolveModes(m: ModeSetting | GameMode[] | undefined): GameMode[] {
  if (!m || m === 'mixed') return ['tdm', 'ffa'];
  return typeof m === 'string' ? [m] : [...new Set(m)];
}

/**
 * Every allowed map/mode pair, ordered so consecutive matches change map and,
 * when possible, mode too (TDM Forja -> FFA Escritório -> ...).
 */
function rotationFor(maps: number[], modes: GameMode[]): { map: number; mode: GameMode }[] {
  const left: { map: number; mode: GameMode }[] = [];
  for (const mode of modes) for (const map of maps) left.push({ map, mode });
  if (left.length === 0) throw new Error('No playable map/mode combination');
  const out = [left.shift() as { map: number; mode: GameMode }];
  while (left.length) {
    const prev = out[out.length - 1];
    let i = left.findIndex((c) => c.map !== prev.map && c.mode !== prev.mode);
    if (i < 0) i = left.findIndex((c) => c.map !== prev.map);
    if (i < 0) i = 0;
    out.push(left.splice(i, 1)[0]);
  }
  return out;
}

/** Choices shown in the end-of-match vote. */
const VOTE_OPTION_COUNT = 3;

/**
 * Vote options: `first` (the rotation default) then, while slots remain, a
 * random entry of a mode not offered yet so every enabled mode can be voted
 * for; once all modes are covered the rest is filled at random.
 */
export function pickVoteOptions<T extends { mode: GameMode }>(
  pool: readonly T[],
  first: T,
  count: number,
  random: () => number,
): T[] {
  const options = [first];
  const rest = pool.filter((o) => o !== first);
  while (options.length < count && rest.length) {
    const unseen = rest.filter((o) => !options.some((p) => p.mode === o.mode));
    const candidates = unseen.length ? unseen : rest;
    const pick = candidates[Math.floor(random() * candidates.length)];
    options.push(pick);
    rest.splice(rest.indexOf(pick), 1);
  }
  return options;
}

interface HistoryEntry {
  time: number;
  x: number;
  y: number;
  z: number;
  ducked: boolean;
  hittable: boolean;
}

export interface ServerPlayer {
  id: number;
  name: string;
  color: number;
  team: number; // 0 Bulldogs, 1 Martelos, -1 free-for-all
  primaryChoice: WeaponId;
  state: PlayerState;
  alive: boolean;
  sprayCharges: number;
  nextSprayTick: number;
  respawnAt: number;
  queue: Cmd[];
  lastSeq: number;
  tokens: number;
  using: boolean; // BTN.USE held in the last processed command
  kills: number;
  deaths: number;
  headshots: number;
  streak: number;
  bestStreak: number;
  joinedAt: number;
  ping: number;
  lastChat: number;
  history: HistoryEntry[];
  histHead: number;
  events: GameEvent[];
  send: (data: string) => void;
  brain: BotBrain | null; // server bot when set
  token: string; // secret used to rejoin after a drop
}

interface Airdrop {
  id: number;
  x: number;
  z: number;
  y: number;
  landY: number;
  w: WeaponId;
  landed: boolean;
}

export interface GameOptions {
  maxPlayers: number;
  matchMs: number;
  podiumMs: number;
  warmupMinPlayers: number;
  modes?: ModeSetting | GameMode[];
  maps?: string[]; // map ids allowed in the rotation and the vote (empty = all)
  ctfLimit?: number; // captures to win CTF early (0 = timer only)
  defuseLimit?: number; // rounds to win debug defusion early (0 = timer only)
  tdmLimit?: number; // team kills to win a TDM match early (0 = timer only)
  airdropFirstMs?: number;
  botFill?: number; // keep at least this many players (bots fill the gap while someone is online)
  botSkill?: number; // 0..1
  random?: () => number;
}

export class Game {
  tick = 0;
  readonly players = new Map<number, ServerPlayer>();
  private nextId = 1;
  mapIndex = 0;
  map: MapDef;
  world: CollisionWorld;
  phase: MatchPhase = 'warmup';
  phaseEnds = 0;
  mode: GameMode = 'ffa';
  readonly teamScores = [0, 0];
  private flags: FlagState[] = [{ kind: 'home' }, { kind: 'home' }];
  private readonly flagBasesByMap = new Map<string, FlagBase[]>();
  private bomb: BombState = { kind: 'home' };
  /** Team that carries and plants; the other team defends. Swaps after every round. */
  private attackers: 0 | 1 = 0;
  private bombVariant = 0;
  private winner = -1;
  private endPending = false;
  private rotationIndex = 0;
  private matchId = 0;
  private readonly ghosts = new Map<string, Ghost>();
  private voteOptions: VoteOption[] = [];
  private readonly votes = new Map<number, number>();
  private botName = 0;
  private readonly rotation: { map: number; mode: GameMode }[];
  /** Every map/mode pair this server plays (rotation order). */
  readonly combos: { map: number; mode: GameMode }[];
  private airdrops: Airdrop[] = [];
  private nextAirdropAt = 0;
  private airdropSeq = 1;
  private globalEvents: { ev: GameEvent; except: number }[] = [];
  private scoreDirty = true;
  private lastScoreSent = -Infinity;
  private results: ResultRow[] = [];
  private readonly random: () => number;
  private readonly worlds: CollisionWorld[];

  private readonly opts: GameOptions;

  constructor(opts: GameOptions) {
    this.opts = opts;
    this.random = opts.random ?? Math.random;
    this.worlds = getMaps().map((m) => new CollisionWorld(m));
    const all = getMaps();
    const mapIdx = (opts.maps ?? []).length
      ? (opts.maps ?? []).map((id) => {
          const i = all.findIndex((m) => m.id === id);
          if (i < 0) throw new Error(`Unknown map: ${id} (use ${all.map((m) => m.id).join(', ')})`);
          return i;
        })
      : all.map((_, i) => i);
    const modes = resolveModes(opts.modes);
    this.rotation = rotationFor([...new Set(mapIdx)], modes);
    this.combos = this.rotation;
    this.map = getMap(0);
    this.world = this.worlds[0];
    this.applyRotation();
    // build bot navigation up front so the first bot never causes a hitch mid-game
    if ((opts.botFill ?? 0) > 0) getMaps().forEach((m, i) => navFor(m, this.worlds[i]));
  }

  get tdmLimit(): number {
    return this.opts.tdmLimit ?? 50;
  }

  private applyRotation(): void {
    const r = this.rotation[this.rotationIndex % this.rotation.length];
    this.mapIndex = r.map;
    this.map = getMap(r.map);
    this.world = this.worlds[r.map];
    this.mode = r.mode;
  }

  get ctfLimit(): number { return this.opts.ctfLimit ?? 3; }
  get defuseLimit(): number { return this.opts.defuseLimit ?? 5; }

  private scoreLimit(): number {
    if (this.mode === 'ctf') return this.ctfLimit;
    if (this.mode === 'defuse') return this.defuseLimit;
    return MODE_RULES[this.mode].killScore ? this.tdmLimit : 0;
  }

  private flagBases(): FlagBase[] {
    let bases = this.flagBasesByMap.get(this.map.id);
    if (!bases) {
      bases = this.map.flagBases.map((base) => ({ ...base, y: this.groundY(base.x, this.map.dropHeight, base.z) }));
      this.flagBasesByMap.set(this.map.id, bases);
    }
    return bases;
  }

  /** Flags rest on the floor, never in the air where a carrier fell. */
  private groundY(x: number, fromY: number, z: number): number {
    return Math.max(0, this.world.groundBelow(x, fromY, z, PLAYER_RADIUS));
  }

  private resetObjectives(): void {
    this.flags = [{ kind: 'home' }, { kind: 'home' }];
    this.bomb = { kind: 'home' };
    this.attackers = 0;
    this.drawBombVariant();
  }

  /** Only debug defusion draws, so seeded sequences of the other modes stay untouched. */
  private drawBombVariant(): void {
    if (this.mode === 'defuse') this.bombVariant = Math.floor(this.random() * DEBUG_SCENARIO_COUNT);
  }

  private dropObjective(p: ServerPlayer): void {
    p.using = false;
    if (this.mode !== 'ctf' && this.mode !== 'defuse') return;
    const at = { x: p.state.x, y: this.groundY(p.state.x, p.state.y, p.state.z), z: p.state.z };
    if (this.mode === 'defuse') {
      const result = dropBomb(this.bomb, p.id, at, this.tick, this.attackers);
      this.bomb = result.bomb;
      for (const event of result.events) this.emit(event);
      return;
    }
    const result = dropCarried(this.flags, p.id, at, this.tick);
    this.flags = result.flags;
    for (const event of result.events) this.emit(event);
  }

  private bombPlaces(): BombPlaces {
    const bases = this.flagBases();
    return { home: bases[this.attackers], site: bases[1 - this.attackers], attackers: this.attackers };
  }

  private updateBomb(): void {
    if (this.mode !== 'defuse' || this.phase !== 'live') return;
    const actors = [...this.players.values()].map((p) => ({
      id: p.id, team: p.team, alive: p.alive, using: p.using,
      x: p.state.x, y: p.state.y, z: p.state.z, dropping: p.state.dropping,
    }));
    const before = this.bomb;
    const result = stepBomb(this.bomb, this.bombPlaces(), actors, this.tick, this.bombVariant);
    this.bomb = result.bomb;
    if (this.bomb.kind === 'planted' && before.kind !== 'planted') {
      this.bomb = { ...this.bomb, y: this.groundY(this.bomb.x, this.bomb.y, this.bomb.z) };
    }
    for (const event of result.events) this.emit(event);
    if (!result.outcome) return;
    const winner = result.outcome === 'defused' ? 1 - this.attackers : this.attackers;
    this.teamScores[winner]++;
    this.scoreDirty = true;
    if (this.defuseLimit > 0 && this.teamScores[winner] >= this.defuseLimit) this.endPending = true;
    this.attackers = (1 - this.attackers) as 0 | 1;
    this.drawBombVariant();
  }

  private msAt(tick: number): number {
    return Math.round(tick * TICK_MS);
  }

  private bombSnapshot(): number[] {
    if (this.mode !== 'defuse') return [];
    const bomb = this.bomb;
    const places = this.bombPlaces();
    const carrying = bomb.kind === 'carried' || bomb.kind === 'planting';
    const holder = carrying ? this.players.get(bomb.carrier) : undefined;
    const at = bomb.kind === 'dropped' || bomb.kind === 'planted' ? bomb : holder?.state ?? places.home;
    const state = { home: 0, carried: 1, planting: 2, dropped: 3, planted: 4 }[bomb.kind];
    const actorId = carrying ? bomb.carrier : bomb.kind === 'planted' ? bomb.defuse?.by ?? -1 : -1;
    return [
      state, actorId, round(at.x, 10), round(at.y, 10), round(at.z, 10),
      bomb.kind === 'planted' ? this.msAt(bomb.explodeAtTick) : 0,
      bomb.kind === 'planted' && bomb.defuse ? this.msAt(bomb.defuse.doneAtTick) : 0,
      bomb.kind === 'planted' ? bomb.variant : this.bombVariant,
      this.attackers,
      bomb.kind === 'planting' ? this.msAt(bomb.doneAtTick) : 0,
    ];
  }

  private updateFlags(): void {
    if (this.mode !== 'ctf' || this.phase !== 'live') return;
    const actors = [...this.players.values()].map((p) => ({
      id: p.id, team: p.team, alive: p.alive,
      x: p.state.x, y: p.state.y, z: p.state.z, dropping: p.state.dropping,
    }));
    const result = stepFlags(this.flags, this.flagBases(), actors, this.tick);
    this.flags = result.flags;
    for (const event of result.events) this.emit(event);
    for (const team of result.captured) {
      this.teamScores[team]++;
      this.scoreDirty = true;
      if (this.ctfLimit > 0 && this.teamScores[team] >= this.ctfLimit) this.endPending = true;
    }
  }

  private flagSnapshot(): number[][] {
    if (this.mode !== 'ctf') return [];
    const bases = this.flagBases();
    return this.flags.map((flag, team) => {
      const carrier = flag.kind === 'carried' ? this.players.get(flag.carrier) : undefined;
      const at = flag.kind === 'dropped' ? flag : carrier?.state ?? bases[team];
      return [
        flag.kind === 'home' ? 0 : flag.kind === 'carried' ? 1 : 2,
        flag.kind === 'carried' ? flag.carrier : -1,
        round(at.x, 10), round(at.y, 10), round(at.z, 10),
        flag.kind === 'dropped' ? Math.round(flag.returnAtTick * TICK_MS) : 0,
      ];
    });
  }

  // ------------------------------------------------------------ teams

  private teamSize(team: number, except?: ServerPlayer): number {
    let n = 0;
    for (const p of this.players.values()) if (p !== except && p.team === team) n++;
    return n;
  }

  /** Smaller team, ties go to the team that is behind on score. */
  private pickTeam(except?: ServerPlayer): number {
    const a = this.teamSize(0, except);
    const b = this.teamSize(1, except);
    if (a !== b) return a < b ? 0 : 1;
    if (this.teamScores[0] !== this.teamScores[1]) return this.teamScores[0] < this.teamScores[1] ? 0 : 1;
    return this.random() < 0.5 ? 0 : 1;
  }

  /** Fresh, even split for a new TDM match (shuffled so teams change between matches). */
  private balanceTeams(): void {
    const list = [...this.players.values()];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    list.forEach((p, i) => {
      p.team = isTeamMode(this.mode) ? i % 2 : -1;
    });
  }

  switchTeam(p: ServerPlayer, team: number): void {
    if (!isTeamMode(this.mode) || this.phase === 'podium' || p.team === team || (team !== 0 && team !== 1)) return;
    // only toward the smaller side, like CS's team balance
    if (this.teamSize(team) >= this.teamSize(p.team)) return;
    this.dropObjective(p);
    p.team = team;
    p.streak = 0;
    if (p.alive) {
      p.alive = false;
      p.queue.length = 0;
      p.respawnAt = this.tick + TEAM_SWITCH_RESPAWN_TICKS;
    }
    this.emit({ k: 'team', id: p.id, team, auto: 0 });
    this.broadcastRoster();
    this.scoreDirty = true;
  }

  now(): number {
    return Math.round(this.tick * TICK_MS);
  }

  // ------------------------------------------------------------ lifecycle

  readonly spectators = new Map<number, Spectator>();

  private *recipients(): IterableIterator<ServerPlayer | Spectator> {
    yield* this.players.values();
    yield* this.spectators.values();
  }

  private spectatorInfo(s: Spectator): SpectatorInfo {
    return s.view.kind === 'choosing' ? { kind: 'choosing', pickEndsAt: s.view.deadline } : s.view;
  }

  spectate(name: string, send: (data: string) => void): Spectator | string {
    if (this.spectators.size >= MAX_SPECTATORS) return 'Sem vaga para espectadores';
    const s: Spectator = { id: this.nextId++, name, send, view: !isTeamMode(this.mode)
      ? { kind: 'watching', team: -1 } : { kind: 'choosing', deadline: this.now() + SPECTATOR_PICK_MS } };
    this.spectators.set(s.id, s);
    send(JSON.stringify({ t: 'welcome', id: s.id, time: this.now(), roster: this.roster(), match: this.matchInfo(), maxPlayers: this.opts.maxPlayers, token: '', spectator: this.spectatorInfo(s) }));
    return s;
  }

  watch(s: Spectator, team: number): void {
    if (this.spectators.get(s.id) !== s || !isTeamMode(this.mode) || (team !== 0 && team !== 1)) return;
    s.view = { kind: 'watching', team };
    this.sendSpectator(s);
  }

  leaveSpectator(id: number): void { this.spectators.delete(id); }

  private sendSpectator(s: Spectator): void {
    s.send(JSON.stringify({ t: 'spectate', state: this.spectatorInfo(s) }));
  }

  private syncSpectators(): void {
    for (const s of this.spectators.values()) {
      if (!isTeamMode(this.mode) && (s.view.kind !== 'watching' || s.view.team !== -1)) {
        s.view = { kind: 'watching', team: -1 };
        this.sendSpectator(s);
      } else if (isTeamMode(this.mode) && s.view.kind === 'watching' && s.view.team === -1) {
        s.view = { kind: 'choosing', deadline: this.now() + SPECTATOR_PICK_MS };
        this.sendSpectator(s);
      }
    }
  }

  humanCount(): number {
    let n = 0;
    for (const p of this.players.values()) if (!p.brain) n++;
    return n;
  }

  join(name: string, color: number, primary: WeaponId, send: (data: string) => void, token = ''): ServerPlayer | string {
    if (this.humanCount() >= this.opts.maxPlayers) return 'Servidor cheio';
    const ghost = token ? this.ghosts.get(token) : undefined;
    if (ghost) this.ghosts.delete(token);
    if (ghost && ghost.expires >= this.tick) name = ghost.name;
    const id = this.nextId++;
    const p: ServerPlayer = {
      id,
      name: this.uniqueName(name || `Jogador ${id}`),
      color: clamp(color, 0, PLAYER_COLORS.length - 1),
      team: -1,
      primaryChoice: primary,
      state: createPlayerState(),
      alive: false,
      sprayCharges: SPRAYS_PER_SPAWN,
      nextSprayTick: 0,
      respawnAt: 0,
      queue: [],
      lastSeq: -1,
      tokens: CMD_BURST,
      using: false,
      kills: 0,
      deaths: 0,
      headshots: 0,
      streak: 0,
      bestStreak: 0,
      joinedAt: this.tick,
      ping: 0,
      lastChat: -Infinity,
      history: [],
      histHead: 0,
      events: [],
      send,
      brain: null,
      token: randomBytes(16).toString('hex'),
    };
    if (isTeamMode(this.mode)) p.team = this.pickTeam();
    if (ghost && ghost.expires >= this.tick && ghost.matchId === this.matchId) {
      // same match: give the score back (and the side, if it is still free)
      p.kills = ghost.kills;
      p.deaths = ghost.deaths;
      p.headshots = ghost.headshots;
      p.bestStreak = ghost.bestStreak;
      if (isTeamMode(this.mode) && ghost.team >= 0 && this.teamSize(ghost.team) <= this.teamSize(1 - ghost.team)) p.team = ghost.team;
    }
    this.players.set(id, p);
    p.send(
      JSON.stringify({
        t: 'welcome',
        id,
        time: this.now(),
        roster: this.roster(),
        match: this.matchInfo(),
        maxPlayers: this.opts.maxPlayers,
        token: p.token,
        spectator: null,
      }),
    );
    this.broadcastRoster();
    this.emit({ k: 'join', id });
    this.scoreDirty = true;
    if (this.phase !== 'podium') this.spawn(p);
    this.fillBots();
    if (this.phase === 'warmup' && this.readyToStart()) this.startMatch();
    return p;
  }

  leave(id: number): void {
    const p = this.players.get(id);
    if (!p) return;
    this.dropObjective(p);
    this.players.delete(id);
    this.votes.delete(id);
    if (!p.brain && this.phase !== 'warmup') {
      this.ghosts.set(p.token, {
        name: p.name,
        team: p.team,
        kills: p.kills,
        deaths: p.deaths,
        headshots: p.headshots,
        bestStreak: p.bestStreak,
        matchId: this.matchId,
        expires: this.tick + GHOST_TICKS,
      });
      if (this.ghosts.size > 200) this.ghosts.delete(this.ghosts.keys().next().value as string);
    }
    this.emit({ k: 'leave', id });
    this.scoreDirty = true;
    this.fillBots();
    this.broadcastRoster();
    if (this.players.size === 0) this.resetToWarmup();
  }

  // ------------------------------------------------------------ bots

  private botList(): ServerPlayer[] {
    return [...this.players.values()].filter((p) => p.brain);
  }

  /** Bots top the server up to `botFill` players, but only while at least one human is online. */
  private fillBots(): void {
    const fill = Math.min(this.opts.botFill ?? 0, 64);
    const humans = this.humanCount();
    const want = humans === 0 ? 0 : Math.max(0, fill - humans);
    let bots = this.botList();
    let changed = false;
    while (bots.length > want) {
      const teams = isTeamMode(this.mode);
      const bigger = this.teamSize(0) >= this.teamSize(1) ? 0 : 1;
      const pick =
        bots.find((b) => !b.alive && (!teams || b.team === bigger)) ?? bots.find((b) => !teams || b.team === bigger) ?? bots[0];
      this.dropObjective(pick);
      this.players.delete(pick.id);
      this.votes.delete(pick.id);
      this.emit({ k: 'leave', id: pick.id });
      bots = this.botList();
      changed = true;
    }
    while (bots.length < want) {
      this.addBot();
      bots = this.botList();
      changed = true;
    }
    if (changed) {
      this.broadcastRoster();
      this.scoreDirty = true;
    }
  }

  private addBot(): void {
    const id = this.nextId++;
    const taken = new Set([...this.players.values()].map((p) => p.name));
    let name = '';
    for (let i = 0; i < BOT_NAMES.length && !name; i++) {
      const n = `BOT ${BOT_NAMES[(this.botName + i) % BOT_NAMES.length]}`;
      if (!taken.has(n)) name = n;
    }
    this.botName++;
    if (!name) name = `BOT ${id}`;
    const skill = clamp((this.opts.botSkill ?? 0.5) + (this.random() - 0.5) * 0.3, 0, 1);
    const p: ServerPlayer = {
      id,
      name,
      color: Math.floor(this.random() * PLAYER_COLORS.length),
      team: isTeamMode(this.mode) ? this.pickTeam() : -1,
      primaryChoice: PRIMARY_CHOICES[Math.floor(this.random() * PRIMARY_CHOICES.length)],
      state: createPlayerState(),
      alive: false,
      sprayCharges: SPRAYS_PER_SPAWN,
      nextSprayTick: 0,
      respawnAt: 0,
      queue: [],
      lastSeq: -1,
      tokens: CMD_BURST,
      using: false,
      kills: 0,
      deaths: 0,
      headshots: 0,
      streak: 0,
      bestStreak: 0,
      joinedAt: this.tick,
      ping: 0,
      lastChat: -Infinity,
      history: [],
      histHead: 0,
      events: [],
      send: () => {},
      brain: new BotBrain(skill),
      token: '',
    };
    this.players.set(id, p);
    this.emit({ k: 'join', id });
    if (this.phase !== 'podium') this.spawn(p);
  }

  private runBots(): void {
    if (this.phase === 'podium') return;
    const list = [...this.players.values()];
    const env: BotEnv = {
      world: this.world,
      nav: navFor(this.map, this.world),
      tick: this.tick,
      now: this.now(),
      mode: this.mode,
      random: this.random,
      players: list,
      airdrops: this.airdrops,
      flags: this.flags,
      flagBases: this.flagBases(),
      bomb: this.bomb,
      bombPlaces: this.bombPlaces(),
    };
    for (const p of list) {
      if (p.brain && p.alive && p.queue.length < 2) p.queue.push(p.brain.think(p, env));
    }
  }

  // ------------------------------------------------------------ map vote

  private buildVote(): void {
    const all: VoteOption[] = this.combos.map((c) => ({ ...c }));
    let pool = all.filter((o) => !(o.map === this.mapIndex && o.mode === this.mode));
    if (pool.length === 0) pool = all;
    const def = this.rotation[(this.rotationIndex + 1) % this.rotation.length];
    const first = pool.find((o) => o.map === def.map && o.mode === def.mode) ?? pool[0];
    this.voteOptions = pickVoteOptions(pool, first, VOTE_OPTION_COUNT, this.random);
    this.votes.clear();
  }

  private voteCounts(): number[] {
    const counts = this.voteOptions.map(() => 0);
    for (const [id, o] of this.votes) if (this.players.has(id) && counts[o] !== undefined) counts[o]++;
    return counts;
  }

  vote(p: ServerPlayer, option: number): void {
    if (this.phase !== 'podium' || p.brain || option < 0 || option >= this.voteOptions.length) return;
    if (this.votes.get(p.id) === option) return;
    this.votes.set(p.id, option);
    const msg = JSON.stringify({ t: 'votes', counts: this.voteCounts() });
    for (const q of this.recipients()) q.send(msg);
  }

  /** Most voted option wins; ties prefer the regular rotation, then chance. No votes: rotation. */
  private voteWinner(): VoteOption {
    const def = this.rotation[(this.rotationIndex + 1) % this.rotation.length];
    if (this.voteOptions.length === 0) return def;
    const counts = this.voteCounts();
    const max = Math.max(...counts);
    if (max <= 0) return this.voteOptions[0];
    const top = counts.map((c, i) => (c === max ? i : -1)).filter((i) => i >= 0);
    if (top.includes(0)) return this.voteOptions[0];
    return this.voteOptions[top[Math.floor(this.random() * top.length)]];
  }

  input(p: ServerPlayer, cmds: Cmd[]): void {
    for (const c of cmds) {
      if (c.seq <= p.lastSeq) continue;
      const tail = p.queue.length ? p.queue[p.queue.length - 1].seq : p.lastSeq;
      if (c.seq <= tail) continue;
      p.queue.push(c);
    }
    if (p.queue.length > MAX_QUEUE) p.queue.splice(0, p.queue.length - MAX_QUEUE);
  }

  spray(p: ServerPlayer): void {
    if (!p.alive || p.state.dropping || p.sprayCharges <= 0 || this.tick < p.nextSprayTick || this.phase === 'podium') return;
    const hit = sprayPlacement(this.world, p.state, SPRAY_RANGE);
    if (!hit) return;
    p.sprayCharges--;
    p.nextSprayTick = this.tick + SPRAY_COOLDOWN_TICKS;
    this.emit({
      k: 'spray', id: p.id, left: p.sprayCharges,
      p: [round(hit.x, 10), round(hit.y, 10), round(hit.z, 10)],
      n: [hit.nx, hit.ny, hit.nz], r: round(p.state.yaw, 1e4),
    });
  }

  setLoadout(p: ServerPlayer, primary: WeaponId): void {
    p.primaryChoice = primary;
  }

  chat(p: ServerPlayer, text: string): void {
    if (!text || this.tick - p.lastChat < 60 * 1.2) return;
    p.lastChat = this.tick;
    const msg = JSON.stringify({ t: 'chat', id: p.id, text });
    for (const q of this.recipients()) q.send(msg);
  }

  private uniqueName(base: string): string {
    const taken = new Set([...this.players.values()].map((p) => p.name.toLowerCase()));
    if (!taken.has(base.toLowerCase())) return base;
    for (let i = 2; i < 100; i++) {
      const n = `${base.slice(0, 13)}#${i}`;
      if (!taken.has(n.toLowerCase())) return n;
    }
    return `${base.slice(0, 10)}#${Math.floor(this.random() * 9999)}`;
  }

  // ------------------------------------------------------------ match flow

  private matchInfo(): MatchInfo {
    const podium = this.phase === 'podium';
    return {
      phase: this.phase,
      mode: this.mode,
      map: this.mapIndex,
      endsAt: this.phaseEnds,
      teams: [...this.teamScores],
      limit: this.scoreLimit(),
      results: podium ? this.results : undefined,
      winner: podium ? this.winner : undefined,
      next: podium ? this.rotation[(this.rotationIndex + 1) % this.rotation.length] : undefined,
      vote: podium ? { options: this.voteOptions, counts: this.voteCounts() } : undefined,
    };
  }

  private broadcastMatch(): void {
    const msg = JSON.stringify({ t: 'match', match: this.matchInfo() });
    for (const p of this.recipients()) p.send(msg);
  }

  private resetScores(): void {
    for (const p of this.players.values()) {
      p.kills = 0;
      p.deaths = 0;
      p.headshots = 0;
      p.streak = 0;
      p.bestStreak = 0;
    }
    this.teamScores[0] = 0;
    this.teamScores[1] = 0;
    this.scoreDirty = true;
  }

  startMatch(): void {
    this.resetObjectives();
    this.syncSpectators();
    this.matchId++;
    this.phase = 'live';
    this.phaseEnds = this.now() + this.opts.matchMs;
    this.airdrops = [];
    this.nextAirdropAt = this.now() + (this.opts.airdropFirstMs ?? 25_000);
    this.endPending = false;
    this.resetScores();
    this.balanceTeams();
    this.broadcastRoster();
    for (const p of this.players.values()) this.spawn(p);
    this.broadcastMatch();
  }

  private endMatch(): void {
    this.resetObjectives();
    this.phase = 'podium';
    this.phaseEnds = this.now() + this.opts.podiumMs;
    this.endPending = false;
    const [a, b] = this.teamScores;
    this.winner = !isTeamMode(this.mode) || a === b ? -1 : a > b ? 0 : 1;
    this.results = [...this.players.values()]
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || b.headshots - a.headshots || a.joinedAt - b.joinedAt)
      .map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        kills: p.kills,
        deaths: p.deaths,
        hs: p.headshots,
        best: p.bestStreak,
        team: p.team,
        bot: p.brain ? 1 : 0,
      }));
    for (const p of this.players.values()) {
      p.alive = false;
      p.queue.length = 0;
    }
    this.airdrops = [];
    this.buildVote();
    this.broadcastMatch();
  }

  private nextMap(): void {
    const choice = this.voteWinner();
    this.rotationIndex++;
    this.mapIndex = choice.map;
    this.map = getMap(choice.map);
    this.world = this.worlds[choice.map];
    this.mode = choice.mode;
    this.resetObjectives();
    this.syncSpectators();
    this.voteOptions = [];
    this.votes.clear();
    for (const p of this.players.values()) this.clearHistory(p);
    if (this.readyToStart()) this.startMatch();
    else {
      this.phase = 'warmup';
      this.phaseEnds = 0;
      this.resetScores();
      this.balanceTeams();
      this.broadcastRoster();
      for (const p of this.players.values()) this.spawn(p);
      this.broadcastMatch();
    }
  }

  private resetToWarmup(): void {
    this.resetObjectives();
    this.syncSpectators();
    this.phase = 'warmup';
    this.phaseEnds = 0;
    this.airdrops = [];
    this.results = [];
    this.teamScores[0] = 0;
    this.teamScores[1] = 0;
    this.endPending = false;
  }

  // ------------------------------------------------------------ spawning

  private spawn(p: ServerPlayer): void {
    this.dropObjective(p);
    const a = this.map.dropArea;
    const teams = isTeamMode(this.mode);
    if (teams) {
      // CS-style autobalance: on respawn, move from a side that is 2+ players bigger
      if (p.team < 0 || this.teamSize(p.team) - this.teamSize(1 - p.team) >= 2) {
        const before = p.team;
        p.team = this.pickTeam(p);
        if (before >= 0 && before !== p.team) {
          this.emit({ k: 'team', id: p.id, team: p.team, auto: 1 });
          this.broadcastRoster();
        }
      }
    }
    // TDM: each side skydives in over its own half of the map (Bulldogs north, Martelos south)
    const minZ = teams && p.team === 1 ? 150 : a.minZ;
    const maxZ = teams && p.team === 0 ? -150 : a.maxZ;
    let best = { x: 0, z: 0, score: -1 };
    for (let i = 0; i < 12; i++) {
      const x = a.minX + this.random() * (a.maxX - a.minX);
      const z = minZ + this.random() * (maxZ - minZ);
      let nearest = 1e9;
      for (const q of this.players.values()) {
        if (q === p || !q.alive || (teams && q.team === p.team)) continue;
        nearest = Math.min(nearest, Math.hypot(q.state.x - x, q.state.z - z));
      }
      if (nearest > best.score) best = { x, z, score: nearest };
    }
    const yaw = Math.atan2(best.x, best.z);
    spawnState(p.state, best.x, this.map.dropHeight, best.z, yaw, p.primaryChoice);
    p.alive = true;
    p.sprayCharges = SPRAYS_PER_SPAWN;
    p.nextSprayTick = 0;
    p.brain?.reset();
    this.clearHistory(p);
  }

  private clearHistory(p: ServerPlayer): void {
    p.history.length = 0;
    p.histHead = 0;
  }

  // ------------------------------------------------------------ combat

  private historyAt(p: ServerPlayer, time: number): HistoryEntry | null {
    const h = p.history;
    if (h.length === 0) return null;
    // entries are stored in a ring; build ordered view lazily (small)
    const n = h.length;
    const start = n < HISTORY ? 0 : p.histHead;
    let prev: HistoryEntry | null = null;
    for (let i = 0; i < n; i++) {
      const e = h[(start + i) % n];
      if (e.time >= time) {
        if (!prev) return e;
        const t = (time - prev.time) / Math.max(1, e.time - prev.time);
        return {
          time,
          x: prev.x + (e.x - prev.x) * t,
          y: prev.y + (e.y - prev.y) * t,
          z: prev.z + (e.z - prev.z) * t,
          ducked: t < 0.5 ? prev.ducked : e.ducked,
          hittable: prev.hittable && e.hittable,
        };
      }
      prev = e;
    }
    return prev;
  }

  private recordHistory(): void {
    const time = this.now();
    for (const p of this.players.values()) {
      const s = p.state;
      const e: HistoryEntry = {
        time,
        x: s.x,
        y: s.y,
        z: s.z,
        ducked: s.ducked,
        hittable: p.alive && !s.dropping && s.protect === 0,
      };
      if (p.history.length < HISTORY) p.history.push(e);
      else {
        p.history[p.histHead] = e;
        p.histHead = (p.histHead + 1) % HISTORY;
      }
    }
  }

  private handleShot(p: ServerPlayer, shot: ShotInfo, interp: number): void {
    const def = weaponDef(shot.weapon);
    const now = this.now();
    const t = clamp(interp, now - LAGCOMP_MAX_MS, now);
    const targets: { q: ServerPlayer; x: number; y: number; z: number; ducked: boolean }[] = [];
    for (const q of this.players.values()) {
      if (q === p || !q.alive || q.state.dropping || q.state.protect > 0) continue;
      if (isTeamMode(this.mode) && q.team === p.team) continue; // no friendly fire: bullets pass through teammates
      const h = this.historyAt(q, t);
      if (h && !h.hittable) continue;
      targets.push(h ? { q, x: h.x, y: h.y, z: h.z, ducked: h.ducked } : { q, x: q.state.x, y: q.state.y, z: q.state.z, ducked: q.state.ducked });
    }

    const damageBy = new Map<ServerPlayer, { dmg: number; head: boolean; zone: number }>();
    const ends: number[] = [];
    const { ox, oy, oz } = shot;
    for (let i = 0; i < shot.dirs.length; i += 3) {
      const dx = shot.dirs[i];
      const dy = shot.dirs[i + 1];
      const dz = shot.dirs[i + 2];
      const wall = this.world.trace(ox, oy, oz, dx, dy, dz, def.range);
      const limit = wall ? wall.t : def.range;
      let best: { t: number; zone: number; q: ServerPlayer } | null = null;
      for (const tg of targets) {
        const hit = rayHitbox(ox, oy, oz, dx, dy, dz, tg.x, tg.y, tg.z, tg.ducked, limit);
        if (hit && (!best || hit.t < best.t)) best = { ...hit, q: tg.q };
      }
      const dist = best ? best.t : limit;
      ends.push(round(ox + dx * dist, 10), round(oy + dy * dist, 10), round(oz + dz * dist, 10));
      if (best) {
        const zoneMult = best.zone === ZONE_HEAD ? def.headMult : best.zone === ZONE_LEGS ? 0.75 : 1;
        const base = shot.heavy && def.heavy ? def.heavy.damage : def.damage;
        const dmg = base * zoneMult * def.rangeMod ** (dist / 500);
        const acc = damageBy.get(best.q) ?? { dmg: 0, head: false, zone: best.zone };
        acc.dmg += dmg;
        if (best.zone === ZONE_HEAD) acc.head = true;
        acc.zone = Math.min(acc.zone, best.zone);
        damageBy.set(best.q, acc);
      }
    }
    this.emit({ k: 'shot', id: p.id, w: shot.weapon, o: [round(ox, 10), round(oy, 10), round(oz, 10)], e: ends, h: shot.heavy ? 1 : 0 }, p.id);
    for (const [victim, acc] of damageBy) this.damage(victim, p, acc.dmg, acc.head, acc.zone, shot.weapon);
  }

  private damage(victim: ServerPlayer, attacker: ServerPlayer, dmg: number, head: boolean, zone: number, weapon: WeaponId): void {
    if (!victim.alive) return;
    const def = weaponDef(weapon);
    const s = victim.state;
    const { hp, armorLoss } = absorbArmor(dmg, s.armor, def.armorPen);
    s.armor = Math.max(0, s.armor - armorLoss);
    s.health -= hp;
    const from = [round(attacker.state.x, 1), round(attacker.state.y, 1), round(attacker.state.z, 1)];
    const ev: GameEvent = { k: 'hit', by: attacker.id, to: victim.id, dmg: Math.round(hp), zone, hp: Math.max(0, Math.ceil(s.health)), from };
    attacker.events.push(ev);
    if (victim !== attacker) victim.events.push(ev);
    if (s.health <= 0) this.kill(victim, attacker, weapon, head);
  }

  private kill(victim: ServerPlayer, killer: ServerPlayer, weapon: WeaponId, head: boolean): void {
    this.dropObjective(victim);
    victim.alive = false;
    victim.deaths++;
    victim.streak = 0;
    victim.respawnAt = this.tick + RESPAWN_TICKS;
    victim.state.health = 0;
    victim.queue.length = 0;
    if (killer !== victim) {
      killer.kills++;
      killer.streak++;
    }
    killer.bestStreak = Math.max(killer.bestStreak, killer.streak);
    if (head) killer.headshots++;
    if (MODE_RULES[this.mode].killScore && killer !== victim && killer.team >= 0 && killer.team !== victim.team) {
      this.teamScores[killer.team]++;
      if (this.tdmLimit > 0 && this.teamScores[killer.team] >= this.tdmLimit) this.endPending = true;
    }
    this.emit({ k: 'kill', by: killer.id, to: victim.id, w: weapon, hs: head ? 1 : 0, streak: killer.streak });
    this.scoreDirty = true;
  }

  // ------------------------------------------------------------ airdrops

  private spawnAirdrop(): void {
    const pts = this.map.airdropPoints.filter((pt) => !this.airdrops.some((d) => Math.hypot(d.x - pt.x, d.z - pt.z) < 200));
    if (pts.length === 0) return;
    const pt = pts[Math.floor(this.random() * pts.length)];
    const startY = this.map.dropHeight + 250;
    const landY = Math.max(0, this.world.groundBelow(pt.x, startY, pt.z, AIRDROP_HALF));
    const w = pickLegendary(this.random());
    const d: Airdrop = { id: this.airdropSeq++, x: pt.x, z: pt.z, y: startY, landY, w, landed: false };
    this.airdrops.push(d);
    this.emit({ k: 'drop', id: d.id, x: d.x, z: d.z, w });
  }

  private updateAirdrops(): void {
    const now = this.now();
    if (this.phase === 'live' && now >= this.nextAirdropAt) {
      this.nextAirdropAt = now + AIRDROP_EVERY_MS;
      if (this.airdrops.length < AIRDROP_MAX_ACTIVE) this.spawnAirdrop();
    }
    for (const d of this.airdrops) {
      if (!d.landed) {
        d.y -= AIRDROP_FALL_SPEED * TICK_DT;
        if (d.y <= d.landY) {
          d.y = d.landY;
          d.landed = true;
        }
      }
    }
    for (let i = this.airdrops.length - 1; i >= 0; i--) {
      const d = this.airdrops[i];
      for (const p of this.players.values()) {
        if (!p.alive || p.state.dropping) continue;
        const s = p.state;
        // claim from the ground next to it, or by standing on top
        const near = Math.hypot(s.x - d.x, s.z - d.z) < AIRDROP_PICKUP_RADIUS;
        const vertical = s.y > d.y - 60 && s.y < d.y + AIRDROP_HALF * 2 + 8;
        if (near && vertical && (d.landed || s.y >= d.y)) {
          giveWeapon(s, d.w);
          s.armor = MAX_ARMOR;
          s.health = MAX_HEALTH;
          this.emit({ k: 'loot', id: p.id, drop: d.id, w: d.w });
          this.airdrops.splice(i, 1);
          break;
        }
      }
    }
  }

  private readyToStart(): boolean {
    return this.players.size >= this.opts.warmupMinPlayers;
  }

  // ------------------------------------------------------------ main tick

  update(): void {
    this.tick++;
    const now = this.now();

    for (const s of this.spectators.values()) {
      if (s.view.kind === 'choosing' && now >= s.view.deadline) this.watch(s, this.pickTeam());
    }

    // phase transitions
    if (this.phase === 'live' && (now >= this.phaseEnds || this.endPending)) this.endMatch();
    else if (this.phase === 'podium' && now >= this.phaseEnds) this.nextMap();

    this.runBots();
    if (this.tick % 600 === 0) for (const [k, g] of this.ghosts) if (g.expires < this.tick) this.ghosts.delete(k);

    // commands
    for (const p of this.players.values()) {
      p.tokens = Math.min(CMD_BURST, p.tokens + 1);
      let n = 0;
      while (p.queue.length > 0 && p.tokens >= 1 && n < MAX_CMDS_PER_TICK) {
        const cmd = p.queue.shift() as Cmd;
        p.tokens -= 1;
        n++;
        p.lastSeq = cmd.seq;
        p.using = (cmd.buttons & BTN.USE) !== 0;
        if (p.alive && this.phase !== 'podium') {
          const shot = applyCmd(this.world, p.state, cmd, p.id);
          if (shot) this.handleShot(p, shot, cmd.interp);
          this.keepInBounds(p);
        } else {
          p.state.yaw = cmd.yaw;
          p.state.pitch = cmd.pitch;
        }
      }
    }

    // Respawns and supply drops.
    if (this.phase !== 'podium') {
      for (const p of this.players.values()) {
        if (!p.alive && this.tick >= p.respawnAt) this.spawn(p);
      }
      this.updateAirdrops();
    }

    this.updateFlags();
    this.updateBomb();
    this.recordHistory();
    this.flushEvents();
    if (this.tick % SNAPSHOT_EVERY_TICKS === 0) this.sendSnapshots();
    if (this.scoreDirty ? now - this.lastScoreSent > 250 : now - this.lastScoreSent > 2000) this.sendScores();
  }

  /** Safety net: anyone who escapes the playable volume is put back in the sky. */
  private keepInBounds(p: ServerPlayer): void {
    const s = p.state;
    const b = this.map.bounds;
    if (s.y < -200 || s.x < b.minX - 64 || s.x > b.maxX + 64 || s.z < b.minZ - 64 || s.z > b.maxZ + 64) {
      this.spawn(p);
    }
  }

  // ------------------------------------------------------------ networking

  private emit(ev: GameEvent, except = -1): void {
    this.globalEvents.push({ ev, except });
  }

  private flushEvents(): void {
    const global = this.globalEvents;
    this.globalEvents = [];
    for (const p of this.recipients()) {
      const list: GameEvent[] = [];
      for (const g of global) if (g.except !== p.id) list.push(g.ev);
      if ('events' in p && p.events.length) {
        list.push(...p.events);
        p.events.length = 0;
      }
      if (list.length) p.send(JSON.stringify({ t: 'ev', e: list }));
    }
  }

  private sendSnapshots(): void {
    const ps: number[][] = [];
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      const s = p.state;
      const flags =
        (s.ducked ? RF_DUCK : 0) |
        (s.dropping ? RF_DROP : 0) |
        RF_ALIVE |
        (s.protect > 0 ? RF_PROTECT : 0) |
        (s.onGround ? RF_GROUND : 0) |
        (s.reload > 0 ? RF_RELOAD : 0) |
        (s.zoom > 0 ? RF_ZOOM : 0);
      ps.push([p.id, round(s.x, 10), round(s.y, 10), round(s.z, 10), round(s.yaw, 1000), round(s.pitch, 1000), flags, s.weapon]);
    }
    const ad = this.airdrops.map((d) => [d.id, d.x, round(d.y, 10), d.z, d.w, d.landed ? 1 : 0]);
    const fl = this.flagSnapshot();
    const bm = this.bombSnapshot();
    const shared = `,"ps":${JSON.stringify(ps)},"ad":${JSON.stringify(ad)},"fl":${JSON.stringify(fl)},"bm":${JSON.stringify(bm)}}`;
    const time = this.now();
    for (const p of this.recipients()) {
      const me = 'alive' in p && p.alive && this.phase !== 'podium' ? JSON.stringify(packState(p.state)) : 'null';
      p.send(`{"t":"snap","time":${time},"ack":${'lastSeq' in p ? p.lastSeq : -1},"me":${me}${shared}`);
    }
  }

  private sendScores(): void {
    this.scoreDirty = false;
    this.lastScoreSent = this.now();
    const s = [...this.players.values()].map((p) => [p.id, p.kills, p.deaths, p.ping, p.streak, p.headshots]);
    const msg = JSON.stringify({ t: 'score', s, ts: this.teamScores });
    for (const p of this.recipients()) p.send(msg);
  }

  private roster(): RosterEntry[] {
    return [...this.players.values()].map((p) => [p.id, p.name, p.color, p.team, p.brain ? 1 : 0]);
  }

  private broadcastRoster(): void {
    const msg = JSON.stringify({ t: 'roster', roster: this.roster() });
    for (const p of this.recipients()) p.send(msg);
  }

  publicStatus(): Record<string, unknown> {
    const leaders = [...this.players.values()]
      .sort((a, b) => b.kills - a.kills)
      .slice(0, 3)
      .map((p) => ({ name: p.name, kills: p.kills }));
    return {
      players: this.humanCount(),
      bots: this.players.size - this.humanCount(),
      maxPlayers: this.opts.maxPlayers,
      map: this.map.name,
      mode: this.mode,
      teams: isTeamMode(this.mode) ? this.teamScores : null,
      modes: [...new Set(this.combos.map((c) => c.mode))],
      maps: [...new Set(this.combos.map((c) => getMap(c.map).name))],
      phase: this.phase,
      endsInMs: this.phase === 'warmup' ? null : Math.max(0, this.phaseEnds - this.now()),
      leaders,
    };
  }
}

export { WEAPON };
