import type { AppName } from './apps.ts';
import { SCREEN_H, SCREEN_W, easeOut, ellipsize, fillRound, line, strokeRound, write, type Ctx, type Rect } from './canvas.ts';
import { TASKBAR_H, taskbarApps, windowControlRect } from './chrome.ts';
import { drawIcon } from './icons.ts';
import { avatar } from './scenes/widgets.ts';

const MENU_W = 372;
const MENU_H = 322;
const MENU_COLUMNS = 6;
const CELL_W = 56;
const CELL_H = 58;
const RECOMMENDED: readonly (readonly [string, string])[] = [
  ['session.test.ts', 'Adicionado há 2 min'],
  ['app-config.yaml', 'Ontem às 18:12'],
];

/** The Windows 11 Start flyout: pinned grid and recommended files, rising from the taskbar. */
export function drawStartMenu(c: Ctx, apps: readonly AppName[], t: number): void {
  const open = easeOut(t);
  const x = (SCREEN_W - MENU_W) / 2;
  const y = SCREEN_H - TASKBAR_H - MENU_H - 8 + (1 - open) * 36;
  c.save();
  c.globalAlpha = open;
  c.shadowColor = 'rgba(0,0,0,0.5)';
  c.shadowBlur = 24;
  fillRound(c, x, y, MENU_W, MENU_H, 10, 'rgba(38,42,54,0.96)');
  c.shadowBlur = 0;
  strokeRound(c, x, y, MENU_W, MENU_H, 10, 'rgba(255,255,255,0.14)', 1);
  fillRound(c, x + 16, y + 14, MENU_W - 32, 26, 13, 'rgba(255,255,255,0.1)');
  write(c, 'Digite aqui para pesquisar', x + 32, y + 32, { color: '#c9d2e2', size: 11.5 });
  write(c, 'Fixados', x + 18, y + 62, { color: '#ffffff', size: 12, weight: 'bold' });
  taskbarApps(apps).slice(0, MENU_COLUMNS * 2).forEach((app, i) => {
    const cx = x + 16 + (i % MENU_COLUMNS) * CELL_W + CELL_W / 2;
    const cy = y + 72 + Math.floor(i / MENU_COLUMNS) * CELL_H;
    drawIcon(c, app, cx - 14, cy, 28);
    write(c, ellipsize(c, app, CELL_W - 4, { size: 9.5 }), cx, cy + 42, { color: '#dfe6f3', size: 9.5, align: 'center' });
  });
  write(c, 'Recomendados', x + 18, y + 208, { color: '#ffffff', size: 12, weight: 'bold' });
  RECOMMENDED.forEach(([name, meta], i) => {
    drawIcon(c, 'Explorer', x + 18, y + 220 + i * 30, 22);
    write(c, name, x + 50, y + 235 + i * 30, { color: '#ffffff', size: 11.5 });
    write(c, meta, x + 190, y + 235 + i * 30, { color: '#aeb8cb', size: 10.5 });
  });
  line(c, x, y + MENU_H - 38, x + MENU_W, y + MENU_H - 38, 'rgba(255,255,255,0.1)');
  avatar(c, x + 28, y + MENU_H - 19, 10, '#9fe6d2', 'D');
  write(c, 'Dev', x + 46, y + MENU_H - 15, { color: '#ffffff', size: 12 });
  c.restore();
}

const SNAP_LAYOUTS: readonly (readonly Rect[])[] = [
  [{ x: 0, y: 0, w: 0.48, h: 1 }, { x: 0.52, y: 0, w: 0.48, h: 1 }],
  [{ x: 0, y: 0, w: 0.62, h: 1 }, { x: 0.66, y: 0, w: 0.34, h: 1 }],
  [{ x: 0, y: 0, w: 0.31, h: 1 }, { x: 0.345, y: 0, w: 0.31, h: 1 }, { x: 0.69, y: 0, w: 0.31, h: 1 }],
  [{ x: 0, y: 0, w: 0.48, h: 1 }, { x: 0.52, y: 0, w: 0.48, h: 0.48 }, { x: 0.52, y: 0.52, w: 0.48, h: 0.48 }],
];
const SNAP_THUMB_W = 52;
const SNAP_THUMB_H = 34;

/** The Snap Layouts grid that Windows 11 shows when hovering the maximize button. */
export function drawSnapLayouts(c: Ctx, t: number): void {
  const anchor = windowControlRect('windows', 'max');
  const w = SNAP_THUMB_W * 2 + 40;
  const h = SNAP_THUMB_H * 2 + 40;
  const x = anchor.x + anchor.w / 2 - w / 2;
  const y = anchor.y + anchor.h + 2 - (1 - easeOut(t)) * 8;
  c.save();
  c.globalAlpha = easeOut(t);
  c.shadowColor = 'rgba(0,0,0,0.5)';
  c.shadowBlur = 16;
  fillRound(c, x, y, w, h, 8, 'rgba(46,46,52,0.98)');
  c.shadowBlur = 0;
  strokeRound(c, x, y, w, h, 8, 'rgba(255,255,255,0.16)', 1);
  SNAP_LAYOUTS.forEach((layout, i) => {
    const tx = x + 12 + (i % 2) * (SNAP_THUMB_W + 16);
    const ty = y + 12 + Math.floor(i / 2) * (SNAP_THUMB_H + 16);
    fillRound(c, tx, ty, SNAP_THUMB_W, SNAP_THUMB_H, 3, 'rgba(255,255,255,0.08)');
    layout.forEach((cell, index) => {
      fillRound(c, tx + cell.x * SNAP_THUMB_W + 1, ty + cell.y * SNAP_THUMB_H + 1, cell.w * SNAP_THUMB_W - 2, cell.h * SNAP_THUMB_H - 2, 2, i === 0 && index === 0 ? '#60cdff' : 'rgba(255,255,255,0.3)');
    });
  });
  c.restore();
}
