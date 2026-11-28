export type EliminationRound = { number: number } & (
  | { kind: 'waiting'; startsAt?: number }
  | { kind: 'playing'; endsAt: number }
  | { kind: 'pause'; nextAt: number; winner: number | null }
);

export type EliminationSnapshot = EliminationRound & {
  alive: number;
  teamsAlive: [number, number] | null;
};

export function canStartEliminationRound(round: EliminationRound, readyCount: number, now: number): boolean {
  if (readyCount < 2 || round.kind === 'playing') return false;
  if (round.kind === 'pause') return now >= round.nextAt;
  return round.startsAt === undefined || now >= round.startsAt;
}

/** Group by player in LMS and by team in Gincana. */
function countSurvivors(aliveGroups: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const group of aliveGroups) counts.set(group, (counts.get(group) ?? 0) + 1);
  return counts;
}

export function eliminationOutcome(aliveGroups: readonly number[]): number | null | undefined {
  const counts = countSurvivors(aliveGroups);
  if (counts.size > 1) return undefined;
  return counts.keys().next().value ?? null;
}

export function eliminationTimeoutOutcome(aliveGroups: readonly number[]): number | null {
  let winner: number | null = null;
  let most = 0;
  for (const [group, count] of countSurvivors(aliveGroups)) {
    if (count === most) winner = null;
    if (count > most) {
      winner = group;
      most = count;
    }
  }
  return winner;
}
