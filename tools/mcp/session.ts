import { perceive } from './perception.ts';
import {
  CollisionWorld,
  getMap,
  PROTOCOL_VERSION,
  RF_DROP,
  STAND_HEIGHT,
  TICK_MS,
  encodeCmd,
  type ServerMsg,
  type ClientMsg,
  weaponDef,
  type PlayerState,
  type WeaponId,
} from '../../shared/src/index.ts';
import { NavGrid } from '../../server/src/nav.ts';
import { ActionOverlay } from './actions.ts';
import { Pilot, type Intent } from './pilot.ts';
import { welcome, decodeSnapshot, renderView, type WorldView } from './view.ts';
export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  addEventListener(type: string, listener: (event: { data?: unknown; reason?: string }) => void): void;
  removeEventListener(type: string, listener: (event: { data?: unknown; reason?: string }) => void): void;
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
  private readonly actions = new ActionOverlay();
  private names = new Map<number, string>();
  private timer: ReturnType<typeof setInterval> | undefined;
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
  };
  constructor(options: GameSession['options']) {
    this.options = options;
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
            if (settled) this.close(m.reason);
            else finish(m.reason);
            return;
          }
          if (m.t === 'welcome' && this.state.phase === 'connecting') {
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
      const closed = (e: { reason?: string }) => {
        const reason = e.reason || 'Socket closed';
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
      const raw = decodeSnapshot(v, m);
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
      v.match = m.match;
    }
    if (m.t === 'score') {
      v.scores = m.s;
      v.match.teams = m.ts;
    }
    if (m.t === 'votes' && v.match.vote) v.match.vote.counts = m.counts;
    if (m.t === 'pong') v.time = m.s;
    if (m.t === 'chat') v.chat.push({ name: this.names.get(m.id), ...m });
    if (m.t === 'ev')
      for (const e of m.e) {
        if (e.k === 'kill')
          v.events.push({ ...e, byName: this.names.get(e.by), toName: this.names.get(e.to) });
        else if (e.k === 'join' || e.k === 'leave') v.events.push({ ...e, name: this.names.get(e.id) });
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
    v.chat = v.chat.slice(-10);
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
    const { socket } = this.requirePlaying();
    if (socket.readyState !== 1) {
      this.close('Socket closed');
      throw new Error('Socket closed');
    }
    socket.send(raw ?? JSON.stringify(msg));
  }
  getState(): object {
    const { view, pilot } = this.requirePlaying();
    const intent = this.intent.kind === 'moveTo' ? { ...this.intent, arrived: pilot.arrived } : this.intent;
    return renderView(view, intent, this.actionState());
  }
  setIntent(intent: Intent): object {
    const { view, nav, world, pilot } = this.requirePlaying();
    let distance: number | undefined;
    if (intent.kind === 'moveTo') {
      const s = view.self;
      if (!s) throw new Error('No living player snapshot yet');
      const start = nav.nearest(s.x, s.y, s.z),
        end = nav.nearest(intent.x, s.y, intent.z);
      if (!start || !end || Math.hypot(end.x - intent.x, end.z - intent.z) > 72 || !nav.findPath(start, end))
        throw new Error('Target unreachable on navigation grid');
      if (world.hullOverlaps(intent.x, end.y + 0.1, intent.z, STAND_HEIGHT))
        throw new Error('Target intersects solid map geometry');
      distance = Math.hypot(intent.x - s.x, intent.z - s.z);
    }
    if (
      intent.kind === 'attack' &&
      !view.peers.some((p) => p.id === intent.targetId && p.alive && p.enemy && !(p.flags & RF_DROP))
    )
      throw new Error('Target not currently perceived or unavailable; consult lastSeen and use move_to to search');
    pilot.setIntent(intent, view.self?.y ?? 0);
    this.intent = intent;
    return { intent, distance };
  }
  private actionState(): { crouch: boolean; zoom: number | null } {
    return { crouch: this.actions.crouch, zoom: this.actions.zoom };
  }
  private livingSelf(): PlayerState {
    const s = this.requirePlaying().view.self;
    if (!s || s.health <= 0) throw new Error('No living player snapshot yet');
    return s;
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
    const previous = this.state;
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
