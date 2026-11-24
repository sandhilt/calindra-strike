import assert from 'node:assert/strict';
import { test } from 'node:test';
import { liveVotePanel } from '../src/game/vote.ts';

const vote = { options: [{ map: 0, mode: 'tdm' as const }, { map: 1, mode: 'ffa' as const }, { map: 0, mode: 'ctf' as const }], counts: [0, 0, 0], closesAt: 130_000 };

test('the round vote lists every option with its key, count and my pick, and counts the seconds down', () => {
  const panel = liveVotePanel(vote, [1, 3, 0], 1, 10_000);
  assert.ok(panel);
  assert.equal(panel.secondsLeft, 120);
  assert.deepEqual(panel.rows.map((r) => [r.key, r.count, r.mine]), [['F1', 1, false], ['F2', 3, true], ['F3', 0, false]]);
});

test('the panel is gone once the window closes, and on the podium where closesAt is absent', () => {
  assert.equal(liveVotePanel(vote, [], -1, 130_000), null);
  assert.equal(liveVotePanel({ ...vote, closesAt: undefined }, [], -1, 0), null);
});
