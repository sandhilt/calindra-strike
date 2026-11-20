import { RADIO_LINES, type RadioLine } from './radio.ts';
import { pickTalk, type TalkCooldowns, type TalkMemory } from './bot-talk.ts';

/** Bots call the radio on fitting moments. Pure, like bot chat: rolls and clock come from the caller. */

export type BotRadioTrigger = 'roundStart' | 'calindra' | 'enemySpotted' | 'enemyDown' | 'plantAttack' | 'plantDefense' | 'hurt';

/** A bot calls out being hit once its health is at or below this many hp (MAX_HEALTH is 100). */
export const BOT_RADIO_LOW_HEALTH = 40;

export const BOT_RADIO_BOT_COOLDOWN_MS = 45_000;
export const BOT_RADIO_GLOBAL_COOLDOWN_MS = 12_000;
const BOT_RADIO_COOLDOWNS: TalkCooldowns = { speakerMs: BOT_RADIO_BOT_COOLDOWN_MS, roomMs: BOT_RADIO_GLOBAL_COOLDOWN_MS };

function radioIdOf(text: string): number {
  const line: RadioLine | undefined = RADIO_LINES.find((l) => l.text === text);
  if (!line) throw new Error(`no radio line reads "${text}"`);
  return line.id;
}

/** Lines are radio ids, so the wire and the menus stay the same as for a player's radio. */
export const BOT_RADIO_LINES: Readonly<Record<BotRadioTrigger, readonly number[]>> = {
  roundStart: ['Vai, vai, vai!', 'Fiquem juntos!'].map(radioIdOf),
  calindra: RADIO_LINES.filter((l) => l.menu === 'calindra').map((l) => l.id),
  enemySpotted: ['Inimigo à vista!', 'Reportando!'].map(radioIdOf),
  enemyDown: ['Inimigo abatido!', 'Setor limpo!'].map(radioIdOf),
  plantAttack: ['Vai explodir!', 'Segura essa posição!'].map(radioIdOf),
  plantDefense: ['Preciso de reforço!', 'Me cobre!'].map(radioIdOf),
  hurt: ['Tô tomando tiro!', 'Me cobre!'].map(radioIdOf),
};

export const BOT_RADIO_CHANCE: Readonly<Record<BotRadioTrigger, number>> = {
  roundStart: 0.5,
  calindra: 0.05,
  enemySpotted: 0.2,
  enemyDown: 0.3,
  plantAttack: 0.6,
  plantDefense: 0.6,
  hurt: 0.25,
};

export type BotRadioMemory = TalkMemory<number>;

/** Decide whether a bot calls the radio now. Returns the radio line id, or null to stay quiet. */
export function pickBotRadio(
  trigger: BotRadioTrigger,
  memory: BotRadioMemory,
  lastAnyAt: number,
  now: number,
  chanceRoll: number,
  lineRoll: number,
): number | null {
  return pickTalk(
    { lines: BOT_RADIO_LINES[trigger], chance: BOT_RADIO_CHANCE[trigger], cooldowns: BOT_RADIO_COOLDOWNS },
    memory,
    lastAnyAt,
    now,
    { chance: chanceRoll, line: lineRoll },
  );
}
