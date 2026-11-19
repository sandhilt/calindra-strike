/**
 * Table talk gate shared by bot chat and bot radio. Pure: the caller passes the rolls and the clock.
 * A speaker waits out its own gap and the room's gap, passes the chance roll, then draws a line other than its last one.
 */

export interface TalkCooldowns {
  readonly speakerMs: number;
  readonly roomMs: number;
}

export interface TalkEntry<T> {
  readonly lines: readonly T[];
  readonly chance: number;
  readonly cooldowns: TalkCooldowns;
}

/** What one speaker remembers between chances to talk. */
export interface TalkMemory<T> {
  lastAt: number;
  last: T | null;
}

/** Both rolls are in [0, 1). */
export interface TalkRolls {
  readonly chance: number;
  readonly line: number;
}

export function newTalkMemory<T>(): TalkMemory<T> {
  return { lastAt: -Infinity, last: null };
}

/** The line the speaker says now, or null to stay quiet. `roomLastAt` is the last time anyone in the room spoke on this channel. */
export function pickTalk<T>(entry: TalkEntry<T>, memory: TalkMemory<T>, roomLastAt: number, now: number, rolls: TalkRolls): T | null {
  if (now - roomLastAt < entry.cooldowns.roomMs) return null;
  if (now - memory.lastAt < entry.cooldowns.speakerMs) return null;
  if (rolls.chance >= entry.chance) return null;
  const fresh = entry.lines.filter((line) => line !== memory.last);
  const pool = fresh.length > 0 ? fresh : entry.lines;
  return pool[Math.min(pool.length - 1, Math.floor(rolls.line * pool.length))];
}

/** The caller records a line only once it really went out, so a refused line does not use up the speaker's gap. */
export function recordTalk<T>(memory: TalkMemory<T>, line: T, now: number): void {
  memory.lastAt = now;
  memory.last = line;
}
