import assert from 'node:assert/strict';

export function closeTo(actual: number, expected: number, digits = 2): void {
  assert.ok(
    Math.abs(actual - expected) < 10 ** -digits / 2,
    `Expected ${actual} to be close to ${expected} (${digits} digits)`,
  );
}
