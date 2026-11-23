import {
  BTN, CollisionWorld, DEG, TICK_MS, applyCmd, clamp, wrapAngle, PLAYER_RADIUS, RF_ALIVE, RF_DROP, WEAPON, stanceFromFlags, type Stance,
  createPlayerState, eyeHeight, getMap, unpackState,
  type BombPoint, type Cmd, type ServerMsg,
} from '../shared/src/index.ts';
import {
  REACH_MAX_HEIGHT_UNITS, aimSkill, aimTolerance, crouchesToShoot, gauss, hasLineOfSight, aimHeight, sightHeights, readyToJump, restingSway, stepSway, waypointReached, type AimSkill,
} from '../server/src/bot.ts';
import { NavGrid, type NavNode } from '../server/src/nav.ts';
import { checkProgress, reachedPatrolPoint, type BotPlayer, type Goal, type ProgressSample } from './drive-goals.ts';

export type Snap = Extract<ServerMsg, { t: 'snap' }>;
export type DriveInput = Pick<Cmd, 'buttons' | 'yaw' | 'pitch' | 'weapon'>;

const REPATH_DISTANCE_UNITS = 48;
const CLOSE_ENEMY_UNITS = 300;
const RECOVERY_MS = 500;
const MAX_PATROL_SKIPS = 6; // one lap of the ring
const REPATH_MS = 1500; // a bot knocked off its route (a ledge, a push) plans again instead of aiming at a node it can no longer reach
const MAX_PENDING_CMDS = 120; // two seconds of commands: a connection further behind is not worth predicting
const MAX_AIM_STEP_SECONDS = 0.1; // a long gap between snapshots does not let the bot snap onto a target
/** How quickly the view closes on where it wants to look, per second: it slows down near the target like a hand does. */
const AIM_EASE_PER_S = 10;
const WALK_EASE_PER_S = 6;
const STEER_BUTTONS = [
  BTN.FWD, BTN.FWD | BTN.LEFT, BTN.LEFT, BTN.BACK | BTN.LEFT,
  BTN.BACK, BTN.BACK | BTN.RIGHT, BTN.RIGHT, BTN.FWD | BTN.RIGHT,
];
const IDLE: DriveInput = { buttons: 0, yaw: 0, pitch: 0, weapon: 0 };
const bearing = (from: BombPoint, to: BombPoint) => Math.atan2(from.x - to.x, from.z - to.z);

export interface Terrain {
  world: CollisionWorld;
  nav: NavGrid;
  /** Flag bases lowered to the floor, team i's flag sits at `bases[i]`. */
  bases: [BombPoint, BombPoint];
}

/** What a mode sees of one bot's surroundings when it picks a goal. */
export interface DriveView {
  snap: Snap;
  terrain: Terrain;
  self: BotPlayer;
  players: readonly BotPlayer[];
  /** Counts up each time the bot reaches a patrol point. */
  leg: number;
  enemy: BombPoint | null;
  closeEnemy: boolean;
}

/** A mode's decisions. `decide` returns null while the match has nothing for the bot to do. */
export interface Brain {
  prepare?(terrain: Terrain, snap: Snap): void;
  decide(view: DriveView): Goal | null;
}

const maps = new Map<number, Terrain>();

function navigation(index: number): Terrain {
  const cached = maps.get(index);
  if (cached) return cached;
  const map = getMap(index);
  const world = new CollisionWorld(map);
  const atFloor = ({ x, z }: { x: number; z: number }) => ({
    x, y: Math.max(0, world.groundBelow(x, map.dropHeight, z, PLAYER_RADIUS)), z,
  });
  const terrain: Terrain = {
    world, nav: new NavGrid(world, map), bases: [atFloor(map.flagBases[0]), atFloor(map.flagBases[1])],
  };
  maps.set(index, terrain);
  return terrain;
}

/** Walks nav-grid paths to the goal a `Brain` picks, shoots visible enemies and recovers when stuck. */
export class BotDriver {
  private leg = 0;
  private goal: Goal | null = null;
  private path: { node: NavNode; jump: boolean }[] = [];
  private progress: ProgressSample | null = null;
  /** Closest the bot has been to the waypoint it is walking to, to tell that it has gone past it. */
  private waypointClosest = Infinity;
  private repathAt = 0;
  private hadEnemy = false;
  private spotted = false;
  private recoverUntil = 0;
  private recoveryYaw = 0;
  private recoverySide = 1;
  private readonly state = createPlayerState();
  /** Commands sent and not yet in a snapshot: the position steered by is where the bot is now, not where the snapshot saw it. */
  private pending: Cmd[] = [];
  private readonly brain: Brain;
  private readonly aim: AimSkill;
  private readonly random: () => number;
  /** Enemy being aimed at, and the aim's state: like a person, the bot reacts late and its first aim is off. */
  private targetId = -1;
  private reactAt = 0;
  private errYaw = 0;
  private errPitch = 0;
  private aimHead = false;
  private crouchRoll = 1;
  private crouching = false;
  private readonly sway = restingSway();
  private yaw = 0;
  private pitch = 0;
  private lastTime = -1;

  /** `skill` 0..1, the same scale as the server bots' BOT_SKILL. */
  constructor(brain: Brain, skill = 0.5, random: () => number = Math.random) {
    this.brain = brain;
    this.aim = aimSkill(skill);
    this.random = random;
  }

  drive(snap: Snap, map: number, id: number, teams: ReadonlyMap<number, number>, tick: number): DriveInput {
    const team = teams.get(id);
    if (!snap.me || team === undefined) return this.idle();

    const terrain = navigation(map);
    const { world, nav } = terrain;
    this.brain.prepare?.(terrain, snap);
    const players = snap.ps.map(([pid, x, y, z, , , flags]) => ({
      id: pid, x, y, z, team: teams.get(pid) ?? -1, dropping: Boolean(flags & RF_DROP), alive: Boolean(flags & RF_ALIVE), flags,
    }));
    unpackState(snap.me, this.state);
    this.pending = this.pending.filter((cmd) => cmd.seq > snap.ack);
    for (const cmd of this.pending) applyCmd(world, this.state, cmd, 1);
    const { x, y, z, dropping } = this.state;
    const self = { x, y, z, team, id, dropping, alive: true };
    const eyeY = y + eyeHeight(this.state);

    let enemy: (BombPoint & { id: number; stance: Stance }) | null = null;
    let enemyDistance = this.aim.sightUnits;
    for (const player of dropping ? [] : players) {
      // A dead enemy stays in snapshots until respawn; treating the body as a threat kept bots from ever finishing the objective.
      if (player.team === team || player.team < 0 || player.dropping || !player.alive) continue;
      const distance = Math.hypot(player.x - x, player.y - y, player.z - z);
      if (distance >= enemyDistance) continue;
      const stance = stanceFromFlags(player.flags);
      if (!hasLineOfSight(world, x, eyeY, z, player, sightHeights(stance))) continue;
      enemy = { x: player.x, y: player.y, z: player.z, id: player.id, stance };
      enemyDistance = distance;
    }
    const closeEnemy = enemyDistance < CLOSE_ENEMY_UNITS;
    if (enemy && !this.hadEnemy) this.spotted = true;
    this.hadEnemy = enemy !== null;

    const view = (leg: number): DriveView => ({ snap, terrain, self, players, leg, enemy, closeEnemy });
    let goal = this.brain.decide(view(this.leg));
    if (!goal) return this.idle();
    if (self.dropping) {
      this.reset();
      const buttons = Math.hypot(x - goal.point.x, z - goal.point.z) > 120 ? BTN.FWD : BTN.DUCK;
      return { buttons, yaw: bearing(self, goal.point), pitch: -0.6, weapon: 0 };
    }

    if (goal.use) {
      this.reset();
      return { buttons: BTN.USE | BTN.DUCK, yaw: bearing(self, goal.point), pitch: 0, weapon: 0 };
    }

    const progress = checkProgress(this.progress, self, snap.time);
    this.progress = progress.sample;
    const patrolNode = (g: Goal) => (g.roam ? nav.nearest(g.point.x, g.point.y, g.point.z) : null);
    const arrived = goal.roam && reachedPatrolPoint(self, patrolNode(goal) ?? goal.point);
    if (goal.roam && (progress.stuck || arrived)) goal = this.nextPatrol(view, goal);
    // A ring point outside the walls has no node to walk to: skip it now instead of pressing against the wall until the stuck timer fires.
    for (let skipped = 0; goal.roam && !patrolNode(goal) && skipped < MAX_PATROL_SKIPS; skipped++) goal = this.nextPatrol(view, goal);

    if (progress.stuck) {
      this.goal = null;
      this.recoverUntil = snap.time + RECOVERY_MS;
      this.recoverySide *= -1;
      this.recoveryYaw = bearing(self, goal.point) + this.recoverySide * Math.PI / 2;
    }

    let moveYaw: number;
    let buttons = 0;
    let settled = false;
    if (snap.time < this.recoverUntil) {
      moveYaw = this.recoveryYaw;
      buttons |= BTN.JUMP;
    } else if (enemy && closeEnemy && goal.duel) {
      this.goal = null;
      const side = (Math.floor(tick / 30) + id) % 2 ? 1 : -1;
      moveYaw = bearing(self, enemy) + side * Math.PI / 2;
    } else {
      const destination = goal.intercept ?? goal.point;
      const changed = snap.time >= this.repathAt || this.goal?.role !== goal.role
        || Math.hypot(destination.x - this.goal.point.x, destination.y - this.goal.point.y, destination.z - this.goal.point.z) >= REPATH_DISTANCE_UNITS;
      if (changed) this.route(nav, self, { role: goal.role, point: destination }, snap.time);
      // The snapshot is a few ticks old, so a bot cannot count on landing inside a tight arrival radius.
      while (this.path[0] && Math.abs(this.path[0].node.y - y) <= REACH_MAX_HEIGHT_UNITS) {
        const distance = Math.hypot(this.path[0].node.x - x, this.path[0].node.z - z);
        if (!waypointReached(distance, this.waypointClosest)) {
          this.waypointClosest = Math.min(this.waypointClosest, distance);
          break;
        }
        this.path.shift();
        this.waypointClosest = Infinity;
      }
      const waypoint = this.path[0];
      moveYaw = bearing(self, waypoint?.node ?? destination);
      // A jump keeps the ground speed, so jumping on stairs while sliding sideways flies off them.
      if (waypoint?.jump && readyToJump(this.state, waypoint.node)) buttons |= BTN.JUMP;
      settled = goal.settle !== undefined && Math.hypot(destination.x - x, destination.y - y, destination.z - z) <= goal.settle;
    }

    const onTarget = this.aimAt(enemy, self, eyeY, moveYaw, snap.time);
    if (this.crouching) {
      buttons |= BTN.DUCK;
      settled = true;
    }
    const direction = Math.round(wrapAngle(moveYaw - this.yaw) / (Math.PI / 4));
    if (!settled) buttons |= STEER_BUTTONS[(direction + 8) % 8];
    const { weapon, mag, reserve } = this.state;
    if (onTarget && tick % 30 < 20) buttons |= BTN.ATTACK;
    if (mag[weapon] === 0 && reserve[weapon] > 0) buttons |= BTN.RELOAD;
    const slot = mag[weapon] === 0 && reserve[weapon] === 0 && weapon !== WEAPON.HAMMER
      ? weapon === WEAPON.PISTOL ? 3 : 2
      : 0;
    return { buttons, yaw: this.yaw, pitch: this.pitch, weapon: slot };
  }

  /**
   * Turns the view toward the enemy at the skill's speed, with an error that starts large and settles, like BotBrain.
   * True when the bot has reacted and its aim is close enough to shoot. Without an enemy the view follows the walk.
   */
  private aimAt(enemy: (BombPoint & { id: number; stance: Stance }) | null, self: BombPoint, eyeY: number, moveYaw: number, now: number): boolean {
    const dt = this.lastTime < 0 ? 0 : clamp((now - this.lastTime) / 1000, 0, MAX_AIM_STEP_SECONDS);
    this.lastTime = now;
    if (!enemy) {
      this.targetId = -1;
      this.crouching = false;
      this.turn(moveYaw, 0, dt, this.aim.walkTurnDegPerSecond, WALK_EASE_PER_S);
      return false;
    }
    if (enemy.id !== this.targetId) {
      this.targetId = enemy.id;
      this.reactAt = now + (this.aim.reactTicks + this.random() * 8) * TICK_MS;
      const error = this.aim.errorDeg * DEG;
      this.errYaw = gauss(this.random) * error;
      this.errPitch = gauss(this.random) * error * 0.6;
      this.aimHead = this.random() < this.aim.headChance;
      this.crouchRoll = this.random();
    }
    const settle = Math.max(0, 1 - this.aim.settlePerSecond * dt);
    this.errYaw *= settle;
    this.errPitch *= settle;
    const aimY = enemy.y + aimHeight(enemy.stance, this.aimHead);
    const distance = Math.hypot(enemy.x - self.x, enemy.z - self.z);
    const wantYaw = bearing(self, enemy);
    const wantPitch = Math.atan2(aimY - eyeY, distance);
    stepSway(this.sway, this.aim, dt, this.random);
    this.turn(wantYaw + this.errYaw + this.sway.yaw, wantPitch + this.errPitch + this.sway.pitch, dt, this.aim.combatTurnDegPerSecond, AIM_EASE_PER_S);
    const reacted = now >= this.reactAt;
    this.crouching = reacted && crouchesToShoot(this.aim, distance, this.state.weapon, this.crouchRoll);
    // The bot cannot feel its sway, so it judges its aim against where it thinks the target is.
    const off = Math.hypot(wrapAngle(wantYaw + this.sway.yaw - this.yaw), wantPitch + this.sway.pitch - this.pitch);
    return reacted && off < aimTolerance(distance, this.aimHead);
  }

  /** Moves the view toward yaw/pitch, closing a share of the gap each second and never faster than the skill's turn rate. */
  private turn(yaw: number, pitch: number, dt: number, maxDegPerSecond: number, easePerSecond: number): void {
    const share = 1 - Math.exp(-easePerSecond * dt);
    const maxTurn = maxDegPerSecond * DEG * dt;
    this.yaw = wrapAngle(this.yaw + clamp(wrapAngle(yaw - this.yaw) * share, -maxTurn, maxTurn));
    this.pitch += clamp((pitch - this.pitch) * share, -maxTurn, maxTurn);
  }

  /** Tells the driver a command went out, so the next snapshots are read as that many ticks behind. */
  sent(cmd: Cmd): void {
    this.pending.push(cmd);
    if (this.pending.length > MAX_PENDING_CMDS) this.pending.shift();
  }

  /** True once after the bot catches sight of an enemy it had not been seeing. */
  takeSpotted(): boolean {
    const spotted = this.spotted;
    this.spotted = false;
    return spotted;
  }

  private nextPatrol(view: (leg: number) => DriveView, current: Goal): Goal {
    return this.brain.decide(view(++this.leg)) ?? current;
  }

  private idle(): DriveInput {
    this.reset();
    return IDLE;
  }

  private reset(): void {
    this.goal = null;
    this.progress = null;
    this.recoverUntil = 0;
  }

  private route(nav: NavGrid, self: BombPoint, goal: Goal, now: number): void {
    this.goal = goal;
    this.repathAt = now + REPATH_MS;
    this.waypointClosest = Infinity;
    const start = nav.nearest(self.x, self.y, self.z);
    const end = nav.nearest(goal.point.x, goal.point.y + 4, goal.point.z);
    if (!start || !end) {
      this.path = [];
      return;
    }
    const path = nav.findPath(start, end) ?? [];
    this.path = path.map((node, i) => ({
      node, jump: nav.edgeBetween(i === 0 ? start : path[i - 1], node)?.jump ?? false,
    }));
  }
}
