import { APP_ACCENT, type AppName } from './apps.ts';
import { SCREEN_H, SCREEN_W, easeOut, easeOutBack, fillRound, glowDisc, lerp, progressBar, pulse, span, spinner, write, type Ctx } from './canvas.ts';
import { drawIcon } from './icons.ts';
import { statusMark } from './scenes/widgets.ts';

const CENTER_X = SCREEN_W / 2;
const CENTER_Y = SCREEN_H / 2;
const SPLASH_ICON_SIZE = 104;
const SPLASH_FADE_START = 0.85;
const MONTAGE_ICON_SIZE = 50;
const MONTAGE_MAX_ICONS = 14;
const BANNER_W = 440;
const BANNER_H = 96;
const BANNER_ICON_SIZE = 34;

/** Big icon scaling in with a glow, shown over the desktop while an app launches. */
export function drawSplash(c: Ctx, app: AppName, t: number, timeMs: number): void {
  const fade = t < SPLASH_FADE_START ? 1 : 1 - span(t, SPLASH_FADE_START, 1);
  c.save();
  c.globalAlpha = fade;
  c.fillStyle = 'rgba(6,10,18,0.55)';
  c.fillRect(0, 0, SCREEN_W, SCREEN_H);
  glowDisc(c, CENTER_X, CENTER_Y - 22, 170, APP_ACCENT[app], 0.55 + 0.2 * pulse(timeMs, 500));
  const size = SPLASH_ICON_SIZE * lerp(0.45, 1, easeOutBack(span(t, 0, 0.45))) * (1 + 0.12 * span(t, SPLASH_FADE_START, 1));
  drawIcon(c, app, CENTER_X - size / 2, CENTER_Y - 22 - size / 2, size);
  write(c, app, CENTER_X, CENTER_Y + 58, { color: '#ffffff', size: 19, weight: 'bold', align: 'center' });
  progressBar(c, CENTER_X - 80, CENTER_Y + 74, 160, 5, t, APP_ACCENT[app]);
  spinner(c, CENTER_X + 104, CENTER_Y + 77, timeMs, 7, APP_ACCENT[app], 2.4);
  c.restore();
}

/** Soft ambient light from the active app plus a gentle vignette. */
export function drawScreenGlow(c: Ctx, accent: string, timeMs: number): void {
  glowDisc(c, CENTER_X, 0, 440, accent, 0.1 + 0.05 * pulse(timeMs, 2400));
  const vignette = c.createRadialGradient(CENTER_X, CENTER_Y, SCREEN_H * 0.45, CENTER_X, CENTER_Y, SCREEN_W * 0.62);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.3)');
  c.fillStyle = vignette;
  c.fillRect(0, 0, SCREEN_W, SCREEN_H);
}

/** Icons of every tool used, flashing one after another around the screen before the banner. */
export function drawMontage(c: Ctx, apps: readonly AppName[], t: number, timeMs: number): void {
  const shown = apps.slice(0, MONTAGE_MAX_ICONS);
  c.save();
  c.fillStyle = `rgba(4,8,14,${0.55 * Math.min(1, t * 3)})`;
  c.fillRect(0, 0, SCREEN_W, SCREEN_H);
  shown.forEach((app, i) => {
    const angle = (i / shown.length) * Math.PI * 2 - Math.PI / 2 + timeMs / 4000;
    const x = CENTER_X + Math.cos(angle) * 270;
    const y = CENTER_Y + Math.sin(angle) * 150;
    const flash = span(t * shown.length * 0.8, i, i + 1.6);
    const burst = flash > 0 && flash < 1 ? easeOutBack(flash) : flash >= 1 ? 1 : 0;
    const size = MONTAGE_ICON_SIZE * (0.55 + 0.6 * burst);
    c.globalAlpha = 0.25 + 0.75 * burst;
    if (flash > 0) glowDisc(c, x, y, 70, APP_ACCENT[app], 0.7 * (1 - flash * 0.5));
    drawIcon(c, app, x - size / 2, y - size / 2, size);
  });
  c.restore();
}

/** Green "bug corrigido" banner surrounded by the icons of the tools used. */
export function drawBanner(c: Ctx, apps: readonly AppName[], t: number, timeMs: number): void {
  const appear = easeOutBack(span(t, 0, 0.35));
  const x = CENTER_X - BANNER_W / 2;
  const y = CENTER_Y - BANNER_H / 2;
  c.save();
  c.fillStyle = `rgba(3,18,12,${0.55 * easeOut(span(t, 0, 0.3))})`;
  c.fillRect(0, 0, SCREEN_W, SCREEN_H);
  c.translate(CENTER_X, CENTER_Y);
  c.scale(0.6 + 0.4 * appear, 0.6 + 0.4 * appear);
  c.translate(-CENTER_X, -CENTER_Y);
  glowDisc(c, CENTER_X, CENTER_Y, 280, '#35e08f', 0.5 + 0.2 * pulse(timeMs, 800));
  const fill = c.createLinearGradient(x, y, x + BANNER_W, y + BANNER_H);
  fill.addColorStop(0, '#12684a');
  fill.addColorStop(1, '#0d4a37');
  c.shadowColor = 'rgba(53,224,143,0.6)';
  c.shadowBlur = 28;
  fillRound(c, x, y, BANNER_W, BANNER_H, 16, fill);
  c.shadowBlur = 0;
  c.strokeStyle = '#6dffb8';
  c.lineWidth = 2;
  c.beginPath();
  c.roundRect(x, y, BANNER_W, BANNER_H, 16);
  c.stroke();
  statusMark(c, x + 46, CENTER_Y, 'done', timeMs, 20);
  write(c, 'bug corrigido', x + 84, CENTER_Y + 4, { color: '#eafff4', size: 32, weight: 'bold' });
  write(c, 'produção respirando', x + 86, CENTER_Y + 28, { color: '#9ff0c6', size: 15 });
  const shown = apps.slice(0, 10);
  shown.forEach((app, i) => {
    const row = i < 5 ? -1 : 1;
    const column = i < 5 ? i : i - 5;
    const rowCount = i < 5 ? Math.min(5, shown.length) : shown.length - 5;
    const bob = Math.sin(timeMs / 380 + i * 0.9) * 3;
    const ix = CENTER_X + (column - (rowCount - 1) / 2) * 62 - BANNER_ICON_SIZE / 2;
    const iy = CENTER_Y + row * 78 - BANNER_ICON_SIZE / 2 + bob;
    c.globalAlpha = easeOut(span(t, 0.2 + i * 0.04, 0.5 + i * 0.04));
    drawIcon(c, app, ix, iy, BANNER_ICON_SIZE);
  });
  c.restore();
}

/** A row of icons asking for help, used on the idle screen. */
export function drawIconRow(c: Ctx, apps: readonly AppName[], y: number, size: number, timeMs: number): void {
  const stride = size + 8;
  const left = SCREEN_W / 2 - (apps.length * stride) / 2;
  apps.forEach((app, i) => {
    const wobble = Math.max(0, Math.sin(timeMs / 260 - i * 0.7)) * 6;
    c.save();
    c.globalAlpha = 0.55 + 0.3 * pulse(timeMs + i * 120, 900);
    drawIcon(c, app, left + i * stride, y - wobble, size);
    c.restore();
  });
}
