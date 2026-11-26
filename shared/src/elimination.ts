export type EliminationRound = { number: number } & (
  | { kind: 'waiting' }
  | { kind: 'playing' }
  | { kind: 'pause'; nextAt: number; winner: number | null }
);

export type EliminationSnapshot = EliminationRound & {
  alive: number;
  teamsAlive: [number, number] | null;
};

/** Group by player in LMS and by team in Gincana. No survivors is a draw. */
export function eliminationOutcome(aliveGroups: readonly number[]): number | null | undefined {
  const [first] = aliveGroups;
  if (first === undefined) return null;
  return aliveGroups.every(group => group === first) ? first : undefined;
}
