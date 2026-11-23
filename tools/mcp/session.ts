import { perceive } from './perception.ts';
import {
  CollisionWorld,
  HEARING_REF_UNITS,
  anglesToward,
  dirFromAngles,
  eyeHeight,
  surfaceOf,
  getMap,
  PROTOCOL_VERSION,
  RF_DROP,
  radioLine,
  KICK_CLOSE_CODE,
  type KickReason,
  STAND_HEIGHT,
  TICK_MS,
  encodeCmd,
  type ServerMsg,
  type GameEvent,
  type ClientMsg,
  weaponDef,
  type PlayerState,
  type WeaponId,
  LUNCH_COLLEAGUES,
  LUNCH_USE_RADIUS_UNITS,
} from '../../shared/src/index.ts';
import { NavGrid } from '../../server/src/nav.ts';
import { ActionOverlay, weaponSlots, WEAPON_SLOT_REQUEST, type WeaponSlot } from './actions.ts';
import { Pilot, type Intent } from './pilot.ts';
import { silent, type Log } from './log.ts';
import { welcome, decodeSnapshot, renderView, bombProp, lunchColleagues, type ViewSound, type WorldView } from './view.ts';
/** Heard sounds waiting for the next read; older ones are dropped, as events are. */
/** A move_to height may be this far from the floor the grid has at that spot before it counts as a wrong floor (units). */
const MOVE_TO_FLOOR_SLACK_UNITS = 48;
const MAX_SOUNDS = 48;
const MAX_IMPACTS_PER_SHOT = 4;
const MAX_OWN_SHOTS_PER_SNAPSHOT = 4;
/** Pitch the agent can look, short of straight up or down where yaw loses meaning. */
const AIM_PITCH_LIMIT_DEG = 89;
/** How far ahead an aim reports what a shot would hit. */
const AIM_PROBE_UNITS = 3000;
const inUseReach = (c: { x: number; y: number; z: number }, self: PlayerState) =>
  Math.hypot(c.x - self.x, c.y - self.y, c.z - self.z) <= LUNCH_USE_RADIUS_UNITS;
/** What a held USE works on: the debug defusion laptop, or a colleague of hora de almoçar. */
type UseObjective = 'bomb' | 'lunch';
export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  addEventListener(type: string, listener: (event: { data?: unknown; reason?: string; code?: number }) => void): void;
  removeEventListener(type: string, listener: (event: { data?: unknown; reason?: string; code?: number }) => void): void;
}
/** What a kicked agent reads on its next tool call: the bare close reason ("idle") says nothing about what to do. */
const KICKED = new Map<string, string>([
  ['idle', 'Kicked for inactivity: no tool call for too long. Call join to play again.'],
  ['afk', 'Kicked: never confirmed ready in time. Call join to play again.'],
  ['podium', 'Kicked: the match ended before you confirmed ready. Call join to play again.'],
] satisfies [KickReason, string][]);

function closeReason(e: { reason?: string; code?: number }): string {
  if (e.code === KICK_CLOSE_CODE) return KICKED.get(e.reason ?? '') ?? 'Kicked by the server. Call join to play again.';
  return e.reason || 'Socket closed';
}

export interface Clock {
  now(): number;
  setInterval(fn: () => void, ms: number): ReturnType<typeof setInterval>;
  clearInterval(id: ReturnType<typeof setInterval>): void;
}
type State =
  | { phase: 'idle' }
  | { phase: 'connecting'; socket: SocketLike }
  | {
      phase: 'playing';
      socket: SocketLike;
      view: WorldView;
      nav: NavGrid;
      world: CollisionWorld;
      pilot: Pilot;
    }
  | { phase: 'closed'; reason: string };
export interface JoinArgs {
  name: string;
  color: number;
  primary: WeaponId;
  code: string;
}
export class GameSession {
  state: State = { phase: 'idle' };
  intent: Intent = { kind: 'idle' };
  private seq = 0;
  private using: { objective: UseObjective; finish: (outcome: string, reason: string) => void; initial: number; started: boolean } | undefined;
  private readonly actions = new ActionOverlay();
  private names = new Map<number, string>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastPresentAt = -Infinity;
  private cancelJoin: (() => void) | undefined;
  private cleanup: (() => void) | undefined;
  private options: {
    url: string;
    origin: string;
    connect: (url: string, origin: string) => SocketLike;
    clock: Clock;
    random: () => number;
    skill?: number;
    omniscient?: boolean;
    autoVote?: boolean;
    log?: Log;
  };
  private readonly log: Log;
  constructor(options: GameSession['options']) {
    this.options = options;
    this.log = options.log ?? silent;
  }
  async join(args: JoinArgs): Promise<object> {
    if (this.state.phase === 'playing') return this.getState();
    if (this.state.phase === 'connecting') throw new Error('Already connecting');
    const socket = this.options.connect(this.options.url, this.options.origin);
    this.state = { phase: 'connecting', socket };
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const started = this.options.clock.now();
      const finish = (reason?: string) => {
        if (settled) return;
        settled = true;
        this.options.clock.clearInterval(timeout);
        this.cancelJoin = undefined;
        if (reason) {
          this.close(reason);
          reject(new Error(reason));
        } else resolve();
      };
      const timeout = this.options.clock.setInterval(() => {
        if (this.options.clock.now() - started >= 8000) finish('Join timed out');
      }, 100);
      this.cancelJoin = () => finish('Left game');
      const open = () => {
        try {
          socket.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, ...args }));
        } catch (e) {
          finish(String(e));
        }
      };
      const message = (event: { data?: unknown }) => {
        try {
          const m: ServerMsg = JSON.parse(String(event.data));
          if (m.t === 'reject') {
            this.log('reject', m.reason);
            if (settled) this.close(m.reason);
            else finish(m.reason);
            return;
          }
          if (m.t === 'welcome' && this.state.phase === 'connecting') {
            socket.send(JSON.stringify({ t: 'ready' }));
            const map = getMap(m.match.map);
            const world = new CollisionWorld(map);
            this.state = {
              phase: 'playing',
              socket,
              view: welcome(m),
              world,
              nav: new NavGrid(world, map),
              pilot: new Pilot(this.options.skill ?? 0.7, this.options.random),
            };
            this.state.view.perception = this.options.omniscient ? 'omniscient' : 'line-of-sight';
            this.log('join', JSON.stringify(args.name), `players=${m.roster.length}`, `mode=${m.match.mode}`, `map=${m.match.map}`);
            this.names.clear();
            for (const r of m.roster) this.names.set(r[0], r[1]);
            this.seq = 0;
            this.intent = { kind: 'idle' };
            this.actions.reset();
            this.timer = this.options.clock.setInterval(() => this.tick(), Math.ceil(TICK_MS * 2));
            finish();
          } else if (this.state.phase === 'playing') this.receive(m);
        } catch (e) {
          const reason = `Invalid server message: ${String(e)}`;
          if (settled) this.close(reason);
          else finish(reason);
        }
      };
      const closed = (e: { reason?: string; code?: number }) => {
        const reason = closeReason(e);
        if (!settled) finish(reason);
        else this.close(reason);
      };
      const error = () => closed({ reason: 'WebSocket connection failed' });
      socket.addEventListener('open', open);
      socket.addEventListener('message', message);
      socket.addEventListener('close', closed);
      socket.addEventListener('error', error);
      this.cleanup = () => {
        socket.removeEventListener('open', open);
        socket.removeEventListener('message', message);
        socket.removeEventListener('close', closed);
        socket.removeEventListener('error', error);
      };
    });
    return this.getState();
  }
  private receive(m: ServerMsg): void {
    if (this.state.phase !== 'playing') return;
    const v = this.state.view;
    let targetOutOfSight = false;
    if (m.t === 'snap') {
      const wasDropping = v.self?.dropping ?? false;
      const before = v.self && v.self.health > 0 ? { weapon: v.self.weapon, mag: v.self.mag[v.self.weapon] } : null;
      const raw = decodeSnapshot(v, m);
      v.sounds.push(...this.ownShotSounds(v, before));
      this.state.world.setProp(bombProp(v));
      this.actions.ack = m.ack;
      const perceived = perceive(raw, v.self, this.state.world, v.lastSeen, v.time, this.options.omniscient);
      v.peers = perceived.peers;
      v.lastSeen = perceived.lastSeen;
      // reset on the snapshot, not on a tick: a respawn can arrive between two ticks.
      // Every spawn starts a skydive, including the warmup-to-live respawn of a living player.
      if (!v.self || v.self.health <= 0 || (v.self.dropping && !wasDropping)) this.actions.reset();
      if (this.intent.kind === 'attack') {
        const targetId = this.intent.targetId;
        targetOutOfSight = raw.some((p) => p.id === targetId && p.alive && p.enemy && !(p.flags & RF_DROP));
      }
    }
    if (m.t === 'roster') {
      v.roster = m.roster;
      for (const r of m.roster) this.names.set(r[0], r[1]);
      while (this.names.size > 256) {
        const oldest = this.names.keys().next();
        if (!oldest.done) this.names.delete(oldest.value);
      }
    }
    if (m.t === 'match') {
      if (v.match.map !== m.match.map || v.match.mode !== m.match.mode
        || (v.match.phase !== m.match.phase && m.match.phase !== 'podium')) {
        v.sprays = [];
        v.bomb = [];
        v.lunch = [];
        v.colleagues = [];
        this.state.world.setProp(null);
      }
      const enteringPodium = v.match.phase !== 'podium' && m.match.phase === 'podium';
      if (v.match.map !== m.match.map) {
        const map = getMap(m.match.map);
        this.state.world = new CollisionWorld(map);
        this.state.nav = new NavGrid(this.state.world, map);
        this.state.pilot = new Pilot(this.options.skill ?? 0.7, this.options.random);
        this.intent = { kind: 'idle' };
        this.actions.reset();
        v.peers = [];
        v.lastSeen.clear();
      }
      if (v.match.mode !== m.match.mode || v.match.map !== m.match.map || v.match.phase !== m.match.phase) this.log('match', m.match.mode, m.match.map, m.match.phase);
      v.match = m.match;
      if (this.options.autoVote && enteringPodium && m.match.vote?.options.length) {
        const option = Math.floor(this.options.random() * m.match.vote.options.length);
        this.send({ t: 'vote', option });
      }
    }
    if (m.t === 'readiness') this.send({ t: 'ready' });
    if (m.t === 'score') {
      v.scores = m.s;
      v.match.teams = m.ts;
    }
    if (m.t === 'votes' && v.match.vote) v.match.vote.counts = m.counts;
    if (m.t === 'pong') v.time = m.s;
    if (m.t === 'chat') v.chat.push({ name: this.names.get(m.id), ...m });
    if (m.t === 'radio') {
      const line = radioLine(m.line);
      if (line) v.chat.push({ t: 'chat', id: m.id, name: this.names.get(m.id), text: line.text, radio: true });
    }
    if (m.t === 'ev')
      for (const e of m.e) {
        if (e.k === 'shot' || e.k === 'hit') v.sounds.push(...this.soundsOf(e, v));
        if (e.k === 'spray') {
          v.sprays.push({ id: e.id, by: this.names.get(e.id) ?? String(e.id),
            x: e.p[0], y: e.p[1], z: e.p[2], nx: e.n[0], ny: e.n[1], nz: e.n[2] });
          v.sprays = v.sprays.slice(-64);
        } else if (e.k === 'kill')
          v.events.push({ ...e, byName: this.names.get(e.by), toName: this.names.get(e.to) });
        else if (e.k === 'flag' || e.k === 'bomb') v.events.push({ ...e, byName: this.names.get(e.by) });
        else if (e.k === 'lunch') v.events.push({ ...e, byName: this.names.get(e.by), colleague: LUNCH_COLLEAGUES[e.who] });
        else if (e.k === 'join' || e.k === 'leave') v.events.push({ ...e, name: this.names.get(e.id) });
        else if (e.k === 'supply') v.events.push({ ...e, name: this.names.get(e.id) });
      }
    if (this.using) {
      const self = v.self;
      const bomb = v.bomb;
      if (!self || self.health <= 0) this.using.finish('interrupted', 'Player died');
      else if (self.dropping) this.using.finish('interrupted', 'Player respawned or dropping');
      else if (this.using.objective === 'lunch') this.watchLunchUse(m, v, self);
      else if (m.t === 'match' || !bomb.length) this.using.finish('interrupted', 'Match changed');
      else if (m.t === 'ev') {
        for (const event of m.e) {
          if (event.k !== 'bomb') continue;
          if (event.what === 'plant' || event.what === 'defused') {
            this.using?.finish(event.by === v.id ? event.what === 'plant' ? 'planted' : 'defused' : 'interrupted',
              event.by === v.id ? 'Objective completed' : 'Another player completed the objective');
          } else if (event.what === 'exploded') this.using?.finish('interrupted', 'Bomb exploded');
          else if (event.what === 'expired') this.using?.finish('interrupted', 'Plant window ran out');
        }
      } else if (m.t === 'snap') {
        const active = (bomb[0] === 2 || (bomb[0] === 4 && bomb[6] > 0)) && bomb[1] === v.id;
        if (active) this.using.started = true;
        else if (this.using.started || bomb[0] !== this.using.initial) this.using.finish(
          this.using.initial !== 4 && bomb[0] === 4 ? 'planted' : 'interrupted', 'Bomb state changed');
      }
    }
    if (m.t === 'snap' && this.intent.kind === 'attack' && !this.intent.ended) {
      const id = this.intent.targetId;
      if (!v.peers.some((p) => p.id === id && p.alive && p.enemy && !(p.flags & RF_DROP))) {
        this.intent = { kind: 'attack', targetId: id, ended: true };
        this.state.pilot.setIntent({ kind: 'idle' }, 0);
        v.events.push({ k: 'intent', reason: targetOutOfSight ? 'Target out of sight' : 'Target dead, missing, friendly or dropping', id });
      }
    }
    v.events = v.events.slice(-20);
    v.sounds = v.sounds.slice(-MAX_SOUNDS);
    v.chat = v.chat.slice(-10);
  }
  /**
   * The server never sends a player their own shots, since a browser plays them from its own prediction, so the agent's are
   * worked out from the magazine dropping between snapshots, with the impact where the crosshair meets the map.
   */
  private ownShotSounds(v: WorldView, before: { weapon: number; mag: number } | null): ViewSound[] {
    const self = v.self;
    if (this.state.phase !== 'playing' || !before || !self || self.health <= 0 || self.dropping || self.weapon !== before.weapon) return [];
    const rounds = Math.min(MAX_OWN_SHOTS_PER_SNAPSHOT, before.mag - self.mag[self.weapon]);
    if (rounds <= 0) return [];
    const weapon = weaponDef(self.weapon);
    const by = this.names.get(v.id);
    const eye = { x: self.x, y: self.y + eyeHeight(self), z: self.z };
    const sounds: ViewSound[] = Array.from({ length: rounds }, () => ({ kind: 'shot', pos: [eye.x, eye.y, eye.z], ref: HEARING_REF_UNITS.shot, weapon: weapon.name, by, own: true }));
    const dir = dirFromAngles(self.yaw, self.pitch);
    const hit = this.state.world.trace(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, weapon.range);
    if (hit) sounds.push({ kind: 'impact', pos: [eye.x + dir.x * hit.t, eye.y + dir.y * hit.t, eye.z + dir.z * hit.t], ref: HEARING_REF_UNITS.impact, material: hit.mat, surface: surfaceOf(hit.mat), by });
    return sounds;
  }
  /** What the server's shot and hit events sound like from where we stand: the shot itself, the impacts it made and a hit on us. */
  private soundsOf(shot: Extract<GameEvent, { k: 'shot' | 'hit' }>, v: WorldView): ViewSound[] {
    if (this.state.phase !== 'playing') return [];
    if (shot.k === 'hit') return shot.to === v.id ? [{ kind: 'hurt', pos: shot.from, ref: HEARING_REF_UNITS.impact }] : [];
    const weapon = weaponDef(shot.w);
    const by = this.names.get(shot.id);
    const [ox, oy, oz] = shot.o;
    const sounds: ViewSound[] = [{ kind: 'shot', pos: shot.o, ref: weapon.slot === 3 ? HEARING_REF_UNITS.hammer : HEARING_REF_UNITS.shot, weapon: weapon.name, by, own: shot.id === v.id }];
    if (weapon.slot === 3) return sounds;
    for (let i = 0; i < shot.e.length && sounds.length <= MAX_IMPACTS_PER_SHOT; i += 3) {
      const length = Math.hypot(shot.e[i] - ox, shot.e[i + 1] - oy, shot.e[i + 2] - oz);
      if (length === 0) continue;
      const hit = this.state.world.trace(ox, oy, oz, (shot.e[i] - ox) / length, (shot.e[i + 1] - oy) / length, (shot.e[i + 2] - oz) / length, length + 2);
      if (hit && Math.abs(hit.t - length) < 3) {
        sounds.push({ kind: 'impact', pos: [shot.e[i], shot.e[i + 1], shot.e[i + 2]], ref: HEARING_REF_UNITS.impact, material: hit.mat, surface: surfaceOf(hit.mat), by });
      }
    }
    return sounds;
  }
  private tick(): void {
    if (this.state.phase !== 'playing') return;
    try {
      const { view, nav, world, pilot } = this.state;
      const commands = Array.from({ length: 2 }, () =>
        this.actions.apply(pilot.nextCmd(view, this.intent, nav, world, ++this.seq), view.self),
      );
      this.send({ t: 'in', c: commands }, JSON.stringify({ t: 'in', c: commands.map(encodeCmd) }));
    } catch (e) {
      this.close(String(e));
    }
  }
  /** Every tool call proves the agent is still answering, even a wait that leaves the pilot standing still. */
  markPresent(): void {
    if (this.state.phase !== 'playing' || this.state.socket.readyState !== 1) return;
    const now = this.options.clock.now();
    if (now - this.lastPresentAt < 1000) return;
    this.lastPresentAt = now;
    this.send({ t: 'active' });
  }
  requirePlaying(): Extract<State, { phase: 'playing' }> {
    if (this.state.phase !== 'playing')
      throw new Error(this.state.phase === 'closed' ? this.state.reason : 'Not joined');
    if (this.state.socket.readyState !== 1) {
      this.close('Socket closed');
      throw new Error('Socket closed');
    }
    return this.state;
  }
  send(msg: Exclude<ClientMsg, { t: 'hello' }>, raw?: string): void {
    const { socket, view } = this.requirePlaying();
    if (socket.readyState !== 1) {
      this.close('Socket closed');
      throw new Error('Socket closed');
    }
    if (msg.t === 'vote') {
      const chosen = view.match.vote?.options[msg.option];
      this.log('vote', `option=${msg.option}`, `map=${chosen?.map}`, `mode=${chosen?.mode}`);
    }
    socket.send(raw ?? JSON.stringify(msg));
  }
  getState(): object {
    const { view, pilot, world } = this.requirePlaying();
    const intent = this.intent.kind === 'moveTo' ? { ...this.intent, arrived: pilot.arrived } : this.intent;
    return renderView(view, intent, this.actionState(), world);
  }
  setIntent(requested: Intent): object {
    const { view, nav, world, pilot } = this.requirePlaying();
    let intent = requested;
    let distance: number | undefined;
    if (intent.kind === 'moveTo') {
      const s = view.self;
      if (!s) throw new Error('No living player snapshot yet');
      const floorY = intent.y ?? s.y;
      const start = nav.nearest(s.x, s.y, s.z),
        end = nav.nearest(intent.x, floorY, intent.z);
      if (!start || !end || Math.hypot(end.x - intent.x, end.z - intent.z) > 72 || !nav.findPath(start, end))
        throw new Error('Target unreachable on navigation grid');
      if (intent.y !== undefined && Math.abs(end.y - intent.y) > MOVE_TO_FLOOR_SLACK_UNITS)
        throw new Error('No floor near y=' + intent.y + ' at that x,z (the nearest is at y=' + end.y + ')');
      if (world.hullOverlaps(intent.x, end.y + 0.1, intent.z, STAND_HEIGHT))
        throw new Error('Target intersects solid map geometry');
      // the pilot arrives at a walkable height, so a floor the agent asked for is the one the grid has there
      if (intent.y !== undefined) intent = { ...intent, y: end.y };
      distance = Math.hypot(intent.x - s.x, intent.z - s.z);
    }
    if (
      intent.kind === 'attack' &&
      !view.peers.some((p) => p.id === intent.targetId && p.alive && p.enemy && !(p.flags & RF_DROP))
    )
      throw new Error('Target not currently perceived or unavailable; consult lastSeen and use move_to to search');
    pilot.setIntent(intent, view.self?.y ?? 0);
    this.intent = intent;
    this.actions.aim = null;
    return { intent, distance };
  }
  /**
   * Holds the crosshair on a world point or at an angle, with the pilot standing still, and reports what a shot from here
   * would hit. Any later move, attack, hunt or stop gives the view back to the pilot.
   */
  aim(at: { x: number; y: number; z: number } | { yawDeg: number; pitchDeg: number }): object {
    const self = this.livingSelf();
    const { pilot, world } = this.requirePlaying();
    if (self.dropping) throw new Error('Player is dropping');
    const eye = { x: self.x, y: self.y + eyeHeight(self), z: self.z };
    const angles = 'yawDeg' in at
      ? { yaw: (at.yawDeg * Math.PI) / 180, pitch: (Math.max(-AIM_PITCH_LIMIT_DEG, Math.min(AIM_PITCH_LIMIT_DEG, at.pitchDeg)) * Math.PI) / 180 }
      : anglesToward(eye, at);
    pilot.setIntent({ kind: 'idle' }, self.y);
    this.intent = { kind: 'idle' };
    this.actions.aim = angles;
    const dir = dirFromAngles(angles.yaw, angles.pitch);
    const hit = world.trace(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, AIM_PROBE_UNITS);
    return {
      yawDeg: (angles.yaw * 180) / Math.PI,
      pitchDeg: (angles.pitch * 180) / Math.PI,
      expect: hit ? { distance: Math.round(hit.t), mat: hit.mat, surface: surfaceOf(hit.mat) } : null,
    };
  }
  /** Holds the trigger for `ms` where the crosshair points; the pilot stays idle, so it fires nothing by itself. */
  fire(ms: number): object {
    const self = this.livingSelf();
    if (self.dropping) throw new Error('Player is dropping');
    this.actions.requestFire(ms);
    return { firing: ms, weapon: weaponDef(self.weapon).name, mag: self.mag[self.weapon], aimed: this.actions.aim !== null };
  }
  private actionState(): { crouch: boolean; walk: boolean; zoom: number | null } {
    return { crouch: this.actions.crouch, walk: this.actions.walk, zoom: this.actions.zoom };
  }
  private livingSelf(): PlayerState {
    const s = this.requirePlaying().view.self;
    if (!s || s.health <= 0) throw new Error('No living player snapshot yet');
    return s;
  }
  use(ms = 10000): Promise<object> {
    const self = this.livingSelf();
    const { view } = this.requirePlaying();
    if (self.dropping) throw new Error('Player is dropping');
    const objective = this.useObjective(view, self);
    if (!Number.isFinite(ms) || ms <= 0 || ms > 10000) throw new Error('Invalid ms');
    if (this.using) throw new Error('Already using');
    this.actions.use = true;
    return new Promise(resolve => {
      const startedAt = this.options.clock.now();
      const timer = this.options.clock.setInterval(() => {
        if (this.options.clock.now() - startedAt >= ms) this.using?.finish('interrupted', 'Duration elapsed');
      }, 25);
      this.using = { objective, initial: view.bomb[0] ?? -1, started: false, finish: (outcome, reason) => {
        this.options.clock.clearInterval(timer);
        this.actions.use = false;
        this.using = undefined;
        resolve({ outcome, reason });
      } };
    });
  }
  private useObjective(view: WorldView, self: PlayerState): UseObjective {
    if (view.match.mode === 'defuse' && view.match.phase === 'live' && view.bomb.length) return 'bomb';
    const colleagues = lunchColleagues(view);
    if (!colleagues || view.match.phase === 'podium') throw new Error('No live debug defusion or hora de almoçar objective');
    if (view.roster.find((r) => r[0] === view.id)?.[3] !== view.lunch[0]) throw new Error('Only the attacking team takes colleagues to lunch');
    if (!colleagues.some((c) => c.kind === 'waiting' && inUseReach(c, self))) throw new Error(`No waiting colleague within ${LUNCH_USE_RADIUS_UNITS} units; move_to one first`);
    return 'lunch';
  }
  /**
   * A colleague taking the call ends the hold. The round ending wins over a call in the same batch, since the next round
   * puts the colleagues back. A snapshot with nobody left to call (an ally took them) ends it too, instead of freezing.
   */
  private watchLunchUse(m: ServerMsg, v: WorldView, self: PlayerState): void {
    const colleagues = lunchColleagues(v);
    if (m.t === 'match' || !colleagues) {
      this.using?.finish('interrupted', 'Match changed');
      return;
    }
    const followingMe = (names: string[]) => this.using?.finish('following', `${names.join(', ')} now ${names.length > 1 ? 'follow' : 'follows'} you`);
    if (m.t === 'ev') {
      const lunch = m.e.flatMap((e) => e.k === 'lunch' ? [e] : []);
      if (lunch.some((e) => e.what === 'served' || e.what === 'full')) this.using?.finish('interrupted', 'Round ended');
      const followers = lunch.filter((e) => e.what === 'follow' && e.by === v.id).map((e) => LUNCH_COLLEAGUES[e.who]);
      if (followers.length) followingMe(followers);
      return;
    }
    if (m.t !== 'snap' || colleagues.some((c) => c.kind === 'waiting' && inUseReach(c, self))) return;
    const mine = colleagues.flatMap((c, i) => c.kind === 'following' && c.leader === v.id ? [LUNCH_COLLEAGUES[i]] : []);
    if (mine.length) followingMe(mine);
    else this.using?.finish('interrupted', 'No waiting colleague left in reach');
  }
  jump(): object {
    if (!this.livingSelf().onGround) throw new Error('Not on the ground');
    this.actions.requestJump();
    return this.actionState();
  }
  setCrouch(on: boolean): object {
    this.livingSelf();
    this.actions.crouch = on;
    return this.actionState();
  }
  walk(on: boolean): object {
    this.livingSelf();
    this.actions.walk = on;
    return this.actionState();
  }
  reload(): object {
    const self = this.livingSelf();
    if (weaponDef(self.weapon).mag <= 0) throw new Error('Weapon cannot reload');
    this.actions.requestReload();
    return this.actionState();
  }
  switchWeapon(slot: WeaponSlot): object {
    const self = this.livingSelf();
    const target = weaponSlots(self)[slot];
    if (target === null) throw new Error('No previous weapon');
    this.actions.requestWeapon(WEAPON_SLOT_REQUEST[slot]);
    return { ...this.actionState(), weapon: weaponDef(target).name };
  }
  setZoom(level: number): object {
    const scopeLevels = weaponDef(this.livingSelf().weapon).zoomFov.length;
    if (scopeLevels === 0) throw new Error('Weapon has no scope');
    if (level > scopeLevels) throw new Error('Zoom level out of range');
    this.actions.zoom = level;
    return this.actionState();
  }
  close(reason = 'Left game'): void {
    if (this.cancelJoin) {
      const cancel = this.cancelJoin;
      this.cancelJoin = undefined;
      cancel();
      return;
    }
    this.using?.finish('interrupted', reason);
    const previous = this.state;
    if (previous.phase === 'playing') this.log('leave', reason);
    this.state = { phase: 'closed', reason };
    this.intent = { kind: 'idle' };
    this.actions.reset();
    if (this.timer) this.options.clock.clearInterval(this.timer);
    this.timer = undefined;
    this.cleanup?.();
    this.cleanup = undefined;
    if (previous.phase === 'playing' || previous.phase === 'connecting') previous.socket.close();
  }
}
