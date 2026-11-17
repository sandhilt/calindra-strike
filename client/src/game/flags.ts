import { TEAMS, type FlagAction } from '@calindra-strike/shared';

export type FlagView = { team: number; x: number; y: number; z: number } & (
  | { state: 'home' }
  | { state: 'carried'; carrier: number }
  | { state: 'dropped'; returnAt: number }
);

export function flagViews(rows: readonly number[][]): FlagView[] {
  return rows.map(([state, carrier, x, y, z, returnAt], team) => {
    const at = { team, x, y, z };
    if (state === 1) return { ...at, state: 'carried', carrier };
    if (state === 2) return { ...at, state: 'dropped', returnAt };
    return { ...at, state: 'home' };
  });
}

export function flagStatus(flag: FlagView, now: number, name: (id: number) => string): string {
  if (flag.state === 'home') return 'na base';
  if (flag.state === 'carried') return `com ${name(flag.carrier)}`;
  return `no chão · ${Math.max(0, Math.ceil((flag.returnAt - now) / 1000))} s`;
}

export function flagMessage(what: FlagAction, team: number, by: number, name: string): string {
  const target = `bandeira dos ${TEAMS[team].name}`;
  if (by < 0) return `${target} voltou sozinha`;
  const verbs = { take: 'roubou', drop: 'derrubou', return: 'devolveu', capture: 'capturou' };
  return `${name} ${verbs[what]} a ${target}!`;
}
