import { MAX_SPEED, STEP_SIZE, WALK_SPEED_MULT, type CollisionWorld, type MapDef } from '@calindra-strike/shared';

export interface TourPoint { x: number; z: number; y?: number }

const SHOPPING_TOUR: readonly TourPoint[] = [
  { x: 250, z: 250 }, { x: 900, z: 250 }, { x: 1120, z: -280 },
  { x: 1120, z: -760 }, { x: 650, z: -760 }, { x: 650, z: -285 },
  { x: 528, z: -285 }, { x: 528, z: -352 }, { x: 528, z: -672, y: 192 },
  { x: 528, z: -744, y: 192 }, { x: -528, z: -744, y: 192 },
  { x: -528, z: -672, y: 192 }, { x: -528, z: -352 }, { x: -528, z: -220 },
  { x: -230, z: -220 }, { x: -230, z: 250 },
];

export const TOURS: Record<string, readonly TourPoint[]> = {
  forja: [
    { x: 0, z: -465 }, { x: 465, z: -465 },
    { x: 465, z: 465 }, { x: -465, z: 465 }, { x: -465, z: -465 },
  ],
  escritorio: [
    { x: 0, z: -125 }, { x: 470, z: -125 },
    { x: 470, z: 125 }, { x: -470, z: 125 }, { x: -470, z: -125 },
  ],
  shopping: SHOPPING_TOUR,
  'shopping-natal': SHOPPING_TOUR,
};

export const TOUR_EYE_HEIGHT = 64;
const WALK_UNITS_PER_SECOND = MAX_SPEED * WALK_SPEED_MULT;
const TURN_RADIANS_PER_SECOND = Math.PI / 3;
const GROUND_BLEND_UNITS = 10;
const GROUND_PROBE_RADIUS = 0.01;

export function tourPoints(map: MapDef): readonly TourPoint[] {
  return Object.hasOwn(TOURS, map.id) ? TOURS[map.id] : [...map.flagBases, { x: 0, z: 0 }];
}

function angleDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export function buildTour(points: readonly TourPoint[]) {
  let length = 0;
  const legs = points.flatMap((from, index) => {
    const to = points[(index + 1) % points.length];
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const distance = Math.hypot(dx, dz);
    if (!distance) return [];
    const start = length;
    length += distance;
    const yaw = Math.atan2(-dx, -dz);
    return [{ from, to, start, distance, yaw, startYaw: yaw }];
  });
  if (!legs.length) return { legs, length, speed: WALK_UNITS_PER_SECOND, origin: points[0] ?? { x: 0, z: 0 } };

  // Anchor the loop on a leg long enough to finish even a half turn.
  const anchor = legs.reduce((longest, leg, index) => leg.distance > legs[longest].distance ? index : longest, 0);
  const speed = Math.min(WALK_UNITS_PER_SECOND, legs[anchor].distance * TURN_RADIANS_PER_SECOND / (1.5 * Math.PI));
  let yaw = legs[anchor].yaw;
  for (let offset = 1; offset <= legs.length; offset++) {
    const leg = legs[(anchor + offset) % legs.length];
    leg.startYaw = yaw;
    yaw = turn(leg.startYaw, leg.yaw, leg.distance / speed);
  }
  return { legs, length, speed, origin: points[0] };
}

function turn(from: number, to: number, seconds: number): number {
  const delta = angleDelta(from, to);
  if (delta === 0) return from;
  const fraction = Math.min(1, seconds * TURN_RADIANS_PER_SECOND / (1.5 * Math.abs(delta)));
  return from + delta * fraction * fraction * (3 - 2 * fraction);
}

type Tour = ReturnType<typeof buildTour>;

function pointAt(tour: Tour, distance: number) {
  const wrapped = ((distance % tour.length) + tour.length) % tour.length;
  const leg = tour.legs.findLast(({ start }) => start <= wrapped);
  if (!leg) return { ...tour.origin, yaw: 0 };
  const along = wrapped - leg.start;
  const fraction = along / leg.distance;
  const fromY = leg.from.y ?? 0;
  return {
    x: leg.from.x + (leg.to.x - leg.from.x) * fraction,
    z: leg.from.z + (leg.to.z - leg.from.z) * fraction,
    y: fromY + ((leg.to.y ?? 0) - fromY) * fraction,
    yaw: turn(leg.startYaw, leg.yaw, along / tour.speed),
  };
}

export function groundAt(world: CollisionWorld, point: TourPoint): number {
  return world.groundBelow(point.x, (point.y ?? 0) + STEP_SIZE, point.z, GROUND_PROBE_RADIUS);
}

export function sampleTour(tour: Tour, world: CollisionWorld, elapsedMs: number) {
  const distance = tour.length ? (elapsedMs * tour.speed / 1000) % tour.length : 0;
  const { x, z, yaw } = pointAt(tour, distance);
  // Interpolate between fixed ground probes so stair rises do not jolt the camera.
  const left = Math.floor(distance / GROUND_BLEND_UNITS) * GROUND_BLEND_UNITS;
  const a = groundAt(world, pointAt(tour, left));
  const right = Math.min(tour.length, left + GROUND_BLEND_UNITS);
  const b = groundAt(world, pointAt(tour, right));
  const mix = right > left ? (distance - left) / (right - left) : 0;
  const ground = Number.isFinite(a) && Number.isFinite(b) ? a + (b - a) * mix : 0;
  return { x, z, y: ground + TOUR_EYE_HEIGHT, yaw };
}
