import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BTN, isActiveCommand } from '../src/index.ts';

const still = { buttons: 0, yaw: 1, pitch: 0.5 };
const cmd = (over: Partial<{ buttons: number; yaw: number; pitch: number; weapon: number }> = {}) => ({ ...still, weapon: 0, ...over });

describe('idle activity', () => {
  it('ignores a command that repeats the last one', () => {
    assert.equal(isActiveCommand(cmd(), still), false);
  });

  it('counts any button other than the prone latch', () => {
    assert.equal(isActiveCommand(cmd({ buttons: BTN.FWD }), still), true);
    assert.equal(isActiveCommand(cmd({ buttons: BTN.FWD | BTN.PRONE }), { ...still, buttons: BTN.FWD | BTN.PRONE }), true);
  });

  it('does not count a prone latch that is only held', () => {
    assert.equal(isActiveCommand(cmd({ buttons: BTN.PRONE }), { ...still, buttons: BTN.PRONE }), false);
  });

  it('counts the prone latch flipping either way', () => {
    assert.equal(isActiveCommand(cmd({ buttons: BTN.PRONE }), still), true);
    assert.equal(isActiveCommand(cmd(), { ...still, buttons: BTN.PRONE }), true);
  });

  it('counts a weapon request, a turn or a pitch change', () => {
    assert.equal(isActiveCommand(cmd({ weapon: 2 }), still), true);
    assert.equal(isActiveCommand(cmd({ yaw: 1.1 }), still), true);
    assert.equal(isActiveCommand(cmd({ pitch: 0.4 }), still), true);
  });
});
