export type Ctx = CanvasRenderingContext2D;
export type Point = readonly [number, number];

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Logical screen size; every layout is authored here and scaled to the real canvas. */
export const SCREEN_W = 720;
export const SCREEN_H = 450;

const FONT_UI = 'system-ui, "Segoe UI", Roboto, sans-serif';
const FONT_MONO = 'ui-monospace, "Cascadia Code", Menlo, Consolas, monospace';

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Maps value from [from, to] to [0, 1], clamped. */
export function span(value: number, from: number, to: number): number {
  return clamp01((value - from) / (to - from));
}

export function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function easeOutBack(t: number): number {
  const overshoot = 1.70158;
  return 1 + (overshoot + 1) * (t - 1) ** 3 + overshoot * (t - 1) ** 2;
}

/** Smooth 0..1 oscillation. */
export function pulse(timeMs: number, periodMs: number): number {
  return (1 + Math.sin((timeMs / periodMs) * Math.PI * 2)) / 2;
}

export function blinkOn(timeMs: number, periodMs = 500): boolean {
  return Math.floor(timeMs / periodMs) % 2 === 0;
}

/** Stable 0..1 pseudo-random value for a string or number, so layouts vary without randomness. */
export function unitHash(seed: string | number): number {
  const text = String(seed);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0) / 4294967296;
}

export function fillRound(c: Ctx, x: number, y: number, w: number, h: number, radius: number, fill: string | CanvasGradient): void {
  c.fillStyle = fill;
  c.beginPath();
  c.roundRect(x, y, w, h, radius);
  c.fill();
}

export function strokeRound(c: Ctx, x: number, y: number, w: number, h: number, radius: number, color: string, width = 1): void {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.roundRect(x, y, w, h, radius);
  c.stroke();
}

export function fillPolygon(c: Ctx, points: readonly Point[], fill: string | CanvasGradient): void {
  const [first, ...rest] = points;
  if (!first) return;
  c.fillStyle = fill;
  c.beginPath();
  c.moveTo(first[0], first[1]);
  for (const [x, y] of rest) c.lineTo(x, y);
  c.closePath();
  c.fill();
}

export function fillDisc(c: Ctx, x: number, y: number, radius: number, fill: string | CanvasGradient): void {
  c.fillStyle = fill;
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.fill();
}

export function line(c: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, width = 1): void {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
}

export interface TextStyle {
  readonly color?: string;
  readonly size?: number;
  readonly weight?: 'normal' | 'bold';
  readonly mono?: boolean;
  readonly italic?: boolean;
  readonly align?: CanvasTextAlign;
}

function applyFont(c: Ctx, style: TextStyle): void {
  const { size = 13, weight = 'normal', mono = false, italic = false } = style;
  c.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${mono ? FONT_MONO : FONT_UI}`;
}

export function write(c: Ctx, value: string, x: number, y: number, style: TextStyle = {}): void {
  applyFont(c, style);
  c.fillStyle = style.color ?? '#dbe7f5';
  c.textAlign = style.align ?? 'left';
  c.textBaseline = 'alphabetic';
  c.fillText(value, x, y);
  c.textAlign = 'left';
}

export function textWidth(c: Ctx, value: string, style: TextStyle = {}): number {
  applyFont(c, style);
  return c.measureText(value).width;
}

/** Cuts the text to the characters that fit, so long strings never spill out of a panel. */
export function ellipsize(c: Ctx, value: string, maxWidth: number, style: TextStyle = {}): string {
  if (textWidth(c, value, style) <= maxWidth) return value;
  let end = value.length;
  while (end > 1 && textWidth(c, `${value.slice(0, end)}…`, style) > maxWidth) end--;
  return `${value.slice(0, end)}…`;
}

/** The part of a string revealed at a typing progress between 0 and 1. */
export function typed(value: string, progress: number): string {
  return value.slice(0, Math.floor(clamp01(progress) * value.length));
}

/** Lines typed one after another over a single 0..1 progress; lines not started yet are left out. */
export function revealLines(lines: readonly string[], progress: number): string[] {
  const total = lines.reduce((sum, value) => sum + value.length, 0);
  let budget = Math.floor(clamp01(progress) * total);
  const visible: string[] = [];
  for (const value of lines) {
    if (budget <= 0) break;
    visible.push(value.slice(0, budget));
    budget -= value.length;
  }
  return visible;
}

/** Greedy word wrap to a pixel width. */
export function wrapText(c: Ctx, value: string, maxWidth: number, style: TextStyle = {}): string[] {
  const rows: string[] = [];
  let row = '';
  for (const word of value.split(' ')) {
    const candidate = row ? `${row} ${word}` : word;
    if (row && textWidth(c, candidate, style) > maxWidth) {
      rows.push(row);
      row = word;
    } else {
      row = candidate;
    }
  }
  if (row) rows.push(row);
  return rows;
}

export function spinner(c: Ctx, x: number, y: number, timeMs: number, radius = 7, color = '#6ee7cf', width = 3): void {
  const angle = timeMs / 180;
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = 'round';
  c.beginPath();
  c.arc(x, y, radius, angle, angle + 4.4);
  c.stroke();
  c.lineCap = 'butt';
}

export function progressBar(c: Ctx, x: number, y: number, w: number, h: number, value: number, color: string, track = 'rgba(255,255,255,0.12)'): void {
  fillRound(c, x, y, w, h, h / 2, track);
  if (value > 0) fillRound(c, x, y, Math.max(h, w * clamp01(value)), h, h / 2, color);
}

export function glowDisc(c: Ctx, x: number, y: number, radius: number, color: string, alpha: number): void {
  const gradient = c.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  c.save();
  c.globalAlpha *= alpha;
  c.fillStyle = gradient;
  c.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  c.restore();
}

/** Runs draw with the origin moved to the rect corner and everything clipped to it. */
export function inRect(c: Ctx, rect: Rect, draw: () => void): void {
  c.save();
  c.translate(rect.x, rect.y);
  c.beginPath();
  c.rect(0, 0, rect.w, rect.h);
  c.clip();
  draw();
  c.restore();
}
