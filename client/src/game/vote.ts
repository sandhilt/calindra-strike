import { MODE_LABEL, getMap, type VoteInfo } from '@calindra-strike/shared';
import type { VotePanel } from '../ui/hud.ts';

/** Keys that vote during a round. The digits are weapon slots there, so the podium's 1-3 do not apply. */
export const ROUND_VOTE_KEYS = ['F1', 'F2', 'F3'] as const;

/** The in-round vote panel: one row per option while the window is open, `null` once it has closed. */
export function liveVotePanel(vote: VoteInfo, counts: readonly number[], mine: number, now: number): VotePanel | null {
  if (vote.closesAt === undefined || now >= vote.closesAt) return null;
  return {
    secondsLeft: Math.ceil((vote.closesAt - now) / 1000),
    rows: vote.options.slice(0, ROUND_VOTE_KEYS.length).map((o, i) => ({
      key: ROUND_VOTE_KEYS[i],
      map: getMap(o.map).name,
      mode: MODE_LABEL[o.mode],
      count: counts[i] ?? 0,
      mine: i === mine,
    })),
  };
}
