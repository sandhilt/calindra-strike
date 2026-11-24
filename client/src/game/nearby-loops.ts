import type { MapProp } from '@calindra-strike/shared';
import { AMBIENT_VOICES, type AmbientLoop, type AmbientVoice } from './audio.ts';
import type { Pos } from './sound-packs/types.ts';

export const MAX_AMBIENT_LOOPS = 5;
const REFRESH_SECONDS = 0.25;

type Point = NonNullable<Pos>;

export interface Emitter extends Point {
  voice: AmbientVoice;
  within: number;
}

export function ambientEmitters(props: readonly MapProp[]): Emitter[] {
  return props.flatMap((prop) => {
    let voice: AmbientVoice;
    switch (prop.kind) {
      case 'vent': voice = 'air'; break;
      case 'fountain': voice = 'water'; break;
      case 'cook': voice = prop.voice; break;
      default: return [];
    }
    const { x, y, z } = prop;
    return [{ x, y, z, voice, within: AMBIENT_VOICES[voice].audibleUnits }];
  });
}

export function nearestEmitters(emitters: readonly Emitter[], from: Point): number[] {
  return emitters
    .map(({ x, y, z, within }, index) => ({
      index, within, distance: Math.hypot(x - from.x, y - from.y, z - from.z),
    }))
    .filter(({ distance, within }) => distance <= within)
    .toSorted((a, b) => a.distance - b.distance)
    .slice(0, MAX_AMBIENT_LOOPS)
    .map(({ index }) => index);
}

export class NearbyLoops {
  private readonly loops = new Map<number, AmbientLoop>();
  private sinceRefresh = Infinity;
  private readonly emitters: readonly Emitter[];
  private readonly start: (emitter: Emitter) => AmbientLoop;

  constructor(emitters: readonly Emitter[], start: (emitter: Emitter) => AmbientLoop) {
    this.emitters = emitters;
    this.start = start;
  }

  update(dt: number, listener: Point): void {
    this.sinceRefresh += dt;
    if (this.sinceRefresh < REFRESH_SECONDS) return;
    this.sinceRefresh = 0;
    const wanted = new Set(nearestEmitters(this.emitters, listener));
    for (const [index, loop] of this.loops) {
      if (wanted.has(index)) continue;
      loop.stop();
      this.loops.delete(index);
    }
    for (const index of wanted) {
      if (!this.loops.has(index)) this.loops.set(index, this.start(this.emitters[index]));
    }
  }

  dispose(): void {
    for (const loop of this.loops.values()) loop.stop();
    this.loops.clear();
  }
}
