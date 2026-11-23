import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_ARMOR, MAX_HEALTH, SUPPLY_COOLDOWN_TICKS, WEAPON, type GameEvent } from '@calindra-strike/shared';
import { Game, type ServerPlayer } from '../src/game.ts';

function setup() {
  const game = new Game({ maxPlayers: 8, matchMs: 600_000, podiumMs: 5_000, warmupMinPlayers: 2, maps: ['shopping'], modes: ['tdm'], random: () => 0.5 });
  const inbox = new Map<number, unknown[]>();
  const join = (name: string): ServerPlayer => {
    const box: unknown[] = [];
    const p = game.join(name, 0, WEAPON.RIFLE, (d) => box.push(JSON.parse(d))) as ServerPlayer;
    inbox.set(p.id, box);
    return p;
  };
  return { game, join, inbox };
}

function stand(p: ServerPlayer, x: number, y: number, z: number, health = 40): void {
  Object.assign(p.state, { x, y, z, vx: 0, vy: 0, vz: 0, dropping: false, onGround: true, protect: 0, deploy: 0, health, armor: 0 });
  p.alive = true;
}

const supplyEvents = (box: unknown[]): GameEvent[] =>
  (box as { t: string; e?: GameEvent[] }[]).filter((m) => m.t === 'ev').flatMap((m) => m.e ?? []).filter((e) => e.k === 'supply');

describe('Mirante supply stand', () => {
  it('restocks a hurt player standing on it, announces it, and stays empty for the cooldown', () => {
    const { game, join, inbox } = setup();
    const a = join('A');
    const b = join('B');
    stand(b, 600, 0, 0);
    stand(a, 10, 384.05, -870);
    game.update();
    assert.equal(a.state.health, MAX_HEALTH);
    assert.equal(a.state.armor, MAX_ARMOR);
    assert.deepEqual(supplyEvents(inbox.get(b.id)!), [{ k: 'supply', id: a.id, at: 0 }]);
    stand(b, 0, 384.05, -880);
    game.update();
    const health = (): number => b.state.health;
    assert.equal(health(), 40, 'the stand is empty');
    for (let i = 0; i < SUPPLY_COOLDOWN_TICKS && health() < MAX_HEALTH; i++) {
      stand(b, 0, 384.05, -880);
      game.update();
    }
    assert.equal(health(), MAX_HEALTH, 'it fills again after the cooldown');
  });

  it('is kept for whoever needs it: a player with everything walks over it and leaves it full', () => {
    const { game, join } = setup();
    const a = join('A');
    join('B');
    stand(a, 0, 384.05, -880, MAX_HEALTH);
    a.state.armor = MAX_ARMOR;
    game.update();
    const b = join('C');
    stand(b, 0, 384.05, -880);
    game.update();
    assert.equal(b.state.health, MAX_HEALTH);
  });

  it('is not reachable from the food court below, from a dead player or from a falling one', () => {
    const { game, join } = setup();
    const a = join('A');
    const b = join('B');
    stand(a, 0, 192.05, -880);
    game.update();
    assert.equal(a.state.health, 40);
    stand(a, 0, 384.05, -880);
    a.alive = false;
    stand(b, 0, 384.05, -880);
    b.state.dropping = true;
    game.update();
    assert.equal(b.state.health, 40);
  });

  it('shows in every snapshot, zero while full and the time it fills again after a restock', () => {
    const { game, join, inbox } = setup();
    const a = join('A');
    join('B');
    for (let i = 0; i < 3; i++) game.update();
    const snaps = () => (inbox.get(a.id) as { t: string; su?: number[] }[]).filter((m) => m.t === 'snap');
    assert.deepEqual(snaps().at(-1)?.su, [0, 0]);
    stand(a, 0, 384.05, 880);
    for (let i = 0; i < 6; i++) game.update();
    const su = snaps().at(-1)?.su;
    assert.equal(su?.[0], 0);
    assert.ok((su?.[1] ?? 0) > game.now(), 'the south stand fills later: ' + su);
  });
});
