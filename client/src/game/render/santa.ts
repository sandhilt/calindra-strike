import type { MapProp } from '@calindra-strike/shared';
import { AVATAR_HEAD_WIDTH, AVATAR_HEAD_Y, AVATAR_HIP_Y, AVATAR_LEG_OFFSET, AVATAR_TORSO_DEPTH, AVATAR_TORSO_WIDTH } from './avatar-proportions.ts';
import type { Parts } from './prop-parts.ts';

const RED = 0xc32038;
const WHITE = 0xf2f8ff;
const BLACK = 0x25212a;
const GOLD = 0xffcc59;
const SKIN = 0xf3ba95;

/** Santa uses the player's block silhouette and forward axis (-z). A seated prop is anchored at its hips. */
export function addSanta(parts: Parts, { x, y, z, yaw, pose }: Extract<MapProp, { kind: 'santa' }>): void {
  const seat = pose === 'seated';
  parts.at(x, y, z, yaw);
  const hip = seat ? 0 : AVATAR_HIP_Y;
  const head = hip + AVATAR_HEAD_Y - AVATAR_HIP_Y;
  for (const side of [-1, 1]) {
    const leg = side * AVATAR_LEG_OFFSET;
    if (seat) {
      parts.box(9, 9, 16, RED, { x: leg, y: -1, z: -8 });
      parts.box(9, 11, 9, RED, { x: leg, y: -7, z: -16 });
      parts.box(10, 5, 13, BLACK, { x: leg, y: -14, z: -18 });
    } else {
      parts.box(9, 28, 10, RED, { x: leg, y: 18, z: 0 });
      parts.box(10, 5, 13, BLACK, { x: leg, y: 2.5, z: -1.5 });
    }
    const arm = side * 15;
    parts.box(7, 7, 8, RED, { x: arm, y: hip + 22, z: 0 });
    parts.box(6, 6, 14, RED, { x: arm, y: hip + 13, z: seat ? -6 : 0, rot: [seat ? 0.35 : Math.PI / 2, 0, 0] });
    parts.box(6, 4, 6, WHITE, { x: arm, y: hip + (seat ? 10 : 6), z: seat ? -12 : 0 });
    parts.box(5, 5, 5, BLACK, { x: arm, y: hip + (seat ? 9 : 2), z: seat ? -16 : 0 });
    parts.box(1.5, 1.5, 1, BLACK, { x: side * 3.5, y: head + 10, z: -7 });
  }
  parts.box(AVATAR_TORSO_WIDTH, 21, AVATAR_TORSO_DEPTH, RED, { x: 0, y: hip + 14, z: 0 });
  parts.box(25, 4, 15, WHITE, { x: 0, y: hip + 3, z: 0 });
  parts.box(3, 17, 1, WHITE, { x: 0, y: hip + 14, z: -7 });
  parts.box(25, 4, 16, BLACK, { x: 0, y: hip + 9, z: 0 });
  parts.box(6, 4, 1, GOLD, { x: 0, y: hip + 9, z: -8 });
  parts.box(AVATAR_HEAD_WIDTH, 12, AVATAR_HEAD_WIDTH, SKIN, { x: 0, y: head + 8.5, z: 0 });
  parts.prism([[-7, 8], [7, 8], [6, 2], [0, -2], [-6, 2]], 4, WHITE, { x: 0, y: head, z: -7 });
  parts.box(17, 3, 16, WHITE, { x: 0, y: head + 14, z: 0 });
  parts.prism([[-8, 0], [8, 0], [9, 7], [5, 13]], 13, RED, { x: 0, y: head + 15, z: 0 });
  parts.box(5, 5, 5, WHITE, { x: 9, y: head + 22, z: 1 });
}
