import { bombStandBox } from '../shared/src/index.ts';
import type { Brain } from './bot-driver.ts';
import { carrapetaGoal } from './carrapeta-goals.ts';
import { ctfGoal, readFlags } from './ctf-goals.ts';
import { defuseGoal, readBombRow } from './defuse-goals.ts';

export const defuseBrain: Brain = {
  prepare({ world }, snap) {
    const bomb = readBombRow(snap.bm);
    if (bomb) world.setProp(bombStandBox(bomb.kind, bomb));
  },
  decide({ snap, terrain, self, players, leg, enemy, closeEnemy }) {
    const bomb = readBombRow(snap.bm);
    if (!bomb) return null;
    const places = { home: terrain.bombBases[bomb.attackers], site: terrain.bombBases[1 - bomb.attackers], attackers: bomb.attackers };
    return defuseGoal(bomb, places, self, players, leg, enemy, closeEnemy);
  },
};

export const ctfBrain: Brain = {
  decide({ snap, terrain, self, players, leg, enemy, closeEnemy }) {
    const flags = readFlags(snap.fl);
    if (!flags || (self.team !== 0 && self.team !== 1)) return null;
    return ctfGoal({ flags, bases: terrain.bases, self, players, leg, time: snap.time, enemy, closeEnemy });
  },
};

export const carrapetaBrain: Brain = { decide: carrapetaGoal };

/** Modes without an objective brain keep the plain strafe-and-shoot loop in `bots.ts`. */
export function brainFor(mode: string): Brain | null {
  if (mode === 'defuse') return defuseBrain;
  if (mode === 'ctf') return ctfBrain;
  if (mode === 'carrapeta') return carrapetaBrain;
  return null;
}
