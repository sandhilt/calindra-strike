import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fullscreenButtonLabel } from '../src/ui/fullscreen.ts';

test('debug fullscreen button follows support and stage fullscreen state', () => {
  assert.equal(fullscreenButtonLabel('debug', true, false), 'maximizar janela');
  assert.equal(fullscreenButtonLabel('debug', true, true), 'sair da tela cheia');
  assert.equal(fullscreenButtonLabel('debug', false, false), null);
});

test('lobby fullscreen button appears only when supported and outside fullscreen', () => {
  assert.equal(fullscreenButtonLabel('lobby', true, false), 'tela cheia');
  assert.equal(fullscreenButtonLabel('lobby', true, true), null);
  assert.equal(fullscreenButtonLabel('lobby', false, false), null);
});
