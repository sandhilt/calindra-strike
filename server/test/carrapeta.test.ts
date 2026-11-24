import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
  BATATA_BOUNTY_POINTS, BATATA_DURATION_SECONDS, CTF_PICKUP_RADIUS_UNITS, PLAYER_RADIUS,
  SNAPSHOT_EVERY_TICKS, TICK_RATE, WEAPON, liftCab, type ServerMsg,
} from '@calindra-strike/shared';
import { Game } from '../src/game.ts';

function setup(roll: number, map = 'forja') {
  const messages: ServerMsg[] = [];
  const game = new Game({
    maxPlayers: 8, matchMs: 120_000, podiumMs: 5000, warmupMinPlayers: 3,
    modes: 'carrapeta', maps: [map], carrapetaPickupTimeoutSeconds: 5, random: () => roll,
  });
  function join(name: string) {
    const player = game.join(name, 0, WEAPON.RIFLE, (data) => { if (name === 'First') messages.push(JSON.parse(data)); });
    assert.ok(typeof player !== 'string');
    return player;
  }
  const first = join('First');
  const second = join('Second');
  assert.equal(first.state.primary, WEAPON.RIFLE);
  game.startMatch();
  function run(ticks: number) {
    for (let i = 0; i < ticks; i++) game.update();
  }
  for (const player of [first, second]) {
    assert.equal(player.state.primary, WEAPON.RIFLE);
    Object.assign(player.state, {
      y: game.world.groundBelow(player.state.x, player.state.y, player.state.z, PLAYER_RADIUS),
      dropping: false,
      onGround: true,
    });
  }
  run(1);
  function snapshot() {
    run(SNAPSHOT_EVERY_TICKS);
    const snap = messages.findLast((m) => m.t === 'snap');
    assert.ok(snap?.t === 'snap');
    return snap.ca;
  }
  return { game, first, second, messages, run, snapshot };
}

it('drops the objective on holder death and draws another player when it times out', () => {
  const { game, first, second, run, snapshot, messages } = setup(0.9);
  assert.equal(second.state.primary, WEAPON.MGL);
  run(TICK_RATE);
  assert.equal(second.points, 1);

  first.state.x = second.state.x - 2 * CTF_PICKUP_RADIUS_UNITS;
  game['kill'](second, first, WEAPON.RIFLE, false);
  assert.equal(first.points, 0);
  assert.equal(second.state.primary, WEAPON.RIFLE);
  second.respawnAt = Infinity;
  assert.equal(snapshot()?.kind, 'dropped');
  run(5 * TICK_RATE);
  assert.partialDeepStrictEqual(snapshot(), { kind: 'held', holder: first.id, frenzyUntilMs: 0 });
  assert.equal(first.state.primary, WEAPON.MGL);
  assert.ok(messages.some((m) => m.t === 'ev' && m.e.some((e) => e.k === 'carrapeta' && e.what === 'reroll' && e.by === first.id)));

  game.phaseEnds = game.now();
  game.update();
  const podium = messages.findLast((m) => m.t === 'match');
  assert.ok(podium?.t === 'match');
  assert.equal(podium.match.winner, second.id);
  assert.equal(podium.match.results?.[0].points, 1);
});

it('halves the live holder during frenzy, awards a bounty, and restores the new holder at expiry', () => {
  const { game, first, second, run, snapshot, messages } = setup(0);
  assert.equal(first.state.mag[WEAPON.MGL], 6);
  assert.equal(snapshot()?.frenzyUntilMs, 0);

  run(30 * TICK_RATE);
  assert.ok((snapshot()?.frenzyUntilMs ?? 0) > game.now());
  assert.equal(first.state.mag[WEAPON.MGL], 3);
  assert.ok(first.state.halvedAmmo);
  game['kill'](first, second, WEAPON.RIFLE, false);
  assert.equal(second.points, BATATA_BOUNTY_POINTS);
  first.respawnAt = Infinity;
  run(5 * TICK_RATE);
  assert.equal(second.state.primary, WEAPON.MGL);
  assert.equal(second.state.mag[WEAPON.MGL], 3);
  assert.ok(second.state.halvedAmmo);
  run(BATATA_DURATION_SECONDS * TICK_RATE);
  assert.equal(snapshot()?.frenzyUntilMs, 0);
  assert.equal(second.state.halvedAmmo, false);
  assert.equal(second.state.mag[WEAPON.MGL], 3);
  assert.deepEqual(messages.flatMap((m) => m.t === 'ev' ? m.e : [])
    .filter((e) => e.k === 'frenzy').map((e) => e.what), ['on', 'off']);
});

it('awards possession points only outside the lift cab', () => {
  const { game, first, run } = setup(0, 'shopping');
  const shaft = game.map.lifts[0];
  assert.ok(shaft);
  Object.assign(first.state, {
    x: (shaft.minX + shaft.maxX) / 2,
    y: liftCab(shaft, game.tick + TICK_RATE).y,
    z: (shaft.minZ + shaft.maxZ) / 2,
    dropping: false,
  });
  run(TICK_RATE);
  assert.equal(first.points, 0);
  first.state.x = shaft.maxX + 100;
  run(TICK_RATE);
  assert.equal(first.points, 1);
});
