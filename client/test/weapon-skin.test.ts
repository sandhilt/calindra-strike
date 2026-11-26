import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAME_MODES, WEAPON } from '@calindra-strike/shared';
import * as THREE from 'three';
import * as weapons from '../src/game/render/weapons3d.ts';

function meshColors(group: THREE.Group): Set<string> {
  const colors = new Set<string>();
  group.traverse((object) => {
    if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) {
      colors.add(object.material.color.getHexString());
    }
  });
  return colors;
}

test('the standard Azeitadora uses dark materials and lime trim', () => {
  const colors = meshColors(weapons.buildWeapon(WEAPON.MGL).group);
  for (const color of ['d9a520', '8a6a1a', '4a2a14', 'c9a227']) {
    assert.ok(!colors.has(color), `unexpected Carrapeta color #${color}`);
  }
  for (const color of ['242427', 'a5fa00', '7fbf12']) assert.ok(colors.has(color), `missing #${color}`);
});

test('the Carrapeta Azeitadora retains gold and walnut', () => {
  const colors = meshColors(weapons.buildWeapon(WEAPON.MGL, 0, 'carrapeta').group);
  for (const color of ['d9a520', '8a6a1a', '4a2a14', 'a5fa00', 'c9a227']) assert.ok(colors.has(color), `missing #${color}`);
});

test('only Carrapeta Dourada selects the Carrapeta skin', () => {
  for (const mode of GAME_MODES) {
    assert.equal(weapons.weaponSkin(mode), mode === 'carrapeta' ? 'carrapeta' : 'standard', mode);
  }
});

test('Carrapeta Dourada gilds every gun and leaves no lime or dark metal', () => {
  for (const id of Object.values(WEAPON)) {
    if (id === WEAPON.HAMMER || id === WEAPON.MGL) continue;
    const colors = meshColors(weapons.buildWeapon(id, 0, 'carrapeta').group);
    assert.ok(colors.has('d9a520'), `weapon ${id} is not gold`);
    for (const color of ['242427', 'a5fa00', '7fbf12']) assert.ok(!colors.has(color), `weapon ${id} keeps #${color}`);
  }
});

test('Carrapeta Dourada swings a red and yellow toy hammer', () => {
  const toy = meshColors(weapons.buildWeapon(WEAPON.HAMMER, 0, 'carrapeta').group);
  assert.deepEqual(toy, new Set(['e0261b', 'ffd21f']));
  assert.ok(!meshColors(weapons.buildWeapon(WEAPON.HAMMER).group).has('e0261b'), 'the standard hammer stays steel');
});
