import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameSession, type SocketLike, type Clock } from '../mcp/session.ts';
import { createTools } from '../mcp/tools.ts';
import type { Log } from '../mcp/log.ts';
import { BOMB_DESK_SIZE_UNITS, BOMB_DESK_HEIGHT_UNITS, BOMB_CRATE_SIZE_UNITS, BOMB_CRATE_HEIGHT_UNITS, BTN, PROTOCOL_VERSION, WEAPON, getMap, packState, createPlayerState, RF_ALIVE, weaponDef, type WeaponId } from '../../shared/src/index.ts';
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
function setup(omniscient = false, autoVote = false, log?: Log) {
  const socket = new Socket();
  const jobs = new Map<ReturnType<typeof setInterval>, () => void>();
  let id = 0;
  let now = 0;
  const clock: Clock = {
    now: () => now,
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
    autoVote,
    log,
    url: 'ws://test',
    origin: 'http://test',
    connect: () => socket,
    clock,
    random: () => 0.5,
  });
  return { session, socket, jobs, advance: (ms: number) => { now += ms; for (const fn of [...jobs.values()]) fn(); } };
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
  assert.ok(tickButtons().every((b) => !(b & (BTN.DUCK | BTN.WALK))));
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

test('crouch, walk and zoom reset when the player dies, even if no tick ran in between', async () => {
  const { call, live, socket, tickButtons, session } = await playing();
  await call('crouch', { on: true });
  await call('walk', { on: true });
  await call('zoom', { level: 1 });
  socket.message({ t: 'snap', time: 300, me: null, ps: [], ad: [] });
  live();
  assert.ok(tickButtons().every((b) => !(b & (BTN.DUCK | BTN.WALK))));
  const state = JSON.parse(JSON.stringify(session.getState()));
  assert.deepEqual(state.you.actions, { crouch: false, walk: false, zoom: null });
  session.close();
});

test('crouch, walk and zoom reset on a respawn of a player who never died (match start)', async () => {
  const { call, live, tickButtons, session } = await playing();
  await call('crouch', { on: true });
  await call('walk', { on: true });
  await call('zoom', { level: 1 });
  live(WEAPON.SNIPER, false, true); // spawn(): alive again, skydiving
  assert.ok(tickButtons().every((b) => !(b & (BTN.DUCK | BTN.WALK))));
  assert.deepEqual(JSON.parse(JSON.stringify(session.getState())).you.actions, { crouch: false, walk: false, zoom: null });
  session.close();
});

test('latched actions and pending requests reset when the map changes', async () => {
  const { call, socket, tickButtons, session } = await playing();
  await call('crouch', { on: true });
  await call('walk', { on: true });
  await call('zoom', { level: 1 });
  await call('jump');
  await call('reload');
  await call('switch_weapon', { slot: 'hammer' });
  socket.message({ t: 'match', match: { ...welcome.match, map: 1 } });
  assert.deepEqual(JSON.parse(JSON.stringify(session.getState())).you.actions, { crouch: false, walk: false, zoom: null });
  const buttons = tickButtons();
  assert.deepEqual((JSON.parse(socket.sent.at(-1)!).c as number[][]).map((c) => c[4]), [0, 0]);
  assert.ok(buttons.every((b) => !(b & (BTN.DUCK | BTN.WALK | BTN.JUMP | BTN.ATTACK2 | BTN.RELOAD))));
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
  for (const [name, a] of [
    ['jump', {}], ['crouch', { on: true }], ['zoom', { level: 1 }],
    ['walk', { on: true }], ['reload', {}], ['switch_weapon', { slot: 'pistol' }],
  ] as const) {
    assert.equal((await call(name, a)).isError, true, name);
  }
  session.close();
});

test('get_state reports ducked, onGround, zoom, maxZoom and the requested actions', async () => {
  const awp = await playing(WEAPON.SNIPER);
  await awp.call('crouch', { on: true });
  await awp.call('walk', { on: true });
  await awp.call('zoom', { level: 2 });
  const you = JSON.parse(JSON.stringify(awp.session.getState())).you;
  assert.partialDeepStrictEqual(you, {
    onGround: true, ducked: false, zoom: 0, maxZoom: 2,
    actions: { crouch: true, walk: true, zoom: 2 },
    slots: {
      primary: weaponDef(WEAPON.RIFLE).name,
      pistol: weaponDef(WEAPON.PISTOL).name,
      hammer: weaponDef(WEAPON.HAMMER).name,
      last: weaponDef(createPlayerState().lastWeapon).name,
    },
  });
  awp.session.close();
  const rifle = await playing(WEAPON.RIFLE);
  assert.equal(JSON.parse(JSON.stringify(rifle.session.getState())).you.maxZoom, 0);
  rifle.session.close();
});

test('auto-vote votes once per podium and permits manual changes', async () => {
  const { session, socket, jobs } = setup(false, true);
  const joined = session.join(args);
  socket.message(welcome);
  await joined;
  const vote = { options: [{ map: 0, mode: 'ffa' }, { map: 1, mode: 'tdm' }, { map: 1, mode: 'ffa' }], counts: [0, 0, 0] };
  const votes = () => socket.sent.map((raw) => JSON.parse(raw)).filter((m) => m.t === 'vote');
  socket.message({ t: 'match', match: { ...welcome.match, vote } });
  assert.deepEqual(votes(), []);
  const podium = { ...welcome.match, phase: 'podium', vote };
  socket.message({ t: 'match', match: podium });
  for (const fn of jobs.values()) fn();
  assert.deepEqual(votes(), [{ t: 'vote', option: 1 }]);
  socket.message({ t: 'match', match: podium });
  assert.deepEqual(votes(), [{ t: 'vote', option: 1 }]);
  const response = await createTools(session).find((tool) => tool.name === 'vote')!.call({ option: 0 });
  assert.equal(response.isError, undefined);
  assert.deepEqual(votes(), [{ t: 'vote', option: 1 }, { t: 'vote', option: 0 }]);
  socket.message({ t: 'match', match: welcome.match });
  socket.message({ t: 'match', match: podium });
  assert.equal(votes().length, 3);
  assert.deepEqual(votes().at(-1), { t: 'vote', option: 1 });
  session.close();
});

test('every vote the agent casts is logged, automatic or by the tool', async () => {
  const lines: string[] = [];
  const { session, socket, jobs } = setup(false, true, (...a) => lines.push(a.join(' ')));
  const joined = session.join(args);
  socket.message(welcome);
  await joined;
  const vote = { options: [{ map: 0, mode: 'ffa' }, { map: 1, mode: 'tdm' }, { map: 1, mode: 'ffa' }], counts: [0, 0, 0] };
  socket.message({ t: 'match', match: { ...welcome.match, phase: 'podium', vote } });
  for (const fn of jobs.values()) fn();
  await createTools(session).find((tool) => tool.name === 'vote')!.call({ option: 0 });
  assert.deepEqual(lines.filter((line) => line.startsWith('vote')), ['vote option=1 map=1 mode=tdm', 'vote option=0 map=0 mode=ffa']);
  session.close();
});

test('auto-vote is off by default', async () => {
  const { session, socket } = setup();
  const joined = session.join(args);
  socket.message(welcome);
  await joined;
  socket.message({ t: 'match', match: { ...welcome.match, phase: 'podium', vote: { options: [{ map: 0, mode: 'ffa' }], counts: [0] } } });
  assert.deepEqual(socket.sent.map((raw) => JSON.parse(raw)).filter((m) => m.t === 'vote'), []);
  session.close();
});

test('auto-vote skips podiums without vote options', async () => {
  const { session, socket } = setup(false, true);
  const joined = session.join(args);
  socket.message(welcome);
  await joined;
  socket.message({ t: 'match', match: { ...welcome.match, phase: 'podium' } });
  socket.message({ t: 'match', match: welcome.match });
  socket.message({ t: 'match', match: { ...welcome.match, phase: 'podium', vote: { options: [], counts: [] } } });
  assert.deepEqual(socket.sent.map((raw) => JSON.parse(raw)).filter((m) => m.t === 'vote'), []);
  session.close();
});

test('walk latches WALK on both commands while idle and releases on off', async () => {
  const { call, tickButtons, session } = await playing();
  assert.equal((await call('walk', { on: true })).isError, undefined);
  assert.ok(tickButtons().every((b) => b & BTN.WALK));
  assert.ok(tickButtons().every((b) => b & BTN.WALK));
  await call('walk', { on: false });
  assert.ok(tickButtons().every((b) => !(b & BTN.WALK)));
  assert.equal((await call('walk', { on: 'true' })).isError, true);
  assert.equal((await call('walk')).isError, true);
  session.close();
});

test('reload pulses exactly once across a tick and rejects the hammer', async () => {
  const rifle = await playing(WEAPON.RIFLE);
  assert.equal((await rifle.call('reload')).isError, undefined);
  assert.equal(rifle.tickButtons().filter((b) => b & BTN.RELOAD).length, 1);
  assert.equal(rifle.tickButtons().filter((b) => b & BTN.RELOAD).length, 0);
  rifle.session.close();
  const hammer = await playing(WEAPON.HAMMER);
  const response = await hammer.call('reload');
  assert.equal(response.isError, true);
  assert.match(JSON.stringify(response), /Weapon cannot reload/);
  assert.ok(hammer.tickButtons().every((b) => !(b & BTN.RELOAD)));
  hammer.session.close();
});

test('switch_weapon maps every slot to one command and returns its weapon name', async () => {
  for (const [slot, request, target] of [
    ['primary', 1, WEAPON.RIFLE],
    ['pistol', 2, WEAPON.PISTOL],
    ['hammer', 3, WEAPON.HAMMER],
    ['last', 4, createPlayerState().lastWeapon],
  ] as const) {
    const { call, tickButtons, socket, session } = await playing(WEAPON.SNIPER);
    const response = await call('switch_weapon', { slot });
    assert.equal(response.isError, undefined, slot);
    assert.partialDeepStrictEqual(JSON.parse(response.content[0].text), {
      crouch: false, walk: false, zoom: null, weapon: weaponDef(target).name,
    });
    tickButtons();
    assert.deepEqual((JSON.parse(socket.sent.at(-1)!).c as number[][]).map((c) => c[4]), [request, 0], slot);
    tickButtons();
    assert.deepEqual((JSON.parse(socket.sent.at(-1)!).c as number[][]).map((c) => c[4]), [0, 0], slot);
    session.close();
  }
});

test('switch_weapon queues held slots and rejects unknown slots', async () => {
  for (const [slot, weapon] of [
    ['primary', WEAPON.RIFLE], ['pistol', WEAPON.PISTOL], ['hammer', WEAPON.HAMMER],
  ] as const) {
    const { call, tickButtons, socket, session } = await playing(weapon);
    assert.equal((await call('switch_weapon', { slot })).isError, undefined);
    tickButtons();
    assert.deepEqual((JSON.parse(socket.sent.at(-1)!).c as number[][]).map((c) => c[4]), [{ primary: 1, pistol: 2, hammer: 3 }[slot], 0]);
    const response = await call('switch_weapon', { slot: 'unknown' });
    assert.equal(response.isError, true);
    assert.match(JSON.stringify(response), /Invalid slot/);
    assert.equal((await call('switch_weapon', { slot: 'toString' })).isError, true);
    assert.equal((await call('switch_weapon')).isError, true);
    session.close();
  }
});

test('death clears pending reload and weapon requests before the next tick', async () => {
  const { call, live, socket, tickButtons, session } = await playing();
  await call('reload');
  await call('switch_weapon', { slot: 'hammer' });
  const dead = createPlayerState();
  dead.health = 0;
  socket.message({ t: 'snap', time: 300, me: packState(dead), ps: [], ad: [] });
  assert.equal((await call('reload')).isError, true);
  assert.equal((await call('switch_weapon', { slot: 'hammer' })).isError, true);
  live();
  assert.ok(tickButtons().every((b) => !(b & BTN.RELOAD)));
  assert.deepEqual((JSON.parse(socket.sent.at(-1)!).c as number[][]).map((c) => c[4]), [0, 0]);
  session.close();
});


test('weapon slots report and request the primary and last weapons from the snapshot', async () => {
  const { call, socket, tickButtons, session } = await playing();
  const self = createPlayerState();
  Object.assign(self, { health: 100, weapon: WEAPON.HAMMER, primary: WEAPON.SNIPER, lastWeapon: WEAPON.PISTOL });
  socket.message({ t: 'snap', time: 300, ack: 0, me: packState(self), ps: [], ad: [] });
  assert.partialDeepStrictEqual(session.getState(), {
    you: { slots: { primary: weaponDef(WEAPON.SNIPER).name, last: weaponDef(WEAPON.PISTOL).name } },
  });
  for (const [slot, request, target] of [['primary', 1, WEAPON.SNIPER], ['last', 4, WEAPON.PISTOL]] as const) {
    const response = await call('switch_weapon', { slot });
    assert.equal(response.isError, undefined);
    assert.partialDeepStrictEqual(JSON.parse(response.content[0].text), { weapon: weaponDef(target).name });
    tickButtons();
    assert.deepEqual((JSON.parse(socket.sent.at(-1)!).c as number[][]).map((c) => c[4]), [request, 0]);
  }
  session.close();
});

test('switch_weapon queues primary after pistol before a new snapshot', async () => {
  const { call, socket, tickButtons, session } = await playing(WEAPON.RIFLE);
  await call('switch_weapon', { slot: 'pistol' });
  tickButtons();
  assert.deepEqual(JSON.parse(socket.sent.at(-1)!).c.map((c: number[]) => c[4]), [2, 0]);
  await call('switch_weapon', { slot: 'primary' });
  tickButtons();
  assert.deepEqual(JSON.parse(socket.sent.at(-1)!).c.map((c: number[]) => c[4]), [1, 0]);
  session.close();
});

test('switch_weapon rejects a replaced primary as last and reports null', async () => {
  const { call, socket, session } = await playing();
  const self = createPlayerState();
  Object.assign(self, { weapon: WEAPON.SNIPER, primary: WEAPON.SNIPER, lastWeapon: WEAPON.RIFLE });
  socket.message({ t: 'snap', time: 300, ack: 0, me: packState(self), ps: [], ad: [] });
  const response = await call('switch_weapon', { slot: 'last' });
  assert.equal(response.isError, true);
  assert.match(response.content[0].text, /No previous weapon/);
  assert.partialDeepStrictEqual(session.getState(), { you: { slots: { last: null } } });
  session.close();
});

test('CTF view reports flags, capture totals and named flag events', async () => {
  const { session, socket } = setup();
  const joining = session.join(args);
  socket.emit('open', {});
  socket.message({ ...welcome, match: { ...welcome.match, mode: 'ctf', teams: [2, 1] } });
  await joining;
  const self = createPlayerState();
  socket.message({ t: 'snap', time: 300, ack: 0, me: packState(self), ps: [], ad: [], fl: [[0, -1, 0, 0, -100, 0], [1, 1, 0, 0, 0, 0]] });
  socket.message({ t: 'ev', e: [{ k: 'flag', what: 'take', team: 1, by: 1 }] });
  const view = session.getState() as { score: { teams: number[] }; flags: unknown[]; events: unknown[] };
  assert.deepEqual(view.score.teams, [2, 1]);
  assert.deepEqual(view.flags[0], { team: 0, state: 'at_base', carrierId: null, carrierName: null, pos: [0, 0, -100], distance: 100, bearingDeg: -0 });
  assert.partialDeepStrictEqual(view.flags[1], { state: 'carried', carrierId: 1, carrierName: 'agent', distance: 0 });
  assert.partialDeepStrictEqual(view.events, [{ k: 'flag', what: 'take', team: 1, by: 1, byName: 'agent' }]);
  socket.message({ t: 'snap', time: 400, ack: 0, me: packState(self), ps: [], ad: [], fl: [[2, -1, 100, 0, 0, 5000], [0, -1, 0, 0, 100, 0]] });
  const dropped = session.getState() as { flags: unknown[]; events: unknown[] };
  assert.partialDeepStrictEqual(dropped.flags[0], { state: 'dropped', carrierId: null, carrierName: null, distance: 100, bearingDeg: 90 });
  assert.deepEqual(dropped.events, []);
  session.close();
});

test('sprays decode names, cap oldest, persist across respawns and clear with a new match/map', async () => {
  const { session, socket } = setup();
  const joined = session.join(args);
  socket.emit('open', {});
  socket.message(welcome);
  await joined;
  const state = () => session.requirePlaying().view;
  const spray = (id = 2, x = 0) => socket.message({ t: 'ev', e: [{ k: 'spray', id, p: [x, 64, -100], n: [0, 0, 1], r: 0 }] });
  assert.equal(JSON.parse(JSON.stringify(session.getState())).scene, null);
  spray();
  assert.deepEqual(state().sprays, [{ id: 2, by: 'enemy', x: 0, y: 64, z: -100, nx: 0, ny: 0, nz: 1 }]);
  const self = createPlayerState();
  self.dropping = false;
  socket.message({ t: 'snap', time: 200, ack: 0, me: packState(self), ps: [], ad: [] });
  assert.deepEqual(JSON.parse(JSON.stringify(session.getState())).scene.sprays,
    [{ by: 'enemy', pos: [0, 64, -100], normal: [0, 0, 1], distance: 100, bearingDeg: 0 }]);
  socket.message({ t: 'snap', time: 300, ack: 0, me: null, ps: [], ad: [] });
  self.dropping = true;
  socket.message({ t: 'snap', time: 400, ack: 0, me: packState(self), ps: [], ad: [] });
  assert.equal(state().sprays.length, 1);
  for (let i = 1; i <= 65; i++) spray(99, i);
  assert.equal(state().sprays.length, 64);
  assert.equal(state().sprays[0].x, 2);
  assert.equal(state().sprays.at(-1)?.by, '99');
  socket.message({ t: 'match', match: { ...welcome.match, phase: 'podium' } });
  assert.equal(state().sprays.length, 64);
  socket.message({ t: 'match', match: { ...welcome.match, phase: 'warmup' } });
  assert.deepEqual(state().sprays, []);
  spray();
  socket.message({ t: 'match', match: { ...welcome.match, phase: 'warmup', map: 1 } });
  assert.deepEqual(state().sprays, []);
  spray();
  socket.message({ t: 'match', match: { ...welcome.match, phase: 'live', map: 1 } });
  assert.deepEqual(state().sprays, []);
  session.close();
});

async function defusion() {
  const ctx = setup();
  const joined = ctx.session.join(args);
  ctx.socket.message({ ...welcome, match: { ...welcome.match, mode: 'defuse' } });
  await joined;
  const self = createPlayerState();
  const snap = (bomb: number[], time = 200) => ctx.socket.message({
    t: 'snap', time, ack: 0, me: packState(self), ps: [], ad: [], bm: bomb,
  });
  return { ...ctx, self, snap };
}

test('bomb perception exposes roles, names, progress, positions and all named events', async () => {
  const { session, socket, snap } = await defusion();
  snap([4, 2, 110, 0, 0, 10200, 5200, 1, 0, 0, 1]);
  const state = JSON.parse(JSON.stringify(session.getState()));
  assert.partialDeepStrictEqual(state.bomb, {
    state: 'planted', defuserName: 'enemy', role: 'attacker',
    attackersTeam: 0, blackFriday: true, fuseSeconds: 15, secondsToExplosion: 10, distance: 110, bearingDeg: 90,
    stand: { kind: 'desk', solid: true, size: [BOMB_DESK_SIZE_UNITS, BOMB_DESK_HEIGHT_UNITS, BOMB_DESK_SIZE_UNITS] },
  });
  assert.ok(state.bomb.site.pos.length === 3);
  assert.ok(state.bomb.defuseProgress >= 0);
  for (const what of ['take', 'drop', 'plant', 'defuse', 'defused', 'exploded', 'return'])
    socket.message({ t: 'ev', e: [{ k: 'bomb', what, team: 0, by: 2 }] });
  const events = JSON.parse(JSON.stringify(session.getState())).events;
  assert.equal(events.length, 7);
  assert.ok(events.every((e: { byName: string }) => e.byName === 'enemy'));
  snap([]);
  assert.equal(JSON.parse(JSON.stringify(session.getState())).bomb, null);
  session.close();
});

test('bomb snapshots install and clear solid stands for move_to', async () => {
  const { session, snap, self } = await defusion();
  const { x, z } = getMap(welcome.match.map).flagBases[0];
  Object.assign(self, { x, y: 0, z: z + 100 });
  const target = { kind: 'moveTo', x, z } as const;
  snap([]);
  assert.doesNotThrow(() => session.setIntent(target));
  snap([0, -1, x, 0, z, 0, 0, 0, 0, 0, 0]);
  assert.partialDeepStrictEqual(session.getState(), {
    bomb: { blackFriday: false, fuseSeconds: 30, stand: {
      kind: 'crate', solid: true, size: [BOMB_CRATE_SIZE_UNITS, BOMB_CRATE_HEIGHT_UNITS, BOMB_CRATE_SIZE_UNITS],
    } },
  });
  assert.throws(() => session.setIntent(target), /intersects solid/);
  snap([1, 1, self.x, self.y, self.z, 0, 0, 0, 0, 0, 0]);
  assert.partialDeepStrictEqual(session.getState(), { bomb: { stand: null } });
  assert.doesNotThrow(() => session.setIntent(target));
  snap([4, -1, x, 0, z, 20200, 0, 0, 0, 0, 1]);
  assert.throws(() => session.setIntent(target), /intersects solid/);
  snap([]);
  assert.doesNotThrow(() => session.setIntent(target));
  session.close();
});

test('manual use completes on plant, releases keys and reports death interruption', async () => {
  const { session, socket, jobs, snap, self } = await defusion();
  snap([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const planted = session.use();
  for (const fn of [...jobs.values()]) fn();
  const commands = JSON.parse(socket.sent.at(-1)!).c;
  assert.ok(commands.every((c: number[]) => (c[1] & BTN.USE) !== 0));
  socket.message({ t: 'ev', e: [{ k: 'bomb', what: 'plant', team: 0, by: 1 }] });
  assert.partialDeepStrictEqual(await planted, { outcome: 'planted' });
  for (const fn of [...jobs.values()]) fn();
  assert.ok(JSON.parse(socket.sent.at(-1)!).c.every((c: number[]) => !(c[1] & BTN.USE)));
  const died = session.use();
  self.health = 0;
  snap([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.partialDeepStrictEqual(await died, { outcome: 'interrupted', reason: 'Player died' });
  session.close();
});

test('manual use reports defused, respawn, competing completion and disconnect', async () => {
  for (const reason of ['defused', 'respawn', 'other', 'disconnect']) {
    const { session, socket, snap, self, jobs } = await defusion();
    snap([4, -1, 0, 0, 0, 50000, 0, 0, 1, 0, 0]);
    const using = session.use();
    if (reason === 'defused') socket.message({ t: 'ev', e: [{ k: 'bomb', what: 'defused', team: 0, by: 1 }] });
    if (reason === 'other') socket.message({ t: 'ev', e: [{ k: 'bomb', what: 'defused', team: 0, by: 2 }] });
    if (reason === 'respawn') {
      self.dropping = true;
      snap([4, -1, 0, 0, 0, 50000, 0, 0, 1, 0, 0]);
    }
    if (reason === 'disconnect') session.close();
    assert.partialDeepStrictEqual(await using, { outcome: reason === 'defused' ? 'defused' : 'interrupted' });
    session.close();
    assert.equal(jobs.size, 0);
  }
});

test('manual use duration is bounded and releases on timeout', async () => {
  const { session, snap, advance } = await defusion();
  snap([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.throws(() => session.use(10001), /Invalid ms/);
  const using = session.use(100);
  advance(99);
  advance(1);
  assert.deepEqual(await using, { outcome: 'interrupted', reason: 'Duration elapsed' });
  session.close();
});
