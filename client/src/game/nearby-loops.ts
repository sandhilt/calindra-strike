import type { MapProp } from '@calindra-strike/shared';
import { AMBIENT_VOICES, type AmbientLoop, type AmbientVoice } from './audio.ts';
import type { Pos } from './sound-packs/types.ts';

export const MAX_AMBIENT_LOOPS = 5;
const REFRESH_SECONDS = 0.25;
/** Use the occupied space underneath the motor for the floor check. */
const FAN_FLOOR_OFFSET_UNITS = 80;

type Point = NonNullable<Pos>;

/** Eye heights on two floors of a mall differ by about this much (units); closer than it is the same floor. */
export const SAME_FLOOR_UNITS = 120;

export interface Emitter extends Point {
  voice: AmbientVoice;
  within: number;
  sameFloor?: boolean;
}

export function ambientEmitters(props: readonly MapProp[]): Emitter[] {
  return props.flatMap((prop) => {
    let voice: AmbientVoice;
    switch (prop.kind) {
      case 'ceilingFan': voice = 'fan'; break;
      case 'vent': voice = 'air'; break;
      case 'fountain': voice = 'water'; break;
      case 'cook': voice = prop.voice; break;
      default: return [];
    }
    const { x, y, z } = prop;
    const { audibleUnits, sameFloor } = AMBIENT_VOICES[voice];
    return [{ x, y, z, voice, within: audibleUnits, ...(sameFloor ? { sameFloor } : {}) }];
  });
}

export function nearestEmitters(emitters: readonly Emitter[], from: Point): number[] {
  return emitters
    .map(({ x, y, z, within, sameFloor, voice }, index) => ({
      index, within, sameFloor, distance: Math.hypot(x - from.x, y - from.y, z - from.z),
      rise: Math.abs(y - (voice === 'fan' ? FAN_FLOOR_OFFSET_UNITS : 0) - from.y),
    }))
    .filter(({ distance, within, sameFloor, rise }) => distance <= within && !(sameFloor && rise > SAME_FLOOR_UNITS))
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
