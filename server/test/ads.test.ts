import { BTN, RF_AIM, RF_ZOOM, WEAPON, type WeaponId, CollisionWorld, MapBuilder, getMaps } from '@calindra-strike/shared';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Game, type ServerPlayer } from '../src/game.ts';

function flatWorld(): CollisionWorld {
  const b = new MapBuilder();
  b.add(-4000, -32, -4000, 4000, 0, 4000, 'ground');
  return new CollisionWorld({ ...getMaps()[0], boxes: b.boxes });
}

function setup(botFill = 0) {
  let r = 0.37;
  const game = new Game({ maxPlayers: 8, matchMs: 60_000, podiumMs: 5_000, warmupMinPlayers: 2, botFill, random: () => (r = ((r * 9301 + 49297) % 233280) / 233280) });
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

function place(p: ServerPlayer, x: number, z: number, weapon: WeaponId) {
  Object.assign(p.state, { x, y: 0.05, z, vx: 0, vy: 0, vz: 0, dropping: false, onGround: true, protect: 0, deploy: 0, weapon, primary: weapon });
}

const rowOf = (inbox: Map<number, any[]>, viewer: ServerPlayer, id: number): number[] => {
  const snaps = inbox.get(viewer.id)!.filter((m) => m.t === 'snap');
  return snaps.at(-1).ps.find((p: number[]) => p[0] === id);
};

describe('aim down sights on the server', () => {
  let seq = 1;
  const hold = (game: Game, p: ServerPlayer, buttons: number, ticks = 8) => {
    const cmds = Array.from({ length: ticks }, () => ({ seq: seq++, buttons, yaw: 0, pitch: 0, weapon: 0, interp: game.now() }));
    game.input(p, cmds);
    for (let i = 0; i < ticks; i++) game.update();
  };

  it('shows a held aim to the others as RF_AIM and not as the scope', () => {
    const { game, join, inbox } = setup();
    const viewer = join('Viewer');
    const aimer = join('Aimer');
    place(viewer, 300, 0, WEAPON.RIFLE);
    place(aimer, 0, 0, WEAPON.RIFLE);
    for (let i = 0; i < 6; i++) game.update();
    hold(game, aimer, BTN.ATTACK2);
    const row = rowOf(inbox, viewer, aimer.id);
    assert.ok(row[6] & RF_AIM);
    assert.equal(row[6] & RF_ZOOM, 0);
    hold(game, aimer, 0);
    assert.equal(rowOf(inbox, viewer, aimer.id)[6] & RF_AIM, 0);
  });

  it('keeps the AWP scope on RF_ZOOM and never raises RF_AIM', () => {
    const { game, join, inbox } = setup();
    const viewer = join('Viewer');
    const sniper = join('Sniper');
    place(viewer, 300, 0, WEAPON.RIFLE);
    place(sniper, 0, 0, WEAPON.SNIPER);
    for (let i = 0; i < 6; i++) game.update();
    hold(game, sniper, BTN.ATTACK2);
    hold(game, sniper, 0);
    const row = rowOf(inbox, viewer, sniper.id);
    assert.ok(row[6] & RF_ZOOM);
    assert.equal(row[6] & RF_AIM, 0);
  });

  it('tells the player their own aim in the packed state', () => {
    const { game, join, inbox } = setup();
    const aimer = join('Aimer');
    place(aimer, 0, 0, WEAPON.RIFLE);
    for (let i = 0; i < 4; i++) game.update();
    hold(game, aimer, BTN.ATTACK2);
    const me = inbox.get(aimer.id)!.filter((m) => m.t === 'snap').at(-1).me as number[];
    assert.ok(me[6] & 1024, 'F_AIM in the local state flags');
  });

  it('never has a bot aim down sights', () => {
    const { game, join } = setup(7);
    join('Human');
    for (let i = 0; i < 1200; i++) {
      game.update();
      for (const p of game.players.values()) if (p.brain) assert.equal(p.state.aiming, false, 'bot ' + p.name + ' at tick ' + i);
    }
  });
});
