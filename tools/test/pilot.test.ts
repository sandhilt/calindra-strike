import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CollisionWorld,
  getMap,
  createPlayerState,
  spawnState,
  applyCmd,
  WEAPON,
  BTN,
  RF_ALIVE,
  RF_DROP,
} from '../../shared/src/index.ts';
import { NavGrid } from '../../server/src/nav.ts';
import { ActionOverlay } from '../mcp/actions.ts';
import { Pilot } from '../mcp/pilot.ts';
import { welcome } from '../mcp/view.ts';

function fixture() {
  const map = getMap(0);
  const world = new CollisionWorld(map);
  const nav = new NavGrid(world, map);
  const view = welcome({
    t: 'welcome',
    id: 1,
    time: 1000,
    roster: [[1, 'agent', 0, 0, 0]],
    match: { phase: 'live', mode: 'tdm', map: 0, endsAt: 10000, teams: [0, 0], limit: 0 },
    maxPlayers: 16,
    token: '',
    spectator: null,
    ready: { kind: 'confirmed' },
    idleKickMs: null, idleKickWarmupMs: null,
  });
  const s = createPlayerState();
  view.self = s;
  spawnState(s, 500, 0, -600, 0, WEAPON.RIFLE);
  s.dropping = false;
  s.onGround = true;
  const pilot = new Pilot(1, () => 0.5);
  return { world, nav, view, s, pilot };
}

test('adapter maps goto and follows a warehouse route with the shared simulation', () => {
  const { world, nav, view, s, pilot } = fixture();
  const intent = { kind: 'moveTo', x: 960, z: -1100 } as const;
  pilot.setIntent(intent, 0);
  for (let seq = 1; seq <= 1800 && !pilot.arrived; seq++) {
    applyCmd(world, s, pilot.nextCmd(view, intent, nav, world, seq), 1);
  }
  assert.ok(pilot.arrived, `Stopped at ${s.x},${s.y},${s.z}`);
  assert.ok(Math.hypot(s.x - 960, s.z + 1100) < 60);
});

test('adapter maps enemy peers and ends engage for teammates or dropping targets', () => {
  const { world, nav, view, s, pilot } = fixture();
  view.peers = [
    {
      id: 2,
      name: 'enemy',
      team: 1,
      enemy: true,
      alive: true,
      x: s.x,
      y: 0,
      z: s.z - 200,
      yaw: 0,
      pitch: 0,
      flags: RF_ALIVE,
      weapon: WEAPON.RIFLE,
      lean: 0,
    },
  ];
  const intent = { kind: 'attack', targetId: 2 } as const;
  pilot.setIntent(intent, 0);
  let fired = false;
  for (let seq = 1; seq < 120; seq++) {
    const cmd = pilot.nextCmd(view, intent, nav, world, seq);
    fired ||= !!(cmd.buttons & BTN.ATTACK);
    assert.equal(cmd.weapon, 0);
  }
  assert.ok(fired);
  view.peers[0].team = 0;
  pilot.nextCmd(view, intent, nav, world, 121);
  assert.ok(pilot.directiveEnded);
  view.peers[0].team = 1;
  view.peers[0].flags |= RF_DROP;
  pilot.setIntent(intent, 0);
  pilot.nextCmd(view, intent, nav, world, 122);
  assert.ok(pilot.directiveEnded);
});

test('idle holds orientation and respawn resets the previous aim', () => {
  const { world, nav, view, s, pilot } = fixture();
  s.yaw = 1;
  assert.partialDeepStrictEqual(pilot.nextCmd(view, { kind: 'idle' }, nav, world, 1), {
    buttons: 0,
    yaw: 1,
    weapon: 0,
  });
  view.self = null;
  assert.equal(pilot.nextCmd(view, { kind: 'hunt' }, nav, world, 2).buttons, 0);
  view.self = s;
  s.yaw = -2;
  s.dropping = true;
  const cmd = pilot.nextCmd(view, { kind: 'hunt' }, nav, world, 3);
  assert.ok(Math.abs(cmd.yaw - s.yaw) < 0.1);
});

test('hunt plants as carrier and defuses as defender using the server brain', () => {
  for (const defending of [false, true]) {
    const { world, nav, view, s, pilot } = fixture();
    view.match.mode = 'defuse';
    const site = getMap(0).flagBases[1];
    s.x = site.x;
    s.z = site.z;
    s.y = world.groundBelow(site.x, getMap(0).dropHeight, site.z, 16);
    view.roster[0][3] = defending ? 1 : 0;
    view.bomb = defending
      ? [4, -1, s.x, s.y, s.z, 50000, 0, 0, 0, 0]
      : [1, 1, s.x, s.y, s.z, 0, 0, 0, 0, 0];
    for (let seq = 1; seq <= 2; seq++) {
      const cmd = pilot.nextCmd(view, { kind: 'hunt' }, nav, world, seq);
      assert.ok(cmd.buttons & BTN.USE);
      assert.equal(cmd.buttons & (BTN.FWD | BTN.BACK | BTN.LEFT | BTN.RIGHT), 0);
    }
  }
});

test('hunt plants at the fountain on the ground floor', () => {
  const map = getMap(2);
  const world = new CollisionWorld(map);
  const nav = new NavGrid(world, map);
  assert.ok(map.defuseSite);
  const site = map.defuseSite;
  for (const y of [192, site.y]) {
    const { view, s, pilot } = fixture();
    Object.assign(view.match, { mode: 'defuse', map: 2 });
    Object.assign(s, { x: site.x, y, z: site.z + 96 });
    view.roster[0][3] = 0;
    view.bomb = [1, view.id, s.x, s.y, s.z, 0, 0, 0, 0];
    const cmd = pilot.nextCmd(view, { kind: 'hunt' }, nav, world, 1);
    assert.equal(Boolean(cmd.buttons & BTN.USE), y === site.y);
  }
});

test('hunt calls a waiting colleague with USE, then leads it away toward lunch', () => {
  const map = getMap(2);
  const world = new CollisionWorld(map);
  const nav = new NavGrid(world, map);
  const { view, s, pilot } = fixture();
  Object.assign(view.match, { mode: 'almoco', map: 2 });
  const hold = map.flagBases[1];
  Object.assign(s, { x: hold.x + 30, z: hold.z, y: world.groundBelow(hold.x + 30, map.dropHeight, hold.z, 16) });
  const row = (kind: number, leader: number) => [kind, leader, hold.x, s.y, hold.z, 0];
  view.lunch = [0, 60_000];
  view.colleagues = [row(0, -1)];
  const call = pilot.nextCmd(view, { kind: 'hunt' }, nav, world, 1);
  assert.ok(call.buttons & BTN.USE, 'holds USE beside a waiting colleague');
  view.colleagues = [row(1, view.id)];
  let walked = false;
  for (let seq = 2; seq <= 30 && !walked; seq++) {
    const cmd = pilot.nextCmd(view, { kind: 'hunt' }, nav, world, seq);
    assert.equal(cmd.buttons & BTN.USE, 0, 'no USE while leading');
    walked = (cmd.buttons & (BTN.FWD | BTN.BACK | BTN.LEFT | BTN.RIGHT)) !== 0;
  }
  assert.ok(walked, 'walks toward a restaurant while leading');
  view.colleagues = [row(0, -1)];
  pilot.setIntent({ kind: 'moveTo', x: hold.x + 600, z: hold.z }, s.y);
  const passing = pilot.nextCmd(view, { kind: 'moveTo', x: hold.x + 600, z: hold.z }, nav, world, 40);
  assert.equal(passing.buttons & BTN.USE, 0, 'a move_to past a colleague does not call it');
});

function mall(at: [number, number, number]) {
  const map = getMap(2);
  const world = new CollisionWorld(map);
  const nav = new NavGrid(world, map);
  const view = welcome({
    t: 'welcome', id: 1, time: 1000, roster: [[1, 'agent', 0, 0, 0]],
    match: { phase: 'live', mode: 'tdm', map: 2, endsAt: 10000, teams: [0, 0], limit: 0 },
    maxPlayers: 16, token: '', spectator: null, ready: { kind: 'confirmed' }, idleKickMs: null, idleKickWarmupMs: null,
  });
  const s = createPlayerState();
  view.self = s;
  spawnState(s, at[0], at[1], at[2], 0, WEAPON.RIFLE);
  s.dropping = false;
  s.onGround = true;
  return { world, nav, view, s, pilot: new Pilot(1, () => 0.5) };
}

test('move_to a point on the top floor rides the glass lift, and move_to the ground comes back down', () => {
  const { world, nav, view, s, pilot } = mall([0, 0, -520]);
  const up = { kind: 'moveTo', x: 0, z: -800, y: 384 } as const;
  pilot.setIntent(up, 0);
  let top = 0;
  for (let seq = 1; seq <= 60 * 40 && !pilot.arrived; seq++) {
    world.liftTick = seq;
    applyCmd(world, s, pilot.nextCmd(view, up, nav, world, seq), 1);
    top = Math.max(top, s.y);
  }
  assert.ok(pilot.arrived, `Stopped at ${s.x},${s.y},${s.z}`);
  assert.ok(Math.abs(s.y - 384) <= 20, 'on the Mirante, at ' + s.y);
  const down = { kind: 'moveTo', x: 0, z: -450, y: 0 } as const;
  pilot.setIntent(down, s.y);
  for (let seq = 3000; seq <= 3000 + 60 * 40 && !pilot.arrived; seq++) {
    world.liftTick = seq;
    applyCmd(world, s, pilot.nextCmd(view, down, nav, world, seq), 1);
  }
  assert.ok(pilot.arrived, `Stopped at ${s.x},${s.y},${s.z}`);
  assert.ok(Math.abs(s.y) <= 20, 'back on the ground, at ' + s.y);
});

test('hunt can start a hammer rush after a close hit, with manual reload taking priority', () => {
  const { world, nav, view, s, pilot } = fixture();
  view.id = 6;
  view.roster = [[6, 'agent', 0, 0, 0]];
  view.peers = [{
    id: 2, name: 'enemy', team: 1, enemy: true, alive: true, x: s.x, y: s.y, z: s.z - 150,
    yaw: 0, pitch: 0, flags: RF_ALIVE, weapon: WEAPON.RIFLE, lean: 0,
  }];
  const intent = { kind: 'hunt' } as const;
  for (let seq = 1; seq <= 6; seq++) {
    assert.equal(pilot.nextCmd(view, intent, nav, world, seq).weapon, 0);
  }
  pilot.noteEnemyHit(100);
  pilot.nextCmd(view, intent, nav, world, 7);
  s.health -= 20;
  const actions = new ActionOverlay();
  actions.requestReload();
  const manual = actions.apply(pilot.nextCmd(view, intent, nav, world, 8, actions.manualWeaponControl), s);
  assert.equal(manual.weapon, 0);
  assert.ok(manual.buttons & BTN.RELOAD);
  assert.equal(pilot.nextCmd(view, intent, nav, world, 9, actions.manualWeaponControl).weapon, 3);
});
