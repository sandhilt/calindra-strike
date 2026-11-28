import type { MapBuilder } from './builder.ts';
import type { StaffRole, StaffUniform } from './staff.ts';
import type { CookVoice, Mat, Outfit } from './types.ts';

/** Where a prop looks: toward the viewer who comes in (+z in a room), or at the back wall. */
export type Gaze = 'front' | 'back' | 'left' | 'right';

const GAZE_YAW: Record<Gaze, number> = { back: 0, front: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 };

/** Colour of the halo over a shop ceiling lamp. */
const SHOP_LAMP_COLOR = '#ffe9bd';

/** The wall a mirror hangs on: `left` and `right` are the side walls at -x and +x, `back` the wall at z 0. */
export type MirrorWall = 'back' | 'left' | 'right';
/** Dark frame thickness, glass thickness and the frame's rim beyond the glass (units). */
const MIRROR_FRAME_UNITS = 2;
const MIRROR_GLASS_UNITS = 0.8;
const MIRROR_RIM_UNITS = 2.4;
/** Silver glass in the white material; the same tint marks every mirror, so tests can find them. */
export const MIRROR_GLASS_TINT = 0xdfe8ee;
const MIRROR_FRAME_TINT = 0x1f1f1f;

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

  /** Air conditioning duct by footprint centre (x, z), size and base height. */
  duct(x: number, z: number, w: number, d: number, h: number, y: number): void {
    this.b.duct(this.ox + x - w / 2, this.oy + y, this.oz + z - d / 2, this.ox + x + w / 2, this.oy + y + h, this.oz + z + d / 2);
  }

  /** Solid box by footprint centre (x, z), size and base height. */
  solid(x: number, z: number, w: number, d: number, h: number, y: number, mat: Mat, tint?: number): void {
    this.b.add(this.ox + x - w / 2, this.oy + y, this.oz + z - d / 2, this.ox + x + w / 2, this.oy + y + h, this.oz + z + d / 2, mat, { tint });
  }

  /** The halo of a ceiling lamp bar, in the shops' warm light: `y` is the bottom of the bar, where the glow starts. */
  lamp(x: number, z: number, y: number): void {
    this.b.light(this.ox + x, this.oy + y, this.oz + z, SHOP_LAMP_COLOR);
  }

  fan(x: number, z: number, y: number, radius: number): void {
    this.b.prop({ kind: 'ceilingFan', x: this.ox + x, y: this.oy + y, z: this.oz + z, radius });
  }

  mannequin(x: number, z: number, gaze: Gaze | number, outfit: Outfit, y = 0): void {
    const yaw = typeof gaze === 'number' ? gaze : GAZE_YAW[gaze];
    this.b.prop({ kind: 'mannequin', x: this.ox + x, y: this.oy + y, z: this.oz + z, yaw, outfit });
  }

  /** A store employee at (x, z) on height y, facing `gaze`: behind a till, or at a station inside a kitchen. */
  staff(x: number, z: number, gaze: Gaze, role: StaffRole, uniform: StaffUniform, y = 0): void {
    this.b.prop({ kind: 'staff', x: this.ox + x, y: this.oy + y, z: this.oz + z, yaw: GAZE_YAW[gaze], role, uniform });
  }

  rack(x: number, z: number, gaze: Gaze, length: number, palette: readonly number[], y = 0): void {
    this.b.prop({ kind: 'clothesRack', x: this.ox + x, y: this.oy + y, z: this.oz + z, yaw: GAZE_YAW[gaze], length, palette });
  }

  /** A flame `size` units tall standing at (x, z) on height y. */
  flame(x: number, z: number, y: number, size: number, style?: 'burner'): void {
    this.b.prop({ kind: 'flame', x: this.ox + x, y: this.oy + y, z: this.oz + z, size, ...(style ? { burner: true } : {}) });
  }

  steam(x: number, z: number, y: number): void {
    this.b.prop({ kind: 'steam', x: this.ox + x, y: this.oy + y, z: this.oz + z });
  }

  /** The spot a cooking sound comes from. */
  cook(x: number, z: number, y: number, voice: CookVoice): void {
    this.b.prop({ kind: 'cook', x: this.ox + x, y: this.oy + y, z: this.oz + z, voice });
  }

  /**
   * A full-length mirror hung flush on a wall: a silver panel in a dark frame. `(x, z)` is the frame's centre on the
   * wall face and `y` its bottom. Look only, so it never blocks a walkway.
   */
  mirror(x: number, z: number, y: number, width: number, height: number, wall: MirrorWall): void {
    const rim = MIRROR_RIM_UNITS;
    if (wall === 'back') {
      this.box(x, z, width + 2 * rim, MIRROR_FRAME_UNITS, height + 2 * rim, y - rim, 'charcoal', MIRROR_FRAME_TINT);
      this.box(x, z + (MIRROR_FRAME_UNITS + MIRROR_GLASS_UNITS) / 2, width, MIRROR_GLASS_UNITS, height, y, 'mirror', MIRROR_GLASS_TINT);
      return;
    }
    const inward = wall === 'left' ? 1 : -1;
    this.box(x, z, MIRROR_FRAME_UNITS, width + 2 * rim, height + 2 * rim, y - rim, 'charcoal', MIRROR_FRAME_TINT);
    this.box(x + inward * (MIRROR_FRAME_UNITS + MIRROR_GLASS_UNITS) / 2, z, MIRROR_GLASS_UNITS, width, height, y, 'mirror', MIRROR_GLASS_TINT);
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
