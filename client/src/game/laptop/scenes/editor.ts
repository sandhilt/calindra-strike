import { APP_ACCENT, type AppName } from '../apps.ts';
import { blinkOn, clamp01, fillDisc, fillPolygon, fillRound, line, progressBar, revealLines, span, spinner, strokeRound, textWidth, typed, wrapText, write, type Ctx } from '../canvas.ts';
import { drawIcon } from '../icons.ts';
import type { Scene } from '../scenarios.ts';
import { CONTENT_H, CONTENT_W, type SceneRenderer } from './frame.ts';
import { GREEN, MUTED, RED, avatar, statusMark } from './widgets.ts';

type EditorScene = Extract<Scene, { kind: 'editor' }>;

interface EditorTheme {
  readonly bg: string;
  readonly side: string;
  readonly tab: string;
  readonly status: string;
  readonly assistant: AppName;
}

const EDITOR_THEMES: Readonly<Record<EditorScene['app'], EditorTheme>> = {
  Cursor: { bg: '#14130f', side: '#0e0d0b', tab: '#1f1d18', status: '#1f1d18', assistant: 'Claude Code' },
  'VS Code': { bg: '#1e1e1e', side: '#252526', tab: '#2d2d2d', status: '#007acc', assistant: 'Codex' },
  Xcode: { bg: '#1f1f24', side: '#2a2a31', tab: '#33333c', status: '#2a2a31', assistant: 'Gemini' },
};

const ACTIVITY_BAR_W = 34;
const AI_PANEL_W = 200;
const STATUS_H = 20;
const TAB_H = 28;
const CODE_LINE_H = 22;
const CODE_SIZE = 11.5;

const TOKEN_PATTERN = /(\/\/.*)|\b(export|function|return|if|const)\b|([A-Za-z_]\w*)(?=\()|('[^']*')/g;

const SYNTAX = { plain: '#d4d4d4', comment: '#6a9955', keyword: '#c586c0', call: '#dcdcaa', string: '#ce9178' } as const;

/** Draws one code line with simple syntax colours, token by token. */
function drawCodeLine(c: Ctx, source: string, x: number, y: number): void {
  const style = { size: CODE_SIZE, mono: true } as const;
  let cursor = x;
  let last = 0;
  const put = (part: string, color: string): void => {
    if (!part) return;
    write(c, part, cursor, y, { ...style, color });
    cursor += textWidth(c, part, style);
  };
  for (const match of source.matchAll(TOKEN_PATTERN)) {
    put(source.slice(last, match.index), SYNTAX.plain);
    const [text, comment, keyword, call, string] = match;
    put(text, comment ? SYNTAX.comment : keyword ? SYNTAX.keyword : call ? SYNTAX.call : string ? SYNTAX.string : SYNTAX.plain);
    last = match.index + text.length;
  }
  put(source.slice(last), SYNTAX.plain);
}

function chevron(c: Ctx, x: number, y: number, open: boolean, color: string): void {
  fillPolygon(c, open ? [[x, y], [x + 7, y], [x + 3.5, y + 5]] : [[x, y - 1], [x + 5, y + 2.5], [x, y + 6]], color);
}

function drawSidebar(c: Ctx, scene: EditorScene, x: number, w: number, theme: EditorTheme): void {
  c.fillStyle = theme.side;
  c.fillRect(x, 0, w, CONTENT_H - STATUS_H);
  write(c, scene.app === 'Xcode' ? 'NAVEGADOR' : 'EXPLORADOR', x + 12, 20, { color: MUTED, size: 10.5, weight: 'bold' });
  const rows: readonly (readonly [string, number, boolean])[] = [
    ['src', 0, true],
    [scene.file, 1, false],
    ['session.test.ts', 1, false],
    ['test', 0, false],
    ['package.json', 0, false],
  ];
  rows.forEach(([label, depth, isFolder], i) => {
    const y = 48 + i * 22;
    const active = label === scene.file;
    if (active) fillRound(c, x + 4, y - 14, w - 8, 20, 4, 'rgba(255,255,255,0.1)');
    if (isFolder || label === 'test') chevron(c, x + 12, y - 8, isFolder, MUTED);
    write(c, label, x + 24 + depth * 10, y, { color: active ? '#ffffff' : '#b3bdcc', size: 12 });
  });
}

function drawTabs(c: Ctx, scene: EditorScene, x: number, w: number, theme: EditorTheme): void {
  c.fillStyle = theme.tab;
  c.fillRect(x, 0, w, TAB_H);
  fillRound(c, x + 6, 4, 150, TAB_H - 4, 5, theme.bg);
  drawIcon(c, scene.app, x + 12, 8, 14);
  write(c, scene.file, x + 32, 19, { color: '#ffffff', size: 11.5 });
  fillDisc(c, x + 140, 17, 3, '#e8c36a');
}

function drawBugMarker(c: Ctx, p: number, gutterX: number, codeX: number, y: number): void {
  const fixed = p > 0.62;
  if (fixed) {
    fillRound(c, gutterX - 22, y - 14, 3, 18, 1.5, GREEN);
    return;
  }
  fillDisc(c, gutterX - 18, y - 5, 4, RED);
  c.strokeStyle = RED;
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(codeX, y + 4);
  for (let dx = 0; dx < 150; dx += 4) c.lineTo(codeX + dx, y + 4 + (dx % 8 === 0 ? 0 : 2));
  c.stroke();
}

function drawAiPanel(c: Ctx, scene: EditorScene, x: number, theme: EditorTheme, p: number, timeMs: number): void {
  const ai = scene.ai;
  if (!ai) return;
  const assistant = theme.assistant;
  const accent = APP_ACCENT[assistant];
  c.fillStyle = 'rgba(255,255,255,0.04)';
  c.fillRect(x, 0, AI_PANEL_W, CONTENT_H - STATUS_H);
  line(c, x, 0, x, CONTENT_H - STATUS_H, 'rgba(255,255,255,0.1)');
  drawIcon(c, assistant, x + 12, 6, 18);
  write(c, assistant, x + 36, 19, { color: '#ffffff', size: 12.5, weight: 'bold' });
  write(c, 'chat', x + AI_PANEL_W - 12, 19, { color: MUTED, size: 10.5, align: 'right' });
  line(c, x, TAB_H, x + AI_PANEL_W, TAB_H, 'rgba(255,255,255,0.1)');

  const promptRows = wrapText(c, revealPrompt(ai.prompt, p), AI_PANEL_W - 52, { size: 11.5 });
  fillRound(c, x + 10, 40, AI_PANEL_W - 20, 14 + promptRows.length * 16, 8, 'rgba(255,255,255,0.09)');
  avatar(c, x + 24, 54, 8, '#9fe6d2', 'D');
  promptRows.forEach((row, i) => write(c, row, x + 38, 58 + i * 16, { color: '#e6edf7', size: 11.5 }));

  const answerTop = 40 + 14 + promptRows.length * 16 + 12;
  drawIcon(c, assistant, x + 12, answerTop, 18);
  if (p < 0.42) {
    if (p > 0.28) spinner(c, x + 42, answerTop + 9, timeMs, 6, accent, 2);
    return;
  }
  const answer = ai.answer.slice(0, Math.floor(span(p, 0.42, 0.8) * ai.answer.length));
  wrapText(c, answer, AI_PANEL_W - 52, { size: 11.5 }).forEach((row, i) => write(c, row, x + 38, answerTop + 13 + i * 16, { color: '#cdd8e8', size: 11.5 }));
  if (p > 0.8) {
    statusMark(c, x + 22, answerTop + 78, 'done', timeMs, 7);
    write(c, 'Alterações aplicadas', x + 36, answerTop + 82, { color: GREEN, size: 11, weight: 'bold' });
  }
}

function revealPrompt(prompt: string, p: number): string {
  return prompt.slice(0, Math.floor(span(p, 0.04, 0.3) * prompt.length));
}

/** Integrated terminal of a remote window, running the tests inside WSL. */
function drawRemotePanel(c: Ctx, x: number, w: number, p: number): void {
  const top = 186;
  c.fillStyle = '#181818';
  c.fillRect(x, top, w, CONTENT_H - STATUS_H - top);
  line(c, x, top, x + w, top, 'rgba(255,255,255,0.12)');
  write(c, 'TERMINAL', x + 14, top + 17, { color: '#ffffff', size: 10.5, weight: 'bold' });
  line(c, x + 12, top + 21, x + 70, top + 21, '#2fa4ff', 1.5);
  const prompt = 'dev@ubuntu:~/app$ ';
  const command = typed('node --test', span(p, 0.5, 0.75));
  write(c, prompt, x + 14, top + 40, { color: '#6aa7ff', size: 11, mono: true });
  write(c, command, x + 14 + textWidth(c, prompt, { size: 11, mono: true }), top + 40, { color: '#e6edf7', size: 11, mono: true });
  if (p > 0.78) write(c, '✔ 24 passing', x + 14, top + 58, { color: GREEN, size: 11, mono: true });
}

function drawStatusBar(c: Ctx, scene: EditorScene, theme: EditorTheme): void {
  const y = CONTENT_H - STATUS_H;
  c.fillStyle = theme.status;
  c.fillRect(0, y, CONTENT_W, STATUS_H);
  let x = 10;
  if (scene.remote) {
    fillRound(c, 0, y, 96, STATUS_H, 0, '#16825d');
    drawIcon(c, 'WSL', 8, y + 3, 14);
    write(c, `${scene.remote}: Ubuntu`, 26, y + 14, { color: '#ffffff', size: 11, weight: 'bold' });
    x = 108;
  }
  write(c, 'hotfix/sessao', x, y + 14, { color: '#e8eefb', size: 11 });
  write(c, 'UTF-8   TypeScript', CONTENT_W - 12, y + 14, { color: '#e8eefb', size: 11, align: 'right' });
}

export const drawEditor: SceneRenderer<'editor'> = (c, scene, { p, timeMs }) => {
  const theme = EDITOR_THEMES[scene.app];
  c.fillStyle = theme.bg;
  c.fillRect(0, 0, CONTENT_W, CONTENT_H);
  const hasActivityBar = scene.app === 'VS Code';
  const sideX = hasActivityBar ? ACTIVITY_BAR_W : 0;
  const sideW = 124;
  if (hasActivityBar) {
    c.fillStyle = '#333333';
    c.fillRect(0, 0, ACTIVITY_BAR_W, CONTENT_H - STATUS_H);
    for (let i = 0; i < 4; i++) strokeRound(c, 9, 14 + i * 34, 16, 16, 4, i === 0 ? '#ffffff' : '#858585', 1.6);
  }
  drawSidebar(c, scene, sideX, sideW, theme);
  const codeX = sideX + sideW;
  const aiX = CONTENT_W - AI_PANEL_W;
  drawTabs(c, scene, codeX, aiX - codeX, theme);

  const visible = revealLines(scene.lines, span(p, 0.06, 0.6));
  visible.forEach((source, i) => {
    const y = TAB_H + 28 + i * CODE_LINE_H;
    write(c, String(i + 1), codeX + 26, y, { color: '#5c6a7e', size: CODE_SIZE, mono: true, align: 'right' });
    drawCodeLine(c, source, codeX + 40, y);
  });
  const bugLine = visible.length > 1 ? 1 : -1;
  if (bugLine >= 0 && visible[bugLine]?.length === scene.lines[bugLine]?.length) drawBugMarker(c, p, codeX + 26, codeX + 40, TAB_H + 28 + bugLine * CODE_LINE_H);
  const caretLine = Math.max(0, visible.length - 1);
  if (blinkOn(timeMs, 450) && p < 0.9) fillRound(c, codeX + 40 + textWidth(c, visible[caretLine] ?? '', { size: CODE_SIZE, mono: true }), TAB_H + 15 + caretLine * CODE_LINE_H, 2, 16, 0, '#d9f3ff');
  if (scene.remote) drawRemotePanel(c, codeX, aiX - codeX, p);
  drawAiPanel(c, scene, aiX, theme, p, timeMs);
  drawStatusBar(c, scene, theme);
};

interface AgentTheme {
  readonly bg: string;
  readonly card: string;
}

const AGENT_THEMES: Readonly<Record<Extract<Scene, { kind: 'agent' }>['app'], AgentTheme>> = {
  'Claude Code': { bg: '#1b1411', card: '#2a1e18' },
  Codex: { bg: '#0e1014', card: '#191c24' },
  Gemini: { bg: '#0f1120', card: '#1a1d36' },
  Grok: { bg: '#09090b', card: '#17171b' },
};

const AGENT_STEP_Y = 78;
const AGENT_STEP_H = 32;

export const drawAgent: SceneRenderer<'agent'> = (c, scene, { p, timeMs }) => {
  const theme = AGENT_THEMES[scene.app];
  const accent = APP_ACCENT[scene.app];
  c.fillStyle = theme.bg;
  c.fillRect(0, 0, CONTENT_W, CONTENT_H);
  drawIcon(c, scene.app, 20, 12, 34);
  write(c, scene.app, 64, 31, { color: '#ffffff', size: 18, weight: 'bold' });
  write(c, 'agente · sessão DEV-404', 64, 47, { color: MUTED, size: 11.5 });
  const done = p > 0.86;
  fillRound(c, CONTENT_W - 150, 18, 130, 24, 12, done ? 'rgba(61,220,151,0.18)' : 'rgba(255,255,255,0.08)');
  if (done) statusMark(c, CONTENT_W - 134, 30, 'done', timeMs, 6);
  else spinner(c, CONTENT_W - 134, 30, timeMs, 6, accent, 2);
  write(c, done ? 'pronto' : 'trabalhando…', CONTENT_W - 120, 34, { color: done ? GREEN : '#dfe7f5', size: 12, weight: 'bold' });
  line(c, 0, 62, CONTENT_W, 62, 'rgba(255,255,255,0.08)');

  const steps = revealLines(scene.lines, span(p, 0.04, 0.7));
  steps.forEach((text, i) => {
    const y = AGENT_STEP_Y + i * AGENT_STEP_H;
    if (i === 0) {
      fillRound(c, 20, y - 18, 420, 28, 8, theme.card);
      avatar(c, 36, y - 4, 9, '#9fe6d2', 'D');
      write(c, text, 54, y, { color: '#e6edf7', size: 13, mono: true });
      return;
    }
    drawIcon(c, scene.app, 26, y - 16, 20);
    const isLast = i === steps.length - 1 && p < 0.7;
    write(c, text, 54, y, { color: text.startsWith('Causa') ? accent : '#cdd8e8', size: 13, mono: true, weight: text.startsWith('Causa') ? 'bold' : 'normal' });
    if (isLast) spinner(c, 54 + textWidth(c, text, { size: 13, mono: true }) + 16, y - 4, timeMs, 6, accent, 2);
  });

  const patch = span(p, 0.7, 0.8);
  if (patch > 0) {
    c.save();
    c.globalAlpha = patch;
    fillRound(c, 54, 200, 520, 52, 8, theme.card);
    write(c, 'src/session.ts', 66, 218, { color: MUTED, size: 11 });
    write(c, '- return refreshSession(token);', 66, 233, { color: RED, size: 12, mono: true });
    write(c, '+ if (isExpired(token)) return signIn();', 66, 247, { color: GREEN, size: 12, mono: true });
    c.restore();
  }
  fillRound(c, 20, 268, CONTENT_W - 40, 32, 10, theme.card);
  strokeRound(c, 20, 268, CONTENT_W - 40, 32, 10, 'rgba(255,255,255,0.12)', 1);
  write(c, '›', 34, 289, { color: accent, size: 18, weight: 'bold' });
  if (blinkOn(timeMs, 450)) fillRound(c, 50, 277, 2, 14, 0, '#d9f3ff');
  progressBar(c, CONTENT_W - 190, 281, 100, 6, clamp01(p * 1.1), accent);
  write(c, `${(p * 12.4).toFixed(1)}k tokens`, CONTENT_W - 30, 289, { color: MUTED, size: 11, align: 'right' });
};
