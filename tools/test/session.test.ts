import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameSession, type SocketLike, type Clock } from '../mcp/session.ts';
import { createTools } from '../mcp/tools.ts';
import { BTN, PROTOCOL_VERSION, WEAPON, packState, createPlayerState, RF_ALIVE, type WeaponId } from '../../shared/src/index.ts';
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

async function playing(weapon: WeaponId = WEAPON.SNIPER, onGround = true) {
  const ctx = setup();
  const joined = ctx.session.join(args);
  ctx.socket.message(welcome);
  await joined;
  const live = (w: WeaponId = weapon, ground = onGround, dropping = false) => {
    const s = createPlayerState();
    s.dropping = dropping;
    s.health = 100;
    s.weapon = w;
    s.onGround = ground;
    ctx.socket.message({ t: 'snap', time: 200, ack: 0, me: packState(s), ps: [[1, 0, 0, 0, 0, 0, RF_ALIVE, w]], ad: [] });
  };
  live();
  const call = (name: string, a: object = {}) => createTools(ctx.session).find((t) => t.name === name)!.call(a);
  const tickButtons = () => {
    for (const fn of ctx.jobs.values()) fn();
    return (JSON.parse(ctx.socket.sent.at(-1)!).c as number[][]).map((c) => c[1]);
  };
  return { ...ctx, live, call, tickButtons };
}

test('crouch latches DUCK on every cmd while idle and can be released', async () => {
  const { call, tickButtons, session } = await playing();
  assert.equal((await call('crouch', { on: true })).isError, undefined);
  assert.ok(tickButtons().every((b) => b & BTN.DUCK));
  assert.ok(tickButtons().every((b) => b & BTN.DUCK));
  await call('crouch', { on: false });
  assert.ok(tickButtons().every((b) => !(b & BTN.DUCK)));
  session.close();
});

test('jump sends exactly one JUMP on the ground and errors in the air', async () => {
  const ground = await playing(WEAPON.RIFLE, true);
  assert.equal((await ground.call('jump')).isError, undefined);
  assert.equal(ground.tickButtons().filter((b) => b & BTN.JUMP).length, 1);
  assert.equal(ground.tickButtons().filter((b) => b & BTN.JUMP).length, 0);
  ground.session.close();
  const air = await playing(WEAPON.RIFLE, false);
  const res = await air.call('jump');
  assert.equal(res.isError, true);
  assert.match(JSON.stringify(res), /Not on the ground/);
  assert.equal(air.tickButtons().filter((b) => b & BTN.JUMP).length, 0);
  air.session.close();
});

test('zoom scopes the AWP with one ATTACK2 and rejects weapons without a scope or bad levels', async () => {
  const awp = await playing(WEAPON.SNIPER);
  assert.equal((await awp.call('zoom', { level: 1 })).isError, undefined);
  assert.equal(awp.tickButtons().filter((b) => b & BTN.ATTACK2).length, 1);
  assert.equal((await awp.call('zoom', { level: 3 })).isError, true);
  awp.session.close();
  const rifle = await playing(WEAPON.RIFLE);
  const res = await rifle.call('zoom', { level: 1 });
  assert.equal(res.isError, true);
  assert.match(JSON.stringify(res), /Weapon has no scope/);
  rifle.session.close();
});

test('crouch and zoom reset when the player dies, even if no tick ran in between', async () => {
  const { call, live, socket, tickButtons, session } = await playing();
  await call('crouch', { on: true });
  await call('zoom', { level: 1 });
  socket.message({ t: 'snap', time: 300, me: null, ps: [], ad: [] });
  live();
  assert.ok(tickButtons().every((b) => !(b & BTN.DUCK)));
  const state = JSON.parse(JSON.stringify(session.getState()));
  assert.deepEqual(state.you.actions, { crouch: false, zoom: null });
  session.close();
});

test('crouch and zoom reset on a respawn of a player who never died (match start)', async () => {
  const { call, live, tickButtons, session } = await playing();
  await call('crouch', { on: true });
  await call('zoom', { level: 1 });
  live(WEAPON.SNIPER, false, true); // spawn(): alive again, skydiving
  assert.ok(tickButtons().every((b) => !(b & BTN.DUCK)));
  assert.deepEqual(JSON.parse(JSON.stringify(session.getState())).you.actions, { crouch: false, zoom: null });
  session.close();
});

test('crouch, zoom and a queued jump reset when the map changes', async () => {
  const { call, socket, tickButtons, session } = await playing();
  await call('crouch', { on: true });
  await call('zoom', { level: 1 });
  await call('jump');
  socket.message({ t: 'match', match: { ...welcome.match, map: 1 } });
  assert.deepEqual(JSON.parse(JSON.stringify(session.getState())).you.actions, { crouch: false, zoom: null });
  const buttons = tickButtons();
  assert.ok(buttons.every((b) => !(b & (BTN.DUCK | BTN.JUMP | BTN.ATTACK2))));
  session.close();
});

test('zoom 0 on a weapon without a scope is an error and keeps the pilot auto-scope', async () => {
  const { call, session } = await playing(WEAPON.RIFLE);
  assert.equal((await call('zoom', { level: 0 })).isError, true);
  assert.equal(JSON.parse(JSON.stringify(session.getState())).you.actions.zoom, null);
  session.close();
});

test('zoom waits for the server ack of its scope press before pressing again', async () => {
  const { call, socket, tickButtons, session } = await playing(WEAPON.SNIPER);
  await call('zoom', { level: 1 });
  assert.equal(tickButtons().filter((b) => b & BTN.ATTACK2).length, 1);
  for (let i = 0; i < 20; i++) assert.equal(tickButtons().filter((b) => b & BTN.ATTACK2).length, 0);
  const s = createPlayerState();
  s.health = 100;
  s.weapon = WEAPON.SNIPER;
  s.onGround = true;
  // ack 2: the two cmds of the first tick were processed, so the press is reflected
  socket.message({ t: 'snap', time: 400, ack: 2, me: packState(s), ps: [[1, 0, 0, 0, 0, 0, RF_ALIVE, WEAPON.SNIPER]], ad: [] });
  assert.equal(tickButtons().filter((b) => b & BTN.ATTACK2).length, 1);
  session.close();
});

test('actions need a living player snapshot', async () => {
  const { session, socket, call } = await playing();
  socket.message({ t: 'snap', time: 300, me: null, ps: [], ad: [] });
  for (const [name, a] of [['jump', {}], ['crouch', { on: true }], ['zoom', { level: 1 }]] as const) {
    assert.equal((await call(name, a)).isError, true, name);
  }
  session.close();
});

test('get_state reports ducked, onGround, zoom, maxZoom and the requested actions', async () => {
  const awp = await playing(WEAPON.SNIPER);
  await awp.call('crouch', { on: true });
  await awp.call('zoom', { level: 2 });
  const you = JSON.parse(JSON.stringify(awp.session.getState())).you;
  assert.partialDeepStrictEqual(you, { onGround: true, ducked: false, zoom: 0, maxZoom: 2, actions: { crouch: true, zoom: 2 } });
  awp.session.close();
  const rifle = await playing(WEAPON.RIFLE);
  assert.equal(JSON.parse(JSON.stringify(rifle.session.getState())).you.maxZoom, 0);
  rifle.session.close();
});
