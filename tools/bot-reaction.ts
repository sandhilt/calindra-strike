import {
  BOT_RADIO_LOW_HEALTH, WEAPON, isDeathStreakCallout, isKillStreakCallout,
  type BotChatTrigger, type BotRadioTrigger, type GameEvent,
} from '../shared/src/index.ts';

/** What a dev bot with id `me` would say about an event, or null when it was not about them. */
export function reactionTrigger(ev: GameEvent, me: number): BotChatTrigger | null {
  switch (ev.k) {
    case 'kill':
      if (ev.by === me && ev.to !== me) {
        if (ev.hs) return 'headshot';
        return ev.w === WEAPON.HAMMER ? 'hammer' : 'kill';
      }
      return ev.to === me && ev.by !== me ? 'death' : null;
    case 'bomb':
      if (ev.by !== me) return null;
      return ev.what === 'plant' ? 'plant' : ev.what === 'defused' ? 'defused' : null;
    case 'flag':
      if (ev.by !== me) return null;
      return ev.what === 'take' ? 'flagTake' : ev.what === 'capture' ? 'capture' : null;
    default:
      return null;
  }
}

/** Something a dev bot may say. `about` is the player a streak line talks about, it fills {name}. */
export type Reaction =
  | { channel: 'chat'; trigger: BotChatTrigger; about?: string }
  | { channel: 'radio'; trigger: BotRadioTrigger };

/** Who is who, as the roster told this bot. */
export interface Table {
  me: number;
  names: ReadonlyMap<number, string>;
  /** Team per player id; -1 (or missing) in free-for-all. */
  teams: ReadonlyMap<number, number>;
}

/** Deaths since each player's last kill. The wire only carries the killer's kill streak, so the dev bot counts the rest. */
export class DeathStreaks {
  private readonly counts = new Map<number, number>();

  /** Registers a kill event and returns the victim's deaths in a row. */
  noteKill(by: number, to: number): number {
    const deaths = (this.counts.get(to) ?? 0) + 1;
    this.counts.set(to, deaths);
    if (by !== to) this.counts.delete(by);
    return deaths;
  }

  forget(id: number): void {
    this.counts.delete(id);
  }

  clear(): void {
    this.counts.clear();
  }
}

function allied(table: Table, other: number): boolean {
  const team = table.teams.get(table.me);
  return team !== undefined && team >= 0 && table.teams.get(other) === team;
}

/**
 * Everything the dev bot might say about one event, most striking first. The caller rolls chance and cooldowns for each
 * (`pickBotChat`, `pickBotRadio`). Streak talk comes from the bot's own table: allies cheer or encourage, foes tease.
 */
export function reactionsTo(ev: GameEvent, table: Table, streaks: DeathStreaks): Reaction[] {
  const { me } = table;
  const reactions: Reaction[] = [];
  if (ev.k === 'leave') streaks.forget(ev.id);
  if (ev.k === 'bomb' && ev.what === 'plant') {
    reactions.push({ channel: 'radio', trigger: table.teams.get(me) === ev.team ? 'plantAttack' : 'plantDefense' });
  }
  if (ev.k !== 'kill') {
    const direct = reactionTrigger(ev, me);
    if (direct) reactions.push({ channel: 'chat', trigger: direct });
    return reactions;
  }

  const deaths = streaks.noteKill(ev.by, ev.to);
  const killerName = table.names.get(ev.by) ?? '';
  const victimName = table.names.get(ev.to) ?? '';
  if (ev.by !== me && ev.by !== ev.to && isKillStreakCallout(ev.streak)) {
    reactions.push({ channel: 'chat', trigger: allied(table, ev.by) ? 'killStreakAlly' : 'killStreakFoe', about: killerName });
  }
  if (ev.to !== me && isDeathStreakCallout(deaths)) {
    reactions.push({ channel: 'chat', trigger: allied(table, ev.to) ? 'deathStreakAlly' : 'deathStreakFoe', about: victimName });
  }
  if (ev.by === me && ev.to !== me) reactions.push({ channel: 'radio', trigger: 'enemyDown' });
  const direct = reactionTrigger(ev, me);
  if (direct) reactions.push({ channel: 'chat', trigger: direct });
  return reactions;
}

/** True when health just fell to the point where a bot calls out being hit. */
export function fellLow(before: number, now: number): boolean {
  return before > BOT_RADIO_LOW_HEALTH && now > 0 && now <= BOT_RADIO_LOW_HEALTH;
}
