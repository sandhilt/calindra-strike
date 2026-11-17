import type { AppName } from '../apps.ts';
import { blinkOn, fillPolygon, fillRound, lerp, span, strokeRound, textWidth, write, type Ctx } from '../canvas.ts';
import { drawIcon } from '../icons.ts';
import type { Scene } from '../scenarios.ts';
import { CONTENT_H, CONTENT_W, type SceneRenderer } from './frame.ts';
import { GREEN, MUTED, RED, statusMark, type StepState } from './widgets.ts';

type TerminalScene = Extract<Scene, { kind: 'terminal' }>;

interface TerminalTheme {
  readonly bg: string;
  readonly tabBar: string;
  readonly prompt: string;
  readonly tabs: readonly { icon: AppName; label: string }[];
  readonly tabStyle: 'flat' | 'pill';
  /** Index of the active tab, which may change while the commands run. */
  readonly activeTab: (p: number) => number;
}

const TERMINAL_THEMES: Readonly<Record<TerminalScene['app'], TerminalTheme>> = {
  iTerm2: {
    bg: '#0d1117',
    tabBar: '#1c2128',
    prompt: '#3be37a',
    tabs: [{ icon: 'iTerm2', label: 'zsh' }, { icon: 'Node.js', label: 'node --test' }],
    tabStyle: 'flat',
    activeTab: () => 1,
  },
  WezTerm: {
    bg: '#1a1b26',
    tabBar: '#11111a',
    prompt: '#bb9af7',
    tabs: [{ icon: 'WezTerm', label: '1: zsh' }, { icon: 'Node.js', label: '2: node' }],
    tabStyle: 'pill',
    activeTab: () => 1,
  },
  'Windows Terminal': {
    bg: '#0c0c0c',
    tabBar: '#1c1c1c',
    prompt: '#6aa7ff',
    tabs: [{ icon: 'PowerShell', label: 'PowerShell' }, { icon: 'Ubuntu', label: 'Ubuntu 24.04' }],
    tabStyle: 'flat',
    activeTab: (p) => (p < 0.09 ? 0 : 1),
  },
};

const TESTS = ['parses token', 'expired session', 'logs out user', 'keeps cookie'] as const;
const FAILING_TEST = 1;
/** Content progress where the failing test turns green; the finale montage builds on it. */
const TEST_FIX_PROGRESS = 0.3;
const TAB_BAR_H = 32;
const HEADER_LINES_END = 0.18;
const HEADER_TOP = 54;
const HEADER_STEP = 20;
const ROW_STEP = 18;
const SUMMARY_H = 36;
const CODE_SIZE = 13;
const PROMPT_PATTERN = /^(\$|PS [^>]*>|[\w.-]+@[\w.-]+:[^$]*\$) /;

function testState(index: number, p: number): StepState {
  const startsAt = 0.14 + index * 0.025;
  const endsAt = 0.2 + index * 0.03;
  if (p < startsAt) return 'pending';
  if (p < endsAt) return 'running';
  if (index === FAILING_TEST && p < TEST_FIX_PROGRESS) return 'failed';
  return 'done';
}

function drawTabs(c: Ctx, theme: TerminalTheme, p: number): void {
  c.fillStyle = theme.tabBar;
  c.fillRect(0, 0, CONTENT_W, TAB_BAR_H);
  const active = theme.activeTab(p);
  theme.tabs.forEach((tab, i) => {
    const x = 10 + i * 150;
    const pill = theme.tabStyle === 'pill';
    if (i === active) fillRound(c, x, pill ? 5 : 4, 142, pill ? 22 : TAB_BAR_H - 4, pill ? 11 : 6, theme.bg);
    if (i === active && pill) strokeRound(c, x, 5, 142, 22, 11, theme.prompt, 1.2);
    drawIcon(c, tab.icon, x + 10, 8, 16);
    write(c, tab.label, x + 32, 20, { color: i === active ? '#ffffff' : MUTED, size: 12 });
  });
  const tail = 10 + theme.tabs.length * 150;
  write(c, '+', tail + 4, 21, { color: MUTED, size: 17 });
  fillPolygon(c, [[tail + 26, 17], [tail + 34, 17], [tail + 30, 22]], MUTED);
}

function headerBottom(scene: TerminalScene): number {
  return HEADER_TOP + (scene.lines.length - 1) * HEADER_STEP;
}

function drawHeaderLines(c: Ctx, scene: TerminalScene, theme: TerminalTheme, p: number, timeMs: number): void {
  const style = { size: CODE_SIZE, mono: true } as const;
  let budget = Math.floor(span(p, 0, HEADER_LINES_END) * scene.lines.join('').length);
  scene.lines.forEach((text, i) => {
    if (budget <= 0) return;
    const y = HEADER_TOP + i * HEADER_STEP;
    const part = text.slice(0, budget);
    budget -= text.length;
    const promptLength = PROMPT_PATTERN.exec(text)?.[0].length ?? 0;
    let endX = 38;
    if (promptLength > 0) {
      const promptPart = part.slice(0, promptLength);
      write(c, promptPart, 38, y, { ...style, color: theme.prompt, weight: 'bold' });
      endX = 38 + textWidth(c, promptPart, style);
      write(c, part.slice(promptLength), endX, y, { ...style, color: '#e6edf7' });
      endX += textWidth(c, part.slice(promptLength), style);
    } else {
      const isNode = text.includes('Node.js');
      write(c, part, 38, y, { ...style, color: isNode ? GREEN : '#c8d3e3' });
      endX += textWidth(c, part, style);
      if (isNode) drawIcon(c, 'Node.js', 12, y - 14, 18);
    }
    if (budget <= 0 && blinkOn(timeMs, 420) && p < HEADER_LINES_END + 0.02) fillRound(c, endX + 3, y - 12, 7, 15, 0, '#d9f3ff');
  });
}

function drawRunner(c: Ctx, scene: TerminalScene, p: number, timeMs: number): void {
  if (p < 0.12) return;
  const headerY = headerBottom(scene) + 28;
  drawIcon(c, 'Node.js', 12, headerY - 14, 18);
  write(c, 'node:test', 38, headerY, { color: '#ffffff', size: 13, mono: true, weight: 'bold' });
  write(c, 'session.test.ts', 118, headerY, { color: MUTED, size: 12, mono: true });
  TESTS.forEach((name, i) => {
    const state = testState(i, p);
    const y = headerY + 8 + i * ROW_STEP;
    if (i === FAILING_TEST && p >= TEST_FIX_PROGRESS) {
      c.save();
      c.globalAlpha = 0.25 * (1 - span(p, TEST_FIX_PROGRESS, TEST_FIX_PROGRESS + 0.12));
      fillRound(c, 8, y - 2, CONTENT_W - 16, ROW_STEP, 4, GREEN);
      c.restore();
    }
    statusMark(c, 22, y + 7, state, timeMs, 6.5);
    const color = state === 'failed' ? RED : state === 'pending' ? MUTED : '#dbe7f5';
    write(c, name, 38, y + 11, { color, size: 12.5, mono: true });
    if (i === FAILING_TEST && state === 'done') write(c, 'corrigido', 220, y + 11, { color: GREEN, size: 11, mono: true });
  });
}

function drawSummary(c: Ctx, scene: TerminalScene, p: number, timeMs: number): void {
  const passing = p >= TEST_FIX_PROGRESS;
  const color = passing ? GREEN : RED;
  const y = CONTENT_H - SUMMARY_H - 10;
  fillRound(c, 10, y, CONTENT_W - 20, SUMMARY_H, 8, passing ? 'rgba(61,220,151,0.14)' : 'rgba(255,93,115,0.14)');
  strokeRound(c, 10, y, CONTENT_W - 20, SUMMARY_H, 8, color, 1.4);
  write(c, passing ? scene.tests.passing : scene.tests.failing, 24, y + 23, { color, size: 15, weight: 'bold', mono: true });
  const counted = passing ? 24 : Math.round(lerp(0, 23, span(p, 0.2, 0.3)));
  write(c, `${counted}/24`, CONTENT_W - 24, y + 23, { color, size: 15, weight: 'bold', mono: true, align: 'right' });
  if (!passing && p > 0.2) statusMark(c, CONTENT_W - 82, y + 18, 'running', timeMs, 8);
}

export const drawTerminal: SceneRenderer<'terminal'> = (c, scene, { p, timeMs }) => {
  const theme = TERMINAL_THEMES[scene.app];
  c.fillStyle = theme.bg;
  c.fillRect(0, 0, CONTENT_W, CONTENT_H);
  if (scene.app === 'Windows Terminal') {
    const acrylic = c.createLinearGradient(0, 0, CONTENT_W, CONTENT_H);
    acrylic.addColorStop(0, 'rgba(40,80,160,0.35)');
    acrylic.addColorStop(1, 'rgba(10,10,20,0.0)');
    c.fillStyle = acrylic;
    c.fillRect(0, TAB_BAR_H, CONTENT_W, CONTENT_H - TAB_BAR_H);
  }
  drawTabs(c, theme, p);
  drawHeaderLines(c, scene, theme, p, timeMs);
  drawRunner(c, scene, p, timeMs);
  if (p >= 0.2) drawSummary(c, scene, p, timeMs);
};
