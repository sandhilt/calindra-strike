import {
  DUCK_EYE,
  DUCK_HEIGHT,
  DUCK_SPEED_MULT,
  PRONE_EYE,
  PRONE_HEIGHT,
  PRONE_SPEED_MULT,
  STAND_EYE,
  STAND_HEIGHT,
} from './constants.ts';

export const STANCE = { STAND: 0, CROUCH: 1, PRONE: 2 } as const;
export type Stance = (typeof STANCE)[keyof typeof STANCE];

/** Hitbox slice: y range above the feet and half width on x and z. */
export interface BodyBox {
  readonly y0: number;
  readonly y1: number;
  readonly half: number;
}

export interface StanceDef {
  readonly height: number; // collision hull
  readonly eye: number;
  readonly speedMult: number; // on the ground, on top of the weapon speed
  readonly head: BodyBox;
  readonly body: BodyBox;
  readonly legs: BodyBox;
  readonly aimHead: number; // where a bot aims, units above the feet
  readonly aimBody: number;
}

/** One row per stance: everything that depends on how low a player is lives here, not in if chains. */
export const STANCES: Readonly<Record<Stance, StanceDef>> = {
  [STANCE.STAND]: {
    height: STAND_HEIGHT,
    eye: STAND_EYE,
    speedMult: 1,
    head: { y0: 58, y1: 72, half: 7 },
    body: { y0: 32, y1: 58, half: 13 },
    legs: { y0: 0, y1: 32, half: 10 },
    aimHead: 64,
    aimBody: 44,
  },
  [STANCE.CROUCH]: {
    height: DUCK_HEIGHT,
    eye: DUCK_EYE,
    speedMult: DUCK_SPEED_MULT,
    head: { y0: 23, y1: 37, half: 7 },
    body: { y0: 12, y1: 26, half: 13 },
    legs: { y0: 0, y1: 12, half: 11 },
    aimHead: 30,
    aimBody: 20,
  },
  [STANCE.PRONE]: {
    height: PRONE_HEIGHT,
    eye: PRONE_EYE,
    speedMult: PRONE_SPEED_MULT,
    head: { y0: 12, y1: 20, half: 7 },
    body: { y0: 4, y1: 14, half: 15 },
    legs: { y0: 0, y1: 8, half: 12 },
    aimHead: 16,
    aimBody: 9,
  },
};

export const isLowered = (stance: Stance): boolean => stance !== STANCE.STAND;
