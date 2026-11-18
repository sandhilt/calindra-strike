import assert from 'node:assert/strict';
import { it } from 'node:test';
import { TICK_MS, WEAPON, type KickReason, type ServerMsg } from '@calindra-strike/shared';
import { Game, type GameOptions, type ServerPlayer } from '../src/game.ts';

const READY_TIMEOUT_MS = 20_000;
const IDLE_TIMEOUT_MS = 30_000;

function setup(opts: Partial<GameOptions> = {}) {
  const kicks: [number, KickReason][] = [];
  const game = new Game({
    maxPlayers: 8, warmupMinPlayers: 1, matchMs: 60_000, podiumMs: 5_000, modes: 'ffa', random: () => 0.3,
    requireReady: true, readyKickMs: READY_TIMEOUT_MS, onKick: (id, reason) => kicks.push([id, reason]), ...opts,
  });
  const join = (name: string) => {
    const messages: ServerMsg[] = [];
    const p = game.join(name, 0, WEAPON.RIFLE, (d) => messages.push(JSON.parse(d))) as ServerPlayer;
    return { p, messages };
  };
  const runFor = (ms: number) => { for (let i = 0; i < Math.ceil(ms / TICK_MS); i++) game.update(); };
  return { game, kicks, join, runFor };
}

it('keeps a new player out of the world, and out of the warmup count, until they confirm', () => {
  const { game, join, runFor } = setup();
  const { p, messages } = join('Gabi');
  const welcome = messages.find((m) => m.t === 'welcome');
  assert.ok(welcome?.t === 'welcome');
  assert.deepEqual(welcome.ready, { kind: 'pending', kickAt: game.now() + READY_TIMEOUT_MS });
  runFor(3_000);
  assert.equal(p.alive, false, 'pending player is never spawned, so nothing can hit them');
  assert.equal(game.phase, 'warmup');
  game.ready(p);
  assert.deepEqual(p.ready, { kind: 'confirmed' });
  assert.equal(p.alive, true);
  assert.equal(game.phase, 'live');
});

it('kicks a player who does not confirm within the timeout', () => {
  const { game, kicks, join, runFor } = setup();
  const { p } = join('Afk');
  runFor(READY_TIMEOUT_MS - 100);
  assert.deepEqual(kicks, []);
  runFor(200);
  assert.deepEqual(kicks, [[p.id, 'afk']]);
  assert.equal(game.players.has(p.id), false);
});

it('kicks players still pending when the match ends and leaves them out of the results', () => {
  const { game, kicks, join, runFor } = setup({ matchMs: 5_000 });
  const { p: ready, messages } = join('Ready');
  game.ready(ready);
  const late = join('Late').p;
  runFor(5_100);
  assert.equal(game.phase, 'podium');
  assert.deepEqual(kicks, [[late.id, 'podium']]);
  assert.equal(game.players.has(ready.id), true);
  const podium = messages.findLast((m) => m.t === 'match');
  assert.ok(podium?.t === 'match' && podium.match.phase === 'podium');
  assert.deepEqual(podium.match.results?.map((r) => r.id), [ready.id]);
});

it('starts the window of a player who joins on the podium when the next match starts', () => {
  const { game, kicks, join, runFor } = setup({ matchMs: 1_000, podiumMs: READY_TIMEOUT_MS });
  game.ready(join('Ready').p);
  runFor(1_100);
  assert.equal(game.phase, 'podium');
  const { p, messages } = join('Podium');
  const welcome = messages.find((m) => m.t === 'welcome');
  assert.ok(welcome?.t === 'welcome');
  assert.deepEqual(welcome.ready, { kind: 'pending', kickAt: game.phaseEnds + READY_TIMEOUT_MS });
  runFor(READY_TIMEOUT_MS + 500);
  assert.equal(game.phase, 'warmup', 'every human is on "pronto" once the podium ends');
  assert.deepEqual(kicks, [], 'the podium does not eat into the window');
  assert.equal(p.alive, false);
  game.ready(p);
  assert.equal(p.alive, true);
  assert.equal(game.phase, 'live');
});

it('asks everybody to confirm again when the next match starts, and kicks who does not', () => {
  const { game, kicks, join, runFor } = setup({ matchMs: 30_000, podiumMs: 2_000 });
  const active = join('Active');
  const afk = join('Afk');
  game.ready(active.p);
  game.ready(afk.p);
  runFor(30_100);
  assert.equal(game.phase, 'podium');
  while (game.phase === 'podium') game.update();
  const window = { kind: 'pending', kickAt: game.now() + READY_TIMEOUT_MS };
  assert.deepEqual(active.messages.findLast((m) => m.t === 'readiness'), { t: 'readiness', ready: window });
  assert.deepEqual(active.p.ready, window);
  assert.equal(game.phase, 'warmup', 'nobody confirmed, so the next match waits');
  assert.equal(active.p.alive, false, 'out of the world, untouchable, until the click');
  game.ready(active.p);
  assert.equal(active.p.alive, true);
  assert.equal(game.phase, 'live');
  runFor(READY_TIMEOUT_MS + 200);
  assert.deepEqual(kicks, [[afk.p.id, 'afk']]);
  assert.equal(game.players.has(active.p.id), true);
});

it('lets the next match run on bots while the humans are still on "pronto"', () => {
  const { game, join, runFor } = setup({ matchMs: 1_000, podiumMs: 2_000, botFill: 3 });
  const { p } = join('Human');
  game.ready(p);
  runFor(1_100);
  runFor(2_100);
  assert.equal(game.phase, 'live');
  assert.equal(p.alive, false);
  assert.equal([...game.players.values()].some((q) => q.brain && q.alive), true, 'bots are playing');
  game.ready(p);
  assert.equal(p.alive, true);
});

it('does not ask again when the ready screen is off, and waits forever when it never kicks', () => {
  const off = setup({ matchMs: 1_000, podiumMs: 2_000, requireReady: false });
  const a = off.join('A');
  off.runFor(3_300);
  assert.equal(a.messages.some((m) => m.t === 'readiness'), false);
  assert.equal(a.p.alive, true);
  const gentle = setup({ matchMs: 1_000, podiumMs: 2_000, readyKickMs: 0 });
  const b = gentle.join('B');
  gentle.game.ready(b.p);
  gentle.runFor(3_300);
  assert.deepEqual(b.p.ready, { kind: 'pending', kickAt: null });
  gentle.runFor(READY_TIMEOUT_MS * 3);
  assert.deepEqual(gentle.kicks, []);
});

it('starts the warmup when the bot replacing a kicked player completes it', () => {
  const { game, join, runFor } = setup({ warmupMinPlayers: 2, botFill: 2 });
  const ready = join('Ready').p;
  join('Afk');
  game.ready(ready);
  assert.equal(game.phase, 'warmup');
  runFor(READY_TIMEOUT_MS + 100);
  assert.equal(game.phase, 'live');
});

it('keeps bots that replace kicked players off the podium', () => {
  const { game, join, runFor } = setup({ matchMs: 5_000, botFill: 2 });
  const { p: ready, messages } = join('Ready');
  game.ready(ready);
  join('Late');
  runFor(5_100);
  const podium = messages.findLast((m) => m.t === 'match');
  assert.ok(podium?.t === 'match' && podium.match.phase === 'podium');
  assert.deepEqual(podium.match.results?.map((r) => r.id), [ready.id]);
  assert.equal(game.players.size, 2, 'a bot refilled the slot after the results');
});

it('ignores podium votes from a player who has not confirmed', () => {
  const { game, join, runFor } = setup({ matchMs: 1_000, podiumMs: 5_000 });
  game.ready(join('Ready').p);
  runFor(1_100);
  const { p } = join('Podium');
  assert.equal(game.vote(p, 0), null);
  game.ready(p);
  assert.notEqual(game.vote(p, 0), null);
});

it('kicks a player in play who sends no input for the idle timeout, but not over the podium', () => {
  const { game, kicks, join, runFor } = setup({ idleKickMs: IDLE_TIMEOUT_MS, matchMs: 60_000, podiumMs: 40_000 });
  const busy = join('Busy').p;
  const idle = join('Idle').p;
  game.ready(busy);
  game.ready(idle);
  const look = (p: ServerPlayer, yaw: number) => game.input(p, [{ seq: p.lastSeq + 1, buttons: 0, yaw, pitch: 0, weapon: 0, interp: 0 }]);
  for (let s = 1; s <= 29; s++) {
    look(busy, s / 10);
    look(idle, 0);
    runFor(1_000);
  }
  assert.deepEqual(kicks, []);
  look(busy, 3);
  runFor(1_100);
  assert.deepEqual(kicks, [[idle.id, 'idle']]);
  for (let s = 0; s < 31 && game.phase !== 'podium'; s++) {
    look(busy, 4 + s / 10);
    runFor(1_000);
  }
  assert.equal(game.phase, 'podium');
  runFor(39_000);
  assert.equal(game.phase, 'podium');
  assert.deepEqual(kicks, [[idle.id, 'idle']], 'standing on the podium is not idling');
  runFor(1_100);
  assert.equal(game.phase, 'warmup', 'the next match waits for the click on "pronto"');
  game.ready(busy);
  assert.equal(game.phase, 'live');
  assert.equal(game.players.has(busy.id), true, 'the podium time does not carry into the next match');
});

it('lets players straight in when no ready timeout is configured', () => {
  const { join } = setup({ requireReady: undefined });
  const { p, messages } = join('Direct');
  const welcome = messages.find((m) => m.t === 'welcome');
  assert.ok(welcome?.t === 'welcome');
  assert.deepEqual(welcome.ready, { kind: 'confirmed' });
  assert.equal(p.alive, true);
});

it('keeps the ready screen but never kicks when the ready kick is off', () => {
  const { game, kicks, join, runFor } = setup({ readyKickMs: 0, matchMs: 5_000 });
  game.ready(join('Ready').p);
  const { p, messages } = join('Slow');
  const welcome = messages.find((m) => m.t === 'welcome');
  assert.ok(welcome?.t === 'welcome');
  assert.deepEqual(welcome.ready, { kind: 'pending', kickAt: null });
  runFor(READY_TIMEOUT_MS + 6_000);
  assert.deepEqual(kicks, []);
  assert.equal(game.players.has(p.id), true);
  assert.equal(p.alive, false);
});

it('counts an explicit active message as presence, like an agent waiting', () => {
  const { game, kicks, join, runFor } = setup({ idleKickMs: IDLE_TIMEOUT_MS, matchMs: 600_000 });
  const { p } = join('Agent');
  game.ready(p);
  for (let s = 0; s < 12; s++) {
    game.markActive(p);
    runFor(5_000);
  }
  assert.deepEqual(kicks, []);
  runFor(IDLE_TIMEOUT_MS + 100);
  assert.deepEqual(kicks, [[p.id, 'idle']], 'no calls for the timeout is idle');
});

it('never kicks idle players when the idle kick is off', () => {
  const { game, kicks, join, runFor } = setup({ idleKickMs: 0 });
  const { p, messages } = join('Still');
  game.ready(p);
  runFor(IDLE_TIMEOUT_MS * 2);
  assert.deepEqual(kicks, []);
  const welcome = messages.find((m) => m.t === 'welcome');
  assert.ok(welcome?.t === 'welcome' && welcome.idleKickMs === null);
});
