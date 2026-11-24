import { CARRAPETA_BANNERS } from '../src/game/carrapeta.ts';
import { ICONS } from '../src/ui/icons.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { WEAPON, weaponDef } from '@calindra-strike/shared';
import { carrapetaFeed, carrapetaStatus, compareScoreRows, weaponAmmo } from '../src/game/carrapeta.ts';

test('the feed names the holder on a take, reroll, and loss', () => {
  assert.equal(carrapetaFeed('take', 'Lia'), 'Lia · Está tudo azeitado');
  assert.equal(carrapetaFeed('reroll', 'Lia'), 'Lia · Está tudo azeitado');
  assert.equal(carrapetaFeed('lose', 'Lia'), 'Lia · avinagrou');
});

test('the objective HUD uses server deadlines for the reroll and frenzy timers', () => {
  const dropped = { kind: 'dropped', x: 0, y: 0, z: 0, rerollAtMs: 4000, frenzyUntilMs: 6000 } as const;
  const name = (id: number) => `jogador ${id}`;
  assert.equal(carrapetaStatus(dropped, 2500, name), 'no chão · sorteio em 2 s · Batata quente 4 s');
  assert.equal(carrapetaStatus(dropped, 7000, name), 'no chão · sorteio em 0 s');
  assert.equal(carrapetaStatus({ kind: 'held', holder: 2, sinceMs: 100, frenzyUntilMs: 0 }, 7000, name), 'jogador 2');
  assert.equal(carrapetaStatus({ kind: 'none', frenzyUntilMs: 0 }, 0, name), 'aguardando sorteio');
});

test('the ammo HUD halves capacity in frenzy and only the Azeitadora has infinite reserve', () => {
  const mag: number[] = [];
  const reserve: number[] = [];
  mag[WEAPON.MGL] = 6;
  reserve[WEAPON.MGL] = 12;
  mag[WEAPON.PISTOL] = 1;
  reserve[WEAPON.PISTOL] = 7;
  const mgl = weaponDef(WEAPON.MGL);
  const ammo = { mag, reserve, halvedAmmo: false, infiniteMgl: false };
  assert.deepEqual(weaponAmmo(ammo, mgl, false), { mag: 6, reserve: 12, capacity: null });
  ammo.infiniteMgl = true;
  assert.deepEqual(weaponAmmo(ammo, mgl, false), { mag: 6, reserve: '∞', capacity: null });
  ammo.halvedAmmo = true;
  assert.deepEqual(weaponAmmo(ammo, mgl, false), { mag: 3, reserve: '∞', capacity: 3 });
  mag[WEAPON.MGL] = 1;
  assert.deepEqual(weaponAmmo(ammo, mgl, false), { mag: 1, reserve: '∞', capacity: 3 });
  const pistol = weaponDef(WEAPON.PISTOL);
  assert.equal(weaponAmmo(ammo, pistol, false).reserve, 7);
  assert.equal(weaponAmmo(ammo, pistol, true).reserve, '∞');
});

test('Carrapeta standings rank by points and preserve kill order for modes without points', () => {
  const hunter = { id: 1, points: 0, kills: 15, deaths: 3 };
  const holder = { id: 2, points: 10, kills: 0, deaths: 1 };
  assert.deepEqual([hunter, holder].sort(compareScoreRows), [holder, hunter]);
  assert.ok(compareScoreRows({ ...hunter, points: undefined }, { ...holder, points: undefined }) < 0);
});

test('the Batata Quente banners show the potato and the others keep the golden top', () => {
  assert.equal(CARRAPETA_BANNERS.on.icon, 'batata');
  assert.equal(CARRAPETA_BANNERS.off.icon, 'batata');
  assert.equal(CARRAPETA_BANNERS.take.icon, 'carrapeta');
  for (const banner of Object.values(CARRAPETA_BANNERS)) assert.match(ICONS[banner.icon], /^<svg viewBox="0 0 64 64"/);
});
