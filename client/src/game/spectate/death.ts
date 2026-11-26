import { RF_ALIVE } from '@calindra-strike/shared';

interface DeathSpectatePlayer {
  id: number;
  team: number | undefined;
  flags: number;
}

export function deathSpectateTargets(players: readonly DeathSpectatePlayer[], team: number, everyone = false): number[] {
  if (!everyone && team < 0) return [];
  return players
    .filter(player => (everyone || player.team === team) && (player.flags & RF_ALIVE) !== 0)
    .map(player => player.id)
    .sort((a, b) => a - b);
}
