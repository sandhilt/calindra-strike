import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LUNCH_RUSH_TAG, followersOf, followersText, lunchAnnouncement, lunchMessage, lunchRole, lunchStatus, lunchView } from '../src/game/lunch.ts';

describe('hora de almoçar HUD', () => {
  it('shows each team its objective, with a rush call for attackers', () => {
    assert.deepEqual(lunchRole(0, 0, false), { side: 'attack', label: 'ataque', goal: 'leve os colegas ao restaurante' });
    assert.deepEqual(lunchRole(1, 1, true), { side: 'attack', label: 'ataque', goal: 'corra, é hora do rush' });
    assert.deepEqual(lunchRole(1, 0, false), { side: 'defend', label: 'defesa', goal: 'impeça o almoço' });
    assert.deepEqual(lunchRole(0, 1, true), { side: 'defend', label: 'defesa', goal: 'impeça o almoço' });
    assert.equal(lunchRole(0, -1, false), null);
    assert.equal(lunchRole(1, 2, true), null);
  });

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
    assert.deepEqual([attack.big, attack.unit], ['1/2', 'sentados']);
    assert.equal(defend.team, 1);
    assert.deepEqual([defend.big, defend.unit], ['10 s', 'pro KFG lotar']);
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
    assert.ok(lunchStatus(rush, 0, 'KFG').every((row) => row.tag === LUNCH_RUSH_TAG));
    assert.ok(lunchStatus(calm, 0, 'KFG').every((row) => row.tag === null));
  });

  it('counts the defenders\' seconds two at a time in a rush hour', () => {
    const rush = lunchView([0, 30_000, 0, 1], []);
    const calm = lunchView([0, 30_000, 0, 0], []);
    assert.ok(rush && calm);
    const left = (view: typeof rush, now: number) => lunchStatus(view, now, 'KFG')[1].big;
    assert.deepEqual([left(calm, 20_000), left(calm, 21_000)], ['10 s', '9 s']);
    assert.deepEqual([left(rush, 20_000), left(rush, 21_000)], ['20 s', '18 s']);
  });

  it('counts only the colleagues following this player', () => {
    const view = lunchView([0, 30_000], [[1, 7, 0, 0, 0, 0], [1, 8, 0, 0, 0, 0], [2, 7, 0, 0, 0, 0], [0, -1, 0, 0, 0, 0]]);
    assert.ok(view);
    assert.equal(followersOf(view, 7), 1, 'a seated colleague no longer follows');
    assert.equal(followersOf(view, 8), 1);
    assert.equal(followersOf(view, 9), 0);
    assert.equal(followersText(1, 3), '1 de 3 colegas te seguindo');
    assert.equal(followersText(2, 3), '2 de 3 colegas te seguindo');
  });
});
