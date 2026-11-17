import { it } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld, CTF_RETURN_TICKS, SNAPSHOT_EVERY_TICKS, TICK_MS, WEAPON, getMaps, type ServerMsg, type GameMode } from '@calindra-strike/shared';
import { Game, type ServerPlayer } from '../src/game.ts';
import { NavGrid } from '../src/nav.ts';

function setup(count = 2, mode: GameMode = 'ctf', ctfLimit = 1) {
  const messages: ServerMsg[] = [];
  const game = new Game({ maxPlayers: 16, matchMs: 120000, podiumMs: 5000, warmupMinPlayers: 2, modes: mode, ctfLimit, random: () => 0.4 });
  const players: ServerPlayer[] = [];
  for (let i = 0; i < count; i++) {
    const p = game.join('P' + i, 0, WEAPON.RIFLE, (data) => messages.push(JSON.parse(data)));
    assert.notEqual(typeof p, 'string');
    players.push(p as ServerPlayer);
  }
  return { game, players, messages };
}
function place(game: Game, p: ServerPlayer, base: number) {
  const at = game.map.flagBases[base];
  Object.assign(p.state, { ...at, y: game.world.groundBelow(at.x, game.map.dropHeight, at.z, 16), dropping: false, protect: 0 });
}
function snapshot(game: Game, messages: ServerMsg[]) {
  for (let i = 0; i < SNAPSHOT_EVERY_TICKS; i++) game.update();
  const snap = messages.findLast((m) => m.t === 'snap');
  assert.ok(snap?.t === 'snap');
  return snap;
}
it('captures, publishes global events and capture scores, and ends at the limit', () => {
  const { game, players, messages } = setup();
  const p = players[0];
  place(game, p, 1 - p.team);
  game.update();
  assert.deepEqual(snapshot(game, messages).fl[1 - p.team].slice(0, 2), [1, p.id]);
  place(game, p, p.team);
  game.update();
  assert.equal(game.teamScores[p.team], 1);
  assert.equal(p.kills, 0);
  game.update();
  assert.equal(game.phase, 'podium');
  const match = messages.findLast((m) => m.t === 'match');
  assert.ok(match?.t === 'match');
  assert.equal(match.match.limit, 1);
  assert.equal(match.match.winner, p.team);
  assert.ok(messages.some((m) => m.t === 'ev' && m.e.some((e) => e.k === 'flag' && e.what === 'capture')));
  assert.ok(snapshot(game, messages).fl.every((row) => row[0] === 0));
});
it('drops on death with a server-clock return deadline and keeps kills personal', () => {
  const { game, players, messages } = setup();
  const [p, enemy] = players;
  place(game, p, 1 - p.team);
  game.update();
  (game as any).kill(p, enemy, WEAPON.RIFLE, false);
  const snap = snapshot(game, messages);
  assert.deepEqual(snap.fl[1 - p.team], [2, -1, p.state.x, 0, p.state.z, Math.round((1 + CTF_RETURN_TICKS) * TICK_MS)]);
  assert.deepEqual(game.teamScores, [0, 0]);
  assert.equal(enemy.kills, 1);
});
it('settles a flag dropped mid-air on the floor so it can be picked up', () => {
  const { game, players, messages } = setup();
  const [p, enemy] = players;
  place(game, p, 1 - p.team);
  game.update();
  p.state.y = 300;
  (game as any).kill(p, enemy, WEAPON.RIFLE, false);
  assert.equal(snapshot(game, messages).fl[1 - p.team][3], 0);
});
it('drops on leaving and on a permitted team switch', () => {
  for (const leave of [true, false]) {
    const { game, players, messages } = setup(3);
    const p = players.find((p) => players.filter((q) => q.team === p.team).length === 2)!;
    const flagTeam = 1 - p.team;
    place(game, p, flagTeam);
    game.update();
    if (leave) game.leave(p.id);
    else game.switchTeam(p, flagTeam);
    assert.equal(snapshot(game, messages).fl[flagTeam][0], 2);
  }
});
it('publishes home positions and empty flags outside CTF', () => {
  for (const mode of ['ctf', 'tdm', 'ffa'] as const) {
    const { game, messages } = setup(2, mode);
    const fl = snapshot(game, messages).fl;
    assert.deepEqual(fl, mode === 'ctf' ? game.map.flagBases.map((b) => [0, -1, b.x, 0, b.z, 0]) : []);
    if (mode === 'ctf') assert.deepEqual(game.publicStatus().teams, [0, 0]);
  }
});
it('uses team spawn halves and supports spectator team selection', () => {
  const { game, players } = setup();
  for (const p of players) assert.ok(p.team === 0 ? p.state.z <= -150 : p.state.z >= 150);
  const spectator = game.spectate('viewer', () => {});
  assert.ok(typeof spectator !== 'string');
  assert.equal(spectator.view.kind, 'choosing');
  game.watch(spectator, 1);
  assert.deepEqual(spectator.view, { kind: 'watching', team: 1 });
});
it('timer-only CTF ends with the capture winner or a draw', () => {
  for (const capture of [true, false]) {
    const { game, players, messages } = setup(2, 'ctf', 0);
    const p = players[0];
    if (capture) {
      place(game, p, 1 - p.team); game.update();
      place(game, p, p.team); game.update();
      game.update();
      assert.equal(game.phase, 'live');
    }
    game.phaseEnds = game.now();
    game.update();
    const match = messages.findLast((m) => m.t === 'match');
    assert.ok(match?.t === 'match');
    assert.equal(match.match.winner, capture ? p.team : -1);
  }
});
for (const map of getMaps()) it('bots can reach both flag bases on ' + map.id, () => {
  const world = new CollisionWorld(map);
  const nav = new NavGrid(world, map);
  const nodes = map.flagBases.map((b) => nav.nearest(b.x, 0, b.z));
  const [north, south] = nodes;
  assert.ok(north && south);
  for (const [i, node] of nodes.entries()) {
    assert.ok(node);
    assert.ok(Math.hypot(node.x - map.flagBases[i].x, node.z - map.flagBases[i].z) <= 48);
    assert.equal(node.y, 0);
  }
  assert.ok(nav.findPath(north, south));
  assert.ok(nav.findPath(south, north));
});
