import { it } from 'node:test';
import assert from 'node:assert/strict';
import { BLACK_FRIDAY_FUSE_MS, BOMB_DESK_SIZE_UNITS, PLAYER_RADIUS, STAND_HEIGHT, BOMB_DROPPED_TICKS, BTN, DEBUG_SCENARIO_COUNT, DEFUSE_TICKS, FUSE_TICKS, PLANT_TICKS, SNAPSHOT_EVERY_TICKS, TICK_MS, WEAPON, type GameMode, type ServerMsg } from '@calindra-strike/shared';
import { bombStandBox, type BombPlaces, type BombState } from '@calindra-strike/shared';
import { Game, type ServerPlayer } from '../src/game.ts';

function setup(defuseLimit = 5, mode: GameMode = 'defuse', random = () => 0.5) {
  const messages: ServerMsg[] = [];
  const game = new Game({ maxPlayers: 16, matchMs: 600000, podiumMs: 5000, warmupMinPlayers: 2, modes: mode, defuseLimit, random });
  const players: ServerPlayer[] = [];
  for (let i = 0; i < 4; i++) {
    const p = game.join('P' + i, 0, WEAPON.RIFLE, (data) => messages.push(JSON.parse(data)));
    assert.notEqual(typeof p, 'string');
    players.push(p as ServerPlayer);
  }
  const attackers = (game as any).attackers as number;
  const attacker = players.find((p) => p.team === attackers) as ServerPlayer;
  const defender = players.find((p) => p.team !== attackers) as ServerPlayer;
  return { game, players, messages, attacker, defender };
}
function place(game: Game, p: ServerPlayer, base: number, using = false) {
  const at = game.map.flagBases[base];
  Object.assign(p.state, { ...at, y: game.world.groundBelow(at.x, game.map.dropHeight, at.z, 16), dropping: false, protect: 0 });
  p.using = using;
}
function run(game: Game, ticks: number) {
  for (let i = 0; i < ticks; i++) game.update();
}
function snapshot(game: Game, messages: ServerMsg[]) {
  for (let i = 0; i < SNAPSHOT_EVERY_TICKS; i++) game.update();
  const snap = messages.findLast((m) => m.t === 'snap');
  assert.ok(snap?.t === 'snap');
  return snap;
}
const attackSite = (game: Game, attackers: number) => 1 - attackers;

/** Takes the bomb at home, plants it at the site and returns the planting time. */
function plant(game: Game, attacker: ServerPlayer, defender: ServerPlayer) {
  const attackers = attacker.team;
  place(game, defender, attackers, false);
  defender.alive = false;
  defender.respawnAt = Infinity;
  place(game, attacker, attackers);
  game.update();
  place(game, attacker, attackSite(game, attackers), true);
  run(game, PLANT_TICKS + 1);
  return game.now();
}

it('plants after the plant time and explodes for the attackers, then the sides swap', () => {
  const { game, attacker, defender, messages } = setup();
  const attackers = attacker.team;
  plant(game, attacker, defender);
  const snap = snapshot(game, messages);
  assert.equal(snap.bm[0], 4);
  assert.equal(snap.bm[8], attackers);
  assert.ok(snap.bm[7] >= 0 && snap.bm[7] < DEBUG_SCENARIO_COUNT);
  attacker.using = false;
  attacker.alive = false;
  attacker.respawnAt = Infinity;
  const explodeAt = snap.bm[5];
  assert.ok(explodeAt > game.now());
  while (game.now() < explodeAt - TICK_MS) game.update();
  assert.deepEqual(game.teamScores, [0, 0]);
  run(game, 2);
  assert.equal(game.teamScores[attackers], 1);
  assert.equal(game.teamScores[1 - attackers], 0);
  assert.equal((game as any).attackers, 1 - attackers);
  const after = snapshot(game, messages);
  assert.equal(after.bm[0], 0);
  assert.equal(after.bm[8], 1 - attackers);
  assert.ok(messages.some((m) => m.t === 'ev' && m.e.some((e) => e.k === 'bomb' && e.what === 'exploded' && e.team === attackers)));
  assert.equal(attacker.kills, 0);
});

it('a defender holding use scores the round for the defenders', () => {
  const { game, attacker, defender, messages } = setup();
  const attackers = attacker.team;
  plant(game, attacker, defender);
  attacker.using = false;
  attacker.alive = false;
  attacker.respawnAt = Infinity;
  defender.alive = true;
  place(game, defender, attackSite(game, attackers), true);
  game.update();
  const started = snapshot(game, messages);
  assert.equal(started.bm[1], defender.id);
  assert.ok(started.bm[6] > game.now());
  run(game, DEFUSE_TICKS);
  assert.equal(game.teamScores[1 - attackers], 1);
  assert.equal(game.teamScores[attackers], 0);
  assert.equal((game as any).attackers, 1 - attackers);
  assert.ok(messages.some((m) => m.t === 'ev' && m.e.some((e) => e.k === 'bomb' && e.what === 'defused' && e.by === defender.id)));
  assert.equal(snapshot(game, messages).bm[8], 1 - attackers);
});

it('releasing use while defusing resets the progress', () => {
  const { game, attacker, defender, messages } = setup();
  plant(game, attacker, defender);
  attacker.alive = false;
  attacker.respawnAt = Infinity;
  defender.alive = true;
  place(game, defender, attackSite(game, attacker.team), true);
  run(game, DEFUSE_TICKS - 5);
  defender.using = false;
  run(game, 2);
  assert.equal(snapshot(game, messages).bm[6], 0);
  assert.deepEqual(game.teamScores, [0, 0]);
});

it('a dead carrier drops the bomb where it fell and, left on the floor, it goes to the other team', () => {
  const { game, attacker, defender, messages } = setup();
  place(game, attacker, attacker.team);
  game.update();
  assert.deepEqual(snapshot(game, messages).bm.slice(0, 2), [1, attacker.id]);
  attacker.state.x += 120;
  (game as any).kill(attacker, defender, WEAPON.RIFLE, false);
  const dropped = snapshot(game, messages);
  assert.equal(dropped.bm[0], 3);
  assert.equal(dropped.bm[2], attacker.state.x);
  assert.equal(attacker.kills, 0);
  assert.ok(dropped.bm[5] > game.now(), 'the hand-over deadline is published');
  const attackers = attacker.team;
  attacker.respawnAt = Infinity;
  run(game, BOMB_DROPPED_TICKS);
  const after = snapshot(game, messages);
  assert.equal(after.bm[0], 0);
  assert.equal(after.bm[8], 1 - attackers, 'sides swapped');
  assert.deepEqual(game.teamScores, [0, 0]);
  assert.ok(messages.some((m) => m.t === 'ev' && m.e.some((e) => e.k === 'bomb' && e.what === 'abandoned' && e.team === 1 - attackers)));
});

it('leaving the match drops a carried bomb', () => {
  const { game, attacker, messages } = setup();
  place(game, attacker, attacker.team);
  game.update();
  game.leave(attacker.id);
  assert.equal(snapshot(game, messages).bm[0], 3);
});

it('ends the match at the round limit with the winning team', () => {
  const { game, attacker, defender, messages } = setup(1);
  plant(game, attacker, defender);
  attacker.alive = false;
  attacker.respawnAt = Infinity;
  run(game, FUSE_TICKS);
  run(game, 2);
  assert.equal(game.phase, 'podium');
  const match = messages.findLast((m) => m.t === 'match');
  assert.ok(match?.t === 'match');
  assert.equal(match.match.limit, 1);
  assert.equal(match.match.winner, attacker.team);
});

it('publishes the limit and an empty bomb outside the mode', () => {
  for (const mode of ['defuse', 'ctf', 'tdm', 'ffa'] as const) {
    const { game, messages } = setup(5, mode);
    const snap = snapshot(game, messages);
    if (mode === 'defuse') assert.equal(snap.bm.length, 12);
    else assert.deepEqual(snap.bm, []);
    const match = messages.findLast((m) => m.t === 'match') ?? { t: 'match', match: (game as any).matchInfo() };
    assert.ok(match.t === 'match');
  }
});

it('uses the injected random for the planted variant', () => {
  const { game, attacker, defender, messages } = setup();
  plant(game, attacker, defender);
  assert.equal(snapshot(game, messages).bm[7], Math.floor(0.5 * DEBUG_SCENARIO_COUNT));
});

it('input use bit is read from the processed command', () => {
  const { game, attacker } = setup();
  place(game, attacker, attacker.team);
  attacker.queue.push({ seq: 1, buttons: BTN.USE, yaw: 0, pitch: 0, weapon: 0, interp: 0 });
  game.update();
  assert.equal(attacker.using, true);
  attacker.queue.push({ seq: 2, buttons: 0, yaw: 0, pitch: 0, weapon: 0, interp: 0 });
  game.update();
  assert.equal(attacker.using, false);
});

it('warmup runs the objective as unscored practice so a lone player can plant and defuse', () => {
  const messages: ServerMsg[] = [];
  const game = new Game({ maxPlayers: 16, matchMs: 600000, podiumMs: 5000, warmupMinPlayers: 99, modes: 'defuse', random: () => 0.5 });
  const players = [0, 1].map((i) => game.join('W' + i, 0, WEAPON.RIFLE, (data) => messages.push(JSON.parse(data))) as ServerPlayer);
  const attackers = (game as any).attackers as number;
  const attacker = players.find((p) => p.team === attackers) as ServerPlayer;
  const defender = players.find((p) => p.team !== attackers) as ServerPlayer;
  assert.equal(game.phase, 'warmup');
  plant(game, attacker, defender);
  assert.equal(snapshot(game, messages).bm[0], 4, 'planted during warmup');
  const at = snapshot(game, messages).bm;
  attacker.using = false;
  defender.alive = true;
  Object.assign(defender.state, { x: at[2], y: at[3], z: at[4], dropping: false });
  defender.using = true;
  run(game, DEFUSE_TICKS + 2);
  assert.deepEqual(game.teamScores, [0, 0], 'warmup defuse does not score');
  assert.ok(messages.some((m) => m.t === 'ev' && m.e.some((e) => e.k === 'bomb' && e.what === 'defused')), 'defused event sent');
  assert.equal(game.phase, 'warmup');
});

it('installs the planted desk and publishes the Black Friday fuse', () => {
  const { game, attacker, defender, messages } = setup(5, 'defuse', () => 0);
  assert.equal(snapshot(game, messages).bm[10], 1);
  const plantedAt = plant(game, attacker, defender);
  const { bm } = snapshot(game, messages);
  assert.equal(bm[0], 4);
  assert.equal(bm[10], 1);
  assert.ok(Math.abs(bm[5] - plantedAt - BLACK_FRIDAY_FUSE_MS) <= 1);

  const [, , x, y, z] = bm;
  const contact = BOMB_DESK_SIZE_UNITS / 2 + PLAYER_RADIUS;
  assert.equal(game.world.clipAxis(x - contact, y, z, STAND_HEIGHT, 0, 1), 0);
});

it('installs bomb stands at the exact coordinates sent in snapshots', (t) => {
  const { game, attacker, messages } = setup();
  const objective = game as unknown as { bomb: BombState; bombPlaces(): BombPlaces };
  const places = objective.bombPlaces();
  const home = { ...places.home, x: places.home.x + 0.04 };
  t.mock.method(objective, 'bombPlaces', () => ({ ...places, home }));
  const setProp = t.mock.method(game.world, 'setProp');

  const { bm: homeRow } = snapshot(game, messages);
  const [, , homeX, homeY, homeZ] = homeRow;
  assert.equal(homeRow[0], 0);
  assert.deepEqual(setProp.mock.calls.at(-1)?.arguments[0], bombStandBox('home', { x: homeX, y: homeY, z: homeZ }));

  place(game, attacker, attacker.team);
  game.update();
  place(game, attacker, attackSite(game, attacker.team), true);
  attacker.state.x += 0.04;
  attacker.state.z += 0.06;
  run(game, PLANT_TICKS + 1);

  const { bm: plantedRow } = snapshot(game, messages);
  const [, , x, y, z] = plantedRow;
  assert.equal(plantedRow[0], 4);
  assert.partialDeepStrictEqual(objective.bomb, { x, y, z });
  assert.deepEqual(setProp.mock.calls.at(-1)?.arguments[0], bombStandBox('planted', { x, y, z }));
});

it('the plant window runs out: nobody scores, the sides swap and the laptop comes back with another scenario', () => {
  const { game, messages } = setup(5, 'defuse', () => 0.5);
  const before = (game as any).attackers as number;
  const variant = snapshot(game, messages).bm[7];
  const window = snapshot(game, messages).bm[11];
  assert.ok(window > 0, 'the deadline is published while nothing is planted');
  run(game, Math.ceil(game.plantTimeoutMs / TICK_MS) + 2);
  assert.equal((game as any).attackers, 1 - before);
  assert.deepEqual(game.teamScores, [0, 0]);
  assert.ok(messages.some((m) => m.t === 'ev' && m.e.some((e) => e.k === 'bomb' && e.what === 'expired' && e.team === 1 - before)));
  const next = snapshot(game, messages).bm;
  assert.notEqual(next[7], variant);
  assert.equal(next[0], 0);
  assert.ok(next[11] > window, 'the new round gets a fresh window');
});

it('a plant window of zero never hands the laptop over', () => {
  const messages: ServerMsg[] = [];
  const game = new Game({ maxPlayers: 16, matchMs: 600000, podiumMs: 5000, warmupMinPlayers: 2, modes: 'defuse', plantTimeoutMs: 0, random: () => 0.5 });
  for (let i = 0; i < 2; i++) game.join('P' + i, 0, WEAPON.RIFLE, (data) => messages.push(JSON.parse(data)));
  const before = (game as any).attackers as number;
  run(game, 130 * 60);
  assert.equal((game as any).attackers, before);
  assert.equal(snapshot(game, messages).bm[11], 0);
});

it('Black Friday can switch on in the middle of a round and cuts a fuse already burning', () => {
  // 0.19 marks the round and puts its moment 342 ticks in, after the 181 ticks the plant takes.
  const { game, attacker, defender, messages } = setup(5, 'defuse', () => 0.19);
  assert.equal(snapshot(game, messages).bm[10], 0, 'not on at the start of the round');
  const plantedAt = plant(game, attacker, defender);
  const { bm } = snapshot(game, messages);
  assert.equal(bm[0], 4);
  assert.equal(bm[10], 1, 'a marked round is Black Friday once the bug is planted');
  assert.ok(Math.abs(bm[5] - plantedAt - BLACK_FRIDAY_FUSE_MS) <= 1);
});

it('Black Friday strikes a round that is already running, in about one round in five', () => {
  let seed = 12345;
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const { game, messages } = setup(0, 'defuse', random);
  const rounds = 400;
  let marked = 0;
  let turnsLater = 0;
  for (let i = 0; i < rounds; i++) {
    (game as any).startBombRound();
    const at = (game as any).bombRound.blackFridayAtTick as number | undefined;
    if (at === undefined) continue;
    marked++;
    if (at > game.tick) turnsLater++;
  }
  assert.ok(marked / rounds >= 0.15 && marked / rounds <= 0.3, `marked share ${marked / rounds}`);
  assert.ok(turnsLater > marked / 2, 'most marked rounds start normal and turn on later');
  assert.equal(snapshot(game, messages).bm.length, 12);
});

it('the plant window does not run down in warmup while nobody is on the attacking side', () => {
  const messages: ServerMsg[] = [];
  const game = new Game({ maxPlayers: 16, matchMs: 600000, podiumMs: 5000, warmupMinPlayers: 99, modes: 'defuse', plantTimeoutMs: 5000, random: () => 0.5 });
  const players = [0, 1].map((i) => game.join('W' + i, 0, WEAPON.RIFLE, (data) => messages.push(JSON.parse(data))) as ServerPlayer);
  const before = (game as any).attackers as number;
  const attacker = players.find((p) => p.team === before) as ServerPlayer;
  attacker.alive = false;
  attacker.respawnAt = Infinity;
  run(game, 10 * 60);
  assert.equal((game as any).attackers, before, 'the laptop stays put with nobody to plant it');
  attacker.alive = true;
  run(game, 4 * 60);
  assert.equal((game as any).attackers, before, 'the full window is still ahead once someone is there');
  run(game, 2 * 60);
  assert.equal((game as any).attackers, 1 - before);
});

it('every plant timeout re-evaluates Black Friday for the round the laptop moves to', () => {
  let roll = 0.5;
  const messages: ServerMsg[] = [];
  const game = new Game({ maxPlayers: 16, matchMs: 600000, podiumMs: 5000, warmupMinPlayers: 2, modes: 'defuse', plantTimeoutMs: 4000, random: () => roll });
  for (let i = 0; i < 2; i++) game.join('P' + i, 0, WEAPON.RIFLE, (data) => messages.push(JSON.parse(data)));
  const round = () => (game as any).bombRound as { blackFriday: boolean; blackFridayAtTick?: number; plantByTick?: number };
  const timeoutTicks = Math.ceil(4000 / TICK_MS);
  for (const marked of [true, false, true, false]) {
    roll = marked ? 0.1 : 0.9;
    const before = (game as any).attackers as number;
    run(game, timeoutTicks + 1);
    assert.equal((game as any).attackers, 1 - before, 'the timeout moved the laptop');
    assert.equal(round().blackFridayAtTick !== undefined, marked, 'a fresh roll on every timeout, not carried over');
    assert.equal(round().blackFriday, false, 'the new round starts without Black Friday');
    const at = round().blackFridayAtTick;
    if (at !== undefined) assert.ok(at < (round().plantByTick as number), 'it turns on before the window can close');
  }
});

it('a match without a lucky roll still gets a Black Friday, and only one is forced', () => {
  const messages: ServerMsg[] = [];
  const game = new Game({ maxPlayers: 16, matchMs: 600000, podiumMs: 5000, warmupMinPlayers: 2, modes: 'defuse', plantTimeoutMs: 4000, random: () => 0.9 });
  for (let i = 0; i < 2; i++) game.join('P' + i, 0, WEAPON.RIFLE, (data) => messages.push(JSON.parse(data)));
  const round = () => (game as any).bombRound as { blackFriday: boolean; blackFridayAtTick?: number };
  const timeoutTicks = Math.ceil(4000 / TICK_MS);
  const seen: boolean[] = [];
  for (let n = 1; n <= 5; n++) {
    while (game.tick < n * timeoutTicks - 2) game.update();
    seen.push(round().blackFriday);
    run(game, 4);
  }
  assert.deepEqual(seen, [false, false, true, false, false], 'the 3rd round is Black Friday by the time its window closes, the others are not');
});

it('the planter steps back off the desk that appears under their feet', () => {
  const { game, attacker, defender } = setup();
  const yaw = Math.PI / 2;
  attacker.state.yaw = yaw;
  plant(game, attacker, defender);
  const bomb = (game as any).bomb as BombState;
  assert.equal(bomb.kind, 'planted');
  const box = bombStandBox('planted', bomb as Extract<BombState, { kind: 'planted' }>);
  assert.ok(box);
  const s = attacker.state;
  const clearX = s.x + PLAYER_RADIUS <= box.min.x || s.x - PLAYER_RADIUS >= box.max.x;
  const clearZ = s.z + PLAYER_RADIUS <= box.min.z || s.z - PLAYER_RADIUS >= box.max.z;
  assert.ok(clearX || clearZ, 'the planter is outside the desk footprint');
  assert.ok(!game.world.hullOverlaps(s.x, s.y, s.z, STAND_HEIGHT), 'the planter is not stuck in any solid');
  const back = { x: Math.sin(yaw), z: Math.cos(yaw) };
  assert.ok((s.x - bomb.x) * back.x + (s.z - bomb.z) * back.z > 0, 'pushed behind where they faced');
  assert.ok(Math.hypot(s.x - bomb.x, s.z - bomb.z) < BOMB_DESK_SIZE_UNITS, 'still right next to the laptop');
});
