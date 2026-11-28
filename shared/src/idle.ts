import { BTN } from './constants.ts';
import { isEliminationMode, type GameMode, type MatchPhase } from './protocol.ts';
import type { Cmd } from './sim.ts';

type Input = Pick<Cmd, 'buttons' | 'yaw' | 'pitch'>;

/**
 * Whether a command shows a player is at the keyboard. The prone key is a latch, so holding it down proves
 * nothing: only the press or release counts. The client's idle warning and the server's kick both use this, so
 * the player is never warned about a kick that would not come, or kicked without a warning.
 */
export function isActiveCommand(cmd: Input & Pick<Cmd, 'weapon'>, last: Input): boolean {
  const proneChanged = ((cmd.buttons ^ last.buttons) & BTN.PRONE) !== 0;
  return (cmd.buttons & ~BTN.PRONE) !== 0 || proneChanged || cmd.weapon !== 0 || cmd.yaw !== last.yaw || cmd.pitch !== last.pitch;
}

export function waitsOutRound(mode: GameMode, phase: MatchPhase, alive: boolean): boolean {
  return phase === 'live' && !alive && isEliminationMode(mode);
}
