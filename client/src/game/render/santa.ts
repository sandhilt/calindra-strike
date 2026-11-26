import type { MapProp } from '@calindra-strike/shared';
import type { Parts } from './prop-parts.ts';

const RED = 0xc32038;
const WHITE = 0xf2f8ff;
const BLACK = 0x25212a;
const GOLD = 0xffcc59;
const SKIN = 0xf3ba95;
/** Height of the mannequin's hips over its feet, the seated anchor. */
const HIP = 28;

/** Santa is the store mannequin's body (`addMannequin`) in a Santa suit, without the plinth. Forward is -z. A seated prop is anchored at its hips. */
export function addSanta(parts: Parts, { x, y, z, yaw, pose }: Extract<MapProp, { kind: 'santa' }>): void {
  const seat = pose === 'seated';
  parts.at(x, y, z, yaw);
  const y0 = seat ? -HIP : 0;
  for (const side of [-5.5, 5.5]) {
    if (seat) {
      parts.box(9, 10, 18, RED, { x: side, y: y0 + HIP - 5, z: -7 });
      parts.box(9, 20, 10, RED, { x: side, y: y0 + HIP - 13, z: -16 });
      parts.box(9.6, 5, 12, BLACK, { x: side, y: y0 + HIP - 25.5, z: -17 });
    } else {
      parts.box(9, 28, 10, RED, { x: side, y: y0 + 14, z: 0 });
      parts.box(9.6, 6, 12, BLACK, { x: side, y: y0 + 3, z: -1 });
    }
  }
  parts.box(24, 6, 14, RED, { x: 0, y: y0 + 33, z: 0 });
  parts.box(24, 21, 14, RED, { x: 0, y: y0 + 46, z: 0 });
  parts.box(24.6, 3, 14.6, BLACK, { x: 0, y: y0 + 35.5, z: 0 });
  parts.box(5, 3.4, 1, GOLD, { x: 0, y: y0 + 35.5, z: -7.6 });
  parts.box(24.6, 3, 14.6, WHITE, { x: 0, y: y0 + 31.5, z: 0 });
  parts.box(3, 18, 1, WHITE, { x: 0, y: y0 + 46, z: -7.3 });
  parts.box(10, 2.4, 9, WHITE, { x: 0, y: y0 + 57, z: 0 });
  for (const side of [-15.5, 15.5]) {
    const lean = -Math.sign(side) * 0.1;
    parts.box(6.4, 12, 7.4, RED, { x: side, y: y0 + 50, z: 0, rot: [0, 0, lean] });
    parts.box(6.8, 3, 7.8, WHITE, { x: side + Math.sign(side) * 1.2, y: y0 + 43.5, z: 0, rot: [0, 0, lean] });
    parts.box(5.2, 7, 6, BLACK, { x: side + Math.sign(side) * 1.6, y: y0 + 38.5, z: 0, rot: [0, 0, lean] });
  }
  parts.cylinder(3, 3.4, 4, 8, SKIN, { x: 0, y: y0 + 60, z: 0 });
  parts.box(14, 12, 14, SKIN, { x: 0, y: y0 + 68, z: 0 });
  parts.box(12, 4.4, 2, BLACK, { x: 0, y: y0 + 68, z: -7.3 });
  parts.prism([[-7, 6], [7, 6], [6, 0], [0, -5], [-6, 0]], 3, WHITE, { x: 0, y: y0 + 59, z: -8 });
  parts.box(15, 3, 15, WHITE, { x: 0, y: y0 + 75, z: 0 });
  parts.prism([[-7, 0], [7, 0], [8, 6], [4, 12]], 12, RED, { x: 0, y: y0 + 76.5, z: 0 });
  parts.box(5, 5, 5, WHITE, { x: 8, y: y0 + 83, z: 1 });
}
