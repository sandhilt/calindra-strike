/**
 * The vertical layout of Shopping Sul Rio, shared by the files that author it: ground floor, the food court
 * deck and the top floor above it, each one a floor slab thick under its walking surface.
 */
export const X = 1408;
export const Z = 1152;
export const SLAB = 16;
/** Walking surface of the food court floor. */
export const DECK = 192;
/** Walking surface of the top floor (Mirante), laid over the food court. */
export const DECK3 = 384;
/** Underside of the top floor slab: the food court ceiling, which kitchens and ducts must stay under. */
export const FOOD_CEILING = DECK3 - SLAB;
/** Underside of the roof slab, 240 units over the top floor. */
export const ROOF = DECK3 + 240;
/** Outer walls reach the top of the roof slab. */
export const WALL = ROOF + SLAB;
/** Skydive start altitude: the same distance over the roof top as before the top floor existed. */
export const DROP_HEIGHT = 1200;
/** Edge of the upper floors, looking over the atrium. */
export const GALLERY_Z = -672;
export const FACADE_Z = -880;
/** The top floor slab stops here; past it, at each end, is a stair bay open from the deck to the roof. */
export const TOP_X = 1216;
/** Inner footprint of the glass lift beside the middle of the atrium edge, in the north half. */
export const LIFT_MIN_X = -56;
export const LIFT_MAX_X = 56;
export const LIFT_MIN_Z = GALLERY_Z;
export const LIFT_MAX_Z = GALLERY_Z + 112;
/** Glass walls of the lift shaft. */
export const LIFT_WALL = 6;
/** Glass balustrades stand above a jump, so nobody (bots' nav included) hops off a floor or an escalator. */
export const RAIL = 64;
