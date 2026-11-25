import assert from 'node:assert/strict';
import { it } from 'node:test';
import {
  eyeHeight, BATATA_BOUNTY_POINTS, CARRAPETA_MAX_HOLD_SECONDS, CARRAPETA_REDRAW_WAIT_SECONDS, CARRAPETA_LOOSE_RESPAWN_EXTRA_TICKS, BATATA_DURATION_SECONDS, CTF_PICKUP_RADIUS_UNITS, PLAYER_RADIUS,
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
  game['frenzyQueue'] = [game.tick + 30 * TICK_RATE - SNAPSHOT_EVERY_TICKS];

  run(30 * TICK_RATE);
  assert.ok((snapshot()?.frenzyUntilMs ?? 0) > game.now());
  assert.equal(first.state.mag[WEAPON.MGL], 3);
  assert.ok(first.state.halvedAmmo);
  assert.equal(first.state.health, 50);
  assert.equal(first.state.armor, 100);
  game['kill'](first, second, WEAPON.RIFLE, false);
  assert.equal(second.points, BATATA_BOUNTY_POINTS);
  first.respawnAt = Infinity;
  run(5 * TICK_RATE);
  assert.equal(second.state.primary, WEAPON.MGL);
  assert.equal(second.state.mag[WEAPON.MGL], 3);
  assert.ok(second.state.halvedAmmo);
  assert.equal(second.state.health, 50);
  assert.equal(second.state.armor, 100);
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

it('lets only the holder and whoever shoots the holder hurt each other, and frees everyone while nobody holds it', () => {
  const game = new Game({
    maxPlayers: 8, matchMs: 120_000, podiumMs: 5000, warmupMinPlayers: 3,
    modes: 'carrapeta', maps: ['forja'], random: () => 0.9,
  });
  const players = ['One', 'Two', 'Three'].map((name) => {
    const player = game.join(name, 0, WEAPON.RIFLE, () => {});
    assert.ok(typeof player !== 'string');
    return player;
  });
  game.startMatch();
  const flatRow = (): { z: number; x0: number; y: number } => {
    for (let z = -600; z <= 600; z += 60) {
      for (let x0 = -600; x0 <= 400; x0 += 60) {
        const ys = [0, 1, 2].map((i) => game.world.groundBelow(x0 + i * 120, 400, z, PLAYER_RADIUS));
        const clear = !game.world.trace(x0, ys[0] + 40, z, 1, 0, 0, 240);
        if (ys.every((y) => y === ys[0]) && clear) return { z, x0, y: ys[0] };
      }
    }
    throw new Error('no open flat row on the map');
  };
  const row = flatRow();
  players.forEach((player, i) => {
    Object.assign(player.state, { x: row.x0 + i * 120, z: row.z, y: row.y, dropping: false, onGround: true, protect: 0 });
  });
  for (let i = 0; i < 4; i++) game.update();
  const holder = players.find((p) => p.state.primary === WEAPON.MGL);
  assert.ok(holder);
  const [left, middle, right] = players;
  const fire = (shooter: typeof left, target: typeof left) => {
    const eye = shooter.state.y + eyeHeight(shooter.state);
    const dx = target.state.x - shooter.state.x;
    const dy = target.state.y + eyeHeight(target.state) / 2 - eye;
    const length = Math.hypot(dx, dy);
    const shot = { weapon: WEAPON.RIFLE, heavy: false, ox: shooter.state.x, oy: eye, oz: shooter.state.z, dirs: [dx / length, dy / length, 0], tick: game.tick };
    game['handleShot'](shooter, shot, game.now());
  };
  const [stranger, bystander] = [left, middle, right].filter((p) => p !== holder);
  const before = [stranger.state.health, bystander.state.health, holder.state.health];
  fire(stranger, bystander);
  fire(bystander, stranger);
  assert.deepEqual([stranger.state.health, bystander.state.health], [before[0], before[1]], 'nobody but the holder is hurt by a non-holder bullet that is not aimed at the holder');
  fire(stranger, holder);
  assert.ok(holder.state.health < before[2], 'a non-holder hurts the holder');
  fire(holder, bystander);
  assert.ok(bystander.state.health < before[1], 'the holder hurts anyone');

  game['carrapeta'] = { kind: 'dropped', x: 0, y: 0, z: 0, rerollAtTick: game.tick + 600 };
  const healthy = stranger.state.health;
  fire(bystander, stranger);
  assert.ok(stranger.state.health < healthy, 'with nobody holding it, anyone can hurt anyone');
  stranger.state.health = 1;
  const respawnBefore = game.tick;
  game['kill'](stranger, bystander, WEAPON.RIFLE, false);
  assert.ok(stranger.respawnAt - respawnBefore >= CARRAPETA_LOOSE_RESPAWN_EXTRA_TICKS + 1, 'a death with nobody holding it waits longer to respawn');
});

it('never airdrops the Azeitadora in Carrapeta Dourada, while other modes can', () => {
  const airdropOf = (mode: 'carrapeta' | 'ffa', roll = 0) => {
    const game = new Game({ maxPlayers: 8, matchMs: 120_000, podiumMs: 5000, warmupMinPlayers: 3, modes: mode, maps: ['forja'], random: () => roll });
    game['spawnAirdrop']();
    return game['airdrops'][0].w;
  };
  assert.notEqual(airdropOf('carrapeta'), WEAPON.MGL, 'the lowest roll would be the launcher outside the mode');
  assert.equal(airdropOf('ffa'), WEAPON.MGL);
  assert.equal(airdropOf('ffa', 0.19), WEAPON.MGL, 'about two drops in ten are the launcher');
  assert.notEqual(airdropOf('ffa', 0.21), WEAPON.MGL);
});

it('waits until the redraw deadline even if the expired holder is the only one landed', () => {
  const { game, first, second, run } = setup(0.9);
  first.state.dropping = true;
  run(CARRAPETA_MAX_HOLD_SECONDS * TICK_RATE - 1);
  assert.partialDeepStrictEqual(game['carrapeta'], { kind: 'held', holder: second.id });

  run(1);
  assert.equal(game['carrapeta'].kind, 'dropped');
  run(CARRAPETA_REDRAW_WAIT_SECONDS * TICK_RATE - 1);
  assert.equal(game['carrapeta'].kind, 'dropped');

  first.state.dropping = false;
  run(1);
  assert.partialDeepStrictEqual(game['carrapeta'], { kind: 'held', holder: first.id });
  assert.equal(second.state.primary, WEAPON.RIFLE);
  assert.equal(first.state.primary, WEAPON.MGL);
});

it('publishes the hold-limit drop and its redraw deadline in the snapshot', () => {
  const { game, first, second, run, snapshot, messages } = setup(0.9);
  first.state.x = second.state.x - 2 * CTF_PICKUP_RADIUS_UNITS;
  const { x, y, z } = second.state;
  const expiresAtMs = game.now() + CARRAPETA_MAX_HOLD_SECONDS * 1000;
  run(CARRAPETA_MAX_HOLD_SECONDS * TICK_RATE);
  assert.partialDeepStrictEqual(snapshot(), { kind: 'dropped', x, y, z });
  const snap = messages.findLast((m) => m.t === 'snap');
  assert.ok(snap?.ca?.kind === 'dropped');
  assert.ok(Math.abs(snap.ca.rerollAtMs - expiresAtMs - CARRAPETA_REDRAW_WAIT_SECONDS * 1000) < 1);

  run(CARRAPETA_REDRAW_WAIT_SECONDS * TICK_RATE - SNAPSHOT_EVERY_TICKS);
  assert.partialDeepStrictEqual(snapshot(), { kind: 'held', holder: first.id });
  assert.ok(messages.some((m) => m.t === 'ev' && m.e.some((e) => e.k === 'carrapeta' && e.what === 'reroll' && e.by === first.id)));
});

it('lets another player pick up the hold-limit drop before the redraw', () => {
  const { game, first, second, run, messages } = setup(0.9);
  first.state.x = second.state.x - 2 * CTF_PICKUP_RADIUS_UNITS;
  run(CARRAPETA_MAX_HOLD_SECONDS * TICK_RATE);
  Object.assign(first.state, { x: second.state.x, y: second.state.y, z: second.state.z });
  run(SNAPSHOT_EVERY_TICKS);
  assert.partialDeepStrictEqual(game['carrapeta'], { kind: 'held', holder: first.id });
  assert.ok(messages.some((m) => m.t === 'ev' && m.e.some((e) => e.k === 'carrapeta' && e.what === 'take' && e.by === first.id)));
});

it('plays the Batata Quente twice in a match', () => {
  const { game, run } = setup(0.5);
  const starts: number[] = [];
  let was = false;
  for (let i = 0; i < game['opts'].matchMs / 1000 * TICK_RATE - 5; i++) {
    run(1);
    const on = game['frenzy'].kind === 'frenzy';
    if (on && !was) starts.push(i);
    was = on;
  }
  assert.equal(starts.length, 2);
});

it('gives a new holder 100 health and 200 armour, and keeps them out of airdrops and supply stands', () => {
  const { game, first, second, run } = setup(0.9);
  const holder = second.state.primary === WEAPON.MGL ? second : first;
  assert.equal(holder.state.health, 100);
  assert.equal(holder.state.armor, 200);
  holder.state.armor = 150;
  const other = holder === first ? second : first;
  other.state.x = holder.state.x + 3000;
  game['airdrops'] = [{ id: 99, x: holder.state.x, z: holder.state.z, y: holder.state.y, landY: holder.state.y, w: WEAPON.SNIPER, landed: true }];
  run(2);
  assert.equal(game['airdrops'].length, 1, 'the holder does not collect the crate');
  assert.equal(holder.state.armor, 150);
  assert.equal(holder.state.primary, WEAPON.MGL);
});

it('keeps a halved holder away from supply stands', () => {
  const { game, first, second, run } = setup(0.9);
  const holder = second.state.primary === WEAPON.MGL ? second : first;
  holder.state.health = 50;
  const stand = game['map'].supplies[0];
  if (!stand) return;
  holder.state.x = stand.x;
  holder.state.y = stand.y;
  holder.state.z = stand.z;
  run(2);
  assert.equal(holder.state.health, 50);
});

it('caps the armour back to the normal maximum once the Carrapeta is lost', () => {
  const { game, first, second, run } = setup(0.9);
  const holder = second.state.primary === WEAPON.MGL ? second : first;
  const other = holder === first ? second : first;
  game['kill'](holder, other, WEAPON.RIFLE, false);
  holder.respawnAt = Infinity;
  run(1);
  assert.ok(holder.state.armor <= 100);
});
