import type { MapProp, StationId } from '@calindra-strike/shared';
import { AMBIENT_VOICES, type AmbientLoop, type AmbientVoice } from './audio.ts';
import type { Pos } from './sound-packs/types.ts';
import { SPEAKER_AUDIBLE_UNITS } from './station-tracks.ts';

export const MAX_AMBIENT_LOOPS = 5;
const MAX_TRACK_LOOPS = 2;
const LOOP_LIMITS = { noise: MAX_AMBIENT_LOOPS, track: MAX_TRACK_LOOPS };
const REFRESH_SECONDS = 0.25;
/** Use the occupied space underneath the motor for the floor check. */
const FAN_FLOOR_OFFSET_UNITS = 80;

type Point = NonNullable<Pos>;

/** Eye heights on two floors of a mall differ by about this much (units); closer than it is the same floor. */
export const SAME_FLOOR_UNITS = 120;

export type Emitter = Point & { within: number } & (
  | { kind: 'noise'; voice: AmbientVoice; sameFloor?: boolean }
  | { kind: 'track'; station: StationId; sameFloor: true }
);

export function ambientEmitters(props: readonly MapProp[]): Emitter[] {
  return props.flatMap<Emitter>((prop) => {
    if (prop.kind === 'speaker') {
      const { x, y, z, station } = prop;
      return [{ kind: 'track', x, y, z, station, within: SPEAKER_AUDIBLE_UNITS, sameFloor: true }];
    }
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
    return [{ kind: 'noise', x, y, z, voice, within: audibleUnits, ...(sameFloor ? { sameFloor } : {}) }];
  });
}

export function nearestEmitters(emitters: readonly Emitter[], from: Point): number[] {
  const remaining = { ...LOOP_LIMITS };
  return emitters
    .map((emitter, index) => {
      const { x, y, z, kind, within, sameFloor } = emitter;
      const floorOffset = kind === 'noise' && emitter.voice === 'fan' ? FAN_FLOOR_OFFSET_UNITS : 0;
      return {
        index, kind, within, sameFloor,
        distance: Math.hypot(x - from.x, y - from.y, z - from.z),
        rise: Math.abs(y - floorOffset - from.y),
      };
    })
    .filter(({ distance, within, sameFloor, rise }) => distance <= within && !(sameFloor && rise > SAME_FLOOR_UNITS))
    .toSorted((a, b) => a.distance - b.distance)
    .filter(({ kind }) => {
      if (remaining[kind] === 0) return false;
      remaining[kind] -= 1;
      return true;
    })
    .map(({ index }) => index);
}

export class NearbyLoops {
  private readonly loops = new Map<number, AmbientLoop>();
  private sinceRefresh = Infinity;
  private readonly emitters: readonly Emitter[];
  private readonly start: (emitter: Emitter) => AmbientLoop | undefined;

  constructor(emitters: readonly Emitter[], start: (emitter: Emitter) => AmbientLoop | undefined) {
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
      if (this.loops.has(index)) continue;
      const loop = this.start(this.emitters[index]);
      if (loop) this.loops.set(index, loop);
    }
  }

  dispose(): void {
    for (const loop of this.loops.values()) loop.stop();
    this.loops.clear();
  }
}
