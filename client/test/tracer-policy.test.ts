import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { applyCmd, BTN, CollisionWorld, createPlayerState, getMaps, spawnState, WEAPON, WEAPONS } from '@calindra-strike/shared';
import { isTracer, TRACER_EVERY } from '../src/game/render/belt-anim.ts';
import { TracerPolicy, projectileRay } from '../src/game/render/tracer-policy.ts';
import { TRACER } from '../src/game/render/fx-tuning.ts';

test('low and performance use the original tracer counts and style for every weapon', () => {
  const policy = new TracerPolicy();
  for (const quality of ['low', 'performance'] as const) {
    for (const weapon of WEAPONS) {
      const expected = weapon.slot === 3 ? 0 : weapon.id === WEAPON.SHOTGUN ? 3 : 1;
      for (let i = 0; i <= TRACER_EVERY; i++) {
        const pattern = policy.projectile(1, weapon.id, quality);
        assert.equal(pattern.pelletsPerShot, expected, weapon.name);
        assert.equal(pattern.style, TRACER, weapon.name);
        assert.equal(pattern.aim, 'muzzle');
        assert.equal(pattern.trail, undefined);
      }
    }
  }
});

test('high buckshot draws every simulated pellet along its direction from the muzzle', () => {
  const player = createPlayerState();
  spawnState(player, 0, 0, 0, 0, WEAPON.SHOTGUN);
  player.dropping = false;
  player.deploy = 0;
  const world = new CollisionWorld(getMaps()[0]);
  const shot = applyCmd(world, player, { seq: 1, buttons: BTN.ATTACK, yaw: 0, pitch: 0, weapon: 0, interp: 0 }, 12);
  assert.ok(shot);
  const pattern = new TracerPolicy().projectile(1, shot.weapon, 'high');
  assert.equal(pattern.pelletsPerShot, shot.dirs.length / 3);
  assert.equal(pattern.aim, 'shot');
  assert.ok(pattern.style.lengthUnits < TRACER.lengthUnits);
  assert.ok(pattern.style.maxAgeSeconds < 0.06);
  const origin = new Vector3(shot.ox, shot.oy, shot.oz);
  const muzzle = origin.clone().add(new Vector3(7, -6, -30));
  const direction = new Vector3();
  for (let i = 0; i < pattern.pelletsPerShot; i++) {
    const expected = new Vector3().fromArray(shot.dirs, i * 3);
    const end = origin.clone().addScaledVector(expected, 500);
    const distance = projectileRay(direction, muzzle, end, origin);
    assert.ok(direction.distanceTo(expected) < 1e-12);
    const tip = muzzle.clone().addScaledVector(direction, distance);
    assert.ok(Math.abs(tip.sub(end).dot(direction)) < 1e-10);
  }
});

test('high LMG accents match the belt cadence independently for each shooter', () => {
  const policy = new TracerPolicy();
  for (let i = 0; i <= 2 * TRACER_EVERY; i++) {
    const { style } = policy.projectile(1, WEAPON.LMG, 'high');
    assert.equal(style.opacity > TRACER.opacity, isTracer(0, i));
    if (i === 1) assert.ok(policy.projectile(2, WEAPON.LMG, 'high').style.opacity > TRACER.opacity);
  }
  policy.projectile(1, WEAPON.PISTOL, 'high');
  assert.ok(policy.projectile(1, WEAPON.LMG, 'high').style.opacity > TRACER.opacity);
  policy.clear();
  assert.ok(policy.projectile(2, WEAPON.LMG, 'high').style.opacity > TRACER.opacity);
});

test('high sniper draws one faster, longer, brighter round with a faint trailing segment', () => {
  const policy = new TracerPolicy();
  const { pelletsPerShot, style, trail } = policy.projectile(1, WEAPON.SNIPER, 'high');
  assert.equal(pelletsPerShot, 1);
  assert.ok(style.speedUnitsPerS > TRACER.speedUnitsPerS);
  assert.ok(style.lengthUnits > TRACER.lengthUnits);
  assert.ok(style.opacity > TRACER.opacity);
  assert.ok(trail);
  assert.equal(trail.headLagUnits, style.lengthUnits);
  assert.ok(trail.opacity < style.opacity);
  for (const weapon of [WEAPON.HAMMER, WEAPON.PISTOL, WEAPON.RIFLE, WEAPON.SMG]) {
    assert.equal(policy.projectile(1, weapon, 'high'), policy.projectile(1, weapon, 'low'));
  }
});
