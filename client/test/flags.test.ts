import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flagViews, flagStatus, flagMessage } from '../src/game/flags.ts';

test('maps all wire states and clears flags outside CTF', () => {
  assert.deepEqual(flagViews([]), []);
  assert.deepEqual(flagViews([[0, -1, 10, 20, 30, 0], [1, 7, 40, 50, 60, 0], [2, -1, 70, 80, 90, 3000]]), [
    { team: 0, x: 10, y: 20, z: 30, state: 'home' },
    { team: 1, x: 40, y: 50, z: 60, state: 'carried', carrier: 7 },
    { team: 2, x: 70, y: 80, z: 90, state: 'dropped', returnAt: 3000 },
  ]);
});

test('status uses carrier names and server deadline with nonnegative rounded seconds', () => {
  const home = { team: 0, x: 0, y: 0, z: 0, state: 'home' } as const;
  assert.equal(flagStatus(home, 0, String), 'na base');
  assert.equal(flagStatus({ ...home, state: 'carried', carrier: 7 }, 0, id => `player ${id}`), 'com player 7');
  assert.equal(flagStatus({ ...home, state: 'dropped', returnAt: 2001 }, 1000, String), 'no chão · 2 s');
  assert.equal(flagStatus({ ...home, state: 'dropped', returnAt: 2001 }, 3000, String), 'no chão · 0 s');
});

test('feed distinguishes all actions and automatic return', () => {
  assert.equal(flagMessage('take', 0, 7, 'Ana'), 'Ana roubou a mochila dos Bulldogs!');
  assert.equal(flagMessage('drop', 1, 7, 'Ana'), 'Ana derrubou a mochila dos Martelos!');
  assert.equal(flagMessage('capture', 1, 7, 'Ana'), 'Ana capturou a mochila dos Martelos!');
  assert.equal(flagMessage('return', 0, 7, 'Ana'), 'Ana devolveu a mochila dos Bulldogs!');
  assert.equal(flagMessage('return', 0, -1, ''), 'mochila dos Bulldogs voltou sozinha');
});
