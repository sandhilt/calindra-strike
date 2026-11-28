import { RF_ALIVE, waitsOutRound, type MatchInfo, type EliminationSnapshot } from '@calindra-strike/shared';
import type { SpectatorAction } from './controls.ts';

interface DeathSpectatePlayer {
  id: number;
  team: number | undefined;
  flags: number;
}

export function deathSpectateTargets(players: readonly DeathSpectatePlayer[], team: number): number[] {
  if (team < 0) return [];
  return players
    .filter(player => player.team === team && (player.flags & RF_ALIVE) !== 0)
    .map(player => player.id)
    .sort((a, b) => a - b);
}

export function canWatchEliminationRound(match: Pick<MatchInfo, 'mode' | 'phase'>, round: EliminationSnapshot | undefined, alive: boolean): boolean {
  return round !== undefined && waitsOutRound(match.mode, match.phase, alive);
}

export function canRunSpectatorAction(action: SpectatorAction, audience: 'spectator' | 'eliminated'): boolean {
  return audience === 'spectator' || action.kind !== 'join';
}

export function defaultWatchTeam(ownTeam: number, livingTeams: readonly (number | undefined)[]): 0 | 1 | -1 {
  if ((ownTeam === 0 || ownTeam === 1) && livingTeams.includes(ownTeam)) return ownTeam;
  return livingTeams.find(team => team === 0 || team === 1) ?? -1;
}
