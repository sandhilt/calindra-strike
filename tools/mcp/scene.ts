import { describeBox, dirFromAngles, eyeHeight, SPRAY_SIZE, clamp,
  type Box, type CollisionWorld, type MapDef, type PlayerState } from '../../shared/src/index.ts';
import { hasLineOfSight } from '../../server/src/bot.ts';
import type { ViewSpray } from './view.ts';

const FACING_RANGE = 1500;
const COVER_RANGE = 700;
const FEATURE_RANGE = 900;
const FACE_EPSILON = 0.1;
const described = new Map<string, { map: MapDef; boxes: { box: Box; description: NonNullable<ReturnType<typeof describeBox>> }[] }>();
type Relative = (p: { x: number; z: number }) => { distance: number | null; bearingDeg: number | null };

function sceneryBoxes(map: MapDef) {
  const cached = described.get(map.id);
  if (cached?.map === map) return cached.boxes;
  const boxes = map.boxes.flatMap((box) => {
    const description = describeBox(box);
    return description ? [{ box, description }] : [];
  });
  described.set(map.id, { map, boxes });
  return boxes;
}

function boxAt(map: MapDef, x: number, y: number, z: number, nx: number, ny: number, nz: number) {
  return map.boxes.find((b) => !b.shootThrough
    && x >= b.min.x - FACE_EPSILON && x <= b.max.x + FACE_EPSILON
    && y >= b.min.y - FACE_EPSILON && y <= b.max.y + FACE_EPSILON
    && z >= b.min.z - FACE_EPSILON && z <= b.max.z + FACE_EPSILON
    && (nx !== 0 && Math.abs(x - (nx < 0 ? b.min.x : b.max.x)) < FACE_EPSILON
      || ny !== 0 && Math.abs(y - (ny < 0 ? b.min.y : b.max.y)) < FACE_EPSILON
      || nz !== 0 && Math.abs(z - (nz < 0 ? b.min.z : b.max.z)) < FACE_EPSILON));
}

export function scene(world: CollisionWorld, map: MapDef, self: PlayerState, sprays: readonly ViewSpray[], relative: Relative) {
  const ey = self.y + eyeHeight(self);
  const dir = dirFromAngles(self.yaw, self.pitch);
  const hit = world.trace(self.x, ey, self.z, dir.x, dir.y, dir.z, FACING_RANGE);
  const facing = (() => {
    if (!hit) return null;
    const x = self.x + dir.x * hit.t, y = ey + dir.y * hit.t, z = self.z + dir.z * hit.t;
    const box = boxAt(map, x, y, z, hit.nx, hit.ny, hit.nz);
    const spray = sprays.find((s) => s.nx === hit.nx && s.ny === hit.ny && s.nz === hit.nz
      && Math.abs((s.x - x) * hit.nx + (s.y - y) * hit.ny + (s.z - z) * hit.nz) <= FACE_EPSILON
      && Math.hypot(s.x - x, s.y - y, s.z - z) <= SPRAY_SIZE / 2);
    return { distance: Math.round(hit.t), point: [x, y, z], normal: [hit.nx, hit.ny, hit.nz],
      ...(box ? { kind: describeBox(box)?.kind, mat: box.mat } : {}),
      ...(spray ? { spray: { by: spray.by } } : {}) };
  })();
  const nearest = <T extends { distance: number | null }>(items: T[]) => items.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
  const cover = nearest(sceneryBoxes(map).flatMap(({ box: b, description }) => {
    const x = clamp(self.x, b.min.x, b.max.x), z = clamp(self.z, b.min.z, b.max.z);
    const rel = relative({ x, z });
    if ((rel.distance ?? Infinity) > COVER_RANGE) return [];
    const y = clamp(ey, b.min.y, b.max.y);
    // Stop just before the face so the target box does not occlude itself.
    const length = Math.hypot(self.x - x, ey - y, self.z - z);
    const offset = length > 0 ? FACE_EPSILON / length : 0;
    const visible = hasLineOfSight(world, self.x, ey, self.z, {
      x: x + (self.x - x) * offset, y: y + (ey - y) * offset, z: z + (self.z - z) * offset,
    }, [0]);
    if (!visible) return [];
    return [{ ...description, mat: b.mat, size: [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z], pos: [x, z], ...rel }];
  })).slice(0, 8);
  const features = map.features.map((f) => ({ feature: f, ...relative(f) }));
  const doors = nearest(features.filter((f) => f.feature.kind !== 'landmark' && (f.distance ?? Infinity) <= FEATURE_RANGE))
    .filter((f, i, all) => all.slice(0, i).filter((p) => (p.feature.kind === 'stairs') === (f.feature.kind === 'stairs')).length < (f.feature.kind === 'stairs' ? 2 : 4))
    .map(({ feature: f, ...rel }) => ({ kind: f.kind, pos: [f.x, f.z], ...('width' in f ? { width: f.width } : {}), ...('height' in f ? { height: f.height } : {}), ...rel }));
  const landmarks = nearest(features.filter((f) => f.feature.kind === 'landmark')).slice(0, 6)
    .map(({ feature: f, ...rel }) => ({ ...('name' in f ? { name: f.name } : {}), pos: [f.x, f.z], ...rel }));
  return { facing, cover, doors, landmarks, sprays: nearest(sprays.map((s) => ({ by: s.by, pos: [s.x, s.y, s.z], normal: [s.nx, s.ny, s.nz], ...relative(s) })))
    .filter((s) => (s.distance ?? Infinity) <= FEATURE_RANGE).slice(0, 6) };
}
