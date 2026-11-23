import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { QUALITY, QUALITY_TIERS } from '../src/game/render/quality.ts';
import { DEFAULT_RT_LEVEL, RT, RT_LEVELS, RT_OPTIONS, parseRtLevel, rtLabel, type RtProfile } from '../src/game/render/rt-levels.ts';
import { benchmarkSetup } from '../src/benchmark/options.ts';
import { defaults, loadSettings } from '../src/settings.ts';

const realStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

afterEach(() => {
  if (realStorage) Object.defineProperty(globalThis, 'localStorage', realStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

function storeSettings(saved: unknown): void {
  const getItem = () => JSON.stringify(saved);
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem }, configurable: true });
}

const profiles = RT_LEVELS.flatMap((level) => {
  const profile = RT[level];
  return profile ? [{ level, profile }] : [];
});

test('off builds nothing and every other level has a profile', () => {
  assert.equal(RT.off, null);
  assert.deepEqual(profiles.map((p) => p.level), ['light', 'medium', 'high']);
});

test('levels are ordered by cost, each knob never going down', () => {
  const knobs = ['resolution', 'rays', 'denoiseSamples', 'msaa', 'strength'] as const satisfies readonly (keyof RtProfile)[];
  for (let i = 1; i < profiles.length; i++) {
    for (const knob of knobs) assert.ok(profiles[i].profile[knob] >= profiles[i - 1].profile[knob], `${profiles[i].level}.${knob}`);
    assert.ok(knobs.some((knob) => profiles[i].profile[knob] > profiles[i - 1].profile[knob]), `${profiles[i].level} costs more than ${profiles[i - 1].level}`);
  }
});

test('every level keeps the effect: it shows, with rays, and at a usable resolution', () => {
  for (const { level, profile } of profiles) {
    assert.ok(profile.strength > 0 && profile.strength <= 1, level);
    assert.ok(profile.rays >= 3 && profile.denoiseSamples >= 8, level);
    assert.ok(profile.resolution >= 0.5 && profile.resolution <= 1, level);
    assert.ok(profile.radiusUnits > 0, level);
  }
});

test('the default level is below the old full-cost pass, and high is that old pass', () => {
  assert.equal(DEFAULT_RT_LEVEL, 'medium');
  assert.ok(RT.medium && RT.high && RT.medium.resolution < RT.high.resolution && RT.medium.rays < RT.high.rays);
  assert.deepEqual(RT.high, { label: 'alto', resolution: 1, rays: 8, denoiseSamples: 16, msaa: 4, strength: 0.85, radiusUnits: 40 });
});

test('only the high tier can run the ray pass, so the performance tier never builds it', () => {
  assert.deepEqual(QUALITY_TIERS.filter((tier) => QUALITY[tier].lightRt), ['high']);
  assert.equal(benchmarkSetup('performance').rtLevel, 'off');
  assert.equal(benchmarkSetup('low').rtLevel, 'off');
  assert.equal(benchmarkSetup('high').rtLevel, DEFAULT_RT_LEVEL);
});

test('the benchmark pins the ray pass level of each high variant', () => {
  assert.deepEqual(
    (['high-no-rt', 'high-rt-light', 'high-rt-medium', 'high-rt-high'] as const).map((tier) => benchmarkSetup(tier).rtLevel),
    ['off', 'light', 'medium', 'high'],
  );
  assert.equal(benchmarkSetup('high-no-rt').profile, QUALITY.high);
});

test('the menu lists the four steps in order with their Portuguese labels', () => {
  assert.deepEqual(RT_OPTIONS.map((o) => o.label), ['desligado', 'leve', 'médio', 'alto']);
  assert.equal(rtLabel('medium'), 'médio');
});

test('a saved level is kept, and the old switch migrates to médio or desligado', () => {
  storeSettings({ lightRt: true });
  assert.equal(loadSettings().lightRt, 'medium');
  storeSettings({ lightRt: false });
  assert.equal(loadSettings().lightRt, 'off');
  for (const level of RT_LEVELS) {
    storeSettings({ lightRt: level });
    assert.equal(loadSettings().lightRt, level);
  }
});

test('a missing or unknown saved level falls back to médio', () => {
  storeSettings({ name: 'ana' });
  assert.equal(loadSettings().lightRt, 'medium');
  for (const bad of ['ultra', '', 0, null, {}, ['off']]) assert.equal(parseRtLevel(bad), 'medium');
  assert.equal(defaults().lightRt, 'medium');
});
