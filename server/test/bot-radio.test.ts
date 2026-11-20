import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BOT_RADIO_BOT_COOLDOWN_MS,
  BOT_RADIO_GLOBAL_COOLDOWN_MS,
  BOT_RADIO_LINES,
  BOT_RADIO_LOW_HEALTH,
  CollisionWorld,
  MAX_HEALTH,
  TICK_MS,
  WEAPON,
  createPlayerState,
  getMaps,
  radioLineAt,
  type GameMode,
  type ServerMsg,
} from '@calindra-strike/shared';
import { BotBrain, type BotAgent, type BotEnv } from '../src/bot.ts';
import { NavGrid } from '../src/nav.ts';
import { Game, type ServerPlayer } from '../src/game.ts';

type Radio = Extract<ServerMsg, { t: 'radio' }>;

const ticksFor = (ms: number) => Math.ceil(ms / TICK_MS);
const LONG_GAP_MS = 60_000;

function setup(mode: GameMode, humans: number) {
  const game = new Game({ maxPlayers: 16, matchMs: 600_000, podiumMs: 5_000, warmupMinPlayers: 2, modes: mode, botFill: 5, random: () => 0.01 });
  const inbox = new Map<number, ServerMsg[]>();
  const people: ServerPlayer[] = [];
  for (let i = 0; i < humans; i++) {
    const box: ServerMsg[] = [];
    const p = game.join(`Gabi${i}`, 0, WEAPON.RIFLE, (d) => box.push(JSON.parse(d))) as ServerPlayer;
    inbox.set(p.id, box);
    people.push(p);
  }
  const bots = [...game.players.values()].filter((p) => p.brain);
  const internals = game as unknown as {
    kill(victim: ServerPlayer, killer: ServerPlayer, weapon: number, head: boolean): void;
    damage(victim: ServerPlayer, attacker: ServerPlayer, dmg: number, head: boolean, zone: number, weapon: number): void;
    emit(ev: unknown): void;
  };
  const kill = (victim: ServerPlayer, killer: ServerPlayer) => internals.kill(victim, killer, WEAPON.RIFLE, false);
  const damage = (victim: ServerPlayer, attacker: ServerPlayer, dmg: number) => internals.damage(victim, attacker, dmg, false, 0, WEAPON.RIFLE);
  const advance = (ms: number) => {
    game.tick += ticksFor(ms);
  };
  const radiosOf = (id: number): Radio[] => (inbox.get(id) ?? []).filter((m): m is Radio => m.t === 'radio');
  return { game, people, bots, kill, damage, emit: internals.emit.bind(game), advance, radiosOf };
}

describe('bot radio in a match', () => {
  it('a bot kill calls "Inimigo abatido!" to the killer team only', () => {
    const { people, bots, kill, advance, radiosOf } = setup('tdm', 4);
    advance(LONG_GAP_MS);
    const killer = bots[0];
    const victim = people.find((p) => p.team !== killer.team);
    assert.ok(victim, 'an opposing human to kill');
    const before = people.map((p) => radiosOf(p.id).length);
    kill(victim, killer);
    const enemyDown = radioLineAt('respostas', 9)?.id;
    for (const [i, p] of people.entries()) {
      const got = radiosOf(p.id).slice(before[i]).map((m) => m.line);
      if (p.team === killer.team) assert.deepEqual(got, [enemyDown], `${p.name} is on the killer's team`);
      else assert.deepEqual(got, [], `${p.name} is on the other team`);
    }
  });

  it('the round start draws at most one radio call', () => {
    const { game, people, radiosOf } = setup('tdm', 4);
    game.startMatch();
    const roundLines = new Set<number>([...BOT_RADIO_LINES.roundStart, ...BOT_RADIO_LINES.calindra]);
    const heard = people.flatMap((p) => radiosOf(p.id).map((m) => m.line));
    assert.ok(heard.length >= 1, 'the round start is called');
    assert.equal(new Set(heard).size, 1, 'one call reaches the room');
    assert.ok(heard.every((line) => roundLines.has(line)));
  });

  it('a flood of kills gets radio calls at the room gap and per bot gap, not per kill', () => {
    const { people, bots, kill, advance, radiosOf } = setup('ffa', 1);
    const floodMs = 120_000;
    for (let t = 0; t < floodMs; t += 1_000) {
      advance(1_000);
      const step = t / 1_000;
      kill(bots[(step + 1) % bots.length], bots[step % bots.length]);
    }
    const calls = radiosOf(people[0].id);
    assert.ok(calls.length >= 2, 'the flood still reaches the radio');
    assert.ok(calls.length <= Math.floor(floodMs / BOT_RADIO_GLOBAL_COOLDOWN_MS) + 1, `at most one call per room gap, got ${calls.length}`);
    const perBot = new Map<number, number>();
    for (const call of calls) perBot.set(call.id, (perBot.get(call.id) ?? 0) + 1);
    for (const [id, n] of perBot) assert.ok(n <= Math.floor(floodMs / BOT_RADIO_BOT_COOLDOWN_MS) + 1, `bot ${id} talks at most once per its gap, got ${n}`);
  });

  it('a bot hit down to low health calls out the hurt line', () => {
    const { people, bots, damage, advance, radiosOf } = setup('ffa', 1);
    advance(LONG_GAP_MS);
    const [bot] = bots;
    const [human] = people;
    bot.state.armor = 0;
    bot.state.health = MAX_HEALTH;
    const before = radiosOf(human.id).length;
    damage(bot, human, MAX_HEALTH - BOT_RADIO_LOW_HEALTH + 5);
    const heard = radiosOf(human.id).slice(before);
    assert.equal(heard.length, 1, 'one call reaches the human');
    assert.equal(heard[0].id, bot.id);
    assert.ok(BOT_RADIO_LINES.hurt.includes(heard[0].line));
  });

  it('a plant calls the attackers and holds the defenders silent inside the room gap', () => {
    const { people, emit, advance, radiosOf, bots } = setup('defuse', 4);
    advance(LONG_GAP_MS);
    const planter = bots[0];
    const before = people.map((p) => radiosOf(p.id).length);
    emit({ k: 'bomb', what: 'plant', team: planter.team, by: planter.id });
    const attackLine = radioLineAt('respostas', 7)?.id;
    for (const [i, p] of people.entries()) {
      const got = radiosOf(p.id).slice(before[i]).map((m) => m.line);
      if (p.team === planter.team) assert.deepEqual(got, [attackLine], `${p.name} hears the attack call`);
      else assert.deepEqual(got, [], `${p.name} is on the defending team`);
    }
  });
});

describe('bot spotting', () => {
  it('a bot reports the enemy it just picked up, once', () => {
    const map = getMaps()[0];
    const world = new CollisionWorld(map);
    const nav = new NavGrid(world, map);
    const base = map.flagBases[0];
    const self: BotAgent = { id: 2, team: 0, alive: true, state: createPlayerState() };
    const enemy: BotAgent = { id: 3, team: 1, alive: true, state: createPlayerState() };
    Object.assign(self.state, { x: base.x, y: 0, z: base.z, dropping: false, yaw: 0 });
    Object.assign(enemy.state, { x: base.x, y: 0, z: base.z - 100, dropping: false });
    const env: BotEnv = { world, nav, tick: 2, now: 0, mode: 'tdm', random: () => 0.5, players: [self, enemy], airdrops: [] };
    const brain = new BotBrain(1);
    brain.think(self, env);
    assert.equal(brain.takeSpotted(), true);
    assert.equal(brain.takeSpotted(), false, 'the flag is taken once');
    env.tick = 8;
    brain.think(self, env);
    assert.equal(brain.takeSpotted(), false, 'the same target is not spotted again');
  });
});
