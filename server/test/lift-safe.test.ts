import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BTN, CollisionWorld, MapBuilder, WEAPON, getMap, liftCab } from '@calindra-strike/shared';
import { Game, type ServerPlayer } from '../src/game.ts';

const SHOPPING = 2;

function setup() {
  const game = new Game({ maxPlayers: 8, matchMs: 60_000, podiumMs: 5_000, warmupMinPlayers: 2, modes: 'tdm', maps: ['shopping'], friendlyFire: true });
  const join = (name: string) => game.join(name, 0, WEAPON.RIFLE, () => {}) as ServerPlayer;
  const b = new MapBuilder();
  b.add(-4000, -32, -4000, 4000, 0, 4000, 'ground');
  const shooter = join('shooter');
  const target = join('target');
  game.world = new CollisionWorld({ ...getMap(SHOPPING), boxes: b.boxes });
  return { game, shooter, target, shaft: game.map.lifts[0] };
}

const stand = (p: ServerPlayer, x: number, y: number, z: number) =>
  Object.assign(p.state, { x, y, z, vx: 0, vy: 0, vz: 0, dropping: false, onGround: true, protect: 0, deploy: 0 });

/** The shooter fires once along z at the target and the target's health is read. */
function shootAlongZ(game: Game, shooter: ServerPlayer, target: ServerPlayer, yaw: number): number {
  for (let i = 0; i < 3; i++) game.update();
  game.input(shooter, [{ seq: 1, buttons: BTN.ATTACK, yaw, pitch: 0, weapon: 0, interp: game.now() }]);
  game.update();
  return target.state.health;
}

describe('the lift cab is a safe room', () => {
  it('lets nobody in the cab be shot, even though the shaft is glass', () => {
    const { game, shooter, target, shaft } = setup();
    const z = (shaft.minZ + shaft.maxZ) / 2;
    stand(shooter, 0, 0.05, z + 400);
    stand(target, 0, liftCab(shaft, game.tick).y + 0.05, z);
    assert.equal(shootAlongZ(game, shooter, target, 0), 100);
  });

  it('still hurts someone standing in the empty shaft while the cab is on another floor', () => {
    const { game, shooter, target, shaft } = setup();
    const z = (shaft.minZ + shaft.maxZ) / 2;
    while (liftCab(shaft, game.tick).y < 100) game.update();
    stand(shooter, 0, 0.05, z + 400);
    stand(target, 0, 0.05, z);
    assert.ok(shootAlongZ(game, shooter, target, 0) < 100);
  });

  it('still hurts someone outside the shaft, level with the cab', () => {
    const { game, shooter, target, shaft } = setup();
    const z = (shaft.minZ + shaft.maxZ) / 2;
    stand(shooter, 300, 0.05, z + 400);
    stand(target, 300, liftCab(shaft, game.tick).y + 0.05, z);
    assert.ok(shootAlongZ(game, shooter, target, 0) < 100);
  });

  it('lets a rider shoot out without hurting anyone, so the cab cannot be used as a shooting nest', () => {
    const { game, shooter, target, shaft } = setup();
    const z = (shaft.minZ + shaft.maxZ) / 2;
    stand(shooter, 0, liftCab(shaft, game.tick).y + 0.05, z);
    stand(target, 0, 0.05, z + 400);
    assert.equal(shootAlongZ(game, shooter, target, Math.PI), 100);
  });
});
