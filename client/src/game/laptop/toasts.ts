import type { AppName } from './apps.ts';
import { SCREEN_H, SCREEN_W, easeOut, ellipsize, fillRound, span, strokeRound, write, type Ctx, type Point, type Rect } from './canvas.ts';
import { TASKBAR_H } from './chrome.ts';
import { drawIcon } from './icons.ts';
import type { OsName } from './scenarios.ts';

export interface Toast {
  readonly icon?: AppName;
  readonly tile?: { readonly letter: string; readonly color: string };
  readonly title: string;
  readonly body: string;
  readonly buttons?: readonly string[];
  /** Button the pointer clicks, for toasts that ask a question. */
  readonly clicked?: number;
}

export interface ToastPlan {
  readonly scene: number;
  /** Scene-local progress window where the toast is on screen. */
  readonly from: number;
  readonly to: number;
  readonly toast: Toast;
}

const slack = (body: string): Toast => ({ icon: 'Slack', title: 'Bia · #incidente-prod', body });

export const TOAST_PLANS: Readonly<Record<string, readonly ToastPlan[]>> = {
  friday: [
    { scene: 2, from: 0.45, to: 0.9, toast: slack('Algum progresso nesse bug?') },
    { scene: 6, from: 0.6, to: 0.98, toast: { icon: 'GitHub Actions', title: 'GitHub Actions', body: 'Workflow concluído · tudo verde' } },
  ],
  jira: [
    { scene: 3, from: 0.45, to: 0.9, toast: slack('Cliente perguntando de novo…') },
    { scene: 6, from: 0.6, to: 0.98, toast: { icon: 'Bitbucket Pipelines', title: 'Bitbucket Pipelines', body: 'Pipeline #88 · build verde' } },
  ],
  login: [
    { scene: 4, from: 0.45, to: 0.9, toast: slack('Conseguiu entrar na Eitri?') },
    { scene: 6, from: 0.6, to: 0.98, toast: { icon: 'GitHub Actions', title: 'GitHub Actions', body: 'Validate session · passou' } },
  ],
  feed: [
    { scene: 1, from: 0.4, to: 0.9, toast: { icon: 'X', title: '@cafe_seguranca te mencionou', body: 'token npm vazou. Revogue!' } },
    { scene: 5, from: 0.45, to: 0.9, toast: slack('Revogou o token?') },
    { scene: 6, from: 0.6, to: 0.98, toast: { icon: 'Bitbucket Pipelines', title: 'Bitbucket Pipelines', body: 'Scan secrets · limpo' } },
  ],
  meeting: [
    { scene: 5, from: 0.45, to: 0.9, toast: slack('Reunião começando em 1 min') },
    { scene: 6, from: 0.5, to: 0.95, toast: { icon: 'GitHub', title: 'GitHub', body: 'PR #43 mergeado' } },
  ],
  wsl: [
    { scene: 1, from: 0.5, to: 0.95, toast: { tile: { letter: 'T', color: '#6264a7' }, title: 'Chamada de Bia', body: 'Precisamos do hotfix agora' } },
    { scene: 3, from: 0.3, to: 0.95, toast: { icon: 'Windows', title: 'Windows Update', body: 'Reiniciar agora?', buttons: ['Reiniciar agora', 'Mais tarde'], clicked: 1 } },
    { scene: 5, from: 0.5, to: 0.95, toast: { icon: 'Docker', title: 'Docker Desktop', body: 'Engine running' } },
  ],
};

const TOAST_W = 244;
const TOAST_H = 58;
const TOAST_BUTTONS_H = 92;
const TOAST_MARGIN = 10;
const SLIDE_IN_END = 0.18;
const SLIDE_OUT_START = 0.82;

export function toastAt(scenarioId: string, sceneIndex: number, local: number): { plan: ToastPlan; t: number } | undefined {
  const plan = TOAST_PLANS[scenarioId]?.find((entry) => entry.scene === sceneIndex && local >= entry.from && local <= entry.to);
  return plan ? { plan, t: span(local, plan.from, plan.to) } : undefined;
}

function toastRect(os: OsName, toast: Toast): Rect {
  const h = toast.buttons ? TOAST_BUTTONS_H : TOAST_H;
  if (os === 'windows') return { x: SCREEN_W - TOAST_W - TOAST_MARGIN, y: SCREEN_H - TASKBAR_H - h - TOAST_MARGIN, w: TOAST_W, h };
  if (os === 'macos') return { x: SCREEN_W - TOAST_W - TOAST_MARGIN, y: 32, w: TOAST_W, h };
  return { x: (SCREEN_W - TOAST_W) / 2, y: 36, w: TOAST_W, h };
}

function buttonRect(rect: Rect, count: number, index: number): Rect {
  const gap = 8;
  const w = (rect.w - 24 - gap * (count - 1)) / count;
  return { x: rect.x + 12 + index * (w + gap), y: rect.y + rect.h - 32, w, h: 22 };
}

/** Where the pointer should go to click the toast's chosen button. */
export function toastClickTarget(os: OsName, toast: Toast): Point | undefined {
  if (toast.clicked === undefined || !toast.buttons) return undefined;
  const rect = buttonRect(toastRect(os, toast), toast.buttons.length, toast.clicked);
  return [rect.x + rect.w / 2, rect.y + rect.h / 2];
}

function slideOffset(os: OsName, t: number): Point {
  const hidden = easeOut(1 - span(t, 0, SLIDE_IN_END)) + easeOut(span(t, SLIDE_OUT_START, 1));
  if (os === 'linux') return [0, -hidden * (TOAST_H + 50)];
  return [hidden * (TOAST_W + 30), 0];
}

export function drawToast(c: Ctx, os: OsName, toast: Toast, t: number): void {
  const rect = toastRect(os, toast);
  const [dx, dy] = slideOffset(os, t);
  c.save();
  c.translate(dx, dy);
  c.shadowColor = 'rgba(0,0,0,0.5)';
  c.shadowBlur = 18;
  c.shadowOffsetY = 6;
  fillRound(c, rect.x, rect.y, rect.w, rect.h, os === 'windows' ? 8 : 12, os === 'windows' ? 'rgba(44,44,48,0.96)' : 'rgba(52,56,66,0.94)');
  c.restore();
  c.save();
  c.translate(dx, dy);
  strokeRound(c, rect.x, rect.y, rect.w, rect.h, os === 'windows' ? 8 : 12, 'rgba(255,255,255,0.16)', 1);
  if (toast.icon) drawIcon(c, toast.icon, rect.x + 12, rect.y + 12, 30);
  else if (toast.tile) {
    fillRound(c, rect.x + 12, rect.y + 12, 30, 30, 8, toast.tile.color);
    write(c, toast.tile.letter, rect.x + 27, rect.y + 34, { color: '#ffffff', size: 17, weight: 'bold', align: 'center' });
  }
  write(c, ellipsize(c, toast.title, 184, { size: 12.5, weight: 'bold' }), rect.x + 52, rect.y + 25, { color: '#ffffff', size: 12.5, weight: 'bold' });
  write(c, ellipsize(c, toast.body, 184, { size: 11.5 }), rect.x + 52, rect.y + 42, { color: '#cfd6e4', size: 11.5 });
  const buttons = toast.buttons ?? [];
  buttons.forEach((label, i) => {
    const button = buttonRect(rect, buttons.length, i);
    const pressed = toast.clicked === i && t > 0.62 && t < 0.8;
    fillRound(c, button.x, button.y, button.w, button.h, 5, pressed ? '#60cdff' : i === 0 ? '#3a3a3f' : '#4a4a52');
    write(c, label, button.x + button.w / 2, button.y + 15, { color: pressed ? '#06121c' : '#ffffff', size: 11, weight: 'bold', align: 'center' });
  });
  c.restore();
}
