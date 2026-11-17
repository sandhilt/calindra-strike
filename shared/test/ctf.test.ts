import { it } from 'node:test';
import assert from 'node:assert/strict';
import { stepFlags, dropCarried, type FlagActor, type FlagState } from '../src/ctf.ts';
import { CTF_RETURN_TICKS } from '../src/constants.ts';

const bases = [{ x: 0, y: 0, z: -1000 }, { x: 0, y: 0, z: 1000 }];
const home: FlagState[] = [{ kind: 'home' }, { kind: 'home' }];
const actor = (team: number, base: number): FlagActor => ({ id: 7, team, ...bases[base], alive: true, dropping: false });

it('takes enemy home flags without mutating inputs; own home stays home', () => {
  const result = stepFlags(home, bases, [actor(0, 1)], 1);
  assert.deepEqual(result.flags[1], { kind: 'carried', carrier: 7 });
  assert.deepEqual(result.events, [{ k: 'flag', what: 'take', team: 1, by: 7 }]);
  assert.equal(home[1].kind, 'home');
  assert.deepEqual(stepFlags(home, bases, [actor(0, 0)], 1).flags, home);
});
it('returns friendly dropped flags and takes enemy dropped flags', () => {
  const flags: FlagState[] = [{ kind: 'dropped', ...bases[0], returnAtTick: 50 }, home[1]];
  assert.equal(stepFlags(flags, bases, [actor(0, 0)], 1).events[0].what, 'return');
  assert.equal(stepFlags(flags, bases, [actor(1, 0)], 1).events[0].what, 'take');
});
it('captures only with own flag home and returns the stolen flag', () => {
  const flags: FlagState[] = [home[0], { kind: 'carried', carrier: 7 }];
  const result = stepFlags(flags, bases, [actor(0, 0)], 1);
  assert.deepEqual(result.flags, home);
  assert.deepEqual(result.captured, [0]);
  assert.deepEqual(result.events, [{ k: 'flag', what: 'capture', team: 1, by: 7 }]);
  flags[0] = { kind: 'carried', carrier: 8 };
  assert.deepEqual(stepFlags(flags, bases, [actor(0, 0)], 1).captured, []);
});
it('dead and skydiving actors cannot touch flags or capture', () => {
  for (const state of [{ alive: false }, { dropping: true }]) {
    assert.deepEqual(stepFlags(home, bases, [{ ...actor(0, 1), ...state }], 1).flags, home);
    assert.deepEqual(stepFlags([home[0], { kind: 'carried', carrier: 7 }], bases, [{ ...actor(0, 0), ...state }], 1).captured, []);
  }
});
it('drops carried flags and returns them exactly at the timeout', () => {
  const flags: FlagState[] = [home[0], { kind: 'carried', carrier: 7 }];
  const result = dropCarried(flags, 7, bases[0], 10);
  assert.deepEqual(result.flags[1], { kind: 'dropped', ...bases[0], returnAtTick: 10 + CTF_RETURN_TICKS });
  assert.equal(flags[1].kind, 'carried');
  assert.equal(stepFlags(result.flags, bases, [], 9 + CTF_RETURN_TICKS).flags[1].kind, 'dropped');
  assert.deepEqual(stepFlags(result.flags, bases, [], 10 + CTF_RETURN_TICKS).events, [{ k: 'flag', what: 'return', team: 1, by: -1 }]);
});
