import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Panting } from '../src/game/panting.ts';

function breaths(p: Panting, seconds: number, winded: boolean, alive = true) {
  const out: { breath: string; loud: number }[] = [];
  for (let t = 0; t < seconds; t += 1 / 60) {
    const b = p.step(1 / 60, winded, alive);
    if (b) out.push(b);
  }
  return out;
}

test('a winded player pants in and out', () => {
  const b = breaths(new Panting(), 3, true);
  assert.ok(b.length >= 6, `${b.length} breaths in 3 s`);
  assert.equal(b[0].breath, 'in');
  assert.ok(b.every((x, i) => x.breath === (i % 2 ? 'out' : 'in')));
  assert.ok(b.every((x) => x.loud === 1));
});

test('the breathing slows and fades once the meter recovers, then stops', () => {
  const p = new Panting();
  breaths(p, 2, true);
  const after = breaths(p, 3, false);
  assert.ok(after.length > 0 && after.length < 6, `${after.length} breaths while recovering`);
  assert.ok(after.at(-1)!.loud < after[0].loud);
  assert.equal(breaths(p, 3, false).length, 0);
});

test('a rested or dead player does not pant', () => {
  assert.equal(breaths(new Panting(), 5, false).length, 0);
  assert.equal(breaths(new Panting(), 5, true, false).length, 0);
});
