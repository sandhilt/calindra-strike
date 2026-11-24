import { BATATA_DOUBLE_EVERY_SECONDS, magCapacity, WEAPON, type CarrapetaEvent, type CarrapetaSnapshot, type PlayerState, type WeaponDef } from '@calindra-strike/shared';

export const CARRAPETA_GOLD = '#ffd54f';
export const CARRAPETA_SYMBOL = '◆';

export const CARRAPETA_BANNERS = {
  take: { title: 'Está tudo azeitado', text: 'Você tem a Carrapeta Dourada. Use a Azeitadora, fuja dos outros jogadores e sobreviva para pontuar.', durationMs: 4500 },
  on: { title: 'Batata quente!', text: `Todos contra o portador. A cada ${BATATA_DOUBLE_EVERY_SECONDS} s com a Carrapeta, os pontos por segundo dobram. O pente do portador fica pela metade.`, durationMs: 4500 },
  off: { title: 'Fim da batata quente', text: 'A caça à Carrapeta continua.', durationMs: 2300 },
} as const;

export type CarrapetaBanner = keyof typeof CARRAPETA_BANNERS;

export function carrapetaFeed(what: CarrapetaEvent['what'], holder: string): string {
  return what === 'lose' ? `${holder} · avinagrou` : `${holder} · Está tudo azeitado`;
}

function secondsLeft(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

export function carrapetaStatus(state: CarrapetaSnapshot, now: number, holderName: (id: number) => string): string {
  const objective = state.kind === 'held' ? holderName(state.holder)
    : state.kind === 'dropped' ? `no chão · sorteio em ${secondsLeft(state.rerollAtMs, now)} s`
      : 'aguardando sorteio';
  const frenzy = secondsLeft(state.frenzyUntilMs, now);
  return frenzy > 0 ? `${objective} · Batata quente ${frenzy} s` : objective;
}

export function weaponAmmo(
  state: Pick<PlayerState, 'mag' | 'reserve' | 'halvedAmmo' | 'infiniteMgl'>,
  def: WeaponDef,
  warmup: boolean,
): { mag: number; reserve: number | '∞'; capacity: number | null } {
  const capacity = state.halvedAmmo && def.mag > 0 ? magCapacity(def, true) : null;
  const mag = capacity === null ? state.mag[def.id] : Math.min(state.mag[def.id], capacity);
  return { mag, reserve: warmup || (def.id === WEAPON.MGL && state.infiniteMgl) ? '∞' : state.reserve[def.id], capacity };
}

type RankedScore = { id: number; kills: number; deaths: number; points?: number };

export function compareScoreRows(a: RankedScore, b: RankedScore): number {
  return (b.points ?? 0) - (a.points ?? 0) || b.kills - a.kills || a.deaths - b.deaths || a.id - b.id;
}
