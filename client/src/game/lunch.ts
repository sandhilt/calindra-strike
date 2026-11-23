import { LUNCH_COLLEAGUES, LUNCH_KINDS, LUNCH_RUSH_SPEED, TEAMS, type LunchEvent } from '@calindra-strike/shared';

export interface ColleagueView {
  name: string;
  kind: (typeof LUNCH_KINDS)[number];
  leader: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
}
export interface LunchView { attackers: number; endsAt: number; target: number; rush: boolean; colleagues: ColleagueView[] }

export function lunchView(header: readonly number[], rows: readonly number[][]): LunchView | null {
  if (header.length < 2) return null;
  const [attackers, endsAt, target = 0, rush = 0] = header;
  const colleagues = rows.map(([kind, leader, x, y, z, yaw], i): ColleagueView => ({
    name: LUNCH_COLLEAGUES[i] ?? 'Colega',
    kind: LUNCH_KINDS[kind] ?? 'waiting',
    leader, x, y, z, yaw,
  }));
  return { attackers, endsAt, target, rush: rush === 1, colleagues };
}

/** One status line per team for the objective panel. */
export function lunchStatus(view: LunchView, now: number, restaurant: string): { team: number; text: string }[] {
  const seated = view.colleagues.filter((c) => c.kind === 'seated').length;
  const secs = Math.max(0, Math.ceil((view.endsAt - now) / 1000));
  const rush = view.rush ? `${LUNCH_RUSH_TAG} · ` : '';
  return [
    { team: view.attackers, text: `${rush}levando o time pro ${restaurant} · ${seated}/${view.colleagues.length} sentados` },
    { team: 1 - view.attackers, text: `${rush}segurando no escritório · ${secs} s pro ${restaurant} lotar` },
  ];
}

/** Colleagues walking behind this player right now. */
export function followersOf(view: LunchView, playerId: number): number {
  return view.colleagues.filter((c) => c.kind === 'following' && c.leader === playerId).length;
}

export function followersText(count: number, total: number): string {
  return count === 1 ? `1 de ${total} colegas te seguindo` : `${count} de ${total} colegas te seguindo`;
}

export const LUNCH_RUSH_TAG = 'HORA DO RUSH';
export const LUNCH_RUSH_PITCH = `a praça lota ${LUNCH_RUSH_SPEED}x mais rápido`;

/** What a new round tells the player: where the colleagues must sit, and when it is a rush hour. */
export function lunchAnnouncement(view: LunchView, restaurant: string): { destination: string; rush: string | null } {
  return {
    destination: `Destino do almoço: ${restaurant}`,
    rush: view.rush ? `${LUNCH_RUSH_TAG}! ${LUNCH_RUSH_PITCH}` : null,
  };
}

/** `scored` is false in the warmup, where rounds end without a point. */
export function lunchMessage(e: LunchEvent, actor: string, colleague: string, scored: boolean): string {
  const point = scored ? ` ponto dos ${TEAMS[e.team].name}` : ' (aquecimento, sem ponto)';
  switch (e.what) {
    case 'follow':
      return `${actor} chamou ${colleague} pro almoço`;
    case 'stop':
      return `${colleague} ficou sem companhia e parou`;
    case 'seated':
      return `${colleague} sentou pra almoçar!`;
    case 'served':
      return `todo mundo almoçou!${point}`;
    case 'full':
      return `acabaram os lugares na praça de alimentação!${point}`;
  }
}
