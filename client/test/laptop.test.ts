import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { DEBUG_SCENARIO_COUNT } from '@calindra-strike/shared';
import { drawLidBadge } from '../src/game/laptop/badge.ts';
import { allApps, dockApps, launchApp, postLabs, sceneApps, type AppName } from '../src/game/laptop/apps.ts';
import { drawBlackFridayRibbon, drawCalmScreen, drawIdleScreen, drawLaptop, drawLaptopScreen } from '../src/game/laptop/draw.ts';
import { ICONS, drawIcon } from '../src/game/laptop/icons.ts';
import { SCENARIOS, sceneAt } from '../src/game/laptop/scenarios.ts';
import { TOAST_PLANS } from '../src/game/laptop/toasts.ts';

/** Records every canvas call so tests can compare frames without a real canvas. */
function recordingContext(): { ctx: CanvasRenderingContext2D; log: string[] } {
  const log: string[] = [];
  const gradient = { addColorStop: (offset: number, color: string) => log.push(`stop ${offset} ${color}`) };
  const state = new Map<string | symbol, unknown>([['globalAlpha', 1]]);
  const ctx = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'measureText') return (text: string) => ({ width: text.length * 6 });
        if (property === 'createLinearGradient' || property === 'createRadialGradient') return () => gradient;
        if (state.has(property)) return state.get(property);
        return (...args: unknown[]) => log.push(`${String(property)}(${args.join(',')})`);
      },
      set(_target, property, value) {
        state.set(property, value);
        log.push(`${String(property)}=${String(value)}`);
        return true;
      },
    },
  );
  return { ctx: ctx as CanvasRenderingContext2D, log };
}

const originalRandom = Math.random;
const originalNow = Date.now;
afterEach(() => {
  Math.random = originalRandom;
  Date.now = originalNow;
});

test('six complete stories cover laptops, operating systems, tools, logins and incident feed', () => {
  assert.equal(SCENARIOS.length, DEBUG_SCENARIO_COUNT);
  assert.deepEqual(new Set(SCENARIOS.map((s) => s.laptop)), new Set(['macbook', 'thinkpad', 'inspiron']));
  assert.deepEqual(new Set(SCENARIOS.map((s) => s.os)), new Set(['macos', 'linux', 'windows']));
  const content = JSON.stringify(SCENARIOS);
  const required = [
    'Cursor', 'VS Code', 'Xcode', 'Grok', 'Claude Code', 'Jira', 'Slack', 'Codex', 'Gemini', 'Chrome', 'Firefox', 'Spotify', 'Netflix',
    'Google Workspace', 'Google Calendar', 'GitHub', 'Bitbucket', 'GitHub Actions', 'Bitbucket Pipelines', 'WezTerm', 'iTerm2', 'Node.js',
    'Windows Terminal', 'Edge', 'Explorer', 'wsl.localhost', 'console.eitri.tech', 'matrix.eitri.tech', 'calindra.tech',
  ];
  for (const app of required) assert.ok(content.includes(app), app);
  const feeds = SCENARIOS.flatMap((s) => s.scenes).filter((e) => e.scene.kind === 'browser' && e.scene.page === 'feed');
  const feed = JSON.stringify(feeds);
  for (const topic of ['token npm', 'supply chain CVE', 'Anthropic', 'OpenAI', 'ChatGPT', 'Google Gemini', 'DeepSeek', 'Qwen', 'Kimi', 'Moonshot']) assert.ok(feed.includes(topic), topic);
  for (const scenario of SCENARIOS) {
    assert.ok(scenario.scenes.length >= 7 && scenario.scenes.length <= 10);
    for (const { scene, weight } of scenario.scenes) {
      assert.ok(weight > 0);
      if (scene.app === 'Xcode' || scene.app === 'iTerm2') assert.equal(scenario.os, 'macos');
      if (scene.app === 'Windows Terminal' || scene.app === 'Explorer' || scene.app === 'Edge') assert.equal(scenario.os, 'windows');
    }
    if (scenario.laptop === 'macbook') assert.equal(scenario.os, 'macos');
    if (scenario.laptop === 'inspiron') assert.equal(scenario.os, 'windows');
    const last = scenario.scenes.at(-1)?.scene;
    assert.equal(last?.kind, 'terminal');
    if (last?.kind === 'terminal') {
      assert.match(last.tests.failing, /FAIL/);
      assert.match(last.tests.passing, /PASS/);
    }
  }
});

test('weighted scene timeline is monotonic, clamped and covers both endpoints', () => {
  for (const scenario of SCENARIOS) {
    assert.deepEqual(sceneAt(scenario, -1), { index: 0, local: 0 });
    assert.deepEqual(sceneAt(scenario, 2), { index: scenario.scenes.length - 1, local: 1 });
    assert.deepEqual(sceneAt(scenario, NaN), { index: 0, local: 0 });
    let previous = -1;
    const seen = new Set<number>();
    for (let i = 0; i <= 1000; i++) {
      const { index, local } = sceneAt(scenario, i / 1000);
      assert.ok(local >= 0 && local <= 1);
      assert.ok(index + local >= previous - 1e-10);
      previous = index + local;
      seen.add(index);
    }
    assert.equal(seen.size, scenario.scenes.length);
  }
});

test('every app a scenario uses has an icon that draws something', () => {
  const used = new Set<AppName>();
  for (const scenario of SCENARIOS) {
    for (const app of allApps(scenario)) used.add(app);
    for (const { scene } of scenario.scenes) {
      used.add(launchApp(scene));
      for (const app of sceneApps(scene)) used.add(app);
    }
    for (const plan of TOAST_PLANS[scenario.id] ?? []) if (plan.toast.icon) used.add(plan.toast.icon);
  }
  used.add('Windows');
  for (const app of used) {
    assert.equal(typeof ICONS[app], 'function', `missing icon: ${app}`);
    const { ctx, log } = recordingContext();
    drawIcon(ctx, app, 0, 0, 32);
    assert.ok(log.some((entry) => entry.startsWith('fill') || entry.startsWith('stroke')), `icon draws nothing: ${app}`);
  }
});

test('the docks list the apps of their scenario and AI posts map to lab icons', () => {
  for (const scenario of SCENARIOS) {
    const apps = dockApps(scenario);
    for (const { scene } of scenario.scenes) assert.ok(apps.includes(launchApp(scene)) || apps.includes(scene.app), scene.app);
  }
  assert.deepEqual(postLabs('Anthropic: novo Claude!'), ['Claude Code']);
  assert.deepEqual(postLabs('DeepSeek, Qwen e Kimi / Moonshot!'), ['DeepSeek', 'Qwen', 'Kimi']);
});

test('frames are deterministic and never read randomness or the wall clock', () => {
  Math.random = () => assert.fail('Math.random used while drawing');
  Date.now = () => assert.fail('Date.now used while drawing');
  const progresses = [0, 0.04, 0.2, 0.5, 0.8, 0.9, 0.94, 0.99, 1];
  for (let scenario = 0; scenario < SCENARIOS.length; scenario++) {
    for (const progress of progresses) {
      const first = recordingContext();
      const second = recordingContext();
      drawLaptopScreen(first.ctx, 512, 320, scenario, progress, 1234);
      drawLaptopScreen(second.ctx, 512, 320, scenario, progress, 1234);
      assert.ok(first.log.length > 50);
      assert.deepEqual(first.log, second.log);
    }
    const laptop = recordingContext();
    drawLaptop(laptop.ctx, 720, 460, scenario, 0.5, 900);
    assert.ok(laptop.log.length > 200);
    const idle = recordingContext();
    drawIdleScreen(idle.ctx, 512, 320, scenario, 12.4, 500);
    assert.ok(idle.log.length > 20);
  }
});

test('each scenario shows a calm desktop before planting', () => {
  for (const [scenario, { title }] of SCENARIOS.entries()) {
    const { ctx, log } = recordingContext();
    drawCalmScreen(ctx, 512, 320, scenario, 1234);
    const labels = log.filter((entry) => entry.startsWith('fillText('));
    for (const label of ['PROD OK', 'tudo tranquilo', 'prod estável · 0 incidentes', 'testes: 128 passando', 'tocando: lo-fi para depurar']) {
      assert.ok(labels.some((entry) => entry.startsWith(`fillText(${label},`)), `${title}: ${label}`);
    }
    assert.ok(!labels.some((entry) => /fillText\((?:prod caiu|PROD,|INCIDENTE ·)/.test(entry)), title);
  }
});

test('the Black Friday ribbon overlays every calm, incident and defuse screen without clearing it', () => {
  for (const [scenario, { title }] of SCENARIOS.entries()) {
    const screens = [
      (ctx: CanvasRenderingContext2D) => drawCalmScreen(ctx, 512, 320, scenario, 1234),
      (ctx: CanvasRenderingContext2D) => drawIdleScreen(ctx, 512, 320, scenario, 12, 1234),
      (ctx: CanvasRenderingContext2D) => drawLaptopScreen(ctx, 512, 320, scenario, 0.5, 1234),
    ];
    for (const draw of screens) {
      const { ctx, log } = recordingContext();
      draw(ctx);
      const screenEnd = log.length;
      drawBlackFridayRibbon(ctx, 512, 320, 1234);
      const overlay = log.slice(screenEnd);
      assert.ok(overlay.some((entry) => entry.startsWith('fillText(BLACK FRIDAY,')), title);
      assert.ok(overlay.some((entry) => entry.startsWith('fillText(tempo 1.75x,')), title);
      assert.ok(!overlay.some((entry) => entry.startsWith('clearRect(')), title);
    }
  }
});

test('each laptop model gets a text or shape badge for the lid', () => {
  for (const model of ['thinkpad', 'inspiron'] as const) {
    const { ctx, log } = recordingContext();
    drawLidBadge(ctx, 256, 96, model);
    assert.ok(log.some((entry) => entry.startsWith('fillText') || entry.startsWith('stroke')), model);
  }
});

test('the MacBook lid carries a white apple: curved body, a bite cut out and a leaf', () => {
  const { ctx, log } = recordingContext();
  drawLidBadge(ctx, 256, 96, 'macbook');
  assert.ok(log.includes('fillStyle=#ffffff'));
  assert.ok(log.filter((entry) => entry.startsWith('bezierCurveTo')).length === 8, 'six curves for the body and two for the leaf');
  const bite = log.indexOf('globalCompositeOperation=destination-out');
  assert.ok(bite >= 0 && log.slice(bite).some((entry) => entry.startsWith('arc(')), 'the bite erases the body');
  assert.equal(log.findLast((entry) => entry.startsWith('globalCompositeOperation=')), 'globalCompositeOperation=source-over');
  assert.ok(!log.some((entry) => entry.startsWith('fillText')), 'no letter on the lid');
});

test('the closing scene shows the green banner after the icon montage', () => {
  for (let scenario = 0; scenario < SCENARIOS.length; scenario++) {
    const montage = recordingContext();
    drawLaptopScreen(montage.ctx, 512, 320, scenario, 0.9, 0);
    const banner = recordingContext();
    drawLaptopScreen(banner.ctx, 512, 320, scenario, 1, 0);
    assert.ok(banner.log.some((entry) => entry.includes('bug corrigido')));
    assert.ok(!montage.log.some((entry) => entry.includes('bug corrigido')));
  }
});

test('ThinkPads run Linux and Windows scenarios run on the Dell Inspiron', () => {
  for (const scenario of SCENARIOS) {
    if (scenario.laptop === 'thinkpad') assert.equal(scenario.os, 'linux', scenario.title);
    if (scenario.os === 'windows') assert.equal(scenario.laptop, 'inspiron', scenario.title);
  }
});
