import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMaps } from '../src/index.ts';

const SHOP_LAMP_COLOR = '#ffe9bd';
const BAR_Z_TOLERANCE_UNITS = 3;
const BAR_Y_TOLERANCE_UNITS = 1;

for (const map of getMaps().filter((candidate) => candidate.id.startsWith('shopping'))) {
  test(`${map.id}: every shop lamp halo hangs on a lamp bar`, () => {
    const bars = map.boxes.filter((box) => box.mat === 'lamp');
    const floating = map.lights.filter(
      (light) =>
        light.color === SHOP_LAMP_COLOR &&
        !bars.some(
          (bar) =>
            light.x >= bar.min.x &&
            light.x <= bar.max.x &&
            Math.abs(light.z - (bar.min.z + bar.max.z) / 2) <= BAR_Z_TOLERANCE_UNITS &&
            Math.abs(light.y - bar.min.y) <= BAR_Y_TOLERANCE_UNITS,
        ),
    );
    assert.deepEqual(floating, []);
  });
}
