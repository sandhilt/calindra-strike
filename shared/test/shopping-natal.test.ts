import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getMaps } from '../src/index.ts';
import { buildShopping } from '../src/maps/shopping.ts';
import { buildShoppingNatal } from '../src/maps/shopping-natal.ts';
import { GALLERY_Z, ROOF } from '../src/maps/shopping-levels.ts';
import type { Box } from '../src/maps/types.ts';

/** Overlaps thinner than this (units) are faces that merely touch. */
const SLACK_UNITS = 0.5;

const base = buildShopping();
const natal = buildShoppingNatal();
const decor = natal.boxes.slice(base.boxes.length);
const solidScenery = base.boxes.filter((b) => b.solid && b.visible);

function overlaps(a: Box, b: Box): boolean {
  const reach = (lo: number, hi: number, lo2: number, hi2: number) => Math.min(hi, hi2) - Math.max(lo, lo2) > SLACK_UNITS;
  return reach(a.min.x, a.max.x, b.min.x, b.max.x) && reach(a.min.y, a.max.y, b.min.y, b.max.y) && reach(a.min.z, a.max.z, b.min.z, b.max.z);
}

function keyOf(min: { x: number; y: number; z: number }, max: { x: number; y: number; z: number }, box: Box): string {
  const corner = (v: { x: number; y: number; z: number }) => [v.x, v.y, v.z].map((n) => n.toFixed(3)).join(',');
  return `${corner(min)}..${corner(max)}|${box.mat}|${box.tint}`;
}

function ownKey(box: Box): string {
  return keyOf(box.min, box.max, box);
}

/** The same box turned 180 degrees around the map centre, as the builder's `mirrored` replays it. */
function mirroredKey(box: Box): string {
  return keyOf({ x: -box.max.x, y: box.min.y, z: -box.max.z }, { x: -box.min.x, y: box.max.y, z: -box.min.z }, box);
}

describe('Shopping Sul Rio: Natal', () => {
  it('is the base map under its own id, name and radio', () => {
    assert.equal(natal.id, 'shopping-natal');
    assert.notEqual(natal.name, base.name);
    assert.ok(natal.subtitle.length > 0);
    assert.ok(getMaps().some((m) => m.id === 'shopping-natal'));
  });

  it('keeps every gameplay field of the base map', () => {
    for (const field of ['bounds', 'dropArea', 'flagBases', 'dropHeight', 'airdropPoints', 'defuseBases', 'defuseSite', 'restaurants', 'floors', 'lifts', 'interiors', 'supplies'] as const) {
      assert.deepEqual(natal[field], base[field], field);
    }
  });

  it('starts with every box of the base map, unchanged', () => {
    assert.deepEqual(natal.boxes.slice(0, base.boxes.length), base.boxes);
    assert.ok(decor.length > 0);
  });

  it('adds only decoration: nothing solid, all visible and shot through', () => {
    for (const box of decor) {
      assert.equal(box.solid, false);
      assert.equal(box.visible, true);
      assert.equal(box.shootThrough, true);
    }
  });

  it('keeps decoration clear of every visible solid of the base map', () => {
    for (const box of decor) {
      const hit = solidScenery.find((s) => overlaps(box, s));
      assert.equal(hit, undefined, `decor ${box.mat} at ${JSON.stringify(box.min)} inside ${hit?.mat}`);
    }
  });

  it('draws the decoration in mirrored pairs, so both halves match', () => {
    const keys = new Set(decor.map(ownKey));
    for (const box of decor) {
      assert.ok(keys.has(mirroredKey(box)), `no mirrored twin for decor ${box.mat} at ${JSON.stringify(box.min)}`);
    }
  });

  it('keeps the base props, changing only the stations of the speakers', () => {
    assert.equal(natal.props.length, base.props.length);
    natal.props.forEach((prop, i) => {
      const original = base.props[i];
      if (prop.kind === 'speaker') {
        assert.equal(prop.station, 'shopping-natal');
        assert.partialDeepStrictEqual(prop, { ...original, station: 'shopping-natal' });
      } else {
        assert.deepEqual(prop, original);
      }
    });
  });

  it('has its own speakers and a radio station of its own', () => {
    const speakers = natal.props.filter((p) => p.kind === 'speaker');
    assert.ok(speakers.length >= 2);
    assert.ok(speakers.every((p) => p.kind === 'speaker' && p.station === natal.id));
  });

  it('places a landmark for the tree and keeps the base landmarks', () => {
    assert.ok(natal.features.some((f) => f.kind === 'landmark' && f.name.startsWith('Árvore de Natal')));
    for (const f of base.features) assert.ok(natal.features.some((g) => JSON.stringify(g) === JSON.stringify(f)));
  });

  it('snows only under the glass canopy, inside the atrium and never above the roof', () => {
    assert.equal(base.theme.snow, undefined);
    const snow = natal.theme.snow;
    assert.ok(snow);
    assert.ok(snow.min.y >= 0);
    assert.ok(snow.max.y <= ROOF);
    assert.ok(snow.min.x >= base.dropArea.minX && snow.max.x <= base.dropArea.maxX);
    assert.ok(Math.abs(snow.min.z) < -GALLERY_Z && Math.abs(snow.max.z) < -GALLERY_Z);
    assert.ok(snow.flakes > 0);
  });
});
