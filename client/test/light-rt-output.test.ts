import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OutputShader } from 'three/examples/jsm/shaders/OutputShader.js';
import { withOcclusion } from '../src/game/render/light-rt.ts';

describe('occlusion in the output pass', () => {
  it('multiplies the occlusion into the colour before tone mapping, in the same shader', () => {
    const shader = withOcclusion(OutputShader.fragmentShader);
    assert.match(shader, /uniform sampler2D tOcclusion;/);
    assert.match(shader, /uniform float occlusionStrength;/);
    assert.ok(shader.indexOf('tOcclusion, vUv') < shader.indexOf('LINEAR_TONE_MAPPING'), 'laid over before the tone mapping');
    assert.equal(shader.match(/texture2D\( tDiffuse, vUv \)/g)?.length, 1, 'the scene is still read once');
  });

  it('refuses a shader it cannot hook into, so the pass falls back to direct rendering', () => {
    assert.throws(() => withOcclusion('void main() {}'), /OutputShader changed/);
  });
});
