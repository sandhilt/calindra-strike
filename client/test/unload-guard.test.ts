import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUnloadGuard } from '../src/game/unload-guard.ts';

test('a running match prompts before the tab closes', () => {
  const guard = createUnloadGuard();
  assert.equal(guard.shouldPrompt(true), true);
  assert.equal(guard.shouldPrompt(false), false);
});

test('a reload started by the dev server never prompts', () => {
  const guard = createUnloadGuard();
  guard.expectReload();
  assert.equal(guard.shouldPrompt(true), false);
  assert.equal(guard.shouldPrompt(false), false);
});

test('each guard keeps its own reload flag', () => {
  const reloading = createUnloadGuard();
  const other = createUnloadGuard();
  reloading.expectReload();
  assert.equal(other.shouldPrompt(true), true);
});
