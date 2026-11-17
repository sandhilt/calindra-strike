import { fillDisc, fillRound, spinner, write, type Ctx } from '../canvas.ts';

export const GREEN = '#3ddc97';
export const RED = '#ff5d73';
export const MUTED = '#8b9bb4';

export type StepState = 'pending' | 'running' | 'done' | 'failed';

/** Round status glyph: hollow, spinning, green check or red cross. */
export function statusMark(c: Ctx, x: number, y: number, state: StepState, timeMs: number, radius = 8): void {
  if (state === 'running') return spinner(c, x, y, timeMs, radius - 1.5, '#6ee7cf', 2.4);
  if (state === 'pending') {
    c.strokeStyle = 'rgba(255,255,255,0.28)';
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(x, y, radius - 1, 0, Math.PI * 2);
    c.stroke();
    return;
  }
  fillDisc(c, x, y, radius, state === 'done' ? GREEN : RED);
  c.strokeStyle = '#0b1320';
  c.lineWidth = 2;
  c.lineCap = 'round';
  c.beginPath();
  if (state === 'done') {
    c.moveTo(x - radius * 0.45, y);
    c.lineTo(x - radius * 0.1, y + radius * 0.38);
    c.lineTo(x + radius * 0.5, y - radius * 0.36);
  } else {
    c.moveTo(x - radius * 0.35, y - radius * 0.35);
    c.lineTo(x + radius * 0.35, y + radius * 0.35);
    c.moveTo(x + radius * 0.35, y - radius * 0.35);
    c.lineTo(x - radius * 0.35, y + radius * 0.35);
  }
  c.stroke();
  c.lineCap = 'butt';
}

export function avatar(c: Ctx, x: number, y: number, radius: number, color: string, initial: string): void {
  fillDisc(c, x, y, radius, color);
  write(c, initial, x, y + radius * 0.36, { color: '#0b1320', size: radius * 1.05, weight: 'bold', align: 'center' });
}

export function chip(c: Ctx, x: number, y: number, label: string, fill: string, color: string, size = 11): number {
  const width = label.length * size * 0.58 + 14;
  fillRound(c, x, y, width, size + 8, (size + 8) / 2, fill);
  write(c, label, x + 7, y + size + 1.5, { color, size, weight: 'bold' });
  return width;
}

export function button(c: Ctx, x: number, y: number, w: number, h: number, label: string, fill: string, color = '#ffffff', size = 13): void {
  fillRound(c, x, y, w, h, 6, fill);
  write(c, label, x + w / 2, y + h / 2 + size * 0.35, { color, size, weight: 'bold', align: 'center' });
}
