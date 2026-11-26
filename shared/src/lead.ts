import { LEAD_ANNOUNCEMENT_INTERVAL_MS } from './constants.ts';

export interface LeadState {
  announced: number | null;
  at: number;
}

export function outrightLeader(scores: Iterable<readonly [id: number, score: number]>): number | null {
  let leader: number | null = null;
  let best = 0;
  for (const [id, score] of scores) {
    if (score > best) {
      best = score;
      leader = id;
    } else if (score === best) leader = null;
  }
  return leader;
}

export function leadAnnouncement(previous: LeadState, leader: number | null, now: number) {
  if (leader === null || now - previous.at < LEAD_ANNOUNCEMENT_INTERVAL_MS) return null;
  return { announced: leader, at: now, what: previous.announced === leader ? 'continues' as const : 'takes' as const };
}
