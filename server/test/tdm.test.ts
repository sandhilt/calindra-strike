import { BTN, CollisionWorld, MapBuilder, WEAPON, getMaps } from '@calindra-strike/shared';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Game, type ServerPlayer } from '../src/game.ts';

function flatWorld(): CollisionWorld {
  const b = new MapBuilder();
  b.add(-4000, -32, -4000, 4000, 0, 4000, 'ground');
  return new CollisionWorld({ ...getMaps()[0], boxes: b.boxes });
}

function setup(n: number, opts: { tdmLimit?: number; friendlyFire?: boolean } = {}) {
  let r = 0.42;
  const game = new Game({
    maxPlayers: 16,
    matchMs: 120_000,
    podiumMs: 5_000,
    warmupMinPlayers: 2,
    modes: 'mixed',
    tdmLimit: opts.tdmLimit ?? 50,
    friendlyFire: opts.friendlyFire,
    random: () => (r = ((r * 9301 + 49297) % 233280) / 233280),
  });
  const inbox = new Map<number, any[]>();
  const players: ServerPlayer[] = [];
  for (let i = 0; i < n; i++) {
    const box: any[] = [];
    const p = game.join(`P${i}`, 0, WEAPON.RIFLE, (d) => box.push(JSON.parse(d))) as ServerPlayer;
    inbox.set(p.id, box);
    players.push(p);
  }
  return { game, players, inbox };
}

function place(p: ServerPlayer, x: number, z: number) {
  Object.assign(p.state, { x, y: 0.05, z, vx: 0, vy: 0, vz: 0, dropping: false, onGround: true, protect: 0, deploy: 0 });
}

function headshot(game: Game, shooter: ServerPlayer, victim: ServerPlayer) {
  game.world = flatWorld();
  place(shooter, 0, 500);
  place(victim, 0, 0);
  for (let i = 0; i < 3; i++) game.update();
  game.input(shooter, [{ seq: shooter.lastSeq + 1, buttons: BTN.ATTACK, yaw: 0, pitch: 0, weapon: 0, interp: game.now() }]);
  game.update();
}

describe('Team Deathmatch', () => {
  it('opens the rotation with TDM and splits players evenly', () => {
    const { game, players } = setup(5);
    assert.equal(game.mode, 'tdm');
    assert.equal(game.phase, 'live');
    const a = players.filter((p) => p.team === 0).length;
    const b = players.filter((p) => p.team === 1).length;
    assert.ok(Math.abs(a - b) <= 1, "Expected Math.abs(a - b) <= 1");
    assert.equal(a + b, 5);
  });

  it('has no friendly fire', () => {
    const { game, players } = setup(4);
    const [s, mate] = players.filter((p) => p.team === 0);
    headshot(game, s, mate);
    assert.equal(mate.alive, true);
    assert.equal(mate.state.health, 100);
    assert.deepEqual(game.teamScores, [0, 0]);
  });

  it('hurts teammates when friendly fire is on, without crediting the shooter', () => {
    const { game, players } = setup(4, { friendlyFire: true });
    const [s, mate] = players.filter((p) => p.team === 0);
    headshot(game, s, mate);
    assert.equal(mate.alive, false);
    assert.equal(mate.deaths, 1);
    assert.equal(s.kills, 0);
    assert.equal(s.headshots, 0);
    assert.equal(s.streak, 0);
    assert.deepEqual(game.teamScores, [0, 0]);
  });

  it('scores enemy kills for the team and ends at the kill limit', () => {
    const { game, players, inbox } = setup(2, { tdmLimit: 1 });
    const [s, enemy] = players[0].team === 0 ? players : [players[1], players[0]];
    headshot(game, s, enemy);
    assert.equal(enemy.alive, false);
    assert.equal(game.teamScores[s.team], 1);
    game.update();
    assert.equal(game.phase, 'podium');
    const match = inbox.get(s.id)!.filter((m) => m.t === 'match').pop().match;
    assert.equal(match.mode, 'tdm');
    assert.equal(match.winner, s.team);
    assert.partialDeepStrictEqual(match.results[0], { id: s.id, team: s.team, kills: 1 });
  });

  it('lets players move only to the smaller team', () => {
    const { game, players } = setup(3);
    const big = players.filter((p) => p.team === 0).length > 1 ? 0 : 1;
    const mover = players.find((p) => p.team === big)!;
    const loner = players.find((p) => p.team !== big)!;
    game.switchTeam(loner, big); // joining the bigger side (2) is blocked
    assert.equal(loner.team, 1 - big);
    game.switchTeam(mover, 1 - big); // joining the smaller side (1) is allowed, like CS
    assert.equal(mover.team, 1 - big);
    assert.equal(mover.alive, false); // switching sides costs a respawn, not a death
    const stayer = players.find((p) => p.team === big)!;
    game.switchTeam(stayer, 1 - big); // now 1 vs 2: blocked
    assert.equal(stayer.team, big);
    assert.equal(mover.deaths, 0);
  });

  it('drops each team over its own half of the map', () => {
    const { game, players } = setup(6);
    for (const p of players) {
      if (p.team === 0) assert.ok(p.state.z < 0, "Expected p.state.z < 0");
      else assert.ok(p.state.z > 0, "Expected p.state.z > 0");
      assert.equal(p.state.y, game.map.dropHeight);
    }
  });

  it('auto-balances a player from a side that is 2 bigger when they respawn', () => {
    const { game, players } = setup(4);
    const team1 = players.filter((p) => p.team === 1);
    game.leave(team1[0].id);
    game.leave(team1[1].id); // 2 vs 0
    const victim = players.find((p) => p.team === 0)!;
    victim.alive = false;
    victim.respawnAt = game.tick + 1;
    game.update();
    game.update();
    assert.equal(victim.alive, true);
    assert.equal(victim.team, 1);
  });

  it('rotates TDM Forja -> FFA Escritório -> FFA Forja -> TDM Escritório', () => {
    const { game } = setup(2);
    const seen: string[] = [];
    for (let m = 0; m < 4; m++) {
      seen.push(`${game.mode}@${game.mapIndex}`);
      (game as any).phaseEnds = game.now();
      game.update(); // -> podium
      for (let i = 0; i < 5 * 60 + 2; i++) game.update(); // -> next match
    }
    assert.deepEqual(seen, ['tdm@0', 'ffa@1', 'ffa@0', 'tdm@1']);
  });

  it('clears teams in free-for-all', () => {
    const { game, players } = setup(2);
    (game as any).phaseEnds = game.now();
    game.update();
    for (let i = 0; i < 5 * 60 + 2; i++) game.update();
    assert.equal(game.mode, 'ffa');
    assert.equal(players.every((p) => p.team === -1), true);
  });
});
