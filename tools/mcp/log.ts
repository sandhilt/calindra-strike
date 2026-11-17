import { format } from 'node:util';

export type Log = (...args: unknown[]) => void;

export const silent: Log = () => {};

/**
 * Same line shape as the server's log (ISO timestamp, then the arguments) but written through `write`, which the entry point
 * points at stderr because stdout carries the JSON-RPC replies. Off returns a no-op, so call sites never check the flag.
 */
export function createLog(enabled: boolean, write: (line: string) => void, now: () => Date = () => new Date()): Log {
  if (!enabled) return silent;
  return (...args) => write(format(now().toISOString(), ...args) + '\n');
}
