import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUCT_LEAK_SECONDS, DuctLeaks } from '../src/game/render/duct-leak.ts';
import { QUALITY, QUALITY_TIERS } from '../src/game/render/quality.ts';

function puffsOver(seconds: number, leaks: DuctLeaks): number {
  let n = 0;
  for (let t = 0; t < seconds; t += 1 / 60) leaks.step(1 / 60, () => n++);
  return n;
}

test('a shot duct leaks for two seconds and then stops', () => {
  const leaks = new DuctLeaks();
  leaks.open(0, 0, 0, 1, 0, 0);
  const during = puffsOver(DUCT_LEAK_SECONDS, leaks);
  assert.ok(during >= 10, `leaked ${during} puffs`);
  assert.equal(puffsOver(5, leaks), 0, 'quiet after two seconds');
  assert.equal(leaks.active, 0);
});

test('only the high tier leaks air from shot ducts', () => {
  assert.deepEqual(QUALITY_TIERS.filter((tier) => QUALITY[tier].fx.ductLeak), ['high']);
});
