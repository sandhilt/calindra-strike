import { AIR_AUDIBLE_UNITS } from './render/prop-motion.ts';

/** How many vents hum at once: the nearest few. */
export const MAX_VENT_HUMS = 3;
/** The set of humming vents is recomputed this often (seconds), not every frame. */
const REFRESH_SECONDS = 0.25;

interface Point {
  x: number;
  y: number;
  z: number;
}

export interface Hum {
  stop(): void;
}

/** Indices of the `count` vents closest to `from`, nearest first, leaving out any beyond `within`. */
export function nearestVents(vents: readonly Point[], from: Point, count: number, within: number): number[] {
  return vents
    .map((v, index) => ({ index, distance: Math.hypot(v.x - from.x, v.y - from.y, v.z - from.z) }))
    .filter((v) => v.distance <= within)
    .toSorted((a, b) => a.distance - b.distance)
    .slice(0, count)
    .map((v) => v.index);
}

/**
 * Keeps a hum running at each of the nearest few vents and stops the rest, so a map with dozens of vents
 * still costs a handful of audio nodes. \`start\` opens one loop at a spot.
 */
export class VentHum {
  private readonly loops = new Map<number, Hum>();
  private sinceRefresh = Infinity;
  private readonly vents: readonly Point[];
  private readonly start: (at: Point) => Hum;

  constructor(vents: readonly Point[], start: (at: Point) => Hum) {
    this.vents = vents;
    this.start = start;
  }

  update(dt: number, listener: Point): void {
    this.sinceRefresh += dt;
    if (this.sinceRefresh < REFRESH_SECONDS) return;
    this.sinceRefresh = 0;
    const wanted = new Set(nearestVents(this.vents, listener, MAX_VENT_HUMS, AIR_AUDIBLE_UNITS));
    for (const [index, loop] of this.loops) {
      if (wanted.has(index)) continue;
      loop.stop();
      this.loops.delete(index);
    }
    for (const index of wanted) {
      if (!this.loops.has(index)) this.loops.set(index, this.start(this.vents[index]));
    }
  }

  dispose(): void {
    for (const loop of this.loops.values()) loop.stop();
    this.loops.clear();
  }
}
