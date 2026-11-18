import { defuseProgress, plantProgress, type BombView } from '../bomb.ts';

/** Someone is planting or defusing the bug; spectators see it whichever player they follow. */
export interface BombActivity {
  kind: 'plant' | 'defuse';
  label: string;
  color: string;
  progress: number;
}

export function bombActivity(bomb: BombView, now: number, actor: (id: number) => { name: string; color: string }): BombActivity | null {
  if (bomb.state === 'planting') {
    const who = actor(bomb.carrier);
    return { kind: 'plant', label: `${who.name} plantando`, color: who.color, progress: plantProgress(bomb, now) };
  }
  if (bomb.state === 'planted' && bomb.defuser >= 0) {
    const who = actor(bomb.defuser);
    return { kind: 'defuse', label: `${who.name} desarmando`, color: who.color, progress: defuseProgress(bomb, now) };
  }
  return null;
}
