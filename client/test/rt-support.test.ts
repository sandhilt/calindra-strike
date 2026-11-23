import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QUALITY, QUALITY_TIERS } from '../src/game/render/quality.ts';
import { INTEGRATED_RT_START, RT } from '../src/game/render/rt-levels.ts';
import { isIntegratedRenderer, isSoftwareRenderer, lightRtSupported, type GpuFacts } from '../src/game/render/rt-support.ts';

const card: GpuFacts = { webgl2: true, software: false, integrated: false, floatTargets: true, maxTextureSize: 16384, textureUnits: 16 };

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

test('integrated graphics are recognised, discrete cards are not', () => {
  for (const name of ['ANGLE (Intel, Intel(R) Arc(TM) Graphics (0x00007D55) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11)', 'ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11)', 'ANGLE (AMD, AMD Radeon(TM) 780M Direct3D11)']) assert.equal(isIntegratedRenderer(name), true, name);
  for (const name of ['ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Laptop GPU (0x00002860) Direct3D11)', 'ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics Direct3D11)', 'ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11)', 'Apple M2']) assert.equal(isIntegratedRenderer(name), false, name);
});

test('auto starts a level lower on an integrated card, and that level exists', () => {
  assert.notEqual(INTEGRATED_RT_START, 'high');
  assert.notEqual(RT[INTEGRATED_RT_START], null);
});
