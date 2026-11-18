import { WEAPON, type BotChatTrigger, type GameEvent } from '../shared/src/index.ts';

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
