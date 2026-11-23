import type { MapBuilder } from './builder.ts';
import type { Mat, Outfit } from './types.ts';

/** Where a prop looks: toward the viewer who comes in (+z in a room), or at the back wall. */
export type Gaze = 'front' | 'back' | 'left' | 'right';

const GAZE_YAW: Record<Gaze, number> = { back: 0, front: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 };

/**
 * One room's authoring frame: x across, z as depth from the back wall (growing toward the door), y up from
 * the floor. Everything is placed relative to it, so a shop is written once and stands anywhere.
 */
export class Room {
  readonly b: MapBuilder;
  readonly ox: number;
  readonly oy: number;
  readonly oz: number;

  constructor(b: MapBuilder, ox: number, oy: number, oz: number) {
    this.b = b;
    this.ox = ox;
    this.oy = oy;
    this.oz = oz;
  }

  /** Look-only box by footprint centre (x, z), size and base height. */
  box(x: number, z: number, w: number, d: number, h: number, y: number, mat: Mat, tint?: number): void {
    this.b.deco(this.ox + x - w / 2, this.oy + y, this.oz + z - d / 2, this.ox + x + w / 2, this.oy + y + h, this.oz + z + d / 2, mat, tint);
  }

  /** Solid box by footprint centre (x, z), size and base height. */
  solid(x: number, z: number, w: number, d: number, h: number, y: number, mat: Mat, tint?: number): void {
    this.b.add(this.ox + x - w / 2, this.oy + y, this.oz + z - d / 2, this.ox + x + w / 2, this.oy + y + h, this.oz + z + d / 2, mat, { tint });
  }

  fan(x: number, z: number, y: number, radius: number): void {
    this.b.prop({ kind: 'ceilingFan', x: this.ox + x, y: this.oy + y, z: this.oz + z, radius });
  }

  mannequin(x: number, z: number, gaze: Gaze | number, outfit: Outfit, y = 0): void {
    const yaw = typeof gaze === 'number' ? gaze : GAZE_YAW[gaze];
    this.b.prop({ kind: 'mannequin', x: this.ox + x, y: this.oy + y, z: this.oz + z, yaw, outfit });
  }

  rack(x: number, z: number, gaze: Gaze, length: number, palette: readonly number[], y = 0): void {
    this.b.prop({ kind: 'clothesRack', x: this.ox + x, y: this.oy + y, z: this.oz + z, yaw: GAZE_YAW[gaze], length, palette });
  }

  /** A grille on a surface that faces `gaze`, centred at (x, y) on depth z. */
  vent(x: number, y: number, z: number, gaze: Gaze, width = 44, height = 30): void {
    this.b.prop({ kind: 'vent', x: this.ox + x, y: this.oy + y, z: this.oz + z, yaw: GAZE_YAW[gaze], width, height });
  }
}

export function outfit(top: number, legs: number, trim: number, dress = false): Outfit {
  return { top, legs, trim, dress };
}

/** Deterministic small random numbers for scattering goods; never `Math.random`, the map must be identical on both sides. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
