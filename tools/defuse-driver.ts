import {
  BTN, CollisionWorld, PLAYER_RADIUS, RF_ALIVE, RF_DROP, RF_DUCK, WEAPON, bombStandBox,
  createPlayerState, eyeHeight, getMap, unpackState,
  type BombPoint, type Cmd, type ServerMsg,
} from '../shared/src/index.ts';
import { hasLineOfSight } from '../server/src/bot.ts';
import { NavGrid, type NavNode } from '../server/src/nav.ts';
import {
  canHoldUse, checkProgress, pickDefuseGoal, reachedPatrolPoint, readBombRow,
  type DefuseGoal, type ProgressSample,
} from './defuse-goals.ts';

type DriveInput = Pick<Cmd, 'buttons' | 'yaw' | 'pitch' | 'weapon'>;
const WAYPOINT_RADIUS_UNITS = 16;
const REPATH_DISTANCE_UNITS = 48;
const CLOSE_ENEMY_UNITS = 300;
const SIGHT_RANGE_UNITS = 1500;
const DEFENDER_PURSUIT_UNITS = 650;
const RECOVERY_MS = 500;
const STEER_BUTTONS = [
  BTN.FWD, BTN.FWD | BTN.LEFT, BTN.LEFT, BTN.BACK | BTN.LEFT,
  BTN.BACK, BTN.BACK | BTN.RIGHT, BTN.RIGHT, BTN.FWD | BTN.RIGHT,
];
const bearing = (from: BombPoint, to: BombPoint) => Math.atan2(from.x - to.x, from.z - to.z);

const maps = new Map<number, { world: CollisionWorld; nav: NavGrid; bases: [BombPoint, BombPoint] }>();

function navigation(index: number) {
  const cached = maps.get(index);
  if (cached) return cached;
  const map = getMap(index);
  const world = new CollisionWorld(map);
  const atFloor = ({ x, z }: { x: number; z: number }) => ({
    x, y: Math.max(0, world.groundBelow(x, map.dropHeight, z, PLAYER_RADIUS)), z,
  });
  const bases: [BombPoint, BombPoint] = [atFloor(map.flagBases[0]), atFloor(map.flagBases[1])];
  const terrain = { world, nav: new NavGrid(world, map), bases };
  maps.set(index, terrain);
  return terrain;
}

export class DefuseDriver {
  private leg = 0;
  private goal: DefuseGoal | null = null;
  private path: { node: NavNode; jump: boolean }[] = [];
  private progress: ProgressSample | null = null;
  private recoverUntil = 0;
  private recoveryYaw = 0;
  private recoverySide = 1;
  private readonly state = createPlayerState();

  drive(
    snap: Extract<ServerMsg, { t: 'snap' }>, map: number, id: number,
    teams: ReadonlyMap<number, number>, tick: number,
  ): DriveInput {
    const bomb = readBombRow(snap.bm);
    const team = teams.get(id);
    if (!snap.me || !bomb || team === undefined) {
      this.progress = null;
      this.goal = null;
      this.recoverUntil = 0;
      return { buttons: 0, yaw: 0, pitch: 0, weapon: 0 };
    }

    const { world, nav, bases } = navigation(map);
    world.setProp(bombStandBox(bomb.kind, bomb));
    const players = snap.ps.map(([pid, x, y, z, , , flags]) => ({
      id: pid, x, y, z, team: teams.get(pid) ?? -1, dropping: Boolean(flags & RF_DROP), alive: Boolean(flags & RF_ALIVE), flags,
    }));
    unpackState(snap.me, this.state);
    const { x, y, z, dropping } = this.state;
    const self = { x, y, z, team, id, dropping, alive: true };
    const eyeY = y + eyeHeight(this.state);
    const places = { home: bases[bomb.attackers], site: bases[1 - bomb.attackers], attackers: bomb.attackers };
    let goal = pickDefuseGoal(bomb, places, self, players, this.leg);
    if (self.dropping) {
      this.goal = null;
      this.progress = null;
      this.recoverUntil = 0;
      const buttons = Math.hypot(x - goal.point.x, z - goal.point.z) > 120 ? BTN.FWD : BTN.DUCK;
      return { buttons, yaw: bearing(self, goal.point), pitch: -0.6, weapon: 0 };
    }

    let enemy: (BombPoint & { aimY: number }) | null = null;
    let enemyDistance = SIGHT_RANGE_UNITS;
    for (const player of players) {
      // A dead enemy stays in snapshots until respawn; treating the body as a threat kept carriers from ever planting.
      if (player.team === team || player.team < 0 || player.dropping || !player.alive) continue;
      const distance = Math.hypot(player.x - x, player.y - y, player.z - z);
      if (distance >= enemyDistance) continue;
      const heights = player.flags & RF_DUCK ? [24, 36] : [44, 64];
      if (!hasLineOfSight(world, x, eyeY, z, player, heights)) continue;
      enemy = { x: player.x, y: player.y, z: player.z, aimY: player.y + heights[0] };
      enemyDistance = distance;
    }

    const closeEnemy = enemyDistance < CLOSE_ENEMY_UNITS;
    if (canHoldUse(self, goal, closeEnemy)) {
      this.progress = null;
      this.goal = null;
      this.recoverUntil = 0;
      return { buttons: BTN.USE, yaw: bearing(self, goal.point), pitch: 0, weapon: 0 };
    }

    const progress = checkProgress(this.progress, self, snap.time);
    this.progress = progress.sample;
    const patrolNode = goal.role === 'patrol' ? nav.nearest(goal.point.x, goal.point.y, goal.point.z) : null;
    if (goal.role === 'patrol' && (progress.stuck || (patrolNode && reachedPatrolPoint(self, patrolNode)))) {
      goal = pickDefuseGoal(bomb, places, self, players, ++this.leg);
    }

    if (progress.stuck) {
      this.goal = null;
      this.recoverUntil = snap.time + RECOVERY_MS;
      this.recoverySide *= -1;
      this.recoveryYaw = bearing(self, goal.point) + this.recoverySide * Math.PI / 2;
    }

    const fightingForObjective = closeEnemy && (goal.role === 'plant' || goal.role === 'defuse');
    let moveYaw: number;
    let buttons = 0;
    if (snap.time < this.recoverUntil) {
      moveYaw = this.recoveryYaw;
      buttons |= BTN.JUMP;
    } else if (enemy && fightingForObjective) {
      this.goal = null;
      const side = (Math.floor(tick / 30) + id) % 2 ? 1 : -1;
      moveYaw = bearing(self, enemy) + side * Math.PI / 2;
    } else {
      let destination = goal.point;
      // Defenders intercept visible intruders near the site before returning to the perimeter.
      if (enemy && !closeEnemy && team !== bomb.attackers && bomb.kind !== 'planted'
        && Math.hypot(enemy.x - places.site.x, enemy.z - places.site.z) < DEFENDER_PURSUIT_UNITS) {
        destination = enemy;
      }
      const changed = this.goal?.role !== goal.role
        || Math.hypot(destination.x - this.goal.point.x, destination.y - this.goal.point.y, destination.z - this.goal.point.z) >= REPATH_DISTANCE_UNITS;
      if (changed) this.route(nav, self, { role: goal.role, point: destination });
      while (this.path[0] && Math.hypot(this.path[0].node.x - x, this.path[0].node.y - y, this.path[0].node.z - z) < WAYPOINT_RADIUS_UNITS) {
        this.path.shift();
      }
      const waypoint = this.path[0];
      moveYaw = bearing(self, waypoint?.node ?? destination);
      if (waypoint?.jump) buttons |= BTN.JUMP;
    }

    const yaw = enemy ? bearing(self, enemy) : moveYaw;
    const direction = Math.round((moveYaw - yaw) / (Math.PI / 4));
    buttons |= STEER_BUTTONS[(direction + 8) % 8];
    const pitch = enemy ? Math.atan2(enemy.aimY - eyeY, Math.hypot(enemy.x - x, enemy.z - z)) : 0;
    const { weapon, mag, reserve } = this.state;
    if (enemy && tick % 30 < 20) buttons |= BTN.ATTACK;
    if (mag[weapon] === 0 && reserve[weapon] > 0) buttons |= BTN.RELOAD;
    const slot = mag[weapon] === 0 && reserve[weapon] === 0 && weapon !== WEAPON.HAMMER
      ? weapon === WEAPON.PISTOL ? 3 : 2
      : 0;
    return { buttons, yaw, pitch, weapon: slot };
  }

  private route(nav: NavGrid, self: BombPoint, goal: DefuseGoal): void {
    this.goal = goal;
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
