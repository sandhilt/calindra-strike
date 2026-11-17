import { textWidth, write, type Ctx } from './canvas.ts';
import type { LaptopModel } from './scenarios.ts';

/** Logical size the badge art is authored in. */
export const BADGE_W = 256;
export const BADGE_H = 96;

const WORDMARK_SIZE = 40;

const APPLE_SCALE_PX = 52;
const APPLE_CENTER_Y_PX = BADGE_H / 2 + 3;
/** Bite and leaf in apple units (1 = APPLE_SCALE_PX), relative to the body's centre. */
const APPLE_BITE = { x: 0.6, y: -0.06, radius: 0.19 };

/** The white apple on the lid: body, a bite out of the right shoulder and a leaf, all drawn from curves. */
function drawMacBadge(c: Ctx): void {
  c.save();
  c.translate(BADGE_W / 2, APPLE_CENTER_Y_PX);
  c.scale(APPLE_SCALE_PX, APPLE_SCALE_PX);
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.moveTo(0, -0.28);
  c.bezierCurveTo(0.15, -0.42, 0.52, -0.38, 0.56, 0);
  c.bezierCurveTo(0.6, 0.3, 0.36, 0.62, 0.2, 0.62);
  c.bezierCurveTo(0.1, 0.62, 0.06, 0.56, 0, 0.56);
  c.bezierCurveTo(-0.06, 0.56, -0.1, 0.62, -0.2, 0.62);
  c.bezierCurveTo(-0.38, 0.62, -0.6, 0.3, -0.56, 0);
  c.bezierCurveTo(-0.52, -0.38, -0.15, -0.42, 0, -0.28);
  c.fill();
  c.globalCompositeOperation = 'destination-out';
  c.beginPath();
  c.arc(APPLE_BITE.x, APPLE_BITE.y, APPLE_BITE.radius, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = 'source-over';
  c.beginPath();
  c.moveTo(0.02, -0.3);
  c.bezierCurveTo(0.02, -0.5, 0.12, -0.62, 0.3, -0.66);
  c.bezierCurveTo(0.3, -0.48, 0.2, -0.34, 0.02, -0.3);
  c.fill();
  c.restore();
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
