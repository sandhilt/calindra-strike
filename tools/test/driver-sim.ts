import {
  TICK_RATE, TICK_MS, WEAPON, applyCmd, createPlayerState, RF_ALIVE, getMap, packState, spawnState,
  type PlayerState,
} from '../../shared/src/index.ts';
import { BotDriver, type Brain, type Snap } from '../bot-driver.ts';

export const SECONDS = (n: number) => n * TICK_RATE;

/** A bot driven by a real BotDriver through the shared movement sim, the way the server steps a dev bot's commands. */
export class SimBot {
  readonly state = createPlayerState();
  readonly driver: BotDriver;
  readonly id: number;
  readonly team: number;
  seq = 0;
  /** Snapshots the bot sees, oldest first: the server answers a few ticks after the position was reached. */
  private readonly history: { me: number[]; seq: number }[] = [];
  private input: ReturnType<BotDriver['drive']> | null = null;
  private readonly lagTicks: number;
  constructor(brain: Brain, id: number, team: number, at: { x: number; y: number; z: number }, lagTicks = 0) {
    this.lagTicks = lagTicks;
    this.driver = new BotDriver(brain);
    this.id = id;
    this.team = team;
    spawnState(this.state, at.x, at.y, at.z, 0, WEAPON.RIFLE);
    this.state.dropping = false;
    this.state.onGround = true;
  }
  /** One tick: build the snapshot the server would send, drive, apply the command. */
  step(map: number, world: import('../../shared/src/index.ts').CollisionWorld, tick: number, bm: number[], others: SimBot[] = []): void {
    this.history.push({ me: packState(this.state), seq: this.seq });
    const seen = this.history[Math.max(0, this.history.length - 1 - this.lagTicks)];
    const snap: Snap = {
      t: 'snap', time: tick * TICK_MS, ack: seen.seq, me: seen.me,
      ps: others.map((o) => [o.id, o.state.x, o.state.y, o.state.z, 0, 0, RF_ALIVE]), ad: [], fl: [], bm,
    };
    const teams = new Map<number, number>([[this.id, this.team], ...others.map((o): [number, number] => [o.id, o.team])]);
    // tools/bots.ts decides once per two ticks and sends the same input twice.
    if (!this.input || tick % 2 === 0) this.input = this.driver.drive(snap, map, this.id, teams, tick);
    const cmd = { ...this.input, seq: ++this.seq, interp: 0 };
    this.driver.sent(cmd);
    applyCmd(world, this.state, cmd, 1);
  }
}
export type { PlayerState };
export { getMap };
