import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getMaps } from '../src/index.ts';
import type { Box, MapDef, MapProp } from '../src/index.ts';

type Vent = Extract<MapProp, { kind: 'vent' }>;

/** How far a grille's plane may miss the face it hangs on (units). */
const FLUSH_UNITS = 0.5;
/** Above this height over its floor, a long sheet metal box is an air duct (units). */
const DUCT_HEIGHT_UNITS = 100;
/** Length from which a high sheet metal box counts as a duct run rather than a fixture (units). */
const DUCT_RUN_UNITS = 100;
/** Shopping Sul Rio's floors are this far apart (units). */
const FLOOR_STEP_UNITS = 192;

const shoppingMaps = getMaps().filter((map) => map.id.startsWith('shopping'));

function vents(map: MapDef): Vent[] {
  return map.props.filter((p): p is Vent => p.kind === 'vent');
}

function label(v: Vent): string {
  return `(${v.x}, ${v.y}, ${v.z})`;
}

function inside(b: Box, x: number, y: number, z: number): boolean {
  return x > b.min.x && x < b.max.x && y > b.min.y && y < b.max.y && z > b.min.z && z < b.max.z;
}

/** The box a vent hangs on: its face lies in the grille's plane and covers the whole grille. */
function mount(map: MapDef, v: Vent): Box | undefined {
  const outX = Math.round(-Math.sin(v.yaw));
  const outZ = Math.round(-Math.cos(v.yaw));
  return map.boxes.find((b) => {
    if (!b.visible || b.mat === 'clip') return false;
    const face = outX > 0 ? b.max.x : outX < 0 ? b.min.x : outZ > 0 ? b.max.z : b.min.z;
    if (Math.abs(face - (outX !== 0 ? v.x : v.z)) > FLUSH_UNITS) return false;
    const across = outX !== 0 ? v.z : v.x;
    const [lo, hi] = outX !== 0 ? [b.min.z, b.max.z] : [b.min.x, b.max.x];
    return across - v.width / 2 >= lo && across + v.width / 2 <= hi && v.y - v.height / 2 >= b.min.y && v.y + v.height / 2 <= b.max.y;
  });
}

describe('air conditioning vents', () => {
  for (const map of shoppingMaps) {
    it(`${map.id}: every grille sits flush on a wall or duct face that covers it`, () => {
      assert.deepEqual(vents(map).filter((v) => !mount(map, v)).map(label), []);
    });

    it(`${map.id}: no grille is buried in a duct`, () => {
      const ducts = map.boxes.filter((b) => b.duct);
      const buried = vents(map).filter((v) => {
        const x = v.x - Math.sin(v.yaw) * FLUSH_UNITS;
        const z = v.z - Math.cos(v.yaw) * FLUSH_UNITS;
        return ducts.some((d) => inside(d, x, v.y, z));
      });
      assert.deepEqual(buried.map(label), []);
    });

    it(`${map.id}: every long sheet metal run high over a floor is authored as a duct`, () => {
      const runs = map.boxes.filter((b) => {
        if (b.duct || b.mat !== 'metal') return false;
        const w = b.max.x - b.min.x;
        const d = b.max.z - b.min.z;
        const high = b.min.y % FLOOR_STEP_UNITS >= DUCT_HEIGHT_UNITS;
        return high && Math.max(w, d) >= DUCT_RUN_UNITS && Math.min(w, d) >= 8 && b.max.y - b.min.y >= 8;
      });
      assert.deepEqual(runs.map((b) => `${JSON.stringify(b.min)}..${JSON.stringify(b.max)}`), []);
    });
  }
});
