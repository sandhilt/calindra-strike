import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { clipHaloToBand } from '../src/game/render/halo-clip.ts';

const sprite = {
  vertexShader: 'void main() {\n\tvec4 mvPosition = modelViewMatrix[ 3 ];\n\tgl_Position = projectionMatrix * mvPosition;\n}',
  fragmentShader: 'void main() {\n\t#include <clipping_planes_fragment>\n}',
  uniforms: {} as Record<string, THREE.IUniform>,
};

test('a clipped halo discards fragments outside the floor and ceiling of its level', () => {
  const material = new THREE.SpriteMaterial();
  clipHaloToBand(material, { floor: 0, ceiling: 176 });
  const shader = structuredClone({ vertexShader: sprite.vertexShader, fragmentShader: sprite.fragmentShader, uniforms: {} });
  material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
  assert.match(shader.vertexShader, /vHaloY = \( inverse\( viewMatrix \) \* mvPosition \)\.y;/);
  assert.match(shader.fragmentShader, /if \( vHaloY < uHaloBand\.x \|\| vHaloY > uHaloBand\.y \) discard;/);
  const band = (shader.uniforms as Record<string, THREE.IUniform<THREE.Vector2>>).uHaloBand.value;
  assert.deepEqual([band.x, band.y], [0, 176]);
});

test('an unbounded side of the band stays open', () => {
  const material = new THREE.SpriteMaterial();
  clipHaloToBand(material, { floor: -Infinity, ceiling: Infinity });
  const shader = { vertexShader: sprite.vertexShader, fragmentShader: sprite.fragmentShader, uniforms: {} as Record<string, THREE.IUniform<THREE.Vector2>> };
  material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
  assert.deepEqual([shader.uniforms.uHaloBand.value.x, shader.uniforms.uHaloBand.value.y], [-1e6, 1e6]);
});
