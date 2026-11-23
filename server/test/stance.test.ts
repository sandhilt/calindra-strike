import { BTN, CollisionWorld, MapBuilder, RF_PRONE, RF_SLIDE, RF_SPRINT, STANCE, STANCES, WEAPON, getMaps, giveWeapon, leanOfRow, stanceFromFlags } from '@calindra-strike/shared';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Game, type ServerPlayer } from '../src/game.ts';
import { aimHeight, sightHeights } from '../src/bot.ts';

function flatWorld(): CollisionWorld {
  const b = new MapBuilder();
  b.add(-4000, -32, -4000, 4000, 0, 4000, 'ground');
  return new CollisionWorld({ ...getMaps()[0], boxes: b.boxes });
}

function setup() {
  let r = 0.37;
  const game = new Game({ maxPlayers: 8, matchMs: 60_000, podiumMs: 5_000, warmupMinPlayers: 2, random: () => (r = (r * 9301 + 49297) % 233280 / 233280) });
  const inbox = new Map<number, any[]>();
  const join = (name: string) => {
    const box: any[] = [];
    const p = game.join(name, 0, WEAPON.RIFLE, (d) => box.push(JSON.parse(d))) as ServerPlayer;
    inbox.set(p.id, box);
    return p;
  };
  game.world = flatWorld();
  return { game, join, inbox };
}

function place(p: ServerPlayer, x: number, z: number) {
  Object.assign(p.state, { x, y: 0.05, z, vx: 0, vy: 0, vz: 0, dropping: false, onGround: true, protect: 0, deploy: 0 });
}

describe('lag compensated hits follow the pose', () => {
  const shootAcrossTheHead = (leanButton: number) => {
    const { game, join } = setup();
    const shooter = join('Shooter');
    const target = join('Target');
    place(shooter, 14, 500);
    place(target, 0, 0);
    for (let i = 0; i < 5; i++) game.update();
    const leaning = Array.from({ length: 8 }, (_, i) => ({ seq: i + 1, buttons: leanButton, yaw: 0, pitch: 0, weapon: 0, interp: game.now() }));
    game.input(target, leaning);
    for (let i = 0; i < 10; i++) game.update();
    game.input(shooter, [{ seq: 1, buttons: BTN.ATTACK, yaw: 0, pitch: 0, weapon: 0, interp: game.now() }]);
    game.update();
    return { shooter, target };
  };

  it('finds a leaned head beside the body line', () => {
    const { shooter, target } = shootAcrossTheHead(BTN.LEAN_RIGHT);
    assert.equal(target.alive, false);
    assert.equal(shooter.headshots, 1);
  });

  it('misses the same spot when the target does not lean', () => {
    const { target } = shootAcrossTheHead(0);
    assert.equal(target.alive, true);
  });

  it('does not hit a prone player at standing head height', () => {
    const { game, join } = setup();
    const shooter = join('Shooter');
    const target = join('Target');
    place(shooter, 0, 500);
    place(target, 0, 0);
    target.state.stance = STANCE.PRONE;
    for (let i = 0; i < 5; i++) game.update();
    game.input(shooter, [{ seq: 1, buttons: BTN.ATTACK, yaw: 0, pitch: 0, weapon: 0, interp: game.now() }]);
    game.update();
    assert.equal(target.alive, true);
  });
});

describe('snapshots', () => {
  it('carry stance, sprint, slide and lean of the other players', () => {
    const { game, join, inbox } = setup();
    const viewer = join('Viewer');
    const mover = join('Mover');
    place(viewer, 300, 0);
    place(mover, 0, 0);
    Object.assign(mover.state, { stance: STANCE.PRONE, sprinting: true, slide: 5, lean: 0.456 });
    for (let i = 0; i < 6; i++) game.update();
    const snaps = inbox.get(viewer.id)!.filter((m) => m.t === 'snap');
    const row = snaps.at(-1).ps.find((p: number[]) => p[0] === mover.id);
    assert.ok(row);
    assert.equal(stanceFromFlags(row[6]), STANCE.PRONE);
    assert.ok(row[6] & RF_PRONE && row[6] & RF_SPRINT && row[6] & RF_SLIDE);
    assert.equal(leanOfRow(row), 0.46);
  });
});

it('applies hammer heavy damage on secondary-only and light damage with both buttons', () => {
  for (const [buttons, damage] of [[BTN.ATTACK2, 95], [BTN.ATTACK | BTN.ATTACK2, 55]]) {
    const { game, join } = setup();
    const attacker = join('Attacker');
    const target = join('Target');
    place(attacker, 0, 50);
    place(target, 0, 0);
    giveWeapon(attacker.state, WEAPON.HAMMER);
    attacker.state.deploy = 0;
    target.state.armor = 0;
    for (let i = 0; i < 5; i++) game.update();
    game.input(attacker, [{ seq: 1, buttons, yaw: 0, pitch: -0.45, weapon: 0, interp: game.now() }]);
    game.update();
    assert.equal(target.state.health, 100 - damage);
  }
});

describe('bot aim heights', () => {
  it('come from the stance table', () => {
    assert.equal(aimHeight(STANCE.STAND, true), 64);
    assert.equal(aimHeight(STANCE.STAND, false), 44);
    assert.equal(aimHeight(STANCE.CROUCH, true), 30);
    assert.equal(aimHeight(STANCE.CROUCH, false), 20);
    assert.ok(aimHeight(STANCE.PRONE, true) < aimHeight(STANCE.CROUCH, false));
    assert.deepEqual(sightHeights(STANCE.PRONE), [STANCES[STANCE.PRONE].aimBody, STANCES[STANCE.PRONE].aimHead]);
  });
});
