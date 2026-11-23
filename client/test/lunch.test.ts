import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LUNCH_RUSH_TAG, lunchAnnouncement, lunchMessage, lunchStatus, lunchView } from '../src/game/lunch.ts';

describe('hora de almoçar HUD', () => {
  it('reads the snapshot rows into named colleagues', () => {
    const view = lunchView([1, 30_000], [[0, -1, 10, 0, 20, 0.5], [1, 7, 30, 96, 40, 0], [2, -1, 50, 192, 60, 0]]);
    assert.partialDeepStrictEqual(view, {
      attackers: 1,
      endsAt: 30_000,
      colleagues: [{ name: 'Estagiário', kind: 'waiting' }, { name: 'PO', kind: 'following', leader: 7, y: 96 }, { name: 'Tech lead', kind: 'seated' }],
    });
    assert.equal(lunchView([], []), null, 'other modes send no header');
  });

  it('shows the seated count to the attackers and the time left to the defenders', () => {
    const view = lunchView([0, 30_000], [[2, -1, 0, 0, 0, 0], [0, -1, 0, 0, 0, 0]]);
    assert.ok(view);
    const [attack, defend] = lunchStatus(view, 20_000, 'KFG');
    assert.equal(attack.team, 0);
    assert.match(attack.text, /KFG · 1\/2 sentados/);
    assert.equal(defend.team, 1);
    assert.match(defend.text, /10 s/);
  });

  it('announces the full food court, with a point only in a live match', () => {
    const full = { k: 'lunch', what: 'full', team: 1, by: -1, who: -1 } as const;
    assert.match(lunchMessage(full, '', '', true), /acabaram os lugares na praça de alimentação! ponto dos/);
    assert.doesNotMatch(lunchMessage(full, '', '', false), /ponto dos/);
  });
});

describe('hora do rush', () => {
  it('reads the rush flag from the fourth header element, and defaults to a normal round', () => {
    assert.equal(lunchView([0, 1000, 2, 1], [])?.rush, true);
    assert.equal(lunchView([0, 1000, 2, 0], [])?.rush, false);
    assert.equal(lunchView([0, 1000, 2], [])?.rush, false);
  });

  it('names the destination every round and the rush only when there is one', () => {
    const calm = lunchView([0, 1000, 1, 0], []);
    const rush = lunchView([0, 1000, 1, 1], []);
    assert.ok(calm && rush);
    assert.equal(lunchAnnouncement(calm, 'KFG').destination, 'Destino do almoço: KFG');
    assert.equal(lunchAnnouncement(calm, 'KFG').rush, null);
    assert.match(lunchAnnouncement(rush, 'KFG').rush ?? '', /HORA DO RUSH/);
    assert.ok(lunchStatus(rush, 0, 'KFG').every((row) => row.text.startsWith(LUNCH_RUSH_TAG)));
    assert.ok(lunchStatus(calm, 0, 'KFG').every((row) => !row.text.includes(LUNCH_RUSH_TAG)));
  });
});
