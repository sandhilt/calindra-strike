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
    idleKickMs: null,
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
