import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getMaps } from '../src/index.ts';
import { isBrandMat } from '../src/maps/brands.ts';
import { buildShopping } from '../src/maps/shopping.ts';
import { buildShoppingNatal, GARLAND_TINTS, SNOWMAN_EXIT_CLEARANCE } from '../src/maps/shopping-natal.ts';
import { BAY_ESCALATORS, BAY_TOP_Z, CANOPY_BOTTOM, DECK, DECK3, FACADE_Z, GALLERY_Z, TOP_X, X, Z } from '../src/maps/shopping-levels.ts';
import type { Box } from '../src/maps/types.ts';

/** Overlaps thinner than this (units) are faces that merely touch. */
const SLACK_UNITS = 0.5;

const base = buildShopping();
const natal = buildShoppingNatal();
const isDisplayCar = ({ min, max }: Box) =>
  min.y >= 5 && max.y <= 68 &&
  (min.x >= 786 && max.x <= 934 && min.z >= -287 && max.z <= -209 ||
    min.x >= -934 && max.x <= -786 && min.z >= 209 && max.z <= 287);
const retained = base.boxes.filter((box) => !isDisplayCar(box));
const decor = natal.boxes.slice(retained.length);
const garlands = decor.filter((box) => GARLAND_TINTS.some((tint) => tint === box.tint));
const solidScenery = retained.filter((b) => b.solid && b.visible);

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

  it('preserves the ordered base geometry except the two display cars', () => {
    assert.equal(base.boxes.length - retained.length, 88);
    assert.deepEqual(natal.boxes.slice(0, retained.length), retained);
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

  it('keeps the base props, changing only the stations of the speakers and dressing the lift cabs', () => {
    natal.props.slice(0, base.props.length).forEach((prop, i) => {
      const original = base.props[i];
      if (prop.kind === 'speaker') {
        assert.equal(prop.station, 'shopping-natal');
        assert.partialDeepStrictEqual(prop, { ...original, station: 'shopping-natal' });
      } else if (prop.kind === 'lift') {
        assert.deepEqual(prop, { ...original, festive: true });
      } else {
        assert.deepEqual(prop, original);
      }
    });
  });

  it('stands a Santa beside each Mirante supply gift, facing it', () => {
    for (const stand of base.supplies) {
      const santa = natal.props.find((p) => p.kind === 'santa' && Math.hypot(p.x - stand.x, p.z - stand.z) < 100);
      assert.ok(santa && santa.kind === 'santa', `Santa by the stand at z ${stand.z}`);
      const facing = { x: -Math.sin(santa.yaw), z: -Math.cos(santa.yaw) };
      const toGift = { x: stand.x - santa.x, z: stand.z - santa.z };
      assert.ok(facing.x * toGift.x + facing.z * toGift.z > 0, 'looks at the gift');
    }
  });

  it('places a seated Santa on each plinth and standing Santas on both upper floors', () => {
    const santas = natal.props.filter((prop) => prop.kind === 'santa');
    assert.equal(santas.length, 8);
    assert.deepEqual(santas.filter((p) => p.pose === 'standing').map((p) => p.y).sort(), [DECK, DECK, DECK3, DECK3, DECK3 + 10, DECK3 + 10]);
    for (const p of santas) {
      assert.ok(santas.some((twin) => twin.pose === p.pose && twin.x === -p.x && twin.y === p.y &&
        twin.z === -p.z && Math.abs(twin.yaw - p.yaw) === Math.PI));
      if (p.pose === 'seated') {
        assert.equal(Math.abs(p.x), 860);
        assert.ok(decor.some((seat) => seat.max.y === p.y && seat.min.x < p.x && seat.max.x > p.x &&
          seat.min.z < p.z && seat.max.z > p.z));
      }
    }
  });

  it('keeps every decoration clear of every sign face with a forward margin on both sides', () => {
    const forwardMargin = 12;
    assert.ok(garlands.length > 100);
    for (const sign of retained.filter((box) => isBrandMat(box.mat))) {
      const normal = sign.max.x - sign.min.x < sign.max.z - sign.min.z ? 'x' : 'z';
      const across = normal === 'x' ? 'z' : 'x';
      const hit = decor.find((b) =>
        b.min[normal] < sign.max[normal] + forwardMargin && b.max[normal] > sign.min[normal] - forwardMargin &&
        b.min[across] < sign.max[across] && b.max[across] > sign.min[across] &&
        b.min.y < sign.max.y && b.max.y > sign.min.y);
      assert.equal(hit, undefined, `decoration obscures ${sign.mat} at ${JSON.stringify(sign.min)}`);
    }
  });

  it('keeps shop displays out of the first 64 units of public aisle', () => {
    const frontage = [FACADE_Z + 8, -Z + 132, FACADE_Z + 8];
    for (const [index, level] of [0, DECK, DECK3].entries()) {
      // Tree trunks are the brown square feet of the small interior displays.
      const trees = decor.filter((b) => b.tint === 0x9c5c36 && b.min.y >= level && b.min.y < level + 48 &&
        b.max.x - b.min.x < 5 && b.min.z < -1300);
      assert.ok(trees.length >= 4, `missing interior trees at y=${level}`);
      for (const tree of trees) assert.ok(tree.max.z < frontage[index]);
    }
    for (const box of decor.filter((b) => b.max.z < 0)) {
      for (const [index, level] of [0, DECK, DECK3].entries()) {
        const front = frontage[index];
        assert.ok(!(box.min.y < level + 112 && box.max.y > level &&
          box.min.z < front + 64 && box.max.z > front), `blocked aisle at ${JSON.stringify(box.min)}`);
      }
    }
  });

  it('dresses only the Christmas lift cabs', () => {
    const lifts = natal.props.filter((p) => p.kind === 'lift');
    assert.equal(lifts.length, natal.lifts.length);
    assert.ok(lifts.every((p) => p.kind === 'lift' && p.festive === true));
    for (const map of getMaps().filter((m) => m.id !== natal.id)) {
      assert.ok(map.props.every((p) => p.kind !== 'lift' || p.festive === undefined), map.id);
    }
  });

  it('hangs holly beside every lift level sign, at its height, without covering it', () => {
    const signs = retained.filter((box) => box.mat.startsWith('brand:piso-'));
    assert.equal(signs.length, 6);
    for (const sign of signs) {
      const beside = decor.filter((b) => b.min.y < sign.max.y && b.max.y > sign.min.y &&
        Math.abs((b.min.z + b.max.z) / 2 - (sign.min.z + sign.max.z) / 2) < 8 &&
        b.max.x > sign.min.x - 24 && b.min.x < sign.max.x + 24);
      assert.ok(beside.some((b) => b.max.x <= sign.min.x), `holly left of ${sign.mat} at z ${sign.min.z}`);
      assert.ok(beside.some((b) => b.min.x >= sign.max.x), `holly right of ${sign.mat} at z ${sign.min.z}`);
      assert.ok(beside.every((b) => b.max.x <= sign.min.x || b.min.x >= sign.max.x));
    }
  });

  it('stands snowmen in the corner of each up escalator landing, out of its exit', () => {
    const snowmen = natal.props.filter((p) => p.kind === 'snowman');
    assert.equal(snowmen.length, 6);
    const [up] = BAY_ESCALATORS;
    for (const p of snowmen) {
      assert.ok(p.kind === 'snowman');
      // Fold the mirrored half back onto the authored north-east bay.
      const x = p.z < 0 ? p.x : -p.x;
      const z = p.z < 0 ? p.z : -p.z;
      // Twig arms reach about 28 units from the middle at scale 1.
      const radius = 28 * p.scale;
      assert.equal(p.y, DECK3 + 3);
      assert.ok(x - radius > Math.max(TOP_X, up.x1) && x + radius < X, `snowman x ${p.x}`);
      assert.ok(z - radius > -Z && z + radius < BAY_TOP_Z - SNOWMAN_EXIT_CLEARANCE, `snowman z ${p.z}`);
      assert.ok(decor.some((snow) => snow.max.y === p.y && snow.min.x < p.x && snow.max.x > p.x &&
        snow.min.z < p.z && snow.max.z > p.z), 'stands on its snow patch');
      const fold = p.z < 0 ? 1 : -1;
      const facing = { x: -Math.sin(p.yaw) * fold, z: -Math.cos(p.yaw) * fold };
      assert.ok(facing.x * (TOP_X - x) + facing.z * (BAY_TOP_Z - z) > 0, 'faces the landing');
    }
    const sizes = new Set(snowmen.map((p) => p.kind === 'snowman' && p.scale));
    assert.ok(sizes.size >= 3);
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
    assert.equal(snow.max.y, CANOPY_BOTTOM);
    const panes = base.boxes.filter((box) => box.mat === 'glass' && box.min.y === CANOPY_BOTTOM);
    assert.equal(panes.length, 2);
    for (const x of [snow.min.x, snow.max.x]) {
      for (const z of [snow.min.z, snow.max.z]) {
        assert.ok(panes.some((p) => p.min.x <= x && p.max.x >= x && p.min.z <= z && p.max.z >= z));
      }
    }
    const strings = decor.filter((b) => b.max.x - b.min.x === 2 && b.max.z - b.min.z === 2 && b.max.y === CANOPY_BOTTOM - 3);
    assert.equal(strings.length, 8);
    for (const string of strings) {
      assert.ok(decor.some((bar) => bar.max.y === CANOPY_BOTTOM && bar.min.y === string.max.y &&
        bar.min.x <= string.min.x && bar.max.x >= string.max.x && bar.min.z <= string.min.z && bar.max.z >= string.max.z));
      assert.ok(decor.some((star) => star.mat === 'lamp' && star.max.y === string.min.y &&
        star.min.x <= string.min.x && star.max.x >= string.max.x && star.min.z <= string.min.z && star.max.z >= string.max.z));
    }
    assert.ok(snow.min.x >= base.dropArea.minX && snow.max.x <= base.dropArea.maxX);
    assert.ok(Math.abs(snow.min.z) < -GALLERY_Z && Math.abs(snow.max.z) < -GALLERY_Z);
    assert.ok(snow.flakes > 0);
  });
});
