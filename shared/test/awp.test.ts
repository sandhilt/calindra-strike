import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { closeTo } from './helpers.ts';
import {
  BTN,
  CollisionWorld,
  type MapDef,
  MapBuilder,
  WEAPON,
  applyCmd,
  computeSpread,
  createPlayerState,
  getMaps,
  giveWeapon,
  packState,
  parseClientMessage,
  pickLegendary,
  spawnState,
  unpackState,
  weaponDef,
} from '../src/index.ts';

function world(): CollisionWorld {
  const b = new MapBuilder();
  b.add(-4000, -32, -4000, 4000, 0, 4000, 'ground');
  const map: MapDef = { ...getMaps()[0], boxes: b.boxes };
  return new CollisionWorld(map);
}

let seq = 0;
function tick(w: CollisionWorld, s: ReturnType<typeof createPlayerState>, buttons = 0, n = 1) {
  const shots = [];
  for (let i = 0; i < n; i++) {
    const shot = applyCmd(w, s, { seq: seq++, buttons, yaw: 0, pitch: 0, weapon: 0, interp: 0 }, 9);
    if (shot) shots.push(shot);
  }
  return shots;
}

function awpPlayer() {
  const w = world();
  const s = createPlayerState();
  spawnState(s, 0, 0.1, 0, 0, WEAPON.RIFLE);
  s.dropping = false;
  tick(w, s, 0, 10);
  giveWeapon(s, WEAPON.SNIPER);
  tick(w, s, 0, weaponDef(WEAPON.SNIPER).deployTicks + 2);
  return { w, s };
}

describe('Mjölnir (CS 1.6 AWP)', () => {
  it('uses the CS zoom levels: 40, then 10, then off', () => {
    const { w, s } = awpPlayer();
    assert.deepEqual(weaponDef(WEAPON.SNIPER).zoomFov, [40, 10]);
    tick(w, s, BTN.ATTACK2);
    tick(w, s);
    assert.equal(s.zoom, 1);
    tick(w, s, BTN.ATTACK2);
    tick(w, s);
    assert.equal(s.zoom, 2);
    tick(w, s, BTN.ATTACK2);
    assert.equal(s.zoom, 0);
  });

  it('follows the 1.6 accuracy table', () => {
    const { w, s } = awpPlayer();
    closeTo(computeSpread(s), 0.081, 6); // unscoped, standing
    tick(w, s, BTN.ATTACK2);
    tick(w, s);
    closeTo(computeSpread(s), 0.001, 6); // scoped, standing still
    tick(w, s, BTN.DUCK, 5);
    assert.equal(computeSpread(s), 0); // scoped + crouched: dead on
    tick(w, s, 0, 5);
    tick(w, s, BTN.FWD, 60);
    closeTo(computeSpread(s), 0.25, 6); // running scoped (150 u/s > 140)
    tick(w, s, 0, 60);
    tick(w, s, BTN.FWD | BTN.WALK, 60);
    closeTo(computeSpread(s), 0.1, 6); // shift-walking scoped (78 u/s)
    tick(w, s, BTN.JUMP);
    tick(w, s);
    closeTo(computeSpread(s), 0.85, 6); // airborne
  });

  it('drops the scope after a shot and re-scopes when the bolt is done', () => {
    const { w, s } = awpPlayer();
    tick(w, s, BTN.ATTACK2);
    tick(w, s);
    assert.equal(s.zoom, 1);
    const shots = tick(w, s, BTN.ATTACK);
    assert.equal(shots.length, 1);
    assert.equal(s.zoom, 0);
    assert.equal(s.resumeZoom, 1);
    tick(w, s, 0, weaponDef(WEAPON.SNIPER).fireTicks + 1);
    assert.equal(s.zoom, 1);
    assert.equal(s.resumeZoom, 0);
  });

  it('cancels the re-scope with right click during the bolt', () => {
    const { w, s } = awpPlayer();
    tick(w, s, BTN.ATTACK2);
    tick(w, s);
    tick(w, s, BTN.ATTACK);
    tick(w, s, BTN.ATTACK2);
    tick(w, s, 0, weaponDef(WEAPON.SNIPER).fireTicks + 1);
    assert.equal(s.zoom, 0);
  });

  it('one-shots a 100 hp body: 115 damage', () => {
    assert.equal(weaponDef(WEAPON.SNIPER).damage, 115);
  });

  it('round-trips the pending re-scope through snapshots', () => {
    const { w, s } = awpPlayer();
    tick(w, s, BTN.ATTACK2);
    tick(w, s);
    tick(w, s, BTN.ATTACK);
    const b = createPlayerState();
    unpackState(packState(s), b);
    assert.equal(b.resumeZoom, 1);
    assert.equal(b.zoom, 0);
  });

  it('is the most common airdrop', () => {
    let awp = 0;
    for (let i = 0; i < 100; i++) if (pickLegendary(i / 100) === WEAPON.SNIPER) awp++;
    assert.equal(awp, 65);
  });
});

describe('team switch message', () => {
  it('accepts teams 0 and 1 only', () => {
    assert.deepEqual(parseClientMessage('{"t":"team","team":1}'), { t: 'team', team: 1 });
    assert.equal(parseClientMessage('{"t":"team","team":2}'), null);
    assert.equal(parseClientMessage('{"t":"team","team":"0"}'), null);
  });
});
