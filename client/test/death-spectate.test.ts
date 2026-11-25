import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RF_ALIVE, RF_DROP } from '@calindra-strike/shared';
import { deathSpectateTargets } from '../src/game/spectate/death.ts';

test('death spectate lists only living teammates in cycling order, including skydivers', () => {
  const players = [
    { id: 9, team: 0, flags: RF_ALIVE | RF_DROP },
    { id: 7, team: 1, flags: RF_ALIVE },
    { id: 5, team: 0, flags: 0 },
    { id: 3, team: 0, flags: RF_ALIVE },
    { id: 2, team: undefined, flags: RF_ALIVE },
  ];
  assert.deepEqual(deathSpectateTargets(players, 0), [3, 9]);
  assert.deepEqual(deathSpectateTargets(players, 1), [7]);
});

test('death spectate has no target when every teammate is dead or missing', () => {
  const players = [
    { id: 1, team: 0, flags: RF_DROP },
    { id: 2, team: 1, flags: RF_ALIVE },
    { id: 3, team: -1, flags: RF_ALIVE },
  ];
  assert.deepEqual(deathSpectateTargets(players, 0), []);
  assert.deepEqual(deathSpectateTargets(players, -1), []);
});
