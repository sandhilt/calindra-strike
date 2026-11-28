import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RF_ALIVE, RF_DROP, type EliminationSnapshot } from '@calindra-strike/shared';
import { canRunSpectatorAction, canWatchEliminationRound, deathSpectateTargets, defaultWatchTeam } from '../src/game/spectate/death.ts';

test('Debug Defusion death spectate lists only living teammates in cycling order, including skydivers', () => {
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

test('Debug Defusion death spectate has no target when every teammate is dead or missing', () => {
  const players = [
    { id: 1, team: 0, flags: RF_DROP },
    { id: 2, team: 1, flags: RF_ALIVE },
    { id: 3, team: -1, flags: RF_ALIVE },
  ];
  assert.deepEqual(deathSpectateTargets(players, 0), []);
  assert.deepEqual(deathSpectateTargets(players, -1), []);
});

test('dead players can watch every live elimination round phase until respawn', () => {
  const counts = { number: 1, alive: 1, teamsAlive: null };
  const rounds: EliminationSnapshot[] = [
    { ...counts, kind: 'waiting', startsAt: 30_000 },
    { ...counts, kind: 'playing', endsAt: 90_000 },
    { ...counts, kind: 'pause', nextAt: 94_000, winner: 1 },
  ];
  for (const round of rounds) {
    assert.equal(canWatchEliminationRound({ mode: 'lms', phase: 'live' }, round, false), true);
    assert.equal(canWatchEliminationRound({ mode: 'gincana', phase: 'live' }, round, false), true);
    assert.equal(canWatchEliminationRound({ mode: 'lms', phase: 'live' }, round, true), false);
    assert.equal(canWatchEliminationRound({ mode: 'lms', phase: 'podium' }, round, false), false);
    assert.equal(canWatchEliminationRound({ mode: 'lms', phase: 'warmup' }, round, false), false);
    assert.equal(canWatchEliminationRound({ mode: 'defuse', phase: 'live' }, round, false), false);
  }
  assert.equal(canWatchEliminationRound({ mode: 'lms', phase: 'live' }, undefined, false), false);
});

test('Gincana defaults to living teammates and falls back to the other team', () => {
  assert.equal(defaultWatchTeam(0, [1, 0]), 0);
  assert.equal(defaultWatchTeam(1, [0, 1]), 1);
  assert.equal(defaultWatchTeam(0, [undefined, 1]), 1);
  assert.equal(defaultWatchTeam(1, [0]), 0);
  assert.equal(defaultWatchTeam(-1, [0]), 0);
  assert.equal(defaultWatchTeam(0, [undefined, -1]), -1);
  assert.equal(defaultWatchTeam(1, []), -1);
});

test('eliminated players can control the camera and open the menu while join stays exclusive to spectators', () => {
  assert.equal(canRunSpectatorAction({ kind: 'join' }, 'spectator'), true);
  assert.equal(canRunSpectatorAction({ kind: 'join' }, 'eliminated'), false);
  for (const kind of ['mode', 'next', 'prev', 'menu'] as const) {
    assert.equal(canRunSpectatorAction({ kind }, 'eliminated'), true);
  }
  assert.equal(canRunSpectatorAction({ kind: 'team', team: 0 }, 'eliminated'), true);
});
