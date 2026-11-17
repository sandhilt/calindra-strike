import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameSession, type SocketLike, type Clock } from '../mcp/session.ts';
import { createTools } from '../mcp/tools.ts';
import { PROTOCOL_VERSION, WEAPON, packState, createPlayerState, RF_ALIVE } from '../../shared/src/index.ts';
class Socket implements SocketLike {
  readyState = 1;
  sent: string[] = [];
  listeners = new Map<string, Set<(event: { data?: unknown; reason?: string }) => void>>();
  addEventListener(t: string, fn: (event: { data?: unknown; reason?: string }) => void) {
    if (!this.listeners.has(t)) this.listeners.set(t, new Set());
    this.listeners.get(t)!.add(fn);
  }
  removeEventListener(t: string, fn: (event: { data?: unknown; reason?: string }) => void) {
    this.listeners.get(t)?.delete(fn);
  }
  send(s: string) {
    this.sent.push(s);
  }
  close() {
    this.readyState = 3;
    this.emit('close', {});
  }
  emit(t: string, e: { data?: unknown; reason?: string }) {
    for (const fn of this.listeners.get(t) ?? []) fn(e);
  }
  message(m: object) {
    this.emit('message', { data: JSON.stringify(m) });
  }
}
function setup(omniscient = false) {
  const socket = new Socket();
  const jobs = new Map<ReturnType<typeof setInterval>, () => void>();
  let id = 0;
  const clock: Clock = {
    now: () => 0,
    setInterval: (fn) => {
      const handle = ++id as unknown as ReturnType<typeof setInterval>;
      jobs.set(handle, fn);
      return handle;
    },
    clearInterval: (id) => {
      jobs.delete(id);
    },
  };
  const session = new GameSession({
    omniscient,
    url: 'ws://test',
    origin: 'http://test',
    connect: () => socket,
    clock,
    random: () => 0.5,
  });
  return { session, socket, jobs };
}
const args = { name: 'agent', color: 0, primary: WEAPON.RIFLE, code: 'secret' };
const welcome = {
  t: 'welcome',
  id: 1,
  time: 100,
  roster: [
    [1, 'agent', 0, 0, 0],
    [2, 'enemy', 1, 1, 0],
  ],
  match: { phase: 'live', mode: 'tdm', map: 0, endsAt: 10000, teams: [1, 2], limit: 20 },
  token: '',
  maxPlayers: 10,
};
test('session hello, snapshot layout, event bounds, cadence and closed tools', async () => {
  const { session, socket, jobs } = setup();
  const joined = session.join(args);
  socket.emit('open', {});
  assert.deepEqual(JSON.parse(socket.sent[0]), { t: 'hello', v: PROTOCOL_VERSION, ...args });
  socket.message(welcome);
  await joined;
  const s = createPlayerState();
  s.x = 10;
  s.health = 75;
  s.mag[s.weapon] = 15;
  socket.message({
    t: 'snap',
    time: 200,
    me: packState(s),
    ps: [
      [1, 10, 0, 0, 0, 0, RF_ALIVE, 2],
      [2, 110, 0, 0, 0, 0, RF_ALIVE, 2],
    ],
    ad: [[3, 60, 0, 70, 2, 1]],
  });
  for (let i = 0; i < 30; i++) {
    socket.message({ t: 'ev', e: [{ k: 'kill', by: 2, to: 1, w: 2, hs: 0, streak: 1 }] });
    socket.message({ t: 'chat', id: 2, text: String(i) });
  }
  const state = JSON.parse(JSON.stringify(session.getState()));
  assert.equal(state.you.hp, 75);
  assert.equal(state.you.mag, 15);
  assert.equal(state.others[0].distance, 100);
  assert.equal(state.others[0].bearingDeg, 90);
  assert.deepEqual(state.airdrops[0], { x: 60, z: 70, distance: 86, bearingDeg: 144 });
  assert.equal(state.events.length, 20);
  assert.equal(state.events[0].byName, 'enemy');
  assert.equal(state.chat.length, 10);
  assert.equal(JSON.parse(JSON.stringify(session.getState())).events.length, 0);
  for (const fn of jobs.values()) fn();
  const packet = JSON.parse(socket.sent.at(-1)!);
  assert.equal(packet.t, 'in');
  assert.equal(packet.c.length, 2);
  socket.close();
  assert.equal(
    (
      await createTools(session)
        .find((t) => t.name === 'get_state')!
        .call({})
    ).isError,
    true,
  );
  assert.equal(jobs.size, 0);
});
test('session surfaces rejection verbatim and permits retry', async () => {
  const { session, socket } = setup();
  const joined = session.join(args);
  socket.message({ t: 'reject', reason: 'wrong code' });
  await assert.rejects(joined, { message: 'wrong code' });
  assert.equal(
    (
      await createTools(session)
        .find((t) => t.name === 'say')!
        .call({ text: 'hi' })
    ).isError,
    true,
  );
});
test('tool arguments are strict', async () => {
  const { session } = setup();
  const tools = createTools(session);
  for (const [name, args] of [
    ['join', { name: '12345678901234567' }],
    ['join', { color: 12 }],
    ['join', { primary: 'hammer' }],
    ['wait', { ms: Infinity }],
    ['move_to', { x: NaN, z: 0 }],
    ['stop', { extra: true }],
    ['say', { text: '' }],
    ['vote', { option: 1.1 }],
  ] as const) {
    assert.equal((await tools.find((t) => t.name === name)!.call(args)).isError, true, name);
  }
});

test('state exposes podium voting and results only during podium', async () => {
  const { session, socket } = setup();
  const joined = session.join(args);
  socket.message(welcome);
  await joined;
  const results = [{ id: 1, name: 'agent', color: 0, kills: 3, deaths: 1, hs: 1, best: 3, team: 0, bot: 0 }];
  socket.message({
    t: 'match',
    match: {
      ...welcome.match,
      phase: 'podium',
      results,
      winner: 0,
      next: { map: 0, mode: 'ffa' },
      vote: { options: [{ map: 0, mode: 'ffa' }], counts: [2] },
    },
  });
  const state = JSON.parse(JSON.stringify(session.getState()));
  assert.deepEqual(state.results, results);
  assert.equal(state.winner, 0);
  assert.partialDeepStrictEqual(state.vote, { options: [{ index: 0, mode: 'ffa' }], counts: [2] });
  assert.equal(typeof state.vote.options[0].map, 'string');
  socket.message({ t: 'match', match: welcome.match });
  assert.equal(Object.hasOwn(session.getState(), 'vote'), false);
  session.close();
});

test('state reports ended attacks and emits an intent event only once', async () => {
  const { session, socket } = setup();
  const joined = session.join(args);
  socket.message(welcome);
  await joined;
  const snap = {
    t: 'snap',
    time: 200,
    me: packState(createPlayerState()),
    ps: [[2, 100, 0, 0, 0, 0, RF_ALIVE, 2]],
    ad: [],
  };
  socket.message(snap);
  session.setIntent({ kind: 'attack', targetId: 2 });
  socket.message({ ...snap, ps: [] });
  const state = JSON.parse(JSON.stringify(session.getState()));
  assert.deepEqual(state.you.intent, { kind: 'attack', targetId: 2, ended: true });
  assert.equal(state.events.filter((e: { k: string }) => e.k === 'intent').length, 1);
  socket.message({ ...snap, ps: [] });
  assert.deepEqual(JSON.parse(JSON.stringify(session.getState())).events, []);
  session.close();
});

test('fair session hides enemies, exposes memory and ends attacks when perception is lost', async () => {
  const { session, socket } = setup();
  const joined = session.join(args);
  socket.message(welcome);
  await joined;
  const self = createPlayerState();
  Object.assign(self, { x: -300, y: 0, z: -600, health: 100, dropping: false });
  const snap = (time: number, z: number) => {
    self.z = z;
    socket.message({
      t: 'snap', time, me: packState(self),
      ps: [[2, 300, 0, z, 0, 0, RF_ALIVE, 2]], ad: [],
    });
  };
  snap(200, -600);
  session.setIntent({ kind: 'attack', targetId: 2 });
  snap(300, 0);
  const state = JSON.parse(JSON.stringify(session.getState()));
  assert.equal(state.perception, 'line-of-sight');
  assert.deepEqual(state.others, []);
  assert.deepEqual(state.lastSeen, [{ id: 2, name: 'enemy', pos: [300, 0, -600], secondsAgo: 0.1 }]);
  assert.ok(state.you.intent.ended);
  assert.equal(state.events[0].reason, 'Target out of sight');
  const attack = createTools(session).find((tool) => tool.name === 'attack')!;
  const response = await attack.call({ target_id: 2 });
  assert.equal(response.isError, true);
  assert.match(response.content[0].text, /lastSeen.*move_to/);
  session.close();
});

test('omniscient session exposes enemies behind walls and labels the mode', async () => {
  const { session, socket } = setup(true);
  const joined = session.join(args);
  socket.message(welcome);
  await joined;
  const self = createPlayerState();
  Object.assign(self, { x: -300, y: 0, z: 0, health: 100, dropping: false });
  socket.message({
    t: 'snap', time: 200, me: packState(self),
    ps: [[2, 300, 0, 0, 0, 0, RF_ALIVE, 2]], ad: [],
  });
  const state = JSON.parse(JSON.stringify(session.getState()));
  assert.equal(state.perception, 'omniscient');
  assert.equal(state.others[0].id, 2);
  session.setIntent({ kind: 'attack', targetId: 2 });
  session.close();
});
