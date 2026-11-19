/**
 * The ammo belt of the machine gun: where each round sits as the belt feeds, in the weapon's own units.
 * Pure, so it is testable without WebGL. Rounds lie across the gun (their axis is X).
 */
export interface BeltPoint {
  x: number;
  y: number;
  z: number;
}

/** From the mouth of the box up the left flank, over the corner and onto the feed tray under the cover. */
export const BELT_PATH: readonly BeltPoint[] = [
  { x: -2.0, y: -0.8, z: -4.0 },
  { x: -3.3, y: 0.6, z: -4.6 },
  { x: -3.3, y: 3.0, z: -5.4 },
  { x: -2.3, y: 4.9, z: -6.2 },
  { x: 0, y: 5.0, z: -7.0 },
];

/** Share of the belt, counted from the feed end, that lies on the tray and rises off it while the belt is not laid. */
const TRAY_SHARE = 0.38;
/** How far the tray end of the belt rises above the tray while it is not laid: just enough to clear the cover's hinge and rest on the supporting hand. */
export const TRAY_LIFT_UNITS = 1.8;
/** How far the tray end of the belt is swung out to the left, past the receiver, while it is pulled clear of the gun. */
export const TRAY_CLEAR_UNITS = 4.5;
/** One round in this many is a tracer. */
export const TRACER_EVERY = 4;

export interface LinkPlacement {
  position: BeltPoint;
  /** 0 where the round appears out of the box or is eaten by the gun, 1 along the rest of the belt. */
  scale: number;
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const smooth = (v: number): number => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};

/** The point at `u` (0 at the box, 1 at the feed tray) counted by distance along the path, so rounds are evenly spaced. */
export function pointAlong(path: readonly BeltPoint[], u: number): BeltPoint {
  const lengths = path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, p.y - path[i].y, p.z - path[i].z));
  const total = lengths.reduce((sum, l) => sum + l, 0);
  let left = clamp01(u) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i] || i === lengths.length - 1) {
      const k = lengths[i] === 0 ? 0 : Math.min(1, left / lengths[i]);
      const a = path[i];
      const b = path[i + 1];
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
    }
    left -= lengths[i];
  }
  return { ...path[0] };
}

/** Share of the box's fall that the tray end does not follow while the supporting hand holds it, so the belt hangs from the hand instead of dropping out of view with the box. */
export const BELT_END_HELD = 0.7;
const NO_FALL: BeltPoint = { x: 0, y: 0, z: 0 };

/**
 * The belt path with its tray end lifted and swung out, and its box end carried by the box. The waypoints move, not the rounds,
 * so the rounds stay evenly spaced along the bent belt and the chain never tears or bunches. `laid` is 1 with the belt on the tray
 * and 0 lifted off it, `clear` is 0 with the end over the tray and 1 swung out to the left of the gun, `fall` is how far the box has
 * moved from its seat: the box end follows it all the way, and the tray end follows it only while the belt lies on the tray.
 */
export function reachedPath(laid: number, clear: number, fall: BeltPoint = NO_FALL, path: readonly BeltPoint[] = BELT_PATH): BeltPoint[] {
  const lengths = path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, p.y - path[i].y, p.z - path[i].z));
  const total = lengths.reduce((sum, l) => sum + l, 0);
  const held = Math.max(1 - laid, clear);
  let along = 0;
  return path.map((p, i) => {
    if (i > 0) along += lengths[i - 1];
    const u = along / total;
    const tray = smooth((u - (1 - TRAY_SHARE)) / TRAY_SHARE);
    const follows = 1 - BELT_END_HELD * held * smooth(u);
    return {
      x: p.x - clear * TRAY_CLEAR_UNITS * tray + fall.x * follows,
      y: p.y + (1 - laid) * TRAY_LIFT_UNITS * tray + fall.y * follows,
      z: p.z + fall.z * follows,
    };
  });
}

/** Slots per second the belt travels while the gun fires, how quickly it gets to and from that pace, and how long one shot keeps it going. */
export const BELT_FLOW_SLOTS_PER_S = 5;
const BELT_FLOW_EASE_PER_S = 14;
export const BELT_BURST_S = 0.12;

/** The belt of a firing gun: rounds fed so far (the fraction is where it sits, the whole part picks the tracers), its pace now, and how long the gun keeps it fed. */
export interface BeltFlow {
  feed: number;
  speed: number;
  burst: number;
}

/**
 * The belt runs at a steady, readable pace while the gun fires and coasts to a stop after. Moving it one slot per shot
 * (twelve a second) made identical rounds repeat the same picture every shot and read as a shimmer, not a flow.
 */
export function stepBeltFlow(flow: BeltFlow, dt: number): void {
  flow.burst = Math.max(0, flow.burst - dt);
  const target = flow.burst > 0 ? BELT_FLOW_SLOTS_PER_S : 0;
  flow.speed += (target - flow.speed) * Math.min(1, dt * BELT_FLOW_EASE_PER_S);
  flow.feed += flow.speed * dt;
}

/** Whether the round in link `index` is a tracer. A fed round keeps its look as it moves, so the whole part of `feed` shifts the pattern. */
export function isTracer(index: number, feed: number): boolean {
  return (((index - Math.floor(feed)) % TRACER_EVERY) + TRACER_EVERY) % TRACER_EVERY === 0;
}

/**
 * Where link `index` of `count` sits. `feed` counts the rounds fed so far: every whole number moves each round one slot toward
 * the tray, so the pattern repeats and only the fraction matters. `laid` and `clear` bend the belt as in `reachedPath`; pass that
 * path in as `bent` when placing every round of one belt, so it is worked out once.
 * The round at the tray end is eaten by the gun only while the belt lies on the tray: a lifted belt keeps its last round whole.
 */
export function linkPlacement(index: number, count: number, feed: number, laid: number, clear = 0, bent: readonly BeltPoint[] = reachedPath(laid, clear)): LinkPlacement {
  const u = (index + (feed - Math.floor(feed))) / count;
  const eaten = laid * (1 - clear);
  const atTray = clamp01((1 - u) * count);
  return { position: pointAlong(bent, u), scale: Math.min(clamp01(u * count), 1 - eaten * (1 - atTray)) };
}
