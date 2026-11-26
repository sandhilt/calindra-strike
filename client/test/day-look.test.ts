import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getMaps, type DayPhase, type MapTheme } from '@calindra-strike/shared';
import { DAY_EXPOSURE, buildLooks, copyLook, createLook, dimForSolarEclipse, lookAt } from '../src/game/render/day-look.ts';

const phases: DayPhase[] = ['day', 'afternoon', 'night'];
const elevation = (look: { sunDir: { y: number } }) => Math.asin(look.sunDir.y);

test('the day look is the map theme exactly, at the renderer exposure', () => {
  for (const map of getMaps()) {
    const day = buildLooks(map.theme).day;
    assert.equal(day.skyTop.getHexString(), map.theme.skyTop.slice(1), map.id);
    assert.equal(day.fogFar, map.theme.fogFar);
    assert.equal(day.sunIntensity, map.theme.sunIntensity);
    assert.equal(day.hemiIntensity, map.theme.hemiIntensity);
    assert.equal(day.exposure, DAY_EXPOSURE);
    assert.equal(day.stars, 0);
    const { x, y, z } = map.theme.sunDir;
    const len = Math.hypot(x, y, z);
    assert.ok(Math.abs(day.sunDir.x - x / len) < 1e-9 && Math.abs(day.sunDir.y - y / len) < 1e-9 && Math.abs(day.sunDir.z - z / len) < 1e-9, map.id);
  }
});

test('the afternoon sun is low and the night has stars and a moon from another side', () => {
  for (const map of getMaps()) {
    const { day, afternoon, night } = buildLooks(map.theme);
    assert.ok(elevation(afternoon) < elevation(day), map.id);
    assert.ok(elevation(afternoon) < 0.35, map.id);
    assert.equal(afternoon.stars, 0);
    assert.equal(night.stars, 1);
    assert.ok(Math.abs(night.sunAzimuth - day.sunAzimuth) > 1.5, map.id);
    assert.ok(night.glow > afternoon.glow && afternoon.glow > day.glow);
  }
});

test('night stays readable: the light that reaches a player is never far below day', () => {
  const reach = (hemi: number, exposure: number) => hemi * exposure;
  for (const map of getMaps()) {
    const { day, night } = buildLooks(map.theme);
    assert.ok(reach(night.hemiIntensity, night.exposure) >= 0.6 * reach(day.hemiIntensity, day.exposure), map.id);
    assert.ok(night.fogFar === day.fogFar && night.fogNear === day.fogNear, 'night sight is not shortened');
  }
});

test('a map theme can replace what the afternoon and the night derive', () => {
  const base = getMaps()[0].theme;
  const theme: MapTheme = { ...base, phases: { night: { fog: '#102030', fogFar: 3000, sunDir: { x: 0, y: 1, z: 0 } } } };
  const looks = buildLooks(theme);
  assert.equal(looks.night.fog.getHexString(), '102030');
  assert.equal(looks.night.fogFar, 3000);
  assert.ok(Math.abs(looks.night.sunDir.y - 1) < 1e-9);
  assert.equal(looks.afternoon.fogFar, base.fogFar);
});

test('lookAt holds a settled phase and eases through a transition', () => {
  const looks = buildLooks(getMaps()[0].theme);
  const out = createLook();
  for (const phase of phases) {
    lookAt(out, looks, { phase, next: 'day', blend: 0 });
    assert.equal(out.exposure, looks[phase].exposure);
    assert.equal(out.sun.getHex(), looks[phase].sun.getHex());
  }
  lookAt(out, looks, { phase: 'afternoon', next: 'night', blend: 0.5 });
  const mid = (a: number, b: number) => Math.min(a, b) < out.exposure && out.exposure < Math.max(a, b);
  assert.ok(mid(looks.afternoon.exposure, looks.night.exposure));
  assert.ok(out.stars > 0 && out.stars < 1);
  assert.ok(Math.abs(out.sunDir.length() - 1) < 1e-9);
  lookAt(out, looks, { phase: 'afternoon', next: 'night', blend: 1 });
  assert.equal(out.exposure, looks.night.exposure);
  assert.equal(out.stars, 1);
});

test('a total solar eclipse dims the day but stays as readable as the night', () => {
  const reach = (hemi: number, exposure: number) => hemi * exposure;
  for (const map of getMaps()) {
    const { day } = buildLooks(map.theme);
    const out = createLook();
    copyLook(out, day);
    dimForSolarEclipse(out, 0);
    assert.equal(out.sunIntensity, day.sunIntensity);
    dimForSolarEclipse(out, 1);
    assert.ok(out.sunIntensity < 0.5 * day.sunIntensity, map.id);
    assert.ok(reach(out.hemiIntensity, out.exposure) >= 0.6 * reach(day.hemiIntensity, day.exposure), map.id);
    assert.equal(out.fogFar, day.fogFar);
  }
});
