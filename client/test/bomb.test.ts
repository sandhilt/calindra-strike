import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLACK_FRIDAY_FUSE_MS, DEFUSE_MS, FUSE_MS, PLANT_MS, TEAMS } from '@calindra-strike/shared';
import { DEFUSE_BANNER_MS, beepIntervalMs, bombView, bombRole, bombStatus, bombMessage, carryNotice, defuseBannerScene, defuseProgress, useRefusal, fuseUrgency, plantProgress, plantSecondsLeft, scoreUnit } from '../src/game/bomb.ts';

test('maps every wire state and clears outside the mode', () => {
  assert.equal(bombView([]), null);
  const at = { x: 10, y: 20, z: 30, variant: 2, attackers: 1, blackFriday: false, plantByAt: 0 };
  assert.deepEqual(bombView([0, -1, 10, 20, 30, 0, 0, 2, 1, 0, 0]), { ...at, state: 'home' });
  assert.deepEqual(bombView([1, 7, 10, 20, 30, 0, 0, 2, 1, 0, 0]), { ...at, state: 'carried', carrier: 7 });
  assert.deepEqual(bombView([2, 7, 10, 20, 30, 0, 0, 2, 1, 5000, 0]), { ...at, state: 'planting', carrier: 7, doneAt: 5000 });
  assert.deepEqual(bombView([3, -1, 10, 20, 30, 21000, 0, 2, 1, 0, 0]), { ...at, state: 'dropped', handOverAt: 21000 });
  assert.deepEqual(bombView([4, 9, 10, 20, 30, 40000, 8000, 2, 1, 0, 0]), { ...at, state: 'planted', explodeAt: 40000, defuser: 9, defuseDoneAt: 8000 });
});

test('progress follows the server deadlines and stays within 0..1', () => {
  const planted = bombView([4, 9, 0, 0, 0, 40000, 10000, 0, 0, 0]);
  assert.ok(planted);
  assert.equal(defuseProgress(planted, 10000 - DEFUSE_MS), 0);
  assert.equal(defuseProgress(planted, 10000 - DEFUSE_MS / 2), 0.5);
  assert.equal(defuseProgress(planted, 10000), 1);
  assert.equal(defuseProgress(planted, 99999), 1);
  assert.equal(defuseProgress(planted, 0), 0);
  const idle = bombView([4, -1, 0, 0, 0, 40000, 0, 0, 0, 0]);
  assert.ok(idle);
  assert.equal(defuseProgress(idle, 5000), 0);
  const planting = bombView([2, 7, 0, 0, 0, 0, 0, 0, 0, 20000]);
  assert.ok(planting);
  assert.equal(plantProgress(planting, 20000 - (PLANT_MS * 3) / 4), 0.25);
  assert.equal(plantProgress(planted, 0), -1);
});

test('status speaks to the carrier, the defuser and the rest', () => {
  const name = (id: number) => 'P' + id;
  const carried = bombView([1, 7, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.ok(carried);
  assert.equal(bombStatus(carried, 0, 7, 0, name), 'segure E no site para plantar');
  assert.equal(bombStatus(carried, 0, 8, 0, name), 'P7 leva o bug');
  const home = bombView([0, -1, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.ok(home);
  assert.deepEqual([0, 1, -1].map(team => bombStatus(home, 0, 8, team, name)), ['pegue o bug na base', 'defenda o site', 'o bug está na base']);
  const planted = bombView([4, -1, 0, 0, 0, 23001, 0, 0, 0, 0]);
  assert.ok(planted);
  assert.equal(bombStatus(planted, 0, 8, 0, name), 'bug plantado · 24s');
  assert.equal(bombStatus(planted, 0, 8, 1, name), 'bug plantado · 24s · segure E perto dele');
  const defusing = bombView([4, 9, 0, 0, 0, 23000, 9000, 0, 0, 0]);
  assert.ok(defusing);
  assert.equal(bombStatus(defusing, 0, 9, 1, name), 'desarmando…');
  assert.equal(bombStatus(defusing, 0, 8, 1, name), 'P9 desarma o bug · 23s');
});

test('beeps speed up as the fuse burns down', () => {
  const planted = bombView([4, -1, 0, 0, 0, 100000, 0, 0, 0, 0]);
  assert.ok(planted);
  assert.equal(fuseUrgency(planted, 100000 - FUSE_MS), 0);
  assert.equal(fuseUrgency(planted, 100000), 1);
  assert.ok(Math.abs(fuseUrgency(planted, 100000 - FUSE_MS / 2) - 0.5) < 1e-9);
  assert.equal(fuseUrgency({ ...planted, state: 'dropped' } as never, 0), 0);
  assert.ok(beepIntervalMs(0) > beepIntervalMs(0.5));
  assert.ok(beepIntervalMs(0.5) > beepIntervalMs(1));
  assert.equal(beepIntervalMs(5), beepIntervalMs(1));
});

test('only the player who holds the bug gets the carry warning', () => {
  const carried = bombView([1, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const planting = bombView([2, 7, 0, 0, 0, 0, 0, 0, 0, 20000, 0]);
  const home = bombView([0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const planted = bombView([4, 7, 0, 0, 0, 40000, 0, 0, 0, 0, 0]);
  assert.ok(carried && planting && home && planted);
  assert.deepEqual(carryNotice(carried, 7), { title: 'você está com o bug', hint: 'leve até o círculo vermelho e segure E' });
  assert.deepEqual(carryNotice(planting, 7), { title: 'plantando o bug', hint: 'não solte o E até terminar' });
  assert.equal(carryNotice(carried, 8), null, 'a teammate or spectator is not warned');
  assert.equal(carryNotice(home, 7), null);
  assert.equal(carryNotice(planted, 7), null, 'once planted the warning is gone');
});

test('the plant window counts down for the attackers and is absent once planted or without a limit', () => {
  const name = (id: number) => 'P' + id;
  const home = bombView([0, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 60000]);
  assert.ok(home);
  assert.equal(plantSecondsLeft(home, 45500), 15);
  assert.equal(plantSecondsLeft(home, 70000), 0);
  assert.equal(bombStatus(home, 45500, 7, 0, name), 'pegue o bug na base · 15s para plantar');
  assert.equal(bombStatus(home, 45500, 7, 1, name), 'defenda o site · 15s para plantar');
  assert.equal(plantSecondsLeft({ ...home, plantByAt: 0 }, 1000), null);
  const planted = bombView([4, -1, 0, 0, 0, 90000, 0, 0, 0, 0, 0, 0]);
  assert.ok(planted);
  assert.equal(plantSecondsLeft(planted, 1000), null);
  assert.equal(bombMessage('expired', 1, 'ninguém'), 'o tempo acabou · o bug agora é dos ' + TEAMS[1].name);
});

test('Black Friday is 50% OFF the fuse', () => {
  assert.equal(BLACK_FRIDAY_FUSE_MS, FUSE_MS / 2);
  assert.equal(FUSE_MS, 30_000);
});

test('Black Friday uses the short fuse and labels the round in every state', () => {
  const explodeAt = 100000;
  const start = explodeAt - BLACK_FRIDAY_FUSE_MS;
  const name = (id: number) => 'P' + id;
  const expectedStatuses = [
    'pegue o bug na base',
    'segure E no site para plantar',
    'plantando…',
    'o bug caiu · pegue-o · troca de lado em 15s',
    'bug plantado · 15s',
  ];
  for (const [state, status] of expectedStatuses.entries()) {
    const bomb = bombView([state, state === 4 ? -1 : 7, 0, 0, 0, explodeAt, 0, 0, 0, 0, 1]);
    assert.ok(bomb?.blackFriday);
    assert.equal(bombStatus(bomb, start, 7, 0, name), 'BLACK FRIDAY 50% OFF · ' + status);
  }
  const planted = bombView([4, -1, 0, 0, 0, explodeAt, 0, 0, 0, 0, 1]);
  assert.ok(planted);
  assert.equal(fuseUrgency(planted, start), 0);
  assert.equal(fuseUrgency(planted, explodeAt - BLACK_FRIDAY_FUSE_MS / 2), 0.5);
  assert.equal(fuseUrgency(planted, explodeAt), 1);
});

test('feed names the team that scored the round', () => {
  assert.equal(bombMessage('plant', 0, 'Ana'), 'Ana plantou o bug!');
  assert.equal(bombMessage('defused', 1, 'Ana'), 'Ana desarmou o bug · ponto dos Martelos');
  assert.equal(bombMessage('exploded', 0, ''), 'o bug explodiu · ponto dos Bulldogs');
  assert.equal(bombMessage('return', 0, ''), 'o bug voltou para a base');
});

test('score unit per mode', () => {
  const modes = ['tdm', 'ffa', 'ctf', 'defuse', 'almoco', 'carrapeta'] as const;
  assert.deepEqual(modes.map(scoreUnit), ['kills', 'kills', 'capturas', 'pontos', 'rodadas', 'pontos']);
});

test('the defuser keeps the finished laptop with the banner for 3 s after the defuse', () => {
  const banner = { variant: 4, until: 10_000 + DEFUSE_BANNER_MS };
  assert.equal(DEFUSE_BANNER_MS, 3000);
  assert.deepEqual(defuseBannerScene(banner, 10_000), { variant: 4, progress: 1, timeMs: 10_000 });
  assert.deepEqual(defuseBannerScene(banner, 12_999), { variant: 4, progress: 1, timeMs: 12_999 });
  assert.equal(defuseBannerScene(banner, 13_000), null);
  assert.equal(defuseBannerScene(null, 10_000), null);
});

test('pressing E explains what is missing instead of failing silently', () => {
  const site = { x: 1000, y: 0, z: 0 };
  const name = (id: number) => 'P' + id;
  const base = { x: 0, y: 0, z: 0, variant: 0, attackers: 0, blackFriday: false, plantByAt: 0 };
  const attempt = (bomb: Parameters<typeof useRefusal>[0]['bomb'], myTeam: number, me = { x: 0, y: 0, z: 0 }) => useRefusal({ bomb, myId: 1, myTeam, me, site, name });
  assert.equal(attempt({ ...base, state: 'home' }, 0), 'encoste no bug para pegá-lo');
  assert.equal(attempt({ ...base, state: 'carried', carrier: 1 }, 0), 'leve o bug até o site (círculo vermelho)');
  assert.equal(attempt({ ...base, state: 'carried', carrier: 1 }, 0, { x: 990, y: 0, z: 0 }), null, 'carrier in the site plants');
  assert.equal(attempt({ ...base, state: 'carried', carrier: 2 }, 0), 'P2 está com o bug');
  assert.equal(attempt({ ...base, state: 'home' }, 1), 'só dá para desarmar depois que o bug for plantado');
  const planted = { ...base, state: 'planted' as const, explodeAt: 0, defuser: -1, defuseDoneAt: 0 };
  assert.equal(attempt(planted, 1, { x: 300, y: 0, z: 0 }), 'chegue mais perto do laptop para desarmar');
  assert.equal(attempt(planted, 1, { x: 20, y: 0, z: 0 }), null, 'defender next to the laptop defuses');
  assert.equal(attempt({ ...planted, defuser: 3 }, 1, { x: 20, y: 0, z: 0 }), 'P3 já está desarmando');
  assert.equal(attempt(planted, -1), null, 'spectators get no hint');
});

test('bombRole keeps each side on its goal all round and hides it from spectators', () => {
  const row = (state: number) => {
    const bomb = bombView([state, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.ok(bomb);
    return bomb;
  };
  assert.deepEqual(bombRole(row(0), 0), { side: 'attack', label: 'ataque', goal: 'plante o bug' });
  assert.deepEqual(bombRole(row(0), 1), { side: 'defend', label: 'defesa', goal: 'impeça o plantio' });
  assert.deepEqual(bombRole(row(4), 0), { side: 'attack', label: 'ataque', goal: 'proteja o bug' });
  assert.deepEqual(bombRole(row(4), 1), { side: 'defend', label: 'defesa', goal: 'desarme o bug' });
  assert.equal(bombRole(row(0), -1), null);
});

test('a dropped bug counts down to the hand-over, cut short by the plant window', () => {
  const name = (id: number) => 'P' + id;
  const dropped = bombView([3, -1, 0, 0, 0, 21000, 0, 0, 0, 0, 0, 60000]);
  assert.ok(dropped);
  assert.equal(bombStatus(dropped, 1000, 7, 0, name), 'o bug caiu · pegue-o · troca de lado em 20s');
  assert.equal(bombStatus({ ...dropped, plantByAt: 6000 }, 1000, 7, 1, name), 'o bug caiu no chão · troca de lado em 5s');
});

test('in warmup the same E key plants before the bug is down and defuses after, whatever the team', () => {
  const at = { x: 0, y: 0, z: 0, variant: 0, attackers: 1, blackFriday: false, plantByAt: 0 };
  const me = { x: 0, y: 0, z: 0 };
  const attempt = { myId: 3, myTeam: 0, me, site: me, name: () => 'x', practice: true };
  assert.equal(useRefusal({ ...attempt, bomb: { ...at, state: 'home' } }), 'encoste no bug para pegá-lo');
  assert.equal(useRefusal({ ...attempt, bomb: { ...at, state: 'planted', explodeAt: 0, defuser: -1, defuseDoneAt: 0 } }), null);
  assert.equal(bombRole({ ...at, state: 'home' }, 0, true)?.goal, 'plante o bug');
  const status = bombStatus({ ...at, state: 'planted', explodeAt: 30000, defuser: -1, defuseDoneAt: 0 }, 0, 3, 0, () => 'x', true);
  assert.equal(status, 'bug plantado · segure E perto dele');
});
