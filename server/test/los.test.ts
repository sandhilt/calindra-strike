import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld, getMap } from '@calindra-strike/shared';
import { hasLineOfSight } from '../src/bot.ts';

test('line of sight crosses open Forja floor but not its solid central box', () => {
  const world = new CollisionWorld(getMap(0));
  assert.equal(hasLineOfSight(world, -300, 64, -600, { x: 300, y: 0, z: -600 }), true);
  assert.equal(hasLineOfSight(world, -300, 64, 0, { x: 300, y: 0, z: 0 }), false);
});
