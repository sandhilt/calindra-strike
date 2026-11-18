import { it } from 'node:test';
import assert from 'node:assert/strict';
import { BTN, WEAPON, weaponDef } from '@calindra-strike/shared';
import { Game, type ServerPlayer } from '../src/game.ts';

function reloadOnce(players: number) {
  const game = new Game({ maxPlayers: 8, matchMs: 60_000, podiumMs: 5000, warmupMinPlayers: 2, modes: 'tdm', random: () => 0.5 });
  const joined = Array.from({ length: players }, (_, i) => game.join('P' + i, 0, WEAPON.RIFLE, () => {}) as ServerPlayer);
  game.update();
  const p = joined[0];
  Object.assign(p.state, { dropping: false, onGround: true, protect: 0, weapon: WEAPON.RIFLE, deploy: 0, reload: 0 });
  p.alive = true;
  p.state.mag[WEAPON.RIFLE] = 0;
  const rifle = weaponDef(WEAPON.RIFLE);
  for (let seq = 1; seq <= rifle.reloadTicks + 5; seq++) {
    p.queue.push({ seq, buttons: seq === 1 ? BTN.RELOAD : 0, yaw: 0, pitch: 0, weapon: 0, interp: 0 });
    game.update();
  }
  return { phase: (game as unknown as { phase: string }).phase, mag: p.state.mag[WEAPON.RIFLE], reserve: p.state.reserve[WEAPON.RIFLE], full: rifle.reserve, magSize: rifle.mag };
}

it('warmup ammo never runs out: a reload fills the magazine and the reserve stays full', () => {
  const r = reloadOnce(1);
  assert.equal(r.phase, 'warmup');
  assert.equal(r.mag, r.magSize);
  assert.equal(r.reserve, r.full);
});

it('a live match still spends the reserve on reloads', () => {
  const r = reloadOnce(2);
  assert.equal(r.phase, 'live');
  assert.equal(r.mag, r.magSize);
  assert.equal(r.reserve, r.full - r.magSize);
});
