import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPON, weaponDef } from '@calindra-strike/shared';
import {
  ADS_BOB_KEEP,
  ADS_CROSSHAIR_SCALE,
  DOT_IN_BLEND,
  aimFovFor,
  aimOffset,
  aimSensitivityScale,
  bobKeep,
  crosshairFor,
  gunHidden,
  scopeOverlay,
} from '../src/game/render/ads-view.ts';
import { smoothBlend, stepBlend } from '../src/game/render/movement-pose.ts';
import { placementFor } from '../src/game/render/weapon-placement.ts';
import { RIFLE_DOT_HEIGHT_UNITS } from '../src/game/render/weapons3d.ts';
import { previewAim } from '../src/debug/weapon-debug.ts';
import { FollowedViewTracker } from '../src/game/render/follow-view.ts';
import { RF_AIM, RF_ALIVE, RF_ZOOM } from '@calindra-strike/shared';

const hip = { zoom: 0, aiming: false, blend: 0 };
const aimed = (blend: number) => ({ zoom: 0, aiming: true, blend });

test('the AWP keeps its mask and hides the gun exactly as before, whatever the aim says', () => {
  const awp = weaponDef(WEAPON.SNIPER);
  assert.equal(scopeOverlay(awp, hip), 'none');
  assert.equal(scopeOverlay(awp, { zoom: 1, aiming: false, blend: 0 }), 'awp');
  assert.equal(scopeOverlay(awp, { zoom: 2, aiming: true, blend: 1 }), 'awp');
  assert.equal(gunHidden(awp, { zoom: 1, aiming: false, blend: 0 }, false), true);
  assert.equal(gunHidden(awp, hip, false), false);
  assert.deepEqual(crosshairFor(awp, hip, false), { visible: true, scale: 1 }, 'the AWP shows where it points before the scope is raised');
  assert.deepEqual(crosshairFor(awp, { zoom: 1, aiming: false, blend: 0 }, false), { visible: false, scale: 1 }, 'and the scope replaces it');
});

test('the rifle looks through a red dot: the gun stays on screen and the crosshair gives way to the dot', () => {
  const rifle = weaponDef(WEAPON.RIFLE);
  assert.equal(rifle.ads?.kind, 'dot');
  for (const blend of [0, 0.5, 1]) {
    assert.equal(scopeOverlay(rifle, aimed(blend)), 'none', 'no lens is ever drawn over the view');
    assert.equal(gunHidden(rifle, aimed(blend), false), false);
  }
  assert.equal(crosshairFor(rifle, hip, false).scale, 1);
  assert.equal(crosshairFor(rifle, aimed(DOT_IN_BLEND - 0.01), false).visible, true);
  assert.equal(crosshairFor(rifle, aimed(DOT_IN_BLEND), false).visible, false);
  assert.equal(crosshairFor(rifle, { zoom: 0, aiming: false, blend: 1 }, false).visible, true, 'a released button brings the crosshair back');
});

test('iron sights keep the gun on screen and shrink the crosshair', () => {
  for (const id of [WEAPON.PISTOL, WEAPON.SMG, WEAPON.SHOTGUN, WEAPON.LMG, WEAPON.MGL]) {
    const def = weaponDef(id);
    assert.equal(def.ads?.kind, 'sights');
    assert.equal(scopeOverlay(def, aimed(1)), 'none');
    assert.equal(gunHidden(def, aimed(1), false), false);
    assert.equal(crosshairFor(def, aimed(1), false).scale, ADS_CROSSHAIR_SCALE);
    assert.equal(crosshairFor(def, hip, false).scale, 1);
  }
});

test('the hammer has no aim: nothing changes for it', () => {
  const hammer = weaponDef(WEAPON.HAMMER);
  assert.equal(aimFovFor(hammer, true, 90), 0);
  assert.equal(scopeOverlay(hammer, aimed(1)), 'none');
  assert.equal(gunHidden(hammer, hip, false), false);
  assert.equal(crosshairFor(hammer, aimed(1), false).scale, 1);
});

test('parachuting hides the gun and the crosshair', () => {
  assert.equal(gunHidden(weaponDef(WEAPON.PISTOL), hip, true), true);
  assert.equal(crosshairFor(weaponDef(WEAPON.PISTOL), hip, true).visible, false);
});

test('the aim field of view and mouse scale follow the weapon, and never widen or speed up the view', () => {
  const rifle = weaponDef(WEAPON.RIFLE);
  assert.equal(aimFovFor(rifle, false, 90), 0);
  assert.equal(aimFovFor(rifle, true, 90), rifle.ads?.fov);
  assert.equal(aimFovFor(rifle, true, 40), 40, 'a narrow setting is not widened');
  assert.ok(Math.abs(aimSensitivityScale(45, 90, 1.2) - 0.6) < 1e-9);
  assert.equal(aimSensitivityScale(78, 90, 1.2), 1);
});

test('the blend takes about 130 ms each way and the bob keeps a steady share at full aim', () => {
  let t = 0;
  for (let i = 0; i < 8; i++) t = stepBlend(t, true, 0.13 / 8, 0.13);
  assert.ok(Math.abs(t - 1) < 1e-9);
  assert.ok(stepBlend(1, false, 0.05, 0.13) < 1);
  assert.equal(stepBlend(0.5, true, 1), 1);
  assert.equal(smoothBlend(0), 0);
  assert.equal(smoothBlend(1), 1);
  assert.equal(bobKeep(0), 1);
  assert.ok(Math.abs(bobKeep(1) - ADS_BOB_KEEP) < 1e-9);
});

test('the gun moves to the centre line whichever hand it is held in, and a red dot lands on the centre', () => {
  const p = placementFor(WEAPON.RIFLE);
  const right = aimOffset(WEAPON.RIFLE, p, 'sights', 1);
  const left = aimOffset(WEAPON.RIFLE, p, 'sights', -1);
  assert.equal(right[0] + p.position[0], 0);
  assert.equal(left[0] - p.position[0], 0);
  assert.equal(right[2], 0);
  assert.ok(right[1] > 0, 'it rises to the eye line');
  const dot = aimOffset(WEAPON.RIFLE, p, 'dot', 1);
  const dotHeight = (RIFLE_DOT_HEIGHT_UNITS) * p.scale;
  assert.ok(Math.abs(dot[1] + p.position[1] + dotHeight) < 1e-9, 'the dot ends on the eye line, not below it');
});

test('the weapon viewer previews the pose only for weapons that aim', () => {
  assert.deepEqual(previewAim(weaponDef(WEAPON.RIFLE), true, 1), { aiming: true, overlay: 'none' });
  assert.deepEqual(previewAim(weaponDef(WEAPON.PISTOL), true, 1), { aiming: true, overlay: 'none' });
  assert.deepEqual(previewAim(weaponDef(WEAPON.SNIPER), true, 1), { aiming: false, overlay: 'none' });
  assert.deepEqual(previewAim(weaponDef(WEAPON.RIFLE), false, 1), { aiming: false, overlay: 'none' });
});

test('a spectator sees the gun hidden only behind an AWP scope', () => {
  const frame = (weapon: number, flags: number, aimBlend: number) => ({ weapon: weapon as 0, flags: flags | RF_ALIVE, speed: 0, onGround: true, reloadElapsed: -1, reloadShells: 0, aimBlend });
  const hidden = (weapon: number, flags: number, blend: number) => new FollowedViewTracker().pose(1, frame(weapon, flags, blend), 0, 0.016).hidden;
  assert.equal(hidden(WEAPON.SNIPER, RF_ZOOM, 0), true);
  assert.equal(hidden(WEAPON.RIFLE, RF_AIM, 1), false);
  assert.equal(hidden(WEAPON.PISTOL, RF_AIM, 1), false);
  assert.equal(hidden(WEAPON.RIFLE, 0, 1), false);
});
