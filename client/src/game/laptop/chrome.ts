import { APP_ACCENT, BACKGROUND_TOOLS, type AppName } from './apps.ts';
import {
  SCREEN_H,
  SCREEN_W,
  fillDisc,
  fillPolygon,
  fillRound,
  line,
  pulse,
  strokeRound,
  textWidth,
  write,
  type Ctx,
  type Point,
  type Rect,
} from './canvas.ts';
import { drawIcon } from './icons.ts';
import type { OsName } from './scenarios.ts';

const WINDOW_W = 640;
const WINDOW_H = 346;
const TITLE_H = 32;

const MENU_BAR_H = 24;
const GNOME_BAR_H = 28;
const GNOME_DOCK_W = 56;
export const TASKBAR_H = 40;
const CLOCK_TEXT = '17:58';

const WINDOW_RECTS: Readonly<Record<OsName, Rect>> = {
  macos: { x: 40, y: 34, w: WINDOW_W, h: WINDOW_H },
  linux: { x: 78, y: 48, w: WINDOW_W, h: WINDOW_H },
  windows: { x: 40, y: 20, w: WINDOW_W, h: WINDOW_H },
};

export function windowRect(os: OsName): Rect {
  return WINDOW_RECTS[os];
}

/** Area under the title bar where a scene draws; scenes lay out in a WINDOW_W by (WINDOW_H - TITLE_H) box. */
export function contentRect(os: OsName): Rect {
  const frame = WINDOW_RECTS[os];
  return { x: frame.x, y: frame.y + TITLE_H, w: frame.w, h: frame.h - TITLE_H };
}

export function windowRadius(os: OsName): number {
  return os === 'windows' ? 8 : 12;
}

export type ProdStatus = 'alert' | 'ok';

export interface ChromeView {
  readonly os: OsName;
  readonly apps: readonly AppName[];
  readonly active: AppName;
  readonly windowTitle: string;
  /** 0..1 while the active app is launching, 1 afterwards. */
  readonly launch: number;
  readonly prod: ProdStatus;
  readonly timeMs: number;
}

export interface DockItem {
  readonly app: AppName;
  readonly x: number;
  readonly y: number;
  readonly size: number;
}

const MAC_DOCK_ICON = 34;
const MAC_DOCK_GAP = 6;
const MAC_DOCK_BASELINE = 438;
const MAC_MAGNIFY = 0.62;
const LINUX_DOCK_ICON = 34;
const LINUX_DOCK_STRIDE = 41;
const WIN_ICON = 24;
const WIN_STRIDE = 29;
const WIN_SEARCH_W = 100;
const WIN_GAP = 8;
const WIN_MAX_APPS = 9;

function macDockItems(apps: readonly AppName[], active: AppName, launch: number): DockItem[] {
  const focus = apps.indexOf(active);
  const strength = launch < 1 ? 1 : 0.35;
  const sizes = apps.map((_, i) => MAC_DOCK_ICON * (1 + MAC_MAGNIFY * strength * Math.exp(-(((i - focus) / 1.2) ** 2))));
  const total = sizes.reduce((sum, size) => sum + size + MAC_DOCK_GAP, 0);
  let x = SCREEN_W / 2 - total / 2 + MAC_DOCK_GAP / 2;
  return apps.map((app, i) => {
    const size = sizes[i] ?? MAC_DOCK_ICON;
    const item = { app, x, y: MAC_DOCK_BASELINE - size, size };
    x += size + MAC_DOCK_GAP;
    return item;
  });
}

function linuxDockItems(apps: readonly AppName[]): DockItem[] {
  const stride = Math.min(LINUX_DOCK_STRIDE, (SCREEN_H - GNOME_BAR_H - 24) / Math.max(1, apps.length));
  return apps.map((app, i) => ({ app, x: (GNOME_DOCK_W - LINUX_DOCK_ICON) / 2, y: GNOME_BAR_H + 12 + i * stride, size: LINUX_DOCK_ICON }));
}

/** Windows 11 keeps Start, Search and the pinned apps in one group centred on the taskbar. */
export function taskbarApps(apps: readonly AppName[]): AppName[] {
  return apps.filter((app) => !BACKGROUND_TOOLS.has(app)).slice(0, WIN_MAX_APPS);
}

function taskbarLayout(apps: readonly AppName[]): { start: Point; search: Rect; items: DockItem[] } {
  const pinned = taskbarApps(apps);
  const groupW = WIN_STRIDE + WIN_GAP + WIN_SEARCH_W + WIN_GAP + pinned.length * WIN_STRIDE;
  const left = SCREEN_W / 2 - groupW / 2;
  const y = SCREEN_H - TASKBAR_H + (TASKBAR_H - WIN_ICON) / 2;
  const searchX = left + WIN_STRIDE + WIN_GAP;
  const itemsX = searchX + WIN_SEARCH_W + WIN_GAP;
  return {
    start: [left + WIN_ICON / 2, y + WIN_ICON / 2],
    search: { x: searchX, y: SCREEN_H - TASKBAR_H + 8, w: WIN_SEARCH_W, h: 24 },
    items: pinned.map((app, i) => ({ app, x: itemsX + i * WIN_STRIDE, y, size: WIN_ICON })),
  };
}

export function startButtonCenter(apps: readonly AppName[]): Point {
  return taskbarLayout(apps).start;
}

function dockItems(os: OsName, apps: readonly AppName[], active: AppName, launch: number): DockItem[] {
  if (os === 'macos') return macDockItems(apps, active, launch);
  if (os === 'linux') return linuxDockItems(apps);
  return taskbarLayout(apps).items;
}

export function dockCenterOf(os: OsName, apps: readonly AppName[], app: AppName): Point {
  const item = dockItems(os, apps, app, 1).find((entry) => entry.app === app);
  return item ? [item.x + item.size / 2, item.y + item.size / 2] : [SCREEN_W / 2, SCREEN_H - 20];
}

function bounceOffset(launch: number): number {
  if (launch >= 1) return 0;
  return -Math.abs(Math.sin(launch * Math.PI * 2.5)) * 12 * (1 - launch * 0.6);
}

function wallpaper(c: Ctx, os: OsName): void {
  if (os === 'windows') return bloomWallpaper(c);
  const [from, to, mid] = os === 'macos' ? ['#1b1d4d', '#b3566f', '#3f2a73'] : ['#2c1740', '#8a3b5e', '#e0703d'];
  const base = c.createLinearGradient(0, 0, SCREEN_W, SCREEN_H);
  base.addColorStop(0, from ?? '#000');
  base.addColorStop(0.55, mid ?? '#000');
  base.addColorStop(1, to ?? '#000');
  c.fillStyle = base;
  c.fillRect(0, 0, SCREEN_W, SCREEN_H);
  const bloom = c.createRadialGradient(SCREEN_W * 0.75, SCREEN_H * 0.3, 10, SCREEN_W * 0.75, SCREEN_H * 0.3, 360);
  bloom.addColorStop(0, 'rgba(255,170,120,0.35)');
  bloom.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = bloom;
  c.fillRect(0, 0, SCREEN_W, SCREEN_H);
}

/** Soft blue flower of overlapping petals, in the spirit of the Windows 11 default wallpaper. */
function bloomWallpaper(c: Ctx): void {
  const base = c.createLinearGradient(0, 0, SCREEN_W, SCREEN_H);
  base.addColorStop(0, '#cfe3ff');
  base.addColorStop(1, '#7fb0f5');
  c.fillStyle = base;
  c.fillRect(0, 0, SCREEN_W, SCREEN_H);
  for (let petal = 0; petal < 6; petal++) {
    c.save();
    c.translate(SCREEN_W / 2, SCREEN_H / 2 - 10);
    c.rotate((petal * Math.PI) / 3);
    const fill = c.createLinearGradient(0, -190, 0, 20);
    fill.addColorStop(0, 'rgba(36,98,220,0.0)');
    fill.addColorStop(0.5, petal % 2 === 0 ? 'rgba(70,140,255,0.4)' : 'rgba(200,225,255,0.6)');
    fill.addColorStop(1, 'rgba(20,60,170,0.0)');
    c.fillStyle = fill;
    c.beginPath();
    c.ellipse(0, -100, 60, 120, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
}

/** Pulsing red PROD pill while the bug is alive, steady green once tests pass. */
export function drawProdBadge(c: Ctx, x: number, y: number, status: ProdStatus, timeMs: number): void {
  const alive = status === 'alert';
  const glow = alive ? 0.45 + 0.55 * pulse(timeMs, 700) : 1;
  const color = alive ? '#ff3b57' : '#35e08f';
  c.save();
  c.globalAlpha = 0.25 + 0.4 * glow;
  fillRound(c, x - 3, y - 3, 62, 22, 11, color);
  c.restore();
  fillRound(c, x, y, 56, 16, 8, alive ? '#5a0f1d' : '#0e4a30');
  strokeRound(c, x, y, 56, 16, 8, color, 1.2);
  c.save();
  c.globalAlpha = alive ? 0.4 + 0.6 * glow : 1;
  fillDisc(c, x + 9, y + 8, 3.2, color);
  c.restore();
  write(c, alive ? 'PROD' : 'PROD OK', x + 16, y + 12, { color: '#ffffff', size: alive ? 10.5 : 9, weight: 'bold' });
}

function drawWifiGlyph(c: Ctx, x: number, y: number, color: string): void {
  c.strokeStyle = color;
  c.lineWidth = 1.6;
  for (const radius of [3, 6, 9]) {
    c.beginPath();
    c.arc(x, y, radius, Math.PI * 1.25, Math.PI * 1.75);
    c.stroke();
  }
  fillDisc(c, x, y, 1.2, color);
}

function drawBatteryGlyph(c: Ctx, x: number, y: number, color: string): void {
  strokeRound(c, x, y, 20, 10, 3, color, 1.2);
  fillRound(c, x + 2, y + 2, 13, 6, 1.5, color);
  fillRound(c, x + 21, y + 3, 2, 4, 1, color);
}

function drawVolumeGlyph(c: Ctx, x: number, y: number, color: string): void {
  fillPolygon(c, [[x, y - 3], [x + 4, y - 3], [x + 9, y - 7], [x + 9, y + 7], [x + 4, y + 3], [x, y + 3]], color);
  c.strokeStyle = color;
  c.lineWidth = 1.4;
  c.beginPath();
  c.arc(x + 9, y, 5, -0.9, 0.9);
  c.stroke();
}

function fillRect(c: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function drawMenuBar(c: Ctx, view: ChromeView): void {
  c.fillStyle = 'rgba(14,16,28,0.8)';
  c.fillRect(0, 0, SCREEN_W, MENU_BAR_H);
  fillDisc(c, 18, 12, 5, '#f2f5fb');
  const titleStyle = { size: 12, weight: 'bold' } as const;
  write(c, view.windowTitle, 34, 16, { ...titleStyle, color: '#ffffff' });
  let menuX = 34 + textWidth(c, view.windowTitle, titleStyle) + 18;
  for (const item of ['Arquivo', 'Editar', 'Exibir']) {
    write(c, item, menuX, 16, { color: '#d5dbe8', size: 11.5 });
    menuX += textWidth(c, item, { size: 11.5 }) + 16;
  }
  fillRound(c, SCREEN_W / 2 - 46, 0, 92, 18, 9, '#05070c');
  fillRect(c, SCREEN_W / 2 - 46, 0, 92, 9, '#05070c');
  drawProdBadge(c, 484, 4, view.prod, view.timeMs);
  drawWifiGlyph(c, 566, 18, '#e6ebf5');
  drawBatteryGlyph(c, 588, 7, '#e6ebf5');
  write(c, `sex ${CLOCK_TEXT}`, SCREEN_W - 12, 16, { color: '#ffffff', size: 12, align: 'right' });
}

function drawMacDock(c: Ctx, view: ChromeView, items: readonly DockItem[]): void {
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;
  const plateW = last.x + last.size - first.x + 24;
  fillRound(c, first.x - 12, 394, plateW, 50, 15, 'rgba(240,244,255,0.2)');
  strokeRound(c, first.x - 12, 394, plateW, 50, 15, 'rgba(255,255,255,0.35)', 1);
  for (const item of items) {
    const lift = item.app === view.active ? bounceOffset(view.launch) : 0;
    drawIcon(c, item.app, item.x, item.y + lift, item.size);
    if (item.app === view.active) fillDisc(c, item.x + item.size / 2, 441, 2.2, '#f4f7ff');
  }
}

function drawGnomeBar(c: Ctx, view: ChromeView): void {
  fillRect(c, 0, 0, SCREEN_W, GNOME_BAR_H, '#0a0b10');
  fillRound(c, 8, 4, 84, 20, 10, 'rgba(255,255,255,0.12)');
  write(c, 'Atividades', 18, 18, { color: '#f2f4f8', size: 12, weight: 'bold' });
  write(c, `sex ${CLOCK_TEXT}`, SCREEN_W / 2, 19, { color: '#ffffff', size: 12.5, weight: 'bold', align: 'center' });
  drawProdBadge(c, 116, 6, view.prod, view.timeMs);
  drawWifiGlyph(c, SCREEN_W - 70, 19, '#e8ecf5');
  drawBatteryGlyph(c, SCREEN_W - 52, 9, '#e8ecf5');
  fillDisc(c, SCREEN_W - 16, 14, 5, '#e8ecf5');
}

function drawGnomeDock(c: Ctx, view: ChromeView, items: readonly DockItem[]): void {
  fillRect(c, 0, GNOME_BAR_H, GNOME_DOCK_W, SCREEN_H - GNOME_BAR_H, 'rgba(10,11,18,0.82)');
  for (const item of items) {
    const active = item.app === view.active;
    if (active) {
      fillRound(c, 4, item.y - 3, GNOME_DOCK_W - 8, item.size + 6, 10, 'rgba(255,255,255,0.16)');
      fillRound(c, 1, item.y + 6, 3, item.size - 12, 1.5, APP_ACCENT[item.app]);
    }
    const shift = active ? bounceOffset(view.launch) * -0.6 : 0;
    drawIcon(c, item.app, item.x + shift, item.y, item.size);
  }
}

function drawTray(c: Ctx, view: ChromeView, top: number): void {
  const color = '#e6ecf7';
  c.strokeStyle = color;
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(SCREEN_W - 152, top + 21);
  c.lineTo(SCREEN_W - 148, top + 17);
  c.lineTo(SCREEN_W - 144, top + 21);
  c.stroke();
  if (view.apps.includes('Docker')) drawIcon(c, 'Docker', SCREEN_W - 136, top + 12, 16);
  drawWifiGlyph(c, SCREEN_W - 108, top + 25, color);
  drawVolumeGlyph(c, SCREEN_W - 94, top + 20, color);
  drawBatteryGlyph(c, SCREEN_W - 80, top + 15, color);
  write(c, CLOCK_TEXT, SCREEN_W - 8, top + 17, { color: '#ffffff', size: 11, align: 'right' });
  write(c, '12/11/2026', SCREEN_W - 8, top + 31, { color: '#cdd6e6', size: 9.5, align: 'right' });
}

function drawTaskbar(c: Ctx, view: ChromeView): void {
  const top = SCREEN_H - TASKBAR_H;
  const layout = taskbarLayout(view.apps);
  fillRect(c, 0, top, SCREEN_W, TASKBAR_H, 'rgba(22,28,44,0.9)');
  line(c, 0, top, SCREEN_W, top, 'rgba(255,255,255,0.14)');
  drawProdBadge(c, 10, top + 12, view.prod, view.timeMs);
  drawIcon(c, 'Windows', layout.start[0] - WIN_ICON / 2, layout.start[1] - WIN_ICON / 2, WIN_ICON);
  const { search } = layout;
  fillRound(c, search.x, search.y, search.w, search.h, 12, 'rgba(255,255,255,0.14)');
  strokeRound(c, search.x, search.y, search.w, search.h, 12, 'rgba(255,255,255,0.2)', 1);
  c.strokeStyle = '#d6deee';
  c.lineWidth = 1.6;
  c.beginPath();
  c.arc(search.x + 14, search.y + 11, 4.5, 0, Math.PI * 2);
  c.moveTo(search.x + 17.5, search.y + 14.5);
  c.lineTo(search.x + 21, search.y + 18);
  c.stroke();
  write(c, 'Pesquisar', search.x + 28, search.y + 16, { color: '#d6deee', size: 11.5 });
  for (const item of layout.items) {
    const active = item.app === view.active;
    if (active) fillRound(c, item.x - 3, top + 4, item.size + 6, TASKBAR_H - 8, 6, 'rgba(255,255,255,0.16)');
    drawIcon(c, item.app, item.x, item.y + (active ? bounceOffset(view.launch) * 0.5 : 0), item.size);
    fillRound(c, item.x + item.size / 2 - (active ? 7 : 2.5), SCREEN_H - 5, active ? 14 : 5, 3, 1.5, active ? APP_ACCENT[item.app] : 'rgba(255,255,255,0.45)');
  }
  drawTray(c, view, top);
}

/** Wallpaper, top bar and dock or taskbar for the laptop's operating system. */
export function drawChrome(c: Ctx, view: ChromeView): void {
  wallpaper(c, view.os);
  const items = dockItems(view.os, view.apps, view.active, view.launch);
  if (view.os === 'macos') {
    drawMenuBar(c, view);
    drawMacDock(c, view, items);
  } else if (view.os === 'linux') {
    drawGnomeBar(c, view);
    drawGnomeDock(c, view, items);
  } else {
    drawTaskbar(c, view);
  }
}

export type WindowControl = 'min' | 'max' | 'close';

const CONTROL_W = 46;

/** Hit areas of the Windows 11 caption buttons; scenes use them to aim the pointer. */
export function windowControlRect(os: OsName, control: WindowControl): Rect {
  const frame = WINDOW_RECTS[os];
  const slot = { min: 3, max: 2, close: 1 }[control];
  return { x: frame.x + frame.w - CONTROL_W * slot, y: frame.y, w: CONTROL_W, h: TITLE_H };
}

export function rectCenter(rect: Rect): Point {
  return [rect.x + rect.w / 2, rect.y + rect.h / 2];
}

function contains(rect: Rect, point: Point | undefined): boolean {
  return point !== undefined && point[0] >= rect.x && point[0] <= rect.x + rect.w && point[1] >= rect.y && point[1] <= rect.y + rect.h;
}

function drawWindowsControls(c: Ctx, pointer: Point | undefined): void {
  const strokeColor = '#e8edf7';
  for (const control of ['min', 'max', 'close'] as const) {
    const rect = windowControlRect('windows', control);
    const hovered = contains(rect, pointer);
    if (hovered) {
      c.save();
      c.beginPath();
      c.roundRect(rect.x, rect.y, rect.w, rect.h, control === 'close' ? [0, 8, 0, 0] : 0);
      c.fillStyle = control === 'close' ? '#c42b1c' : 'rgba(255,255,255,0.1)';
      c.fill();
      c.restore();
    }
    const [cx, cy] = rectCenter(rect);
    c.strokeStyle = strokeColor;
    c.lineWidth = 1.2;
    c.beginPath();
    if (control === 'min') {
      c.moveTo(cx - 5, cy);
      c.lineTo(cx + 5, cy);
    } else if (control === 'max') {
      c.roundRect(cx - 5, cy - 5, 10, 10, 1.5);
    } else {
      c.moveTo(cx - 5, cy - 5);
      c.lineTo(cx + 5, cy + 5);
      c.moveTo(cx + 5, cy - 5);
      c.lineTo(cx - 5, cy + 5);
    }
    c.stroke();
  }
}

function drawLinuxControls(c: Ctx, frame: Rect): void {
  const top = frame.y + TITLE_H / 2;
  const right = frame.x + frame.w;
  for (const [i, glyph] of ['min', 'max', 'close'].entries()) {
    const cx = right - 74 + i * 24;
    fillDisc(c, cx, top, 9, glyph === 'close' ? '#e5484d' : 'rgba(255,255,255,0.14)');
    c.strokeStyle = '#ffffff';
    c.lineWidth = 1.6;
    c.beginPath();
    if (glyph === 'min') {
      c.moveTo(cx - 3.5, top + 3);
      c.lineTo(cx + 3.5, top + 3);
    } else if (glyph === 'max') {
      c.rect(cx - 3.5, top - 3.5, 7, 7);
    } else {
      c.moveTo(cx - 3.5, top - 3.5);
      c.lineTo(cx + 3.5, top + 3.5);
      c.moveTo(cx + 3.5, top - 3.5);
      c.lineTo(cx - 3.5, top + 3.5);
    }
    c.stroke();
  }
}

export interface WindowView {
  readonly os: OsName;
  readonly app: AppName;
  readonly title: string;
  /** Pointer position in screen coordinates, used for caption button hover. */
  readonly pointer?: Point;
}

/** Window frame with a title bar showing the app icon, title and OS style controls. */
export function drawWindowFrame(c: Ctx, view: WindowView): void {
  const frame = WINDOW_RECTS[view.os];
  const radius = windowRadius(view.os);
  const accent = APP_ACCENT[view.app];
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.55)';
  c.shadowBlur = 26;
  c.shadowOffsetY = 10;
  fillRound(c, frame.x, frame.y, frame.w, frame.h, radius, '#101624');
  c.restore();
  c.save();
  c.beginPath();
  c.roundRect(frame.x, frame.y, frame.w, frame.h, radius);
  c.clip();
  const bar = c.createLinearGradient(0, frame.y, 0, frame.y + TITLE_H);
  bar.addColorStop(0, view.os === 'windows' ? '#2b2b2b' : '#2b3347');
  bar.addColorStop(1, view.os === 'windows' ? '#202020' : '#1f2638');
  c.fillStyle = bar;
  c.fillRect(frame.x, frame.y, frame.w, TITLE_H);
  c.globalAlpha = 0.9;
  c.fillStyle = accent;
  c.fillRect(frame.x, frame.y + TITLE_H - 2, frame.w, 2);
  c.restore();
  strokeRound(c, frame.x, frame.y, frame.w, frame.h, radius, 'rgba(255,255,255,0.14)', 1);
  if (view.os === 'macos') ['#ff5f57', '#febc2e', '#28c840'].forEach((color, i) => fillDisc(c, frame.x + 17 + i * 19, frame.y + TITLE_H / 2, 6, color));
  else if (view.os === 'linux') drawLinuxControls(c, frame);
  else drawWindowsControls(c, view.pointer);
  const iconX = view.os === 'macos' ? frame.x + 84 : frame.x + 12;
  drawIcon(c, view.app, iconX, frame.y + 6, 20);
  write(c, view.title, iconX + 28, frame.y + 21, { color: '#f2f6fc', size: 13.5, weight: 'bold' });
}
