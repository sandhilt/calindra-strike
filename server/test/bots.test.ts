import { WEAPON } from '@calindra-strike/shared';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Game, type ServerPlayer } from '../src/game.ts';

function setup(opts: { botFill?: number; modes?: 'mixed' | 'ffa' | 'tdm'; matchMs?: number } = {}) {
  let r = 0.31;
  const game = new Game({
    maxPlayers: 16,
    matchMs: opts.matchMs ?? 120_000,
    podiumMs: 5_000,
    warmupMinPlayers: 2,
    modes: opts.modes ?? 'ffa',
    botFill: opts.botFill ?? 6,
    botSkill: 0.6,
    random: () => (r = ((r * 9301 + 49297) % 233280) / 233280),
  });
  const inbox = new Map<number, any[]>();
  const join = (name: string, token = '') => {
    const box: any[] = [];
    const p = game.join(name, 0, WEAPON.RIFLE, (d) => box.push(JSON.parse(d)), token) as ServerPlayer;
    inbox.set(p.id, box);
    return p;
  };
  const bots = () => [...game.players.values()].filter((p) => p.brain);
  return { game, join, inbox, bots };
}

describe('bots', () => {
  it('fill the server up to BOT_FILL while someone is online, and start the match', () => {
    const { game, join, bots } = setup();
    assert.equal((bots()).length, 0);
    join('Gabi');
    assert.equal((bots()).length, 5);
    assert.equal(game.phase, 'live');
    assert.equal(bots().every((b) => b.name.startsWith('BOT ')), true);
  });

  it('make room for real players and leave when the last human does', () => {
    const { game, join, bots } = setup();
    const a = join('A');
    join('B');
    join('C');
    assert.equal((bots()).length, 3);
    assert.equal(game.humanCount(), 3);
    game.leave(a.id);
    assert.equal((bots()).length, 4);
    for (const p of [...game.players.values()]) if (!p.brain) game.leave(p.id);
    assert.equal(game.players.size, 0);
    assert.equal(game.phase, 'warmup');
  });

  it('never block a real player from joining', () => {
    const { game, join, bots } = setup({ botFill: 16 });
    for (let i = 0; i < 16; i++) assert.equal(typeof join(`P${i}`), 'object');
    assert.equal((bots()).length, 0);
    assert.equal(game.humanCount(), 16);
  });

  it('roam the map and fight: someone gets shot within a minute', () => {
    const { game, join, bots } = setup();
    join('Gabi');
    const start = new Map(bots().map((b) => [b.id, { x: b.state.x, z: b.state.z }]));
    for (let i = 0; i < 60 * 60; i++) game.update();
    const moved = bots().filter((b) => Math.hypot(b.state.x - start.get(b.id)!.x, b.state.z - start.get(b.id)!.z) > 300);
    assert.ok(moved.length > 2, "Expected moved.length > 2");
    const kills = [...game.players.values()].reduce((n, p) => n + p.kills, 0);
    const hurt = [...game.players.values()].some((p) => p.deaths > 0 || p.state.health < 100);
    assert.equal(kills > 0 || hurt, true);
  });

  it('only shoot the other team in TDM', () => {
    const { game, join } = setup({ modes: 'tdm', botFill: 8 });
    join('Gabi');
    assert.equal(game.mode, 'tdm');
    for (let i = 0; i < 60 * 45; i++) game.update();
    // no friendly fire on the server means team scores equal total kills
    const total = [...game.players.values()].reduce((n, p) => n + p.kills, 0);
    assert.equal(game.teamScores[0] + game.teamScores[1], total);
    const sizes = [0, 1].map((t) => [...game.players.values()].filter((p) => p.team === t).length);
    assert.ok(Math.abs(sizes[0] - sizes[1]) <= 1, "Expected Math.abs(sizes[0] - sizes[1]) <= 1");
  });
});

describe('map vote', () => {
  it('offers 3 other map/mode combos and plays the most voted one', () => {
    const { game, join, inbox } = setup({ modes: 'mixed', botFill: 0, matchMs: 20_000 });
    const a = join('A');
    const b = join('B');
    (game as any).phaseEnds = game.now();
    game.update();
    assert.equal(game.phase, 'podium');
    const match = inbox.get(a.id)!.filter((m) => m.t === 'match').pop().match;
    assert.equal((match.vote.options).length, 3);
    assert.equal(match.vote.options.some((o: any) => o.map === game.mapIndex && o.mode === game.mode), false);
    const pick = match.vote.options[2];
    assert.deepEqual(game.vote(a, 2), pick, 'an accepted vote returns the option, which the server logs');
    assert.equal(game.vote(a, 2), null, 'a repeat is ignored');
    assert.equal(game.vote(a, 9), null, 'an unknown option is ignored');
    game.vote(b, 2);
    assert.deepEqual(inbox.get(a.id)!.filter((m) => m.t === 'votes').pop().counts, [0, 0, 2]);
    for (let i = 0; i < 5 * 60 + 2; i++) game.update();
    assert.equal(game.phase, 'live');
    assert.deepEqual({ map: game.mapIndex, mode: game.mode }, pick);
  });

  it('follows the normal rotation when nobody votes', () => {
    const { game, join } = setup({ modes: 'mixed', botFill: 0 });
    join('A');
    join('B');
    (game as any).phaseEnds = game.now();
    game.update();
    for (let i = 0; i < 5 * 60 + 2; i++) game.update();
    assert.deepEqual({ map: game.mapIndex, mode: game.mode }, { map: 1, mode: 'ffa' });
  });

  it('ignores votes outside the podium and from bots', () => {
    const { game, join, bots } = setup({ botFill: 4 });
    const a = join('A');
    assert.equal(game.vote(a, 0), null);
    assert.equal((game as any).votes.size, 0);
    (game as any).phaseEnds = game.now();
    game.update();
    assert.equal(game.vote(bots()[0], 1), null);
    assert.equal((game as any).votes.size, 0);
  });
});

describe('rejoin', () => {
  it('gives your score back if you reconnect with your token during the same match', () => {
    const { game, join, inbox } = setup({ botFill: 0 });
    const a = join('Gabi');
    join('B');
    const token = inbox.get(a.id)!.find((m) => m.t === 'welcome').token;
    assert.match(token, /^[0-9a-f]{32}$/);
    a.kills = 7;
    a.deaths = 2;
    game.leave(a.id);
    const again = join('someone else', token);
    assert.equal(again.name, 'Gabi');
    assert.equal(again.kills, 7);
    assert.equal(again.deaths, 2);
    // the token is single use
    game.leave(again.id);
    const third = join('x', 'f'.repeat(32));
    assert.equal(third.kills, 0);
  });
});
