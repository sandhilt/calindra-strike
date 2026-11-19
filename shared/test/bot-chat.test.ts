import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BOT_CHAT_BOT_COOLDOWN_MS,
  BOT_CHAT_CHANCE,
  BOT_CHAT_GLOBAL_COOLDOWN_MS,
  BOT_CHAT_LINES,
  CHAT_MAX_LEN,
  NAME_MAX_LEN,
  fillBotChat,
  isDeathStreakCallout,
  isKillStreakCallout,
  newBotChatMemory,
  pickBotChat,
  sanitizeChat,
  type BotChatTrigger,
} from '../src/index.ts';

const triggers = Object.keys(BOT_CHAT_LINES) as BotChatTrigger[];
const MAX_LINE = 60;
const DEFUSE_TRIGGERS: readonly BotChatTrigger[] = ['plant', 'defused', 'exploded', 'roundStart'];
const STREAK_TRIGGERS: readonly BotChatTrigger[] = ['killStreakFoe', 'killStreakAlly', 'deathStreakFoe', 'deathStreakAlly'];
/** The tools the laptop bomb's screen shows, as the defuse lines should name them. */
const LAPTOP_TOOLS = [
  'Docker', 'Postman', 'Jira', 'Slack', 'Claude Code', 'Codex', 'Cursor', 'VS Code', 'Xcode', 'GitHub Actions',
  'Bitbucket Pipelines', 'iTerm2', 'WezTerm', 'Windows Terminal', 'Chrome', 'Firefox', 'Edge', 'Spotify', 'Netflix',
  'Gemini', 'Grok', 'Node.js', 'WSL', 'Finder', 'Safari',
];

describe('bot chat lines', () => {
  for (const trigger of triggers) {
    it(`${trigger} has enough short, unique, chat-safe lines`, () => {
      const lines = BOT_CHAT_LINES[trigger];
      assert.ok(lines.length >= 5, 'at least 5 lines');
      assert.equal(new Set(lines).size, lines.length, 'no duplicates');
      for (const line of lines) {
        assert.ok(line.length > 0 && line.length <= MAX_LINE && line.length <= CHAT_MAX_LEN, line);
        assert.equal(sanitizeChat(line), line, `survives sanitizeChat: ${line}`);
      }
    });
    it(`${trigger} has a chance between 20% and 45%`, () => {
      assert.ok(BOT_CHAT_CHANCE[trigger] >= 0.2 && BOT_CHAT_CHANCE[trigger] <= 0.45);
    });
  }

  for (const trigger of DEFUSE_TRIGGERS) {
    it(`${trigger} has at least eight new lines on top of the original eight`, () => {
      assert.ok(BOT_CHAT_LINES[trigger].length >= 16);
    });
  }

  it('the defuse lines name every tool on the laptop screen', () => {
    const defuseLines = DEFUSE_TRIGGERS.flatMap((trigger) => BOT_CHAT_LINES[trigger]);
    for (const tool of LAPTOP_TOOLS) {
      assert.ok(defuseLines.some((line) => line.includes(tool)), `a defuse line names ${tool}`);
    }
  });

  it('only the streak triggers carry a {name} placeholder', () => {
    for (const trigger of triggers) {
      for (const line of BOT_CHAT_LINES[trigger]) {
        assert.equal(line.includes('{name}'), STREAK_TRIGGERS.includes(trigger), `${trigger}: ${line}`);
      }
    }
  });

  it('a streak line filled with the longest name still fits the chat', () => {
    for (const trigger of STREAK_TRIGGERS) {
      for (const line of BOT_CHAT_LINES[trigger]) {
        const filled = fillBotChat(line, 'x'.repeat(NAME_MAX_LEN));
        assert.ok(filled.length <= MAX_LINE && filled.length <= CHAT_MAX_LEN, filled);
        assert.equal(sanitizeChat(filled), filled, `survives sanitizeChat: ${filled}`);
      }
    }
  });
});

describe('streak milestones', () => {
  const upTo = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

  it('calls out the third kill in a row, then every fifth one', () => {
    assert.deepEqual(upTo(12).filter((streak) => isKillStreakCallout(streak)), [3, 5, 10]);
  });

  it('calls out every fourth death from four on', () => {
    assert.deepEqual(upTo(12).filter((deaths) => isDeathStreakCallout(deaths)), [4, 8, 12]);
  });
});

describe('fillBotChat', () => {
  it('puts the player name in every placeholder', () => {
    assert.equal(fillBotChat('Alguém para esse {name}! Isso, {name}.', 'Gabi'), 'Alguém para esse Gabi! Isso, Gabi.');
  });

  it('leaves a line without a placeholder as it is', () => {
    assert.equal(fillBotChat('Fechei o ticket.', 'Gabi'), 'Fechei o ticket.');
  });
});

describe('pickBotChat', () => {
  it('speaks when the chance roll is under the trigger chance', () => {
    const line = pickBotChat('kill', newBotChatMemory(), -Infinity, 100_000, BOT_CHAT_CHANCE.kill - 0.01, 0);
    assert.equal(line, BOT_CHAT_LINES.kill[0]);
  });

  it('stays quiet when the chance roll is at or over the chance', () => {
    assert.equal(pickBotChat('kill', newBotChatMemory(), -Infinity, 100_000, BOT_CHAT_CHANCE.kill, 0), null);
  });

  it('keeps one bot quiet until its own cooldown ends', () => {
    const memory = { lastAt: 100_000, last: null };
    assert.equal(pickBotChat('kill', memory, -Infinity, 100_000 + BOT_CHAT_BOT_COOLDOWN_MS - 1, 0, 0), null);
    assert.notEqual(pickBotChat('kill', memory, -Infinity, 100_000 + BOT_CHAT_BOT_COOLDOWN_MS, 0, 0), null);
  });

  it('keeps every bot quiet until the room cooldown ends', () => {
    const memory = newBotChatMemory();
    assert.equal(pickBotChat('kill', memory, 50_000, 50_000 + BOT_CHAT_GLOBAL_COOLDOWN_MS - 1, 0, 0), null);
    assert.notEqual(pickBotChat('kill', memory, 50_000, 50_000 + BOT_CHAT_GLOBAL_COOLDOWN_MS, 0, 0), null);
  });

  it('never repeats the previous line, whatever the line roll', () => {
    for (const trigger of triggers) {
      for (const previous of BOT_CHAT_LINES[trigger]) {
        for (const roll of [0, 0.25, 0.5, 0.75, 0.999999]) {
          const line = pickBotChat(trigger, { lastAt: -Infinity, last: previous }, -Infinity, 1_000_000, 0, roll);
          assert.ok(line && line !== previous && BOT_CHAT_LINES[trigger].includes(line));
        }
      }
    }
  });
});
