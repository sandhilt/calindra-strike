import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DRUM_CHAMBERS, chamberPosition, chambersFilled, drumLayout, droppedShell, ejectedShell } from '../src/game/render/drum-anim.ts';

test('a full drum is loaded in every chamber and has not turned', () => {
  const full = drumLayout(6, 6);
  assert.equal(full.angle, 0);
  assert.deepEqual(full.loaded, Array(DRUM_CHAMBERS).fill(true));
});

test('each round fired turns the drum one chamber and empties it, until none is left', () => {
  let previous = 0;
  for (let mag = 5; mag >= 0; mag--) {
    const { angle, loaded } = drumLayout(mag, 6);
    assert.ok(angle > previous, 'the drum keeps turning forward');
    previous = angle;
    assert.equal(loaded.filter(Boolean).length, mag);
  }
  assert.deepEqual(drumLayout(0, 6).loaded, Array(DRUM_CHAMBERS).fill(false));
});

test('a halved drum only ever holds three rounds', () => {
  assert.equal(drumLayout(3, 3).loaded.filter(Boolean).length, 3);
  assert.equal(drumLayout(1, 3).loaded.filter(Boolean).length, 1);
  assert.equal(drumLayout(3, 3).loaded.filter(Boolean).length, 3);
  assert.equal(drumLayout(0, 3).loaded.some(Boolean), false);
});

test('a fired round leaves the chamber and falls out of view, and only inside its flight', () => {
  assert.equal(ejectedShell(-0.1).visible, false);
  assert.equal(ejectedShell(1).visible, false);
  const early = ejectedShell(0.2);
  const late = ejectedShell(0.9);
  assert.ok(early.visible && early.x < 0 && early.y > ejectedShell(0).y, 'it kicks out to the side the shooter sees');
  assert.ok(late.y < early.y, 'it falls');
  assert.ok(droppedShell(0.8).y < droppedShell(0.2).y);
});

test('a reload fills the drum chamber by chamber', () => {
  assert.equal(chambersFilled(0, 6), 0);
  assert.equal(chambersFilled(1, 6), 6);
  assert.equal(chambersFilled(0.5, 6), 3);
  assert.equal(chambersFilled(1, 3), 3);
});

test('the next round to fire is always at the top, and half way through the rounds left sit on the side the shooter sees', () => {
  for (let mag = 6; mag >= 1; mag--) {
    const { angle, loaded } = drumLayout(mag, 6);
    const positions = loaded.flatMap((on, k) => (on ? [chamberPosition(k, angle)] : []));
    assert.ok(positions.some((p) => Math.min(p, 2 * Math.PI - p) < 1e-9), 'one loaded chamber is at the top, ready to fire');
  }
  const half = drumLayout(3, 6);
  for (const [k, on] of half.loaded.entries()) {
    if (on) assert.ok(chamberPosition(k, half.angle) === 0 || chamberPosition(k, half.angle) >= Math.PI, 'the rounds left are on the left, top');
  }
});
