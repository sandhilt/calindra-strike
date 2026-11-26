import type { MapProp } from '@calindra-strike/shared';
import type { Parts } from './prop-parts.ts';

const SNOW = 0xf4f8ff;
const COAL = 0x25212a;
const CARROT = 0xf07a22;
const RED = 0xc32038;
const GREEN = 0x176448;
const PINE = 0x227b55;
const GOLD = 0xffcc59;
const TWIG = 0x6b4426;

/** A snowman of three snowballs with coal eyes and buttons, a carrot nose, twig arms, a red scarf and a top hat. Forward is -z. */
export function addSnowman(parts: Parts, { x, y, z, yaw, scale: s }: Extract<MapProp, { kind: 'snowman' }>): void {
  parts.at(x, y, z, yaw);
  parts.sphere(16 * s, SNOW, { x: 0, y: 16 * s, z: 0 });
  parts.sphere(12 * s, SNOW, { x: 0, y: 38 * s, z: 0 });
  parts.sphere(9 * s, SNOW, { x: 0, y: 56 * s, z: 0 });
  for (const [by, bz] of [[34, -11.6], [41, -11.4]] as const) parts.box(2.4 * s, 2.4 * s, 2 * s, COAL, { x: 0, y: by * s, z: bz * s });
  for (const side of [-3, 3]) parts.box(2 * s, 2 * s, 1.6 * s, COAL, { x: side * s, y: 59 * s, z: -8 * s });
  parts.cylinder(0, 1.6 * s, 9 * s, 6, CARROT, { x: 0, y: 56 * s, z: -12.5 * s, rot: [-Math.PI / 2, 0, 0] });
  parts.cylinder(9.6 * s, 10.4 * s, 4 * s, 12, RED, { x: 0, y: 48.5 * s, z: 0 });
  parts.box(4 * s, 12 * s, 1.6 * s, RED, { x: 5 * s, y: 42 * s, z: -10 * s, rot: [0.2, 0, 0.15] });
  parts.cylinder(11 * s, 11 * s, 1.6 * s, 14, COAL, { x: 0, y: 63.5 * s, z: 0 });
  parts.cylinder(6.5 * s, 7 * s, 12 * s, 12, COAL, { x: 0, y: 70 * s, z: 0 });
  parts.cylinder(7.1 * s, 7.1 * s, 2.4 * s, 12, RED, { x: 0, y: 66 * s, z: 0 });
  for (const side of [-1, 1]) {
    parts.box(18 * s, 1.6 * s, 1.6 * s, TWIG, { x: side * 19 * s, y: 43 * s, z: 0, rot: [0, 0, side * 0.45] });
    parts.box(5 * s, 1.2 * s, 1.2 * s, TWIG, { x: side * 25 * s, y: 48.5 * s, z: 0, rot: [0, 0, side * 1.1] });
  }
}

/**
 * Christmas dress for the inside of a lift cab, in the cab's own frame (floor at y 0, centre at x = z = 0). Only the
 * side walls carry it, so the doorways at local +z and -z stay clear: a garland under the ceiling, a wreath and a
 * stack of gifts on the floor against each wall.
 */
export function addCabDecor(parts: Parts, width: number, depth: number, ceiling: number): void {
  parts.at(0, 0, 0);
  const run = depth - 24;
  for (const side of [-1, 1]) {
    const wall = side * (width / 2 - 5);
    parts.box(4, 5, run, PINE, { x: wall, y: ceiling - 9, z: 0 });
    for (let i = 0; i < 5; i++) {
      parts.box(3.4, 3.4, 3.4, i % 2 ? GOLD : RED, { x: wall - side * 1.5, y: ceiling - 14, z: -run / 2 + 8 + (i * (run - 16)) / 4 });
    }
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5;
      parts.box(3, 5, 5, i % 2 ? GREEN : PINE, { x: wall, y: 58 + Math.sin(angle) * 9, z: Math.cos(angle) * 9 });
    }
    parts.box(3.4, 5, 8, RED, { x: wall - side * 0.6, y: 47, z: 0 });
    parts.box(10, 10, 10, side < 0 ? RED : GREEN, { x: wall - side * 5, y: 5, z: 12 });
    parts.box(10.4, 10, 2.4, GOLD, { x: wall - side * 5, y: 5, z: 12 });
    parts.box(7, 7, 7, side < 0 ? GOLD : RED, { x: wall - side * 4, y: 3.5, z: 2 });
  }
}
