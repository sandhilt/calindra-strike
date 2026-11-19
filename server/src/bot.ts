import {
  BOMB_SITE_RADIUS_UNITS,
  BTN,
  DEFUSE_RADIUS_UNITS,
  type BombPlaces,
  type BombState,
  CTF_ENGAGE_DISTANCE_UNITS,
  type Cmd,
  type CollisionWorld,
  DEG,
  type GameMode,
  type FlagState,
  type FlagBase,
  type PlayerState,
  WEAPON,
  clamp,
  eyeHeight,
  inBombReach,
  weaponDef,
  wrapAngle,
} from '@calindra-strike/shared';
import type { NavGrid, NavNode } from './nav.ts';

export interface BotAgent {
 readonly id: number;
 readonly team: number;
 readonly alive: boolean;
 readonly state: PlayerState;
}
export type BotDirective = { kind: 'goto'; x: number; y: number; z: number } | { kind: 'engage'; targetId: number };

export interface BotEnv {
  world: CollisionWorld;
  nav: NavGrid;
  tick: number;
  now: number;
  mode: GameMode;
  random: () => number;
  players: Iterable<BotAgent>;
  flags?: readonly FlagState[];
  flagBases?: readonly FlagBase[];
  bomb?: BombState;
  bombPlaces?: BombPlaces;
  airdrops: { x: number; y: number; z: number; landed: boolean }[];
}

/** Team-local id order keeps both roles on each team even with alternating team ids. */
export function pickCtfGoal(self: BotAgent, env: BotEnv): FlagBase | null {
  if (env.mode !== 'ctf' || (self.team !== 0 && self.team !== 1)) return null;
  const ownBase = env.flagBases?.[self.team];
  const enemyBase = env.flagBases?.[1 - self.team];
  const own = env.flags?.[self.team];
  const enemy = env.flags?.[1 - self.team];
  if (!ownBase || !enemyBase || !own || !enemy) return null;
  const carrier = own.kind === 'carried' ? [...env.players].find(p => p.id === own.carrier) : null;
  if (enemy.kind === 'carried' && enemy.carrier === self.id) {
    if (own.kind === 'dropped') return own;
    return carrier?.state ?? ownBase;
  }
  if (own.kind === 'dropped') return own;
  const defender = ctfRole(self, env) === 'defender';
  if (defender) {
    return carrier?.state ?? ownBase;
  }
  return enemy.kind === 'dropped' ? enemy : enemyBase;
}

/** Where a bot stands to hold USE, as a margin inside the radius that actually counts on the server. */
const PLANT_HOLD_RADIUS_UNITS = BOMB_SITE_RADIUS_UNITS - 60;
const DEFUSE_HOLD_RADIUS_UNITS = DEFUSE_RADIUS_UNITS - 4;
const HOLD_MAX_HEIGHT_UNITS = 40;
const APPROACH_RADIUS_UNITS = 140; // nav nodes can end short of an off-grid goal, walk the rest straight

export interface BombGoal extends FlagBase {
  /** Stand still holding USE once this close, null when the goal is only a place to wait. */
  holdRadiusUnits: number | null;
}

/**
 * Attackers fetch the bomb, the carrier plants at the site and the rest escort. Defenders guard the site and defuse once
 * it is planted. Players who only wait (defenders before the plant, escorts during it, attackers guarding a planted bomb)
 * patrol a ring around the spot instead of parking on it, which made them easy targets that looked idle.
 */
export function pickBombGoal(self: BotAgent, env: BotEnv): BombGoal | null {
  if (env.mode !== 'defuse' || !env.bomb || !env.bombPlaces || (self.team !== 0 && self.team !== 1)) return null;
  const { bomb, bombPlaces: places } = env;
  if (self.team !== places.attackers) {
    if (bomb.kind === 'planted') return { x: bomb.x, y: bomb.y, z: bomb.z, holdRadiusUnits: DEFUSE_HOLD_RADIUS_UNITS };
    return { ...guardPatrolPoint(places.site, self, env.tick), holdRadiusUnits: null };
  }
  if (bomb.kind === 'home') return { ...places.home, holdRadiusUnits: null };
  if (bomb.kind === 'dropped') return { x: bomb.x, y: bomb.y, z: bomb.z, holdRadiusUnits: null };
  if (bomb.kind === 'planted') return { ...guardPatrolPoint(bomb, self, env.tick), holdRadiusUnits: null };
  if (bomb.carrier === self.id) return { ...places.site, holdRadiusUnits: PLANT_HOLD_RADIUS_UNITS };
  const carrier = [...env.players].find(p => p.id === bomb.carrier);
  const anchor = carrier?.state ?? places.site;
  if (bomb.kind === 'planting') return { ...guardPatrolPoint(anchor, self, env.tick), holdRadiusUnits: null };
  return { x: anchor.x, y: anchor.y, z: anchor.z, holdRadiusUnits: null };
}

const GUARD_RING_UNITS = 240; // outside the plant radius, close enough to shoot a planter
const GUARD_PATROL_TICKS = 180; // 3 s at 60 Hz on each patrol point
const GOLDEN_ANGLE_RAD = Math.PI * (3 - Math.sqrt(5)); // spreads teammates' points around the ring

/** A point on a ring around `anchor` that differs per player and moves on every patrol step. */
export function guardPatrolPoint(anchor: { x: number; y: number; z: number }, self: BotAgent, tick: number): FlagBase {
  const step = Math.floor(tick / GUARD_PATROL_TICKS);
  const angle = (self.id + step) * GOLDEN_ANGLE_RAD;
  return { x: anchor.x + Math.cos(angle) * GUARD_RING_UNITS, y: anchor.y, z: anchor.z + Math.sin(angle) * GUARD_RING_UNITS };
}

function bombRole(self: BotAgent, env: BotEnv): CtfRole {
  const bomb = env.bomb;
  if ((bomb?.kind === 'carried' || bomb?.kind === 'planting') && bomb.carrier === self.id) return 'carrier';
  return self.team === env.bombPlaces?.attackers ? 'attacker' : 'defender';
}

function holdsPosition(self: BotAgent, goal: BombGoal | null, bombKind: BombState['kind'] | undefined): boolean {
  if (!goal || goal.holdRadiusUnits === null) return false;
  const s = self.state;
  if (bombKind === 'planted') return inBombReach(s, goal, DEFUSE_HOLD_RADIUS_UNITS);
  return Math.hypot(goal.x - s.x, goal.z - s.z) <= goal.holdRadiusUnits && Math.abs(goal.y - s.y) <= HOLD_MAX_HEIGHT_UNITS;
}

export type CtfRole = 'carrier' | 'attacker' | 'defender';
export function ctfCombatStance(role: CtfRole, distanceUnits: number): 'advance' | 'duel' {
  return role === 'carrier' || (role === 'attacker' && distanceUnits > CTF_ENGAGE_DISTANCE_UNITS) ? 'advance' : 'duel';
}

function ctfRole(self: BotAgent, env: BotEnv): CtfRole {
  const enemy = env.flags?.[1 - self.team];
  if (enemy?.kind === 'carried' && enemy.carrier === self.id) return 'carrier';
  const teammates = [...env.players].filter(p => p.team === self.team).sort((a, b) => a.id - b.id);
  return teammates.findIndex(p => p.id === self.id) % CTF_DEFENDER_CYCLE === CTF_DEFENDER_CYCLE - 1 ? 'defender' : 'attacker';
}

// One defender per four teammates: guarding with more starved the attack and 4v4 bot matches never captured.
const CTF_DEFENDER_CYCLE = 4;
const GOAL_CHANGE_DISTANCE_UNITS = 1; // ignore sub-unit floor settling when refreshing objectives
const SCAN_EVERY = 6; // ticks between target scans (100 ms)
export const VIEW_RANGE = 2600;
export const HEAR_RANGE = 420; // notices you behind it up close

export function hasLineOfSight(
  world: CollisionWorld,
  ex: number,
  ey: number,
  ez: number,
  target: { x: number; y: number; z: number },
  targetHeights: readonly number[] = [44, 64],
): boolean {
  for (const height of targetHeights) {
    const dx = target.x - ex;
    const dy = target.y + height - ey;
    const dz = target.z - ez;
    const distance = Math.hypot(dx, dy, dz);
    if (distance < 1) return true;
    if (!world.trace(ex, ey, ez, dx / distance, dy / distance, dz / distance, distance)) return true;
  }
  return false;
}

function gauss(r: () => number): number {
  return (r() + r() + r() - 1.5) / 0.75;
}

/** Angle from eye to a point, in the game's yaw/pitch convention. */
function anglesTo(ex: number, ey: number, ez: number, x: number, y: number, z: number): [number, number] {
  const dx = x - ex;
  const dz = z - ez;
  return [Math.atan2(-dx, -dz), Math.atan2(y - ey, Math.hypot(dx, dz))];
}

/**
 * Shared bot brain. Produces exactly one command per tick through the same
 * simulation as real players, so it moves and shoots under the same rules.
 */
export class BotBrain {
  private directive: BotDirective | null = null;
  private reached = false;
  private ended = false;
  get arrived(): boolean { return this.reached; }

  /** True once after the bot picks up a new enemy, so the game can call it out on the radio. */
  takeSpotted(): boolean {
    const spotted = this.spotted;
    this.spotted = false;
    return spotted;
  }
  get directiveEnded(): boolean { return this.ended; }
  setDirective(directive: BotDirective | null): void {
    this.directive = directive;
    this.reached = false;
    this.ended = false;
    this.targetId = -1;
    this.goal = null;
    this.path = [];
    this.repathAt = 0;
  }
  private seq = 0;
  private yaw = 0;
  private pitch = 0;
  private aimInit = false;
  private errYaw = 0;
  private errPitch = 0;
  private targetId = -1;
  private reactAt = 0;
  private spotted = false; // a new enemy came into view since the last takeSpotted()
  private aimHead = false;
  private burstLeft = 0;
  private pauseUntil = 0;
  private strafeDir = 1;
  private strafeUntil = 0;
  private path: NavNode[] = [];
  private jumps: boolean[] = [];
  private pathIdx = 0;
  private goal: { x: number; y: number; z: number } | null = null;
  private repathAt = 0;
  private goalUntil = 0;
  private lastCheck = { x: 0, z: 0, tick: 0 };
  private stuck = 0;
  private prevButtons = 0;

  private readonly skill: number;

  constructor(skill: number) {
    this.skill = skill;
  }

  /** Called when the bot (re)spawns so it forgets the previous life. */
  reset(): void {
    this.aimInit = false;
    this.targetId = -1;
    this.path = [];
    this.goal = null;
    this.stuck = 0;
  }

  private lerpSkill(lo: number, hi: number): number {
    return lo + (hi - lo) * this.skill;
  }

  private turnTo(yaw: number, pitch: number, dt: number, rateDeg: number): void {
    const max = rateDeg * DEG * dt;
    const dy = wrapAngle(yaw - this.yaw);
    this.yaw = wrapAngle(this.yaw + clamp(dy, -max, max));
    this.pitch += clamp(pitch - this.pitch, -max, max);
  }

  private isEnemy(self: BotAgent, q: BotAgent, mode: GameMode): boolean {
    return q !== self && q.alive && (mode === 'ffa' || q.team !== self.team);
  }

  private scan(self: BotAgent, env: BotEnv): BotAgent | null {
    const s = self.state;
    const ex = s.x;
    const ey = s.y + eyeHeight(s);
    const ez = s.z;
    let best: BotAgent | null = null;
    let bestD = Infinity;
    for (const q of env.players) {
      if (this.directive?.kind === 'engage' && q.id !== this.directive.targetId) continue;
      if (!this.isEnemy(self, q, env.mode) || q.state.dropping) continue;
      const d = Math.hypot(q.state.x - ex, q.state.z - ez);
      if (d > VIEW_RANGE) continue;
      // field of view ~140 degrees, but close enemies are heard anyway
      const [yaw] = anglesTo(ex, ey, ez, q.state.x, q.state.y + 44, q.state.z);
      if (d > HEAR_RANGE && Math.abs(wrapAngle(yaw - this.yaw)) > 70 * DEG) continue;
      if (!hasLineOfSight(env.world, ex, ey, ez, q.state)) continue;
      // prefer the current target slightly so bots don't flick between people
      const score = d * (q.id === this.targetId ? 0.7 : 1);
      if (score < bestD) {
        bestD = score;
        best = q;
      }
    }
    return best;
  }

  private nearestEnemy(self: BotAgent, env: BotEnv): BotAgent | null {
    let best: BotAgent | null = null;
    let bestD = Infinity;
    for (const q of env.players) {
      if (!this.isEnemy(self, q, env.mode) || q.state.dropping) continue;
      const d = Math.hypot(q.state.x - self.state.x, q.state.z - self.state.z);
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }
    return best;
  }

  private pickGoal(self: BotAgent, env: BotEnv): void {
    const s = self.state;
    if (this.directive?.kind === 'goto') {
      this.goal = this.directive;
      this.goalUntil = Infinity;
      this.repathAt = 0;
      return;
    }
    if (this.directive?.kind === 'engage') {
      const id = this.directive.targetId;
      const target = [...env.players].find(p => p.id === id);
      if (target) {
        this.goal = { x: target.state.x, y: target.state.y, z: target.state.z };
        this.goalUntil = env.tick + 90;
        this.repathAt = 0;
        return;
      }
    }
    const objective = pickCtfGoal(self, env) ?? pickBombGoal(self, env);
    if (objective) {
      if (!this.goal || Math.hypot(this.goal.x - objective.x, this.goal.y - objective.y, this.goal.z - objective.z) > GOAL_CHANGE_DISTANCE_UNITS) {
        this.goal = { x: objective.x, y: objective.y, z: objective.z };
        this.repathAt = 0;
      }
      this.goalUntil = env.tick + SCAN_EVERY;
      return;
    }
    const r = env.random();
    const drop = env.airdrops.find((d) => d.landed && Math.hypot(d.x - s.x, d.z - s.z) < 1600);
    const enemy = this.nearestEnemy(self, env);
    if (drop && r < 0.6) this.goal = { x: drop.x, y: drop.y, z: drop.z };
    else if (enemy && r < 0.85) this.goal = { x: enemy.state.x, y: enemy.state.y, z: enemy.state.z };
    else {
      const n = env.nav.randomNode(env.random);
      this.goal = { x: n.x, y: n.y, z: n.z };
    }
    this.goalUntil = env.tick + 180 + Math.floor(env.random() * 180);
    this.repathAt = 0;
  }

  private repath(self: BotAgent, env: BotEnv): void {
    const s = self.state;
    this.repathAt = env.tick + 90;
    if (!this.goal) return;
    const a = env.nav.nearest(s.x, s.y, s.z);
    const b = env.nav.nearest(this.goal.x, this.goal.y + 4, this.goal.z);
    if (!a || !b) {
      this.path = [];
      return;
    }
    const p = env.nav.findPath(a, b) ?? [];
    this.path = p;
    this.jumps = p.map((n, i) => {
      const prev = i === 0 ? a : p[i - 1];
      return env.nav.edgeBetween(prev, n)?.jump ?? false;
    });
    this.pathIdx = 0;
  }

  think(self: BotAgent, env: BotEnv): Cmd {
    const s = self.state;
    if (this.directive?.kind === 'engage') {
      const id = this.directive.targetId;
      const target = [...env.players].find(p => p.id === id);
      if (!target || !this.isEnemy(self, target, env.mode) || target.state.dropping) {
        this.setDirective(null);
        this.ended = true;
      }
    }
    this.reached = this.directive?.kind === 'goto'
      && Math.hypot(this.directive.x - s.x, this.directive.z - s.z) < 60;
    const dt = 1 / 60;
    if (!this.aimInit) {
      this.yaw = s.yaw;
      this.pitch = 0;
      this.aimInit = true;
    }
    let buttons = 0;
    let weapon = 0;

    // out of ammo on the primary: fall back like a player would
    const def = weaponDef(s.weapon);
    if (def.mag > 0 && s.mag[s.weapon] === 0 && s.reserve[s.weapon] === 0) weapon = s.weapon === WEAPON.PISTOL ? 3 : 2;

    if (s.dropping) {
      // glide toward the action and dive once roughly above it
      const enemy = this.nearestEnemy(self, env);
      const objective = pickCtfGoal(self, env) ?? pickBombGoal(self, env);
      const tx = objective?.x ?? (enemy ? enemy.state.x : 0);
      const tz = objective?.z ?? (enemy ? enemy.state.z : 0);
      const d = Math.hypot(tx - s.x, tz - s.z);
      const [yaw] = anglesTo(s.x, 0, s.z, tx, 0, tz);
      this.turnTo(yaw, -0.6, dt, 240);
      buttons = d > 200 ? BTN.FWD : BTN.DUCK;
      return this.cmd(buttons, weapon, env);
    }

    const bombGoal = pickBombGoal(self, env);
    const holding = holdsPosition(self, bombGoal, env.bomb?.kind);

    // --- perception
    if (env.tick % SCAN_EVERY === self.id % SCAN_EVERY) {
      const t = this.scan(self, env);
      const id = t ? t.id : -1;
      if (id !== this.targetId) {
        this.targetId = id;
        if (t) {
          this.spotted = true;
          this.reactAt = env.tick + Math.round(this.lerpSkill(24, 9) + env.random() * 8);
          const e = this.lerpSkill(6, 2) * DEG;
          this.errYaw = gauss(env.random) * e;
          this.errPitch = gauss(env.random) * e * 0.6;
          this.aimHead = env.random() < this.lerpSkill(0.15, 0.5);
          this.burstLeft = 0;
        }
      }
    }
    let target: BotAgent | null = null;
    if (this.targetId >= 0) {
      for (const q of env.players) if (q.id === this.targetId) target = q;
      if (!target || !this.isEnemy(self, target, env.mode) || target.state.dropping) {
        this.targetId = -1;
        target = null;
      }
    }

    if (target) {
      // --- combat
      const t = target.state;
      const ex = s.x;
      const ey = s.y + eyeHeight(s);
      const ez = s.z;
      const aimY = t.y + (t.ducked ? (this.aimHead ? 30 : 20) : this.aimHead ? 64 : 44);
      const dist = Math.hypot(t.x - ex, t.z - ez);
      const [wantYaw, wantPitch] = anglesTo(ex, ey, ez, t.x, aimY, t.z);
      const settle = Math.max(0, 1 - this.lerpSkill(2.2, 5.5) * dt);
      this.errYaw *= settle;
      this.errPitch *= settle;
      const jitter = this.lerpSkill(0.9, 0.3) * DEG;
      this.turnTo(wantYaw + this.errYaw + gauss(env.random) * jitter * 0.3, wantPitch + this.errPitch, dt, this.lerpSkill(260, 620));
      const off = Math.hypot(wrapAngle(wantYaw - this.yaw), wantPitch - this.pitch);
      const tolerance = Math.atan2(this.aimHead ? 7 : 12, Math.max(1, dist)) + 0.6 * DEG;
      const ready = env.tick >= this.reactAt;
      const cur = weaponDef(s.weapon);

      if (cur.slot === 3) {
        buttons |= BTN.FWD;
        if (dist < 80 && ready) buttons |= BTN.ATTACK;
      } else if (cur.zoomFov.length && s.zoom === 0 && s.resumeZoom === 0 && dist > 350 && !(this.prevButtons & BTN.ATTACK2)) {
        buttons |= BTN.ATTACK2; // scope in before taking an AWP shot
      } else if (ready && off < tolerance && env.tick >= this.pauseUntil) {
        if (cur.auto) {
          if (this.burstLeft <= 0) this.burstLeft = 3 + Math.floor(env.random() * this.lerpSkill(3, 6));
          buttons |= BTN.ATTACK;
          if (s.tick + 1 >= s.nextFire && s.mag[s.weapon] > 0) {
            this.burstLeft--;
            if (this.burstLeft <= 0) this.pauseUntil = env.tick + 14 + Math.floor(env.random() * 16);
          }
        } else if (!(this.prevButtons & BTN.ATTACK)) {
          buttons |= BTN.ATTACK; // semi-auto: tap
        }
      }

      if (holding) {
        buttons &= ~(BTN.FWD | BTN.BACK | BTN.LEFT | BTN.RIGHT);
        return this.cmd(buttons | BTN.USE, weapon, env);
      }
      if (bombGoal && ctfCombatStance(bombRole(self, env), dist) === 'advance') {
        buttons &= ~(BTN.FWD | BTN.BACK | BTN.LEFT | BTN.RIGHT);
        buttons |= this.advanceWhileAiming(self, env);
        return this.cmd(buttons, weapon, env);
      }
      if (env.mode === 'ctf' && pickCtfGoal(self, env) && ctfCombatStance(ctfRole(self, env), dist) === 'advance') {
        buttons &= ~(BTN.FWD | BTN.BACK | BTN.LEFT | BTN.RIGHT);
        buttons |= this.advanceWhileAiming(self, env);
        return this.cmd(buttons, weapon, env);
      }

      // counter-strafe: stand still while shooting, strafe between bursts
      if (!(buttons & BTN.ATTACK) && cur.slot !== 3) {
        if (env.tick >= this.strafeUntil) {
          this.strafeDir = env.random() < 0.5 ? -1 : 1;
          this.strafeUntil = env.tick + 20 + Math.floor(env.random() * 30);
        }
        buttons |= this.strafeDir > 0 ? BTN.RIGHT : BTN.LEFT;
        if (dist > 1100) buttons |= BTN.FWD;
      }
      this.path = []; // replan after the fight
      this.repathAt = 0;
      return this.cmd(buttons, weapon, env);
    }

    // --- navigation
    if (holding) return this.cmd(BTN.USE, weapon, env);
    if (this.reached) {
      if (this.wantsReload(s, def)) buttons |= BTN.RELOAD;
      return this.cmd(buttons, weapon, env);
    }
    const node = this.navigationNode(self, env);
    if (!node) {
      if (this.goal && Math.hypot(this.goal.x - s.x, this.goal.z - s.z) < 60) this.pickGoal(self, env);
      this.repathAt = Math.min(this.repathAt, env.tick + 10);
      if (bombGoal?.holdRadiusUnits != null && Math.hypot(bombGoal.x - s.x, bombGoal.z - s.z) < APPROACH_RADIUS_UNITS) {
        const [yaw] = anglesTo(s.x, 0, s.z, bombGoal.x, 0, bombGoal.z);
        this.turnTo(yaw, 0, dt, this.lerpSkill(300, 520));
        if (Math.abs(wrapAngle(yaw - this.yaw)) < 70 * DEG) buttons |= BTN.FWD;
      }
    } else {
      const [yaw] = anglesTo(s.x, 0, s.z, node.x, 0, node.z);
      this.turnTo(yaw, 0, dt, this.lerpSkill(300, 520));
      // walk once roughly facing the waypoint
      if (Math.abs(wrapAngle(yaw - this.yaw)) < 70 * DEG) buttons |= BTN.FWD;
      const near = Math.hypot(node.x - s.x, node.z - s.z) < 72;
      if (this.jumps[this.pathIdx] && near && s.onGround && !s.jumpHeld) buttons |= BTN.JUMP;
    }

    // unstick: jump, then pick somewhere else
    if (env.tick - this.lastCheck.tick >= 45) {
      const moved = Math.hypot(s.x - this.lastCheck.x, s.z - this.lastCheck.z);
      if (moved < 10 && node) {
        this.stuck++;
        if (this.stuck >= 3 && !this.directive) {
          const n = env.nav.randomNode(env.random);
          this.goal = { x: n.x, y: n.y, z: n.z };
          this.repathAt = 0;
          this.stuck = 0;
        }
      } else this.stuck = 0;
      this.lastCheck = { x: s.x, z: s.z, tick: env.tick };
    }
    if (this.stuck > 0 && s.onGround && !s.jumpHeld) buttons |= BTN.JUMP;
    if (this.wantsReload(s, def)) buttons |= BTN.RELOAD;

    return this.cmd(buttons, weapon, env);
  }

  private navigationNode(self: BotAgent, env: BotEnv): NavNode | undefined {
    const s = self.state;
    if (!this.goal || env.tick >= this.goalUntil) this.pickGoal(self, env);
    if (env.tick >= this.repathAt) this.repath(self, env);
    let node = this.path[this.pathIdx];
    while (node && Math.hypot(node.x - s.x, node.z - s.z) < 26 && Math.abs(node.y - s.y) < 40) {
      this.pathIdx++;
      node = this.path[this.pathIdx];
    }
    return node;
  }

  private advanceWhileAiming(self: BotAgent, env: BotEnv): number {
    const node = this.navigationNode(self, env);
    if (!node) {
      this.repathAt = Math.min(this.repathAt, env.tick + 10);
      return 0;
    }
    const s = self.state;
    const [yaw] = anglesTo(s.x, 0, s.z, node.x, 0, node.z);
    const angle = wrapAngle(yaw - this.yaw);
    // Quantize to eight WASD directions while keeping the gun trained on the enemy.
    const forward = Math.round(Math.cos(angle));
    const right = Math.round(-Math.sin(angle));
    let buttons = (forward > 0 ? BTN.FWD : forward < 0 ? BTN.BACK : 0)
      | (right > 0 ? BTN.RIGHT : right < 0 ? BTN.LEFT : 0);
    if (this.jumps[this.pathIdx] && Math.hypot(node.x - s.x, node.z - s.z) < 72 && s.onGround && !s.jumpHeld) buttons |= BTN.JUMP;
    return buttons;
  }

  private wantsReload(s: PlayerState, def: ReturnType<typeof weaponDef>): boolean {
    return s.reload === 0 && def.mag > 0 && s.mag[s.weapon] < def.mag * 0.4 && s.reserve[s.weapon] > 0;
  }

  private cmd(buttons: number, weapon: number, env: BotEnv): Cmd {
    this.prevButtons = buttons;
    return { seq: ++this.seq, buttons, yaw: this.yaw, pitch: clamp(this.pitch, -1.5, 1.5), weapon, interp: env.now };
  }
}

export const BOT_NAMES = ['Brokkr', 'Sindri', 'Freya', 'Loki', 'Tyr', 'Skadi', 'Odin', 'Heimdall', 'Thor', 'Baldur', 'Frigg', 'Idun', 'Njord', 'Vidar', 'Sif', 'Bragi'];
