import { fillRound, glowDisc, strokeRound, textWidth, write, type Ctx } from './canvas.ts';
import type { LaptopModel } from './scenarios.ts';

/** Logical size the badge art is authored in. */
export const BADGE_W = 256;
export const BADGE_H = 96;

const WORDMARK_SIZE = 40;

function drawMacBadge(c: Ctx): void {
  glowDisc(c, BADGE_W / 2, BADGE_H / 2, 70, '#ffffff', 0.55);
  fillRound(c, BADGE_W / 2 - 30, BADGE_H / 2 - 30, 60, 60, 16, 'rgba(255,255,255,0.18)');
  strokeRound(c, BADGE_W / 2 - 30, BADGE_H / 2 - 30, 60, 60, 16, 'rgba(255,255,255,0.85)', 2.5);
  write(c, 'M', BADGE_W / 2, BADGE_H / 2 + 14, { color: '#ffffff', size: 40, weight: 'bold', align: 'center' });
}

/** "ThinkPad" in italic bold with the red dot over the i, built from a dotless i. */
function drawThinkpadBadge(c: Ctx): void {
  const style = { size: WORDMARK_SIZE, weight: 'bold', italic: true } as const;
  const head = 'Th';
  const tail = 'nkPad';
  const total = textWidth(c, `${head}ı${tail}`, style);
  let x = (BADGE_W - total) / 2;
  const baseline = BADGE_H / 2 + 14;
  write(c, head, x, baseline, { ...style, color: '#e8ebf0' });
  x += textWidth(c, head, style);
  write(c, 'ı', x, baseline, { ...style, color: '#e8ebf0' });
  const dotX = x + textWidth(c, 'ı', style) / 2 + 3;
  c.fillStyle = '#ee334b';
  c.beginPath();
  c.arc(dotX, baseline - 31, 4.5, 0, Math.PI * 2);
  c.fill();
  x += textWidth(c, 'ı', style);
  write(c, tail, x, baseline, { ...style, color: '#e8ebf0' });
}

function drawDellBadge(c: Ctx): void {
  const cx = BADGE_W / 2;
  const cy = BADGE_H / 2;
  c.strokeStyle = '#1b3a5c';
  c.lineWidth = 5;
  c.beginPath();
  c.arc(cx, cy, 34, 0, Math.PI * 2);
  c.stroke();
  write(c, 'DELL', cx, cy + 9, { color: '#1b3a5c', size: 26, weight: 'bold', align: 'center' });
}

const BADGES: Readonly<Record<LaptopModel, (c: Ctx) => void>> = {
  macbook: drawMacBadge,
  thinkpad: drawThinkpadBadge,
  inspiron: drawDellBadge,
};

/** Brand badge for the back of the lid, drawn from text and shapes only. */
export function drawLidBadge(ctx: CanvasRenderingContext2D, width: number, height: number, model: LaptopModel): void {
  ctx.save();
  ctx.scale(width / BADGE_W, height / BADGE_H);
  ctx.clearRect(0, 0, BADGE_W, BADGE_H);
  BADGES[model](ctx);
  ctx.restore();
}
