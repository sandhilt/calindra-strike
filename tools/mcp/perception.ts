import { eyeHeight, stanceFromFlags, type CollisionWorld, type PlayerState } from '../../shared/src/index.ts';
import { hasLineOfSight, sightHeights, VIEW_RANGE, HEAR_RANGE } from '../../server/src/bot.ts';
import type { Peer } from './view.ts';

const MEMORY_MS = 10000;
const MEMORY_LIMIT = 64;
export interface LastSeen {
  x: number;
  y: number;
  z: number;
  time: number;
}
export type PerceivedPeer = Peer & { via: 'sight' | 'sound' | 'team' };

export function perceive(
  raw: readonly Peer[],
  self: PlayerState | null,
  world: CollisionWorld,
  previous: ReadonlyMap<number, LastSeen>,
  time: number,
  omniscient = false,
): { peers: PerceivedPeer[]; lastSeen: Map<number, LastSeen> } {
  const lastSeen = new Map(previous);
  const enemies = new Set(raw.filter((p) => p.enemy && p.alive).map((p) => p.id));
  for (const [id, seen] of lastSeen) {
    if (!enemies.has(id) || time - seen.time >= MEMORY_MS) lastSeen.delete(id);
  }
  const peers: PerceivedPeer[] = [];
  for (const peer of raw) {
    if (!peer.enemy) {
      peers.push({ ...peer, via: 'team' });
      continue;
    }
    if (!omniscient && (!self || self.health <= 0 || self.dropping || !peer.alive)) continue;
    const distance = self ? Math.hypot(peer.x - self.x, peer.z - self.z) : Infinity;
    const sight = self && distance <= VIEW_RANGE
      && hasLineOfSight(world, self.x, self.y + eyeHeight(self), self.z, peer, sightHeights(stanceFromFlags(peer.flags)));
    if (!omniscient && !sight && distance > HEAR_RANGE) continue;
    peers.push({ ...peer, via: omniscient || sight ? 'sight' : 'sound' });
    if (peer.alive) {
      lastSeen.delete(peer.id);
      lastSeen.set(peer.id, { x: peer.x, y: peer.y, z: peer.z, time });
    }
  }
  while (lastSeen.size > MEMORY_LIMIT) {
    const oldest = lastSeen.keys().next();
    if (!oldest.done) lastSeen.delete(oldest.value);
  }
  return { peers, lastSeen };
}
