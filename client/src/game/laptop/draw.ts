import { APP_ACCENT, allApps, dockApps, launchApp } from './apps.ts';
import { SCREEN_W, SCREEN_H, easeOut, fillDisc, fillRound, glowDisc, lerp, line, span, spinner, strokeRound, write, type Ctx } from './canvas.ts';
import { contentRect, drawChrome, drawProdBadge, drawWindowFrame, windowRadius, windowRect } from './chrome.ts';
import { drawBanner, drawIconRow, drawMontage, drawScreenGlow, drawSplash } from './overlays.ts';
import {
  SNAP_SCENE,
  SNAP_WINDOW,
  START_MENU_SCENE,
  START_MENU_WINDOW,
  drawPointer,
  pointerAt,
} from './pointer.ts';
import { drawScene } from './scenes/index.ts';
import { SCENARIOS, sceneAt, type LaptopModel, type Scenario } from './scenarios.ts';
import { BANNER_START, MONTAGE_START, SPLASH_END, contentProgress, splashProgress, windowOpenProgress } from './timeline.ts';
import { drawToast, toastAt } from './toasts.ts';
import { drawSnapLayouts, drawStartMenu } from './windows-ui.ts';

const LID = { x: 88, y: 4, w: 544, h: 348 } as const;
const SCREEN = { x: 104, y: 18, w: 512, h: 320 } as const;
const DECK = { x: 30, y: 352, w: 660, h: 100 } as const;
const KEY_ROWS: readonly (readonly number[])[] = [
  Array<number>(14).fill(1),
  Array<number>(14).fill(1),
  [1.5, ...Array<number>(12).fill(1), 1.5],
  [1.8, ...Array<number>(10).fill(1), 2.2],
  [1.3, 1, 1, 1.3, 6, 1.3, 1, 1, 1, 1],
];
const WINDOWS_KEY_ROW = 4;
const WINDOWS_KEY_INDEX = 2;

const CHASSIS: Readonly<Record<LaptopModel, { body: string; keys: string; label: string }>> = {
  macbook: { body: '#aeb7c2', keys: '#2d333c', label: 'MacBook M' },
  thinkpad: { body: '#22262d', keys: '#14171c', label: 'ThinkPad' },
  inspiron: { body: '#b9c3d0', keys: '#323a46', label: 'Dell Inspiron' },
};

export const LAPTOP_MODELS: readonly LaptopModel[] = ['macbook', 'thinkpad', 'inspiron'];

export function laptopModelOf(variant: number): LaptopModel {
  return scenarioFor(variant).laptop;
}

/** Lid colour of a laptop model, shared by the 2D chassis and the 3D lid. */
export function chassisColor(model: LaptopModel): string {
  return CHASSIS[model].body;
}

function scenarioFor(index: number): Scenario {
  const count = SCENARIOS.length;
  return SCENARIOS[((Math.trunc(index) % count) + count) % count] ?? SCENARIOS[0];
}

function drawWindow(c: Ctx, scenario: Scenario, index: number, local: number, timeMs: number, pointer: readonly [number, number]): void {
  const entry = scenario.scenes[index];
  if (!entry || local < SPLASH_END) return;
  const { scene } = entry;
  const os = scenario.os;
  const open = easeOut(windowOpenProgress(local));
  const frame = windowRect(os);
  c.save();
  c.translate(frame.x + frame.w / 2, frame.y + frame.h / 2);
  c.scale(lerp(0.92, 1, open), lerp(0.92, 1, open));
  c.translate(-(frame.x + frame.w / 2), -(frame.y + frame.h / 2));
  c.globalAlpha = 0.25 + 0.75 * open;
  drawWindowFrame(c, { os, app: scene.app, title: scene.app, pointer });
  const area = contentRect(os);
  const radius = windowRadius(os);
  c.save();
  c.translate(area.x, area.y);
  c.beginPath();
  c.roundRect(0, 0, area.w, area.h, [0, 0, radius, radius]);
  c.clip();
  drawScene(c, scene, { p: contentProgress(local), timeMs, os });
  c.restore();
  c.restore();
}

function drawScreen(c: Ctx, scenario: Scenario, progress: number, timeMs: number): void {
  const { index, local } = sceneAt(scenario, progress);
  const entry = scenario.scenes[index];
  if (!entry) return;
  const { scene } = entry;
  const os = scenario.os;
  const apps = dockApps(scenario);
  const launched = launchApp(scene);
  const pointer = pointerAt({ os, scenarioId: scenario.id, sceneIndex: index, local, timeMs, apps, launched });
  drawChrome(c, { os, apps, active: launched, windowTitle: scene.app, launch: splashProgress(local), prod: progress >= BANNER_START ? 'ok' : 'alert', timeMs });
  drawWindow(c, scenario, index, local, timeMs, pointer);
  if (os === 'windows') {
    if (index === START_MENU_SCENE && local < START_MENU_WINDOW.to) drawStartMenu(c, apps, Math.sin((local / START_MENU_WINDOW.to) * Math.PI));
    if (index === SNAP_SCENE && local > SNAP_WINDOW.from + 0.04 && local < SNAP_WINDOW.to) drawSnapLayouts(c, span(local, SNAP_WINDOW.from + 0.04, SNAP_WINDOW.from + 0.1));
  }
  const startMenuOpens = os === 'windows' && index === START_MENU_SCENE;
  if (local < SPLASH_END && !startMenuOpens) drawSplash(c, launched, splashProgress(local), timeMs);
  const toast = toastAt(scenario.id, index, local);
  if (toast) drawToast(c, os, toast.plan.toast, toast.t);
  drawPointer(c, pointer);
  drawScreenGlow(c, APP_ACCENT[launched], timeMs);
  if (progress >= MONTAGE_START && progress < BANNER_START) drawMontage(c, allApps(scenario), span(progress, MONTAGE_START, BANNER_START), timeMs);
  if (progress >= BANNER_START) drawBanner(c, allApps(scenario), span(progress, BANNER_START, 1), timeMs);
}

export function drawLaptopScreen(ctx: CanvasRenderingContext2D, width: number, height: number, scenario: number, progress: number, timeMs: number): void {
  ctx.save();
  ctx.scale(width / SCREEN_W, height / SCREEN_H);
  ctx.beginPath();
  ctx.rect(0, 0, SCREEN_W, SCREEN_H);
  ctx.clip();
  drawScreen(ctx, scenarioFor(scenario), progress, timeMs);
  ctx.restore();
}

function drawKeyboard(c: Ctx, model: LaptopModel, os: Scenario['os']): void {
  const palette = CHASSIS[model];
  fillRound(c, 80, 360, 560, 66, 6, '#0d1015');
  KEY_ROWS.forEach((widths, row) => {
    const gap = 3;
    const unit = (540 - gap * (widths.length - 1)) / widths.reduce((sum, w) => sum + w, 0);
    let x = 90;
    const y = 364 + row * 12.4;
    widths.forEach((width, index) => {
      const isWindowsKey = os === 'windows' && row === WINDOWS_KEY_ROW && index === WINDOWS_KEY_INDEX;
      fillRound(c, x, y, width * unit, 9, 2, isWindowsKey ? '#1f4d7a' : palette.keys);
      if (isWindowsKey) {
        for (const [dx, dy] of [[0, 0], [3.5, 0], [0, 3.5], [3.5, 3.5]] as const) fillRound(c, x + (width * unit) / 2 - 3.5 + dx, y + 1 + dy, 3, 3, 0.5, '#7fd0ff');
      }
      x += width * unit + gap;
    });
  });
  if (model === 'thinkpad') fillDisc(c, 360, 390, 3.2, '#ee334b');
}

function drawTouchpad(c: Ctx, model: LaptopModel): void {
  if (model === 'thinkpad') for (let i = 0; i < 3; i++) fillRound(c, 288 + i * 50, 428, i === 1 ? 34 : 48, 3, 1, '#0d1015');
  fillRound(c, 280, 432, 160, 18, 5, 'rgba(0,0,0,0.22)');
  strokeRound(c, 280, 432, 160, 18, 5, 'rgba(255,255,255,0.22)', 1);
}

export function drawLaptop(ctx: CanvasRenderingContext2D, width: number, height: number, scenario: number, progress: number, timeMs: number): void {
  const data = scenarioFor(scenario);
  const palette = CHASSIS[data.laptop];
  ctx.save();
  ctx.scale(width / 720, height / 460);
  ctx.clearRect(0, 0, 720, 460);
  fillRound(ctx, LID.x, LID.y, LID.w, LID.h, 16, palette.body);
  fillRound(ctx, LID.x + 8, LID.y + 8, LID.w - 16, 330, 10, '#06080c');
  ctx.save();
  ctx.translate(SCREEN.x, SCREEN.y);
  drawLaptopScreen(ctx, SCREEN.w, SCREEN.h, scenario, progress, timeMs);
  ctx.restore();
  fillDisc(ctx, 360, 13, 1.8, '#1b2330');
  write(ctx, palette.label, 360, 349, { color: data.laptop === 'thinkpad' ? '#dce1e8' : '#3a424d', size: 9, weight: 'bold', align: 'center' });
  fillRound(ctx, 290, 349, 140, 5, 2, 'rgba(0,0,0,0.3)');
  fillRound(ctx, DECK.x, DECK.y, DECK.w, DECK.h, 12, palette.body);
  line(ctx, DECK.x + 10, DECK.y + DECK.h - 4, DECK.x + DECK.w - 10, DECK.y + DECK.h - 4, 'rgba(0,0,0,0.25)', 2);
  drawKeyboard(ctx, data.laptop, data.os);
  drawTouchpad(ctx, data.laptop);
  ctx.restore();
}

export function drawIdleScreen(ctx: CanvasRenderingContext2D, width: number, height: number, scenario: number, secondsLeft: number, timeMs: number): void {
  const data = scenarioFor(scenario);
  ctx.save();
  ctx.scale(width / SCREEN_W, height / SCREEN_H);
  const background = ctx.createLinearGradient(0, 0, SCREEN_W, SCREEN_H);
  background.addColorStop(0, '#2a0f1c');
  background.addColorStop(1, '#14080f');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  glowDisc(ctx, SCREEN_W / 2, 90, 380, '#ff3b57', 0.18);
  write(ctx, `INCIDENTE · ${data.title}`, 36, 48, { color: '#ffa8b6', size: 17, weight: 'bold' });
  drawProdBadge(ctx, SCREEN_W - 92, 32, 'alert', timeMs);
  write(ctx, 'prod caiu', 36, 128, { color: '#ff5c7c', size: 56, weight: 'bold' });
  write(ctx, `${Math.max(0, Math.ceil(secondsLeft))} s`, SCREEN_W - 36, 128, { color: '#ffb8c5', size: 42, weight: 'bold', align: 'right' });
  const trace = ['Error: sexta-feira em produção', '  at deploy (release.ts:42)', '  at missingRegression (tests.ts:0)', '  at coffeeBreak (team.ts:17)', '> Aguardando alguém depurar…'];
  trace.forEach((row, i) => write(ctx, row, 38, 188 + i * 30, { color: i === trace.length - 1 ? '#ffd6dd' : '#f19aaa', size: 17, mono: true }));
  drawIconRow(ctx, dockApps(data).slice(0, 9), 352, 36, timeMs);
  spinner(ctx, 46, 420, timeMs, 8, '#ff8fa3', 3);
  write(ctx, 'Conecte o notebook para corrigir o bug', 70, 426, { color: '#efadb9', size: 17 });
  ctx.restore();
}
