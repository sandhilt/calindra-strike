import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WEAPON } from '@calindra-strike/shared';
import { DrumView } from '../src/game/render/drum-view.ts';
import { RESTING_RELOAD_POSE } from '../src/game/render/reload-anim.ts';
import { buildWeapon } from '../src/game/render/weapons3d.ts';

function launcher() {
  const drum = buildWeapon(WEAPON.MGL).rig.drum;
  assert.ok(drum, 'the Azeitadora has a drum');
  const view = new DrumView();
  const run = (mag: number, frames: number, pose = RESTING_RELOAD_POSE, capacity = 6) => {
    for (let i = 0; i < frames; i++) view.update(drum, pose, { mag, capacity }, 1 / 60);
  };
  const lit = () => drum.pips.meshes.filter((pip) => pip.visible && pip.material === drum.pips.on).length;
  const rounds = () => drum.rounds.filter((round) => round.visible).length;
  return { drum, view, run, lit, rounds };
}

test('a full drum shows six rounds and six lit pips, and has not turned', () => {
  const { drum, run, lit, rounds } = launcher();
  run(6, 5);
  assert.equal(Math.abs(drum.group.rotation.z), 0);
  assert.equal(rounds(), 6);
  assert.equal(lit(), 6);
});

test('every shot turns the drum a chamber, throws the round out and dims a pip, until none is left', () => {
  const { drum, view, run, lit, rounds } = launcher();
  run(6, 5);
  let turned = 0;
  for (let mag = 5; mag >= 0; mag--) {
    view.eject();
    run(mag, 4);
    assert.ok(drum.loose.some((shell) => shell.visible), 'the fired round is in the air');
    run(mag, 60);
    assert.ok(drum.loose.every((shell) => !shell.visible), 'and falls out of view');
    assert.ok(Math.abs(drum.group.rotation.z) > turned, 'the drum has turned on');
    turned = Math.abs(drum.group.rotation.z);
    assert.equal(rounds(), mag);
    assert.equal(lit(), mag);
  }
  assert.equal(rounds(), 0);
});

test('a reload fills the drum round by round while it spins, and a halved drum lights three pips', () => {
  const { drum, run, lit, rounds } = launcher();
  run(0, 5);
  run(0, 1, { ...RESTING_RELOAD_POSE, drumFill: 0.5, drumTurn: 0.5 });
  assert.equal(rounds(), 3);
  assert.ok(Math.abs(Math.abs(drum.group.rotation.z) - Math.PI) < 1e-9, 'half a turn');
  run(6, 1, { ...RESTING_RELOAD_POSE, drumFill: 1, drumTurn: 1 });
  assert.equal(rounds(), 6);
  const halved = launcher();
  halved.run(3, 5, RESTING_RELOAD_POSE, 3);
  assert.equal(halved.lit(), 3);
  assert.equal(halved.drum.pips.meshes.filter((pip) => pip.visible).length, 3);
  assert.equal(lit(), 6);
});
