import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BOT_CHAT_BOT_COOLDOWN_MS,
  BOT_CHAT_CHANCE,
  BOT_CHAT_GLOBAL_COOLDOWN_MS,
  BOT_CHAT_LINES,
  CHAT_MAX_LEN,
  newBotChatMemory,
  pickBotChat,
  sanitizeChat,
  type BotChatTrigger,
} from '../src/index.ts';

const triggers = Object.keys(BOT_CHAT_LINES) as BotChatTrigger[];
const MAX_LINE = 60;

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
    const memory = { lastAt: 100_000, lastLine: null };
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
          const line = pickBotChat(trigger, { lastAt: -Infinity, lastLine: previous }, -Infinity, 1_000_000, 0, roll);
          assert.ok(line && line !== previous && BOT_CHAT_LINES[trigger].includes(line));
        }
      }
    }
  });
});
