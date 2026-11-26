import type { MapProp } from '@calindra-strike/shared';
import { Parts } from './prop-parts.ts';

type Of<K extends MapProp['kind']> = Extract<MapProp, { kind: K }>;

const SKIN = 0xe9e4da;
const DARK = 0x26272a;
const STEEL = 0x9aa0a8;
/** Height of the mannequin's round base. */
const BASE_UNITS = 2.5;

/**
 * A shop mannequin cut like the player's `Avatar` (legs 0 to 32, torso 32 to 58, head 58 to 72) in matte white,
 * dressed in the colours of its shop, standing on a round base. One pose: arms hanging a little apart.
 */
export function addMannequin(parts: Parts, m: Of<'mannequin'>): void {
  const { top, legs, trim, dress } = m.outfit;
  const y = BASE_UNITS;
  parts.at(m.x, m.y, m.z, m.yaw);
  parts.cylinder(15, 16, BASE_UNITS, 14, DARK, { x: 0, y: BASE_UNITS / 2, z: 0 });
  if (dress) {
    for (const side of [-5.5, 5.5]) parts.box(7, 14, 8, SKIN, { x: side, y: y + 7, z: 0 });
    parts.cylinder(11, 17, 24, 12, legs, { x: 0, y: y + 22, z: 0 });
  } else {
    for (const side of [-5.5, 5.5]) {
      parts.box(9, 28, 10, legs, { x: side, y: y + 14, z: 0 });
      parts.box(9.6, 5, 12, SKIN, { x: side, y: y + 2.5, z: -1 });
    }
  }
  parts.box(24, 6, 14, dress ? top : legs, { x: 0, y: y + 33, z: 0 });
  parts.box(24, 21, 14, top, { x: 0, y: y + 46, z: 0 });
  parts.box(24.6, 2.4, 14.6, trim, { x: 0, y: y + 35.5, z: 0 });
  parts.box(10, 2.4, 9, trim, { x: 0, y: y + 57, z: 0 });
  for (const side of [-15.5, 15.5]) {
    parts.box(6.4, 12, 7.4, top, { x: side, y: y + 50, z: 0, rot: [0, 0, -Math.sign(side) * 0.1] });
    parts.box(5.2, 12, 6, SKIN, { x: side + Math.sign(side) * 1.4, y: y + 39, z: 0, rot: [0, 0, -Math.sign(side) * 0.1] });
  }
  parts.cylinder(3, 3.4, 4, 8, SKIN, { x: 0, y: y + 60, z: 0 });
  parts.box(14, 12, 14, SKIN, { x: 0, y: y + 68, z: 0 });
  parts.box(12, 4.4, 2, DARK, { x: 0, y: y + 68, z: -7.3 });
}

const RACK_HEIGHT = 62;
const RACK_FOOT_UNITS = 30;
const GARMENT_PITCH_UNITS = 5.5;

/** A clothes rack (arara): two feet, two uprights, a rail, and garments on hangers packed along it. */
export function addClothesRack(parts: Parts, r: Of<'clothesRack'>): void {
  const half = r.length / 2;
  parts.at(r.x, r.y, r.z, r.yaw);
  for (const end of [-half, half]) {
    parts.box(2.4, 2.4, RACK_FOOT_UNITS, STEEL, { x: end, y: 1.2, z: 0 });
    parts.box(2.4, RACK_HEIGHT, 2.4, STEEL, { x: end, y: RACK_HEIGHT / 2, z: 0 });
  }
  parts.box(r.length + 2.4, 2.4, 2.4, STEEL, { x: 0, y: RACK_HEIGHT, z: 0 });
  if (r.palette.length === 0) return;
  const count = Math.floor((r.length - 8) / GARMENT_PITCH_UNITS);
  for (let i = 0; i < count; i++) {
    const x = -half + 5 + i * GARMENT_PITCH_UNITS;
    const color = r.palette[(i * 5 + Math.round(Math.abs(r.x + r.z))) % r.palette.length];
    const length = 22 + ((i * 7) % 4) * 4;
    parts.box(0.8, 3.2, 0.8, STEEL, { x, y: RACK_HEIGHT + 2.6, z: 0 });
    parts.box(2.6, 5, 22, color, { x, y: RACK_HEIGHT - 3.5, z: 0 });
    parts.box(2.6, length - 5, 16, color, { x, y: RACK_HEIGHT - 6 - (length - 5) / 2, z: 0 });
  }
}

/** The ceiling end of a fan: the down rod, the motor and a lamp under the blades. Blades are drawn apart so they can spin. */
export function addFanMount(parts: Parts, f: Of<'ceilingFan'>): void {
  parts.at(f.x, f.y, f.z);
  parts.cylinder(1, 1, 36, 6, DARK, { x: 0, y: 24.5, z: 0 });
  parts.cylinder(5.5, 6.5, 6, 12, 0x6a5a48, { x: 0, y: 3.5, z: 0 });
  parts.cylinder(4, 3, 3, 10, 0xfff0c8, { x: 0, y: -2.5, z: 0 });
}

/** The wall plate of a vent: a steel frame, a dark opening and slanted slats in front of the fan. */
export function addVentFrame(parts: Parts, v: Of<'vent'>): void {
  const border = 2.2;
  const depth = 2.6;
  parts.at(v.x, v.y, v.z, v.yaw);
  parts.box(v.width, border, depth, STEEL, { x: 0, y: (v.height - border) / 2, z: -depth / 2 });
  parts.box(v.width, border, depth, STEEL, { x: 0, y: -(v.height - border) / 2, z: -depth / 2 });
  for (const side of [-1, 1]) parts.box(border, v.height - 2 * border, depth, STEEL, { x: (side * (v.width - border)) / 2, y: 0, z: -depth / 2 });
  parts.box(v.width - 2 * border, v.height - 2 * border, 0.4, 0x0f1012, { x: 0, y: 0, z: -0.2 });
  const slats = Math.floor((v.height - 2 * border) / 4.4);
  for (let i = 0; i < slats; i++) {
    const y = ((i + 0.5) / slats - 0.5) * (v.height - 2 * border);
    parts.box(v.width - 2 * border, 1.1, 1.6, 0xd2d6db, { x: 0, y, z: -2.1, rot: [0.5, 0, 0] });
  }
}

/**
 * The body under a moving staircase, which stands still while the steps travel over it: a dark wedge between
 * the glass sides and, on each side, a steel apron that follows the nose line of the steps.
 */
/** Height of the glass balustrade over the escalator apron, matching the stepped collision panes of the map (units). */
export const ESCALATOR_GLASS_UNITS = 80;

/** Outline of one balustrade band in the escalator frame: `lift` over the apron top, `band` tall, straight along the incline. */
function balustrade(e: Of<'escalator'>, rise: number, lift: number, band: number): [number, number][] {
  const flatFrom = (e.height - rise) / (e.height / e.length);
  const bottom: [number, number][] = [[0, rise + lift], [flatFrom, e.height + lift], [e.length, e.height + lift]];
  return [...bottom, ...bottom.toReversed().map(([u, v]): [number, number] => [u, v + band])];
}

/** The see-through sides of each escalator, one straight pane per side instead of the stepped collision boxes. */
export function addEscalatorGlass(parts: Parts, e: Of<'escalator'>, rise: number): void {
  parts.at(e.x, e.y, e.z, Math.atan2(-e.dirZ, e.dirX));
  for (const side of [-1, 1]) parts.prism(balustrade(e, rise, 0, ESCALATOR_GLASS_UNITS), 6, 0xbfd6e0, { x: 0, y: 0, z: (side * (e.width + 6)) / 2 });
}

export function addEscalatorBody(parts: Parts, e: Of<'escalator'>, rise: number): void {
  const yaw = Math.atan2(-e.dirZ, e.dirX);
  parts.at(e.x, e.y, e.z, yaw);
  parts.prism([[0, 0], [e.length, 0], [e.length, e.height - 2]], e.width, 0x2b2e33, { x: 0, y: 0, z: 0 });
  const slope = e.height / e.length;
  const flatFrom = (e.height - rise) / slope;
  const apron = [[0, 0], [e.length, 0], [e.length, e.height], [flatFrom, e.height], [0, rise]] as const;
  for (const side of [-1, 1]) {
    const z = (side * (e.width + 6)) / 2;
    parts.prism(apron, 6, 0x41454c, { x: 0, y: 0, z });
    parts.prism(balustrade(e, rise, ESCALATOR_GLASS_UNITS, 4), 10, 0x25262a, { x: 0, y: 0, z });
  }
}
