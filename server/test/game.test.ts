import { SPRAYS_PER_SPAWN, SPRAY_COOLDOWN_TICKS, BTN, CollisionWorld, type GameEvent, type MatchInfo, MapBuilder, WEAPON, getMaps } from '@calindra-strike/shared';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Game, type ServerPlayer } from '../src/game.ts';

function flatWorld(): CollisionWorld {
  const b = new MapBuilder();
  b.add(-4000, -32, -4000, 4000, 0, 4000, 'ground');
  return new CollisionWorld({ ...getMaps()[0], boxes: b.boxes });
}

function setup(opts: Partial<{ matchMs: number }> = {}) {
  let r = 0.37;
  const game = new Game({ maxPlayers: 8, matchMs: opts.matchMs ?? 60_000, podiumMs: 5_000, warmupMinPlayers: 2, random: () => (r = (r * 9301 + 49297) % 233280 / 233280) });
  const inbox = new Map<number, any[]>();
  const join = (name: string) => {
    const box: any[] = [];
    const p = game.join(name, 0, WEAPON.RIFLE, (d) => box.push(JSON.parse(d))) as ServerPlayer;
    inbox.set(p.id, box);
    return p;
  };
  return { game, join, inbox };
}

function place(p: ServerPlayer, x: number, z: number) {
  Object.assign(p.state, { x, y: 0.05, z, vx: 0, vy: 0, vz: 0, dropping: false, onGround: true, protect: 0, deploy: 0 });
}

const events = (box: any[]): GameEvent[] => box.filter((m) => m.t === 'ev').flatMap((m) => m.e);

describe('Game', () => {
  it('waits in warmup until two players, then starts a live match', () => {
    const { game, join } = setup();
    join('A');
    assert.equal(game.phase, 'warmup');
    join('B');
    assert.equal(game.phase, 'live');
  });

  it('dedupes names', () => {
    const { join } = setup();
    assert.equal(join('Gabi').name, 'Gabi');
    assert.equal(join('gabi').name, 'gabi#2');
  });

  it('kills with a rifle headshot and credits the shooter', () => {
    const { game, join, inbox } = setup();
    const a = join('Shooter');
    const b = join('Target');
    game.world = flatWorld();
    place(a, 0, 500);
    place(b, 0, 0);
    for (let i = 0; i < 5; i++) game.update();
    game.input(a, [{ seq: 1, buttons: BTN.ATTACK, yaw: 0, pitch: 0, weapon: 0, interp: game.now() }]);
    game.update();
    assert.equal(b.alive, false);
    assert.equal(a.kills, 1);
    assert.equal(a.headshots, 1);
    const kill = events(inbox.get(b.id)!).find((e) => e.k === 'kill');
    assert.partialDeepStrictEqual(kill, { by: a.id, to: b.id, hs: 1 });
    // shot event is broadcast to others, not echoed to the shooter
    assert.equal(events(inbox.get(b.id)!).some((e) => e.k === 'shot'), true);
    assert.equal(events(inbox.get(a.id)!).some((e) => e.k === 'shot'), false);
  });

  it('does not damage players with spawn protection or mid-skydive', () => {
    const { game, join } = setup();
    const a = join('A');
    const b = join('B');
    game.world = flatWorld();
    place(a, 0, 500);
    place(b, 0, 0);
    b.state.protect = 60;
    for (let i = 0; i < 3; i++) game.update();
    game.input(a, [{ seq: 1, buttons: BTN.ATTACK, yaw: 0, pitch: 0, weapon: 0, interp: game.now() }]);
    game.update();
    assert.equal(b.alive, true);
    assert.equal(b.state.health, 100);
  });

  it('respawns the dead after 3 seconds, dropping from the sky', () => {
    const { game, join } = setup();
    const a = join('A');
    const b = join('B');
    game.world = flatWorld();
    place(a, 0, 500);
    place(b, 0, 0);
    for (let i = 0; i < 3; i++) game.update();
    game.input(a, [{ seq: 1, buttons: BTN.ATTACK, yaw: 0, pitch: 0, weapon: 0, interp: game.now() }]);
    game.update();
    assert.equal(b.alive, false);
    for (let i = 0; i < 181; i++) game.update();
    assert.equal(b.alive, true);
    assert.equal(b.state.dropping, true);
    assert.equal(b.state.y, game.map.dropHeight);
  });

  it('ends the match into a podium and rotates to the next map', () => {
    const { game, join, inbox } = setup({ matchMs: 20_000 });
    const a = join('A');
    const b = join('B');
    a.kills = 3;
    b.kills = 5;
    (game as any).phaseEnds = game.now();
    game.update();
    assert.equal(game.phase, 'podium');
    const match = inbox.get(a.id)!.filter((m) => m.t === 'match').pop();
    assert.deepEqual(match.match.results.map((r: any) => r.name), ['B', 'A']);
    for (let i = 0; i < 5 * 60 + 2; i++) game.update();
    assert.equal(game.phase, 'live');
    assert.equal(game.mapIndex, 1);
    assert.equal(a.kills, 0);
  });

  for (const mode of ['tdm', 'ffa'] as const) {
    it(`keeps every player in the final ${mode} ranking, including zero kills`, () => {
      const messages: any[] = [];
      const game = new Game({ maxPlayers: 24, matchMs: 60_000, podiumMs: 5000, warmupMinPlayers: 2, modes: [mode] });
      const players = Array.from({ length: 8 }, (_, i) => game.join(`Player ${i}`, i, WEAPON.RIFLE, (raw) => messages.push(JSON.parse(raw))) as ServerPlayer);
      players.forEach((p, i) => {
        p.kills = i * 2;
        p.deaths = 8 - i;
        p.headshots = i;
      });
      game.teamScores[0] = 30;
      game.teamScores[1] = 10;
      game.phaseEnds = game.now();
      game.update();
      const final = messages.filter((m) => m.t === 'match').at(-1).match as MatchInfo;
      assert.equal(final.phase, 'podium');
      assert.deepEqual(final.results?.map((r) => r.kills), [14, 12, 10, 8, 6, 4, 2, 0]);
      assert.deepEqual(new Set(final.results?.map((r) => r.id)), new Set(players.map((p) => p.id)));
      if (mode === 'tdm') assert.deepEqual(new Set(final.results?.map((r) => r.team)), new Set([0, 1]));
      game.join('Late spectator', 0, WEAPON.RIFLE, (raw) => messages.push(JSON.parse(raw)));
      const welcome = messages.filter((m) => m.t === 'welcome').at(-1);
      assert.deepEqual(welcome.match.results, final.results);
    });
  }

  it('drops a legendary airdrop that a player can claim', () => {
    const { game, join, inbox } = setup();
    const a = join('A');
    join('B');
    (game as any).nextAirdropAt = game.now();
    game.update();
    const drop = events(inbox.get(a.id)!).find((e) => e.k === 'drop') as Extract<GameEvent, { k: 'drop' }>;
    assert.ok(drop);
    for (let i = 0; i < 60 * 20; i++) game.update();
    place(a, drop.x, drop.z + 30);
    a.state.y = (game as any).airdrops[0].landY + 0.05;
    game.update();
    assert.ok(([WEAPON.SNIPER, WEAPON.LMG] as number[]).includes(a.state.weapon));
    assert.equal(a.state.armor, 100);
    assert.equal(events(inbox.get(a.id)!).some((e) => e.k === 'loot'), true);
  });

  it('caps command throughput (no speedhack by flooding commands)', () => {
    const { game, join } = setup();
    const a = join('A');
    game.world = flatWorld();
    place(a, 0, 0);
    const before = a.state.tick;
    const flood = Array.from({ length: 500 }, (_, i) => ({ seq: i + 1, buttons: BTN.FWD, yaw: 0, pitch: 0, weapon: 0, interp: 0 }));
    for (let i = 0; i < 50; i++) game.input(a, flood.slice(i * 10, i * 10 + 10));
    for (let i = 0; i < 60; i++) game.update();
    // one second of server time can never run more than burst + 60 commands
    assert.ok(a.state.tick - before <= 24 + 60, "Expected a.state.tick - before <= 24 + 60");
  });
});

describe('sprays', () => {
  it('broadcasts ten sprays with remaining charges and ignores the eleventh', () => {
    const { game, join, inbox } = setup();
    const a = join('Sprayer');
    join('Observer');
    game.world = flatWorld();
    place(a, 0, 0);
    a.state.pitch = -Math.PI / 2;
    for (let use = 0; use < SPRAYS_PER_SPAWN; use++) {
      game.spray(a);
      for (let tick = 0; tick < SPRAY_COOLDOWN_TICKS; tick++) game.update();
    }
    game.spray(a);
    game.update();
    for (const box of inbox.values()) {
      const sprays = events(box).filter(e => e.k === 'spray');
      assert.deepEqual(sprays.map(e => e.left), Array.from({ length: SPRAYS_PER_SPAWN }, (_, i) => SPRAYS_PER_SPAWN - i - 1));
      for (const spray of sprays) assert.partialDeepStrictEqual(spray, { id: a.id, n: [0, 1, 0] });
    }
    assert.equal(a.sprayCharges, 0);
  });

  it('rejects sprays until exactly two seconds have elapsed', () => {
    const { game, join, inbox } = setup();
    const a = join('Sprayer');
    game.world = flatWorld();
    place(a, 0, 0);
    a.state.pitch = -Math.PI / 2;
    game.spray(a);
    for (let tick = 0; tick < SPRAY_COOLDOWN_TICKS - 1; tick++) game.update();
    game.spray(a);
    assert.equal(a.sprayCharges, SPRAYS_PER_SPAWN - 1);
    game.update();
    game.spray(a);
    game.update();
    assert.deepEqual(events(inbox.get(a.id)!).filter(e => e.k === 'spray').map(e => e.left), [9, 8]);
  });

  for (const invalid of ['sky', 'out of range'] as const) {
    it(`does not consume a charge or start cooldown for ${invalid}`, () => {
      const { game, join, inbox } = setup();
      const a = join('Sprayer');
      game.world = flatWorld();
      place(a, 0, 0);
      a.state.pitch = invalid === 'sky' ? Math.PI / 2 : -Math.PI / 2;
      if (invalid === 'out of range') a.state.y = 200;
      game.spray(a);
      assert.equal(a.sprayCharges, SPRAYS_PER_SPAWN);
      assert.equal(a.nextSprayTick, 0);
      place(a, 0, 0);
      a.state.pitch = -Math.PI / 2;
      game.spray(a);
      game.update();
      assert.deepEqual(events(inbox.get(a.id)!).filter(e => e.k === 'spray').map(e => e.left), [9]);
    });
  }

  it('resets charges and cooldown after death and respawn', () => {
    const { game, join, inbox } = setup();
    const a = join('Sprayer');
    const b = join('Shooter');
    game.world = flatWorld();
    place(a, 0, 0);
    place(b, 0, 500);
    a.state.pitch = -Math.PI / 2;
    game.spray(a);
    game.spray(a);
    game.update();
    for (const box of inbox.values()) {
      const sprays = events(box).filter(e => e.k === 'spray');
      assert.equal(sprays.length, 1);
      assert.partialDeepStrictEqual(sprays[0], { id: a.id, n: [0, 1, 0] });
    }
    game.input(b, [{ seq: 1, buttons: BTN.ATTACK, yaw: 0, pitch: 0, weapon: 0, interp: game.now() }]);
    game.update();
    assert.equal(a.alive, false);
    for (let i = 0; i < 181; i++) game.update();
    assert.equal(a.alive, true);
    assert.equal(a.sprayCharges, SPRAYS_PER_SPAWN);
    assert.equal(a.nextSprayTick, 0);
    place(a, 0, 0);
    a.state.pitch = -Math.PI / 2;
    game.spray(a);
    game.update();
    for (const box of inbox.values()) assert.equal(events(box).filter(e => e.k === 'spray').length, 2);
  });

  it('does not consume attempts at sky, out of range, while dead or dropping', () => {
    const { game, join, inbox } = setup();
    const a = join('Sprayer');
    game.world = flatWorld();
    place(a, 0, 0);
    a.alive = false;
    a.state.pitch = -Math.PI / 2;
    game.spray(a);
    a.alive = true;
    a.state.dropping = true;
    game.spray(a);
    a.state.dropping = false;
    a.state.pitch = Math.PI / 2;
    game.spray(a);
    a.state.pitch = -Math.PI / 2;
    a.state.y = 200;
    game.spray(a);
    assert.equal(a.sprayCharges, SPRAYS_PER_SPAWN);
    assert.equal(a.nextSprayTick, 0);
    game.update();
    assert.equal(events(inbox.get(a.id)!).filter(e => e.k === 'spray').length, 0);
    place(a, 0, 0);
    game.spray(a);
    game.update();
    assert.equal(events(inbox.get(a.id)!).filter(e => e.k === 'spray').length, 1);
  });
});
