import assert from 'node:assert/strict';
import test from 'node:test';
import { BTN } from '@calindra-strike/shared';
import { CROUCH_TAPS_IDLE, DOUBLE_TAP_MS, type CrouchTapState, isCrouchKey, pressCrouch } from '../src/game/crouch-taps.ts';
import { PRONE_CANCEL_BUTTONS, nextProne } from '../src/game/prone-input.ts';

/** Replays presses [timeMs, sprinting] through the machine and returns the final result. */
function replay(presses: readonly (readonly [number, boolean?])[], startProne = false) {
  let state: CrouchTapState = CROUCH_TAPS_IDLE;
  let prone = startProne;
  for (const [now, sprinting = false] of presses) ({ state, prone } = pressCrouch(state, { now, sprinting, prone }));
  return { state, prone };
}

test('two presses inside the window lie down', () => {
  assert.equal(replay([[1000], [1000 + 150]]).prone, true);
});

test('two presses outside the window do not, and the second starts a new pair', () => {
  const late = replay([[1000], [1000 + DOUBLE_TAP_MS + 1]]);
  assert.equal(late.prone, false);
  assert.deepEqual(late.state, { kind: 'tapped', at: 1000 + DOUBLE_TAP_MS + 1 });
  assert.equal(replay([[1000], [1400], [1500]]).prone, true);
});

test('the window boundary is inclusive', () => {
  assert.equal(replay([[0], [DOUBLE_TAP_MS]]).prone, true);
});

test('a press while prone gets up and does not start a pair', () => {
  const up = replay([[5000]], true);
  assert.equal(up.prone, false);
  assert.deepEqual(up.state, CROUCH_TAPS_IDLE);
  assert.equal(replay([[0], [100], [200]]).prone, false);
});

test('a press with sprint held is the slide: no tap, prone untouched', () => {
  assert.equal(replay([[0], [100, true]]).prone, false);
  assert.equal(replay([[0, true], [100]]).prone, false);
  assert.equal(replay([[0, true]], true).prone, true);
});

test('both Ctrl keys and C are the same crouch key', () => {
  for (const code of ['ControlLeft', 'ControlRight', 'KeyC']) assert.equal(isCrouchKey(code), true);
  assert.equal(isCrouchKey('ArrowDown'), false);
  assert.equal(isCrouchKey('ShiftLeft'), false);
});

test('jump and sprint end prone, a held crouch does not', () => {
  assert.equal(nextProne(true, false, BTN.JUMP), false);
  assert.equal(nextProne(true, false, BTN.SPRINT), false);
  assert.equal(nextProne(true, false, BTN.DUCK | BTN.FWD), true);
  assert.equal(nextProne(false, true, BTN.DUCK), true);
  assert.equal(PRONE_CANCEL_BUTTONS & BTN.DUCK, 0);
});
