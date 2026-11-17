import assert from 'node:assert/strict';
import { it } from 'node:test';
import { MAX_SPECTATORS, SPECTATOR_PICK_MS, TICK_MS, WEAPON, type ServerMsg } from '@calindra-strike/shared';
import { Game, type GameOptions, type ServerPlayer, type Spectator } from '../src/game.ts';

function setup(opts: Partial<GameOptions> = {}) {
  const game = new Game({ maxPlayers: 1, warmupMinPlayers: 2, matchMs: 100, podiumMs: 100, modes: 'tdm', random: () => 0.2, ...opts });
  const messages: ServerMsg[] = [];
  const spectator = game.spectate('Watcher', d => messages.push(JSON.parse(d))) as Spectator;
  const join = () => game.join('Player', 0, WEAPON.RIFLE, () => {}) as ServerPlayer;
  return { game, spectator, messages, join };
}

it('keeps spectators out of slots, warmup, bots, roster, scores, results and votes', () => {
  const { game, spectator, messages, join } = setup({ botFill: 2 });
  assert.equal(game.phase, 'warmup');
  assert.equal(game.players.size, 0);
  assert.equal(game.humanCount(), 0);
  assert.equal(game.publicStatus().players, 0);
  const player = join();
  assert.equal(typeof player, 'object');
  assert.equal(game.players.size, 2);
  assert.equal(game.humanCount(), 1);
  assert.equal(typeof game.join('Full', 0, WEAPON.RIFLE, () => {}), 'string');
  game.startMatch();
  for (let n = 0; n < 8; n++) game.update();
  for (const msg of messages) {
    if (msg.t === 'roster' || msg.t === 'welcome') assert.ok(!msg.roster.some(r => r[0] === spectator.id));
    if (msg.t === 'score') assert.ok(!msg.s.some(r => r[0] === spectator.id));
    if (msg.t === 'match') assert.ok(!msg.match.results?.some(r => r.id === spectator.id));
  }
  const match = messages.findLast(m => m.t === 'match');
  assert.ok(match?.t === 'match' && match.match.phase === 'podium');
  assert.ok(match.match.vote?.counts.every(n => n === 0));
  assert.ok(messages.some(m => m.t === 'score'));
  assert.ok(messages.some(m => m.t === 'snap' && m.me === null && m.ack === -1));
  game.leaveSpectator(spectator.id);
  assert.equal(game.spectators.size, 0);
});

it('assigns the smaller player team on timeout without counting watchers', () => {
  const { game, spectator, messages, join } = setup();
  const player = join();
  game.tick = Math.ceil(SPECTATOR_PICK_MS / TICK_MS);
  game.update();
  assert.deepEqual(spectator.view, { kind: 'watching', team: 1 - player.team });
  assert.ok(messages.some(m => m.t === 'spectate'));
  game.watch(spectator, player.team);
  assert.deepEqual(spectator.view, { kind: 'watching', team: player.team });
  game.update();
  assert.deepEqual(spectator.view, { kind: 'watching', team: player.team });
});

it('allows team switches, rejects invalid choices, and caps spectators independently', () => {
  const { game, spectator } = setup();
  game.watch(spectator, 2);
  assert.equal(spectator.view.kind, 'choosing');
  game.watch(spectator, 1);
  assert.deepEqual(spectator.view, { kind: 'watching', team: 1 });
  game.watch(spectator, 0);
  assert.deepEqual(spectator.view, { kind: 'watching', team: 0 });
  game.watch(spectator, -1);
  assert.deepEqual(spectator.view, { kind: 'watching', team: 0 });
  for (let i = 1; i < MAX_SPECTATORS; i++) assert.equal(typeof game.spectate('Watcher', () => {}), 'object');
  assert.equal(game.spectate('Overflow', () => {}), 'Sem vaga para espectadores');
});

it('skips FFA choice and reopens it on returning to TDM through rotation', () => {
  const { game, spectator } = setup({ modes: ['ffa', 'tdm'], warmupMinPlayers: 1 });
  assert.deepEqual(spectator.view, { kind: 'watching', team: -1 });
  game.watch(spectator, 0);
  assert.deepEqual(spectator.view, { kind: 'watching', team: -1 });
  game.startMatch();
  for (let n = 0; n < 14; n++) game.update();
  assert.equal(game.mode, 'tdm');
  assert.equal(spectator.view.kind, 'choosing');
});

it('delivers chat and global events, keeping private combat events private', () => {
  const { game, messages, join } = setup();
  const player = join();
  player.events.push({ k: 'team', id: player.id, team: 0, auto: 0 });
  game.chat(player, 'hello');
  game.update();
  assert.ok(messages.some(m => m.t === 'chat'));
  assert.ok(messages.some(m => m.t === 'ev' && m.e.some(e => e.k === 'join')));
  assert.ok(!messages.some(m => m.t === 'ev' && m.e.some(e => e.k === 'team')));
});

it('adapter ignores spectator input/chat/loadout/vote/team, permits watch/ping and cleans up', async () => {
  const { readFile } = await import('node:fs/promises');
  const { stripTypeScriptTypes } = await import('node:module');
  const { EventEmitter } = await import('node:events');
  const { parseClientMessage, PROTOCOL_VERSION } = await import('@calindra-strike/shared');
  const source = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  const handler = source.slice(source.indexOf('function onConnection('), source.indexOf('// ------------------------------------------------------------------ loop'));
  const { game } = setup();
  game.spectators.clear();
  class Socket extends EventEmitter {
    OPEN = 1;
    readyState = 1;
    bufferedAmount = 0;
    messages: ServerMsg[] = [];
    send(data: string) { this.messages.push(JSON.parse(data)); }
    ping() {}
    terminate() { this.emit('close'); }
    close() { this.emit('close'); }
  }
  const ws = new Socket();
  const bind = new Function('game', 'parseClientMessage', 'PROTOCOL_VERSION', `
    let connections = 0;
    const sockets = new Set(), perIp = new Map();
    const SEND_BUFFER_HARD = 2000000, SEND_BUFFER_SOFT = 256000;
    const TokenBucket = class { take() { return true; } };
    const log = () => {}, codeMatches = () => true, sanitizeName = x => x;
    ${stripTypeScriptTypes(handler)}
    return onConnection;
  `)(game, parseClientMessage, PROTOCOL_VERSION);
  bind(ws, 'test');
  const send = (msg: object) => ws.emit('message', Buffer.from(JSON.stringify(msg)), false);
  try {
    send({ t: 'hello', v: PROTOCOL_VERSION, name: 'Watcher', color: 0, primary: WEAPON.RIFLE, spectate: true });
    const spectator = [...game.spectators.values()][0];
    assert.ok(spectator);
    let actions = 0;
    game.input = game.chat = game.setLoadout = game.vote = game.switchTeam = () => { actions++; };
    send({ t: 'in', c: [] });
    send({ t: 'chat', text: 'ghosting' });
    send({ t: 'loadout', primary: WEAPON.RIFLE });
    send({ t: 'vote', option: 0 });
    send({ t: 'team', team: 0 });
    assert.equal(actions, 0);
    send({ t: 'watch', team: 1 });
    assert.deepEqual(spectator.view, { kind: 'watching', team: 1 });
    send({ t: 'ping', c: 123 });
    assert.ok(ws.messages.some(m => m.t === 'pong'));
    assert.equal(game.players.size, 0);
  } finally { ws.emit('close'); }
  assert.equal(game.spectators.size, 0);
});
