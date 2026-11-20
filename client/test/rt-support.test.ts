import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QUALITY, QUALITY_TIERS } from '../src/game/render/quality.ts';
import { isSoftwareRenderer, lightRtSupported, type GpuFacts } from '../src/game/render/rt-support.ts';

const card: GpuFacts = { webgl2: true, software: false, floatTargets: true, maxTextureSize: 16384, textureUnits: 16 };

test('a real WebGL 2 card with room for the passes runs the light ray-marched lighting', () => {
  assert.equal(lightRtSupported(card), true);
});

test('each missing capability turns it off', () => {
  for (const weak of [{ webgl2: false }, { software: true }, { floatTargets: false }, { maxTextureSize: 4096 }, { textureUnits: 8 }]) {
    assert.equal(lightRtSupported({ ...card, ...weak }), false, JSON.stringify(weak));
  }
});

test('software rasterisers are recognised by their renderer name', () => {
  for (const name of ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))', 'llvmpipe (LLVM 15.0.7, 256 bits)', 'Microsoft Basic Render Driver']) assert.equal(isSoftwareRenderer(name), true, name);
  for (const name of ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3060)', 'Apple M2', 'AMD Radeon RX 6700']) assert.equal(isSoftwareRenderer(name), false, name);
});

test('only the high tier asks for it', () => {
  assert.deepEqual(QUALITY_TIERS.filter((tier) => QUALITY[tier].lightRt), ['high']);
});
