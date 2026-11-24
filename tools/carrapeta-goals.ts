import { TICK_MS, type CarrapetaSnapshot, type CarrapetaState } from '../shared/src/index.ts';
import type { DriveView } from './bot-driver.ts';
import { patrolPoint, type Goal } from './drive-goals.ts';

const EVADE_DISTANCE_UNITS = 320;
const EVADE_TURNS = [0, 1, -1, 2, -2, 3];

export function carrapetaState(snapshot: CarrapetaSnapshot | undefined): CarrapetaState {
  if (snapshot?.kind === 'held') {
    return { kind: 'held', holder: snapshot.holder, sinceTick: Math.round(snapshot.sinceMs / TICK_MS) };
  }
  if (snapshot?.kind === 'dropped') {
    const { x, y, z, rerollAtMs } = snapshot;
    return { kind: 'dropped', x, y, z, rerollAtTick: Math.round(rerollAtMs / TICK_MS) };
  }
  return { kind: 'none' };
}

export function carrapetaGoal({ snap: { ca }, self, players, enemy, leg }: Pick<DriveView, 'snap' | 'self' | 'players' | 'enemy' | 'leg'>): Goal {
  if (ca?.kind === 'dropped') {
    const { x, y, z } = ca;
    return { role: 'pickup', point: { x, y, z } };
  }
  if (ca?.kind === 'held') {
    if (ca.holder === self.id) {
      const away = enemy && (enemy.x !== self.x || enemy.z !== self.z)
        ? Math.atan2(self.z - enemy.z, self.x - enemy.x) + EVADE_TURNS[leg % EVADE_TURNS.length] * Math.PI / 3
        : null;
      const point = away === null ? patrolPoint(self, self.id, leg) : {
        x: self.x + Math.cos(away) * EVADE_DISTANCE_UNITS,
        y: self.y,
        z: self.z + Math.sin(away) * EVADE_DISTANCE_UNITS,
      };
      return { role: 'evade', point, roam: true, keepMoving: true };
    }
    const holder = players.find(p => p.id === ca.holder && p.alive && !p.dropping);
    if (holder) {
      const { x, y, z } = holder;
      return { role: 'chase', point: { x, y, z }, duel: true };
    }
  }
  return { role: 'patrol', point: patrolPoint(self, self.id, leg), roam: true };
}
