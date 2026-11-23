import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getMaps, waterSurfaceAt } from '../src/index.ts';

const shopping = getMaps().find((map) => map.id === 'shopping');
const forja = getMaps().find((map) => map.id === 'forja');

describe('waterSurfaceAt', () => {
  it('finds the shopping map', () => {
    assert.ok(shopping);
  });

  it('wades in the lower basin with feet on its floor', () => {
    assert.ok(shopping);
    assert.equal(waterSurfaceAt(shopping, 100, 0, 100), 28);
  });

  it('is dry on the plaza outside the basin wall', () => {
    assert.ok(shopping);
    assert.equal(waterSurfaceAt(shopping, 200, 0, 0), null);
  });

  it('is dry on the 36 high basin wall, over the water footprint', () => {
    assert.ok(shopping);
    assert.equal(waterSurfaceAt(shopping, 130, 36, 0), null);
  });

  it('wades on the upper basin surface', () => {
    assert.ok(shopping);
    assert.equal(waterSurfaceAt(shopping, 40, 106, 40), 108);
  });

  it('is dry above the water surface', () => {
    assert.ok(shopping);
    assert.equal(waterSurfaceAt(shopping, 100, 28, 100), null);
  });

  it('is dry on maps without water', () => {
    assert.ok(forja);
    assert.equal(waterSurfaceAt(forja, 0, 0, 0), null);
  });
});
