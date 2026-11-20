import { postLabs, sceneSite, type AppName, type SiteName } from '../apps.ts';
import {
  clamp01, easeOut, ellipsize, fillDisc, fillRound, inRect, line, lerp, pulse, span, spinner, strokeRound, typed, unitHash, wrapText, write,
  type Ctx,
} from '../canvas.ts';
import { drawIcon } from '../icons.ts';
import type { Scene } from '../scenarios.ts';
import { CONTENT_H, CONTENT_W, type SceneFrame, type SceneRenderer } from './frame.ts';
import { GREEN, MUTED, RED, avatar, button, chip, statusMark, type StepState } from './widgets.ts';

type BrowserScene = Extract<Scene, { kind: 'browser' }>;

interface BrowserTheme {
  readonly strip: string;
  readonly bar: string;
  readonly pill: string;
}

const BROWSER_THEMES: Readonly<Record<BrowserScene['app'], BrowserTheme>> = {
  Chrome: { strip: '#202124', bar: '#35363a', pill: '#202124' },
  Firefox: { strip: '#1c1b22', bar: '#2b2a33', pill: '#1c1b22' },
  Edge: { strip: '#1f1f1f', bar: '#2b2b2b', pill: '#1a1a1a' },
  Safari: { strip: '#2a2a2d', bar: '#38383c', pill: '#1f1f22' },
};

const STRIP_H = 32;
const TOOLBAR_H = 34;
const PAGE_Y = STRIP_H + TOOLBAR_H;
const PAGE_W = CONTENT_W;
const PAGE_H = CONTENT_H - PAGE_Y;

interface SiteTheme {
  readonly bg: string;
  readonly card: string;
  readonly accent: string;
  readonly border: string;
  readonly host: string;
  readonly matrix?: true;
}

const SITE_THEMES: Readonly<Partial<Record<SiteName, SiteTheme>>> = {
  'Eitri Console': { bg: '#0b0f08', card: '#151b0e', accent: '#a6ff00', border: '#2c3a14', host: 'console.eitri.tech' },
  'Eitri Matrix': { bg: '#050a06', card: '#0b140c', accent: '#a6ff00', border: '#1e3a1c', host: 'matrix.eitri.tech', matrix: true },
  Datadog: { bg: '#171123', card: '#281b37', accent: '#b78ae8', border: '#4f3866', host: 'app.datadoghq.com' },
  Firebase: { bg: '#151820', card: '#252933', accent: '#ff9100', border: '#404553', host: 'console.firebase.google.com' },
  'Google Cloud': { bg: '#14171b', card: '#23272e', accent: '#8ab4f8', border: '#414751', host: 'console.cloud.google.com' },
  AWS: { bg: '#131a24', card: '#232f3e', accent: '#ff9900', border: '#3f5268', host: 'console.aws.amazon.com' },
  Calindra: { bg: '#0d0f0d', card: '#171a16', accent: '#b6ff1a', border: '#2f3a22', host: 'calindra.tech' },
  GitHub: { bg: '#0d1117', card: '#161b22', accent: '#2ea043', border: '#30363d', host: 'github.com' },
  Bitbucket: { bg: '#1d2125', card: '#22272b', accent: '#2684ff', border: '#3b444c', host: 'bitbucket.org' },
};

const FALLBACK_THEME: SiteTheme = { bg: '#101624', card: '#1a2236', accent: '#6ee7cf', border: '#2c3850', host: '' };

function siteTheme(site: SiteName | undefined): SiteTheme {
  return (site && SITE_THEMES[site]) || FALLBACK_THEME;
}

function drawBrowserChrome(c: Ctx, scene: BrowserScene, site: SiteName | undefined): void {
  const theme = BROWSER_THEMES[scene.app];
  const favicon: AppName = site ?? scene.app;
  c.fillStyle = theme.strip;
  c.fillRect(0, 0, CONTENT_W, STRIP_H);
  fillRound(c, 8, 5, 190, STRIP_H - 5, 8, theme.bar);
  drawIcon(c, favicon, 18, 10, 16);
  write(c, site ?? scene.app, 42, 22, { color: '#f1f4fa', size: 12 });
  write(c, '×', 184, 22, { color: MUTED, size: 14, align: 'center' });
  drawIcon(c, scene.app, 212, 10, 16);
  write(c, 'Nova guia', 234, 22, { color: MUTED, size: 12 });
  c.fillStyle = theme.bar;
  c.fillRect(0, STRIP_H, CONTENT_W, TOOLBAR_H);
  c.strokeStyle = '#c9d2e0';
  c.lineWidth = 1.8;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(26, STRIP_H + 17);
  c.lineTo(16, STRIP_H + 17);
  c.moveTo(20, STRIP_H + 12);
  c.lineTo(15, STRIP_H + 17);
  c.lineTo(20, STRIP_H + 22);
  c.moveTo(42, STRIP_H + 17);
  c.lineTo(52, STRIP_H + 17);
  c.moveTo(48, STRIP_H + 12);
  c.lineTo(53, STRIP_H + 17);
  c.lineTo(48, STRIP_H + 22);
  c.stroke();
  c.beginPath();
  c.arc(76, STRIP_H + 17, 6, 0.5, Math.PI * 2 - 0.9);
  c.stroke();
  c.lineCap = 'butt';
  fillRound(c, 96, STRIP_H + 5, CONTENT_W - 150, 24, 12, theme.pill);
  fillRound(c, 108, STRIP_H + 15, 8, 7, 1.5, GREEN);
  strokeRound(c, 109.5, STRIP_H + 10, 5, 6, 2.5, GREEN, 1.4);
  write(c, ellipsize(c, scene.url, CONTENT_W - 200, { size: 12 }), 126, STRIP_H + 21, { color: '#e3e9f4', size: 12 });
  avatar(c, CONTENT_W - 28, STRIP_H + 17, 10, '#9fe6d2', 'D');
}

function drawMatrixRain(c: Ctx, theme: SiteTheme, timeMs: number): void {
  for (let column = 0; column < 40; column++) {
    const speed = 0.04 + unitHash(column) * 0.06;
    const head = ((timeMs * speed + unitHash(column + 99) * 400) % (PAGE_H + 160)) - 80;
    for (let row = 0; row < 9; row++) {
      const y = head - row * 12;
      c.save();
      c.globalAlpha = (1 - row / 9) * 0.45;
      write(c, unitHash(column * 31 + row + Math.floor(timeMs / 600)) > 0.5 ? '1' : '0', column * 16 + 6, y, { color: theme.accent, size: 11, mono: true });
      c.restore();
    }
  }
}

type PageRenderer = (c: Ctx, scene: BrowserScene, frame: SceneFrame, site: SiteName | undefined) => void;

const FIELD_W = 264;

function drawField(c: Ctx, theme: SiteTheme, x: number, y: number, label: string, value: string, focused: boolean, caret: boolean): void {
  write(c, label, x, y - 5, { color: MUTED, size: 10.5 });
  fillRound(c, x, y, FIELD_W, 28, 6, '#0a0d10');
  strokeRound(c, x, y, FIELD_W, 28, 6, focused ? theme.accent : theme.border, focused ? 1.6 : 1);
  write(c, value, x + 10, y + 19, { color: '#f1f6ff', size: 13, mono: true });
  if (focused && caret) fillRound(c, x + 12 + value.length * 7.8, y + 7, 1.6, 15, 0, theme.accent);
}

const drawLogin: PageRenderer = (c, scene, { p, timeMs }, site) => {
  const theme = siteTheme(site);
  c.fillStyle = theme.bg;
  c.fillRect(0, 0, PAGE_W, PAGE_H);
  if (theme.matrix) drawMatrixRain(c, theme, timeMs);
  const [title = '', email = '', secret = '', action = ''] = scene.lines;
  const cardX = (PAGE_W - 300) / 2;
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.6)';
  c.shadowBlur = 24;
  fillRound(c, cardX, 6, 300, 236, 14, theme.card);
  c.restore();
  strokeRound(c, cardX, 6, 300, 236, 14, theme.border, 1);
  if (site) drawIcon(c, site, PAGE_W / 2 - 24, 14, 48);
  write(c, title, PAGE_W / 2, 82, { color: '#ffffff', size: 16, weight: 'bold', align: 'center' });
  write(c, theme.host, PAGE_W / 2, 97, { color: MUTED, size: 11, align: 'center' });
  const fieldX = cardX + 18;
  const emailTyped = typed(email, span(p, 0.05, 0.38));
  const secretTyped = typed(secret, span(p, 0.4, 0.64));
  drawField(c, theme, fieldX, 118, 'E-mail', emailTyped, p < 0.4, true);
  drawField(c, theme, fieldX, 164, 'Senha', secretTyped, p >= 0.4 && p < 0.68, true);
  const submitting = p >= 0.7;
  const success = p >= 0.92;
  fillRound(c, fieldX, 204, FIELD_W, 28, 6, success ? GREEN : theme.accent);
  if (submitting && !success) {
    fillRound(c, fieldX, 230, FIELD_W * span(p, 0.7, 0.92), 3, 1.5, '#ffffff');
    spinner(c, fieldX + 24, 218, timeMs, 7, '#0b1208', 2.4);
  }
  const label = success ? 'Autenticado' : submitting ? 'Entrando…' : action;
  write(c, label, fieldX + FIELD_W / 2 + (submitting && !success ? 12 : 0), 223, { color: '#0b1208', size: 13, weight: 'bold', align: 'center' });
};

const drawDashboard: PageRenderer = (c, scene, { p, timeMs }, site) => {
  const theme = siteTheme(site);
  c.fillStyle = theme.bg;
  c.fillRect(0, 0, PAGE_W, PAGE_H);
  c.fillStyle = theme.card;
  c.fillRect(0, 0, 130, PAGE_H);
  if (site) drawIcon(c, site, 12, 10, 22);
  const heading = site === 'Eitri Console' ? 'Eitri' : site ?? scene.app;
  write(c, heading, 40, 26, { color: '#ffffff', size: 12, weight: 'bold' });
  ['Serviços', 'Sessões', 'Eventos', 'Equipe'].forEach((item, i) => {
    if (i === 1) fillRound(c, 8, 50 + i * 30, 114, 26, 6, `${theme.accent}24`);
    write(c, item, 20, 68 + i * 30, { color: i === 1 ? theme.accent : '#b8c3d4', size: 12.5 });
  });
  const [title = '', alert = '', queue = ''] = scene.lines;
  write(c, title, 150, 28, { color: '#ffffff', size: 17, weight: 'bold' });
  const healed = p > 0.6;
  [[alert, healed ? GREEN : RED], [queue, GREEN]].forEach(([label, color], i) => {
    const x = 150 + i * 240;
    fillRound(c, x, 44, 226, 64, 10, theme.card);
    strokeRound(c, x, 44, 226, 64, 10, color ?? theme.border, 1.4);
    fillDisc(c, x + 18, 64, 5 + (color === RED ? pulse(timeMs, 600) * 2 : 0), color ?? GREEN);
    write(c, ellipsize(c, label ?? '', 190, { size: 12.5 }), x + 32, 68, { color: '#e4ebf7', size: 12.5, weight: 'bold' });
    write(c, i === 0 ? (healed ? 'resolvido pelo patch' : 'investigando…') : 'sem atrasos', x + 18, 92, { color: MUTED, size: 11.5 });
  });
  for (let i = 0; i < 18; i++) {
    const height = 18 + (Math.sin(i * 0.8 + timeMs / 500) + 1) * 26 * (healed && i > 10 ? 0.45 : 1) * easeOut(span(p, 0, 0.3));
    fillRound(c, 150 + i * 26, 220 - height, 16, height, 3, i > 10 && !healed ? RED : theme.accent);
  }
  write(c, 'requisições por minuto', 150, 134, { color: MUTED, size: 11 });
};

const SECURITY_PATTERN = /token|CVE|vazou|supply chain/i;

function postCounter(handle: string, salt: number, p: number): number {
  return Math.floor((30 + unitHash(handle + salt) * 900) * (0.35 + 0.65 * easeOut(p)));
}

const POST_ROW_H = 76;
const FEED_TOP = 42;

function drawPost(c: Ctx, raw: string, y: number, p: number): void {
  const [handle = '', ...rest] = raw.split(' · ');
  const body = rest.join(' · ');
  const lab = postLabs(body)[0];
  if (lab) drawIcon(c, lab, 14, y + 10, 34);
  else avatar(c, 31, y + 27, 17, `hsl(${Math.floor(unitHash(handle) * 360)} 70% 68%)`, handle.charAt(1).toUpperCase());
  write(c, handle, 60, y + 22, { color: '#ffffff', size: 13, weight: 'bold' });
  write(c, '· agora', 60 + handle.length * 7.6 + 10, y + 22, { color: MUTED, size: 12 });
  wrapText(c, body, 540, { size: 13 }).slice(0, 2).forEach((row, i) => write(c, row, 60, y + 41 + i * 16, { color: '#e7e9ea', size: 13 }));
  const security = SECURITY_PATTERN.test(body);
  if (security) chip(c, CONTENT_W - 94, y + 8, 'Segurança', 'rgba(255,93,115,0.2)', RED, 10.5);
  else if (lab) chip(c, CONTENT_W - 62, y + 8, 'IA', 'rgba(142,156,255,0.22)', '#aab4ff', 10.5);
  const counters: readonly [string, number][] = [['↩', postCounter(handle, 1, p) / 6], ['⟲', postCounter(handle, 2, p) / 2], ['♥', postCounter(handle, 3, p)]];
  counters.forEach(([glyph, count], i) => write(c, `${glyph} ${Math.floor(count)}`, 60 + i * 84, y + 70, { color: MUTED, size: 11 }));
  line(c, 0, y + POST_ROW_H - 1, CONTENT_W, y + POST_ROW_H - 1, 'rgba(255,255,255,0.1)');
}

const drawFeed: PageRenderer = (c, scene, { p }) => {
  c.fillStyle = '#000000';
  c.fillRect(0, 0, PAGE_W, PAGE_H);
  const posts = scene.lines;
  const scroll = easeOut(span(p, 0, 1)) * Math.max(0, posts.length * POST_ROW_H - (PAGE_H - FEED_TOP));
  inRect(c, { x: 0, y: FEED_TOP, w: PAGE_W, h: PAGE_H - FEED_TOP }, () => {
    posts.forEach((raw, i) => drawPost(c, raw, i * POST_ROW_H - scroll, p));
  });
  c.fillStyle = 'rgba(0,0,0,0.92)';
  c.fillRect(0, 0, PAGE_W, FEED_TOP);
  drawIcon(c, 'X', 14, 8, 26);
  write(c, 'Para você', PAGE_W / 2 - 50, 28, { color: '#ffffff', size: 14, weight: 'bold' });
  write(c, 'Seguindo', PAGE_W / 2 + 60, 28, { color: MUTED, size: 14 });
  fillRound(c, PAGE_W / 2 - 54, FEED_TOP - 4, 70, 3, 1.5, '#1d9bf0');
  line(c, 0, FEED_TOP, PAGE_W, FEED_TOP, 'rgba(255,255,255,0.12)');
};

function checkState(index: number, p: number): StepState {
  if (p < 0.12 + index * 0.1) return 'pending';
  return p < 0.3 + index * 0.14 ? 'running' : 'done';
}

const drawPullRequest: PageRenderer = (c, scene, { p, timeMs }, site) => {
  const theme = siteTheme(site);
  const pipeline: AppName = site === 'Bitbucket' ? 'Bitbucket Pipelines' : 'GitHub Actions';
  c.fillStyle = theme.bg;
  c.fillRect(0, 0, PAGE_W, PAGE_H);
  const [title = '', added = '', review = ''] = scene.lines;
  if (site) drawIcon(c, site, 16, 10, 24);
  write(c, title, 50, 28, { color: '#ffffff', size: 16, weight: 'bold' });
  const merged = p > 0.88;
  chip(c, 50, 38, merged ? (site === 'Bitbucket' ? 'Aprovado' : 'Merged') : 'Aberto', merged ? '#8957e5' : theme.accent, '#ffffff', 11);
  fillRound(c, 16, 74, 410, 120, 8, theme.card);
  strokeRound(c, 16, 74, 410, 120, 8, theme.border, 1);
  write(c, 'src/session.ts', 28, 94, { color: MUTED, size: 11.5, mono: true });
  fillRound(c, 17, 102, 408, 22, 0, 'rgba(255,93,115,0.14)');
  write(c, '- return refreshSession(token);', 28, 117, { color: RED, size: 12, mono: true });
  fillRound(c, 17, 124, 408, 22, 0, 'rgba(61,220,151,0.14)');
  write(c, typed(added.startsWith('+') ? added : `+ ${added}`, span(p, 0.1, 0.4)), 28, 139, { color: GREEN, size: 12, mono: true });
  fillRound(c, 17, 146, 408, 22, 0, 'rgba(61,220,151,0.14)');
  write(c, typed('+ if (isExpired(token)) return signIn();', span(p, 0.3, 0.6)), 28, 161, { color: GREEN, size: 12, mono: true });
  avatar(c, 30, 214, 10, '#ffc857', 'B');
  write(c, typed(review, span(p, 0.55, 0.85)), 48, 218, { color: '#d5deec', size: 12.5 });
  fillRound(c, 444, 74, 180, 120, 8, theme.card);
  strokeRound(c, 444, 74, 180, 120, 8, theme.border, 1);
  drawIcon(c, pipeline, 454, 82, 18);
  write(c, 'Verificações', 478, 96, { color: '#ffffff', size: 12.5, weight: 'bold' });
  ['typecheck', 'regression tests', 'deploy preview'].forEach((name, i) => {
    statusMark(c, 462, 124 + i * 24, checkState(i, p), timeMs, 7);
    write(c, name, 478, 128 + i * 24, { color: '#cdd8e8', size: 12 });
  });
  button(c, 444, 204, 180, 30, merged ? 'Merged' : site === 'Bitbucket' ? 'Aprovar' : 'Merge pull request', merged ? '#8957e5' : theme.accent);
};

const drawDocs: PageRenderer = (c, scene, { p, timeMs }, site) => {
  c.fillStyle = '#1b1c1f';
  c.fillRect(0, 0, PAGE_W, PAGE_H);
  const [header = '', title = '', action = ''] = scene.lines;
  if (site) drawIcon(c, site, 14, 8, 24);
  write(c, header, 46, 27, { color: '#ffffff', size: 14, weight: 'bold' });
  button(c, PAGE_W - 106, 10, 90, 26, 'Compartilhar', '#4285f4', '#ffffff', 12);
  fillRound(c, 150, 48, 340, 190, 3, '#f7f8fa');
  write(c, typed(title, span(p, 0.1, 0.45)), 172, 82, { color: '#1c2430', size: 17, weight: 'bold' });
  write(c, typed(action, span(p, 0.45, 0.85)), 172, 112, { color: '#3a4658', size: 13 });
  for (let i = 0; i < 5; i++) fillRound(c, 172, 134 + i * 16, 296 - ((i * 53) % 90), 6, 3, '#d5dae3');
  fillRound(c, 172 + 8 * typed(title, span(p, 0.1, 0.45)).length * 0.95, 66, 2, 20, 0, '#34a853');
  chip(c, 330, 36, 'Bia', '#ea4335', '#ffffff', 10);
  for (let i = 0; i < 3; i++) {
    const x = 520 + i * 36;
    fillRound(c, x, 56, 32, 24, 5, '#2b2d33');
    avatar(c, x + 16, 68 - 2 + pulse(timeMs + i * 300, 1500) * 2, 7, ['#8ab4f8', '#fbbc04', '#81c995'][i] ?? '#fff', ['B', 'D', 'M'][i] ?? 'X');
  }
  write(c, 'Meet', 520, 100, { color: MUTED, size: 11 });
};

const drawCalendar: PageRenderer = (c, scene, { p }, site) => {
  c.fillStyle = '#16181c';
  c.fillRect(0, 0, PAGE_W, PAGE_H);
  const [, first = '', second = ''] = scene.lines;
  if (site) drawIcon(c, site, 14, 8, 24);
  write(c, 'sexta, 12 de novembro', 46, 27, { color: '#ffffff', size: 14, weight: 'bold' });
  ['seg', 'ter', 'qua', 'qui', 'sex'].forEach((day, i) => {
    const x = 70 + i * 112;
    write(c, day, x + 56, 56, { color: i === 4 ? '#8ab4f8' : MUTED, size: 11.5, align: 'center' });
    line(c, x, 62, x, PAGE_H, 'rgba(255,255,255,0.08)');
  });
  for (let hour = 0; hour < 5; hour++) {
    const y = 68 + hour * 36;
    write(c, `${9 + hour}:00`, 8, y + 4, { color: MUTED, size: 10.5 });
    line(c, 60, y, PAGE_W, y, 'rgba(255,255,255,0.08)');
  }
  const reveal = easeOut(span(p, 0.1, 0.5));
  fillRound(c, 74 + 4 * 112, 68, 104, 66 * reveal, 6, '#3367d6');
  write(c, ellipsize(c, first, 94, { size: 11 }), 80 + 4 * 112, 84, { color: '#ffffff', size: 11, weight: 'bold' });
  fillRound(c, 74 + 4 * 112, 104, 52, 40 * reveal, 6, '#188038');
  write(c, ellipsize(c, second, 46, { size: 10.5 }), 78 + 4 * 112, 118, { color: '#ffffff', size: 10.5 });
  const nowY = lerp(70, 200, clamp01(p));
  line(c, 60, nowY, PAGE_W, nowY, RED, 1.6);
  fillDisc(c, 60, nowY, 4, RED);
};

const PAGES: Readonly<Record<BrowserScene['page'], PageRenderer>> = {
  login: drawLogin,
  dashboard: drawDashboard,
  pr: drawPullRequest,
  feed: drawFeed,
  docs: drawDocs,
  calendar: drawCalendar,
};

export const drawBrowser: SceneRenderer<'browser'> = (c, scene, frame) => {
  const site = sceneSite(scene);
  drawBrowserChrome(c, scene, site);
  c.save();
  c.translate(0, PAGE_Y);
  c.beginPath();
  c.rect(0, 0, PAGE_W, PAGE_H);
  c.clip();
  PAGES[scene.page](c, scene, frame, site);
  c.restore();
};
