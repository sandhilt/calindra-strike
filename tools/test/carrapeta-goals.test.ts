import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BTN, RF_ALIVE, TICK_MS, WEAPON, createPlayerState, packState, spawnState } from '../../shared/src/index.ts';
import { BotDriver, type DriveView, type Snap } from '../bot-driver.ts';
import { brainFor } from '../brains.ts';
import { patrolPoint, type BotPlayer } from '../drive-goals.ts';

const self: BotPlayer = { id: 1, team: -1, x: -100, y: 0, z: -1500, alive: true, dropping: false };
const holder: BotPlayer = { ...self, id: 2, z: -1150 };
const bystander: BotPlayer = { ...self, id: 3, z: -1300 };
const held = (id: number): Snap['ca'] => ({ kind: 'held', holder: id, sinceMs: 0, frenzyUntilMs: 0 });

function snapshot(ca: Snap['ca'], players: readonly BotPlayer[] = []): Snap {
  const state = createPlayerState();
  spawnState(state, self.x, self.y, self.z, 0, WEAPON.RIFLE);
  state.dropping = false;
  state.onGround = true;
  return {
    t: 'snap', time: 0, ack: 0, me: packState(state),
    ps: players.map(({ id, x, y, z }) => [id, x, y, z, 0, 0, RF_ALIVE]),
    ad: [], fl: [], bm: [], lu: [], lc: [], su: [], ca,
  };
}

function driveView(ca: Snap['ca'], players: BotPlayer[], decide: (view: DriveView) => void) {
  const driver = new BotDriver({ decide(view) { decide(view); return null; } });
  driver.drive(snapshot(ca, players), 0, self.id, new Map([self, ...players].map(p => [p.id, p.team])), 0, 'carrapeta');
}

function goal(ca: Snap['ca'], players: BotPlayer[] = [], enemy: BotPlayer | null = null, leg = 0) {
  const brain = brainFor('carrapeta');
  assert.ok(brain);
  let result;
  driveView(ca, players, view => { result = brain.decide({ ...view, enemy, leg }); });
  return result;
}

test('dev bots head to the dropped Carrapeta', () => {
  const point = { x: -200, y: 32, z: -1200 };
  assert.deepEqual(goal({ kind: 'dropped', ...point, rerollAtMs: 1000, frenzyUntilMs: 0 }),
    { role: 'pickup', point });
});

test('dev bots chase the holder and update the destination as it moves', () => {
  const moved = { ...holder, x: holder.x + 100 };
  for (const player of [holder, moved]) {
    assert.partialDeepStrictEqual(goal(held(holder.id), [player]), {
      role: 'chase', point: { x: player.x, y: player.y, z: player.z },
    });
  }
});

test('the holder evades visible enemies and patrols when alone', () => {
  const evade = goal(held(self.id), [holder], holder);
  assert.equal(evade?.roam, true);
  assert.ok(evade.point.z < self.z);
  assert.deepEqual(goal(held(self.id))?.point, patrolPoint(self, self.id, 0));
});

test('dev bots patrol when there is no holder or drop', () => {
  const none = { kind: 'none', frenzyUntilMs: 0 } as const;
  assert.deepEqual(goal(none), { role: 'patrol', point: patrolPoint(self, self.id, 0), roam: true });
  assert.deepEqual(goal(undefined, [], null, 1)?.point, patrolPoint(self, self.id, 1));
});

test('team-less dev bots target only legal Carrapeta enemies', () => {
  const target = (view: DriveView) => view.enemy?.z;
  driveView(held(holder.id), [bystander, holder], view => assert.equal(target(view), holder.z));
  driveView(held(holder.id), [bystander], view => assert.equal(target(view), undefined));
  driveView(held(self.id), [holder, bystander], view => assert.equal(target(view), bystander.z));
  driveView(undefined, [bystander], view => assert.equal(target(view), bystander.z));
});

test('the Carrapeta holder keeps steering during combat', () => {
  const brain = brainFor('carrapeta');
  assert.ok(brain);
  const driver = new BotDriver(brain, 1, () => 0.01);
  const snap = snapshot(held(self.id), [bystander]);
  const teams = new Map([[self.id, -1], [bystander.id, -1]]);
  let fired = false;
  for (let tick = 1; tick <= 60; tick++) {
    const { buttons } = driver.drive({ ...snap, time: tick * TICK_MS }, 0, self.id, teams, tick, 'carrapeta');
    assert.ok(buttons & (BTN.FWD | BTN.BACK | BTN.LEFT | BTN.RIGHT));
    fired ||= Boolean(buttons & BTN.ATTACK);
  }
  assert.ok(fired);
});
