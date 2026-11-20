import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BOT_CHAT_GLOBAL_COOLDOWN_MS, BOT_CHAT_LINES, TICK_MS, WEAPON, fillBotChat, type ServerMsg } from '@calindra-strike/shared';
import { Game, type ServerPlayer } from '../src/game.ts';

const ticksFor = (ms: number) => Math.ceil(ms / TICK_MS);

function setup() {
  const game = new Game({ maxPlayers: 16, matchMs: 600_000, podiumMs: 5_000, warmupMinPlayers: 2, modes: 'ffa', botFill: 5, random: () => 0.01 });
  const box: ServerMsg[] = [];
  const human = game.join('Gabi', 0, WEAPON.RIFLE, (d) => box.push(JSON.parse(d))) as ServerPlayer;
  const bots = [...game.players.values()].filter((p) => p.brain);
  const kill = (victim: ServerPlayer, killer: ServerPlayer, weapon: number = WEAPON.RIFLE, head = false) =>
    (game as unknown as { kill(v: ServerPlayer, k: ServerPlayer, w: number, h: boolean): void }).kill(victim, killer, weapon, head);
  const chats = () => box.filter((m): m is Extract<ServerMsg, { t: 'chat' }> => m.t === 'chat');
  const advance = (ms: number) => {
    game.tick += ticksFor(ms);
  };
  return { game, human, bots, kill, chats, advance, box };
}

describe('bot chat in a match', () => {
  it('a bot kill produces one table-talk line and the room cooldown holds the next one back', () => {
    const { human, bots, kill, chats, advance } = setup();
    advance(60_000);
    const before = chats().length;
    kill(human, bots[0]);
    kill(bots[2], bots[1]);
    const lines = chats().slice(before);
    assert.equal(lines.length, 1, 'only one line inside the room cooldown');
    assert.equal(lines[0].id === bots[0].id || lines[0].id === human.id, true);
    const speaker = lines[0].id;
    assert.ok(bots.some((b) => b.id === speaker));
    advance(BOT_CHAT_GLOBAL_COOLDOWN_MS + 1_000);
    kill(bots[3], bots[1]);
    assert.equal(chats().length - before, 2, 'a different bot may speak after the room cooldown');
  });

  it('the same bot does not speak twice inside its own cooldown', () => {
    const { bots, kill, chats, advance } = setup();
    advance(60_000);
    const before = chats().filter((m) => m.id === bots[0].id).length;
    kill(bots[1], bots[0]);
    advance(BOT_CHAT_GLOBAL_COOLDOWN_MS + 1_000);
    kill(bots[2], bots[0]);
    assert.equal(chats().filter((m) => m.id === bots[0].id).length - before, 1);
  });

  it('says a line from the table, and a hammer kill uses the hammer lines', () => {
    const { bots, kill, chats, advance } = setup();
    advance(60_000);
    const before = chats().length;
    kill(bots[1], bots[0], WEAPON.HAMMER);
    const [line] = chats().slice(before);
    assert.ok(line && BOT_CHAT_LINES.hammer.includes(line.text));
  });

  it('never touches how humans chat', () => {
    const { game, human, chats, advance } = setup();
    advance(60_000);
    const before = chats().length;
    game.chat(human, 'oi pessoal');
    const [mine] = chats().slice(before);
    assert.deepEqual(mine, { t: 'chat', id: human.id, text: 'oi pessoal' });
  });

  it('a human killing a bot makes the bot answer at most once', () => {
    const { human, bots, kill, chats, advance } = setup();
    advance(60_000);
    const before = chats().length;
    kill(bots[0], human);
    assert.ok(chats().length - before <= 1);
    assert.equal(chats().slice(before).every((m) => m.id !== human.id), true);
  });
});

describe('streak callouts in a match', () => {
  const spacing = BOT_CHAT_GLOBAL_COOLDOWN_MS + 1_000;

  it('the third kill in a row draws a callout that names the killer', () => {
    const { bots, kill, chats, advance } = setup();
    advance(60_000);
    kill(bots[1], bots[0]);
    advance(spacing);
    kill(bots[2], bots[0]);
    advance(spacing);
    const before = chats().length;
    kill(bots[3], bots[0]);
    const said = chats().slice(before).map((m) => m.text);
    const callouts = BOT_CHAT_LINES.killStreakFoe.map((line) => fillBotChat(line, bots[0].name));
    assert.ok(said.some((text) => callouts.includes(text)), `a foe names ${bots[0].name}: ${said.join(' | ')}`);
  });

  it('four deaths in a row draw a tease that names the victim', () => {
    const { human, bots, kill, chats, advance } = setup();
    advance(60_000);
    for (const killer of bots.slice(1, 4)) {
      kill(human, killer);
      advance(spacing);
    }
    const before = chats().length;
    kill(human, bots[1]);
    const said = chats().slice(before).map((m) => m.text);
    const teases = BOT_CHAT_LINES.deathStreakFoe.map((line) => fillBotChat(line, human.name));
    assert.ok(said.some((text) => teases.includes(text)), `a foe teases ${human.name}: ${said.join(' | ')}`);
  });

  it('a kill by the victim resets the death count, so three more deaths draw no tease', () => {
    const { human, bots, kill, chats, advance } = setup();
    advance(60_000);
    for (const killer of bots.slice(1, 4)) {
      kill(human, killer);
      advance(spacing);
    }
    kill(bots[0], human);
    advance(spacing);
    const before = chats().length;
    for (const killer of bots.slice(1, 4)) {
      kill(human, killer);
      advance(spacing);
    }
    const teases = [...BOT_CHAT_LINES.deathStreakFoe, ...BOT_CHAT_LINES.deathStreakAlly].map((line) => fillBotChat(line, human.name));
    assert.equal(chats().slice(before).filter((m) => teases.includes(m.text)).length, 0);
  });
});
