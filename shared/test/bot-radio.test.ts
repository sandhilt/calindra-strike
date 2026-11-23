import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BOT_RADIO_BOT_COOLDOWN_MS,
  BOT_RADIO_CHANCE,
  BOT_RADIO_GLOBAL_COOLDOWN_MS,
  BOT_RADIO_LINES,
  BOT_RADIO_LOW_HEALTH,
  MAX_HEALTH,
  RADIO_LINES,
  newTalkMemory,
  pickBotRadio,
  radioLine,
  recordTalk,
  type BotRadioTrigger,
} from '../src/index.ts';

const triggers = Object.keys(BOT_RADIO_LINES) as BotRadioTrigger[];
const radioIds = new Set(RADIO_LINES.map((line) => line.id));
const textsOf = (trigger: BotRadioTrigger) => BOT_RADIO_LINES[trigger].map((id) => radioLine(id)?.text);
const STEP_MS = 1_000;
const TEN_MINUTES_MS = 600_000;

describe('bot radio table', () => {
  for (const trigger of triggers) {
    it(`${trigger} calls only radio lines, each at most once`, () => {
      const ids = BOT_RADIO_LINES[trigger];
      assert.ok(ids.length >= 1);
      assert.equal(new Set(ids).size, ids.length);
      for (const id of ids) assert.ok(radioIds.has(id), `${id} is a radio line`);
    });

    it(`${trigger} has a chance strictly between 0 and 1`, () => {
      assert.ok(BOT_RADIO_CHANCE[trigger] > 0 && BOT_RADIO_CHANCE[trigger] < 1);
    });
  }

  it('says the agreed Portuguese line for each trigger', () => {
    assert.deepEqual(textsOf('roundStart'), ['Vai, vai, vai!', 'Fiquem juntos!']);
    assert.deepEqual(textsOf('enemySpotted'), ['Inimigo à vista!', 'Reportando!']);
    assert.deepEqual(textsOf('enemyDown'), ['Inimigo abatido!', 'Setor limpo!']);
    assert.deepEqual(textsOf('plantAttack'), ['Vai explodir!', 'Segura essa posição!']);
    assert.deepEqual(textsOf('plantDefense'), ['Preciso de reforço!', 'Me cobre!']);
    assert.deepEqual(textsOf('hurt'), ['Tô tomando tiro!', 'Me cobre!']);
  });

  it('draws rarely from both Calindra menus', () => {
    assert.deepEqual(BOT_RADIO_LINES.calindra, [41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 52]);
    assert.ok(BOT_RADIO_CHANCE.calindra < BOT_RADIO_CHANCE.roundStart);
  });

  it('calls out hurt below the max health and above zero', () => {
    assert.ok(BOT_RADIO_LOW_HEALTH > 0 && BOT_RADIO_LOW_HEALTH < MAX_HEALTH);
  });
});

describe('pickBotRadio', () => {
  it('calls a line of the trigger table when the chance roll is under the chance', () => {
    const id = pickBotRadio('enemyDown', newTalkMemory(), -Infinity, 100_000, BOT_RADIO_CHANCE.enemyDown - 0.01, 0);
    assert.equal(id, BOT_RADIO_LINES.enemyDown[0]);
  });

  it('stays quiet when the chance roll is at or over the chance', () => {
    assert.equal(pickBotRadio('enemyDown', newTalkMemory(), -Infinity, 100_000, BOT_RADIO_CHANCE.enemyDown, 0), null);
  });

  it('keeps one bot quiet until its own gap ends', () => {
    const memory = { lastAt: 100_000, last: null };
    assert.equal(pickBotRadio('hurt', memory, -Infinity, 100_000 + BOT_RADIO_BOT_COOLDOWN_MS - 1, 0, 0), null);
    assert.notEqual(pickBotRadio('hurt', memory, -Infinity, 100_000 + BOT_RADIO_BOT_COOLDOWN_MS, 0, 0), null);
  });

  it('keeps every bot quiet until the room gap ends', () => {
    const memory = newTalkMemory<number>();
    assert.equal(pickBotRadio('hurt', memory, 50_000, 50_000 + BOT_RADIO_GLOBAL_COOLDOWN_MS - 1, 0, 0), null);
    assert.notEqual(pickBotRadio('hurt', memory, 50_000, 50_000 + BOT_RADIO_GLOBAL_COOLDOWN_MS, 0, 0), null);
  });

  it('never repeats the speaker\'s last line, whatever the line roll', () => {
    for (const trigger of triggers) {
      for (const previous of BOT_RADIO_LINES[trigger]) {
        for (const roll of [0, 0.5, 0.999999]) {
          const id = pickBotRadio(trigger, { lastAt: -Infinity, last: previous }, -Infinity, 1_000_000, 0, roll);
          if (BOT_RADIO_LINES[trigger].length > 1) assert.notEqual(id, previous);
          assert.ok(id !== null && BOT_RADIO_LINES[trigger].includes(id));
        }
      }
    }
  });

  it('keeps a room of speakers sparse, even when every roll passes', () => {
    const speakers = [0, 1, 2, 3].map(() => newTalkMemory<number>());
    const callsAt: number[] = [];
    const callsByBot = speakers.map(() => [] as number[]);
    let roomLastAt = -Infinity;
    for (let now = 0; now <= TEN_MINUTES_MS; now += STEP_MS) {
      speakers.forEach((memory, bot) => {
        const id = pickBotRadio('enemySpotted', memory, roomLastAt, now, 0, 0);
        if (id === null) return;
        recordTalk(memory, id, now);
        roomLastAt = now;
        callsAt.push(now);
        callsByBot[bot].push(now);
      });
    }
    assert.ok(callsAt.length > 1, 'the room does talk');
    for (let i = 1; i < callsAt.length; i++) assert.ok(callsAt[i] - callsAt[i - 1] >= BOT_RADIO_GLOBAL_COOLDOWN_MS);
    for (const calls of callsByBot) {
      for (let i = 1; i < calls.length; i++) assert.ok(calls[i] - calls[i - 1] >= BOT_RADIO_BOT_COOLDOWN_MS);
    }
  });
});
