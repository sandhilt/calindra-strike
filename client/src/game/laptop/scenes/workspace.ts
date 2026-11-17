import { APP_ACCENT } from '../apps.ts';
import { clamp01, easeOut, ellipsize, fillDisc, fillPolygon, fillRound, line, pulse, revealLines, span, spinner, strokeRound, unitHash, write, type Ctx } from '../canvas.ts';
import { drawIcon } from '../icons.ts';
import { CONTENT_H, CONTENT_W, type SceneRenderer } from './frame.ts';
import { GREEN, MUTED, avatar, button, chip, statusMark, type StepState } from './widgets.ts';

const BOARD_COLUMNS = ['A fazer', 'Em andamento', 'Concluído'] as const;
const COLUMN_W = 196;
const COLUMN_GAP = 8;
const BOARD_LEFT = 16;
const CARD_Y = 112;

function drawCard(c: Ctx, x: number, y: number, title: string, meta: string, accent: string, lift = 0): void {
  c.save();
  if (lift > 0) {
    c.shadowColor = 'rgba(0,0,0,0.6)';
    c.shadowBlur = 16 * lift;
    c.shadowOffsetY = 8 * lift;
  }
  fillRound(c, x, y - lift * 6, COLUMN_W - 16, 66, 6, lift > 0 ? '#3b4c6b' : '#2b323a');
  c.restore();
  fillRound(c, x, y - lift * 6, 4, 66, 2, accent);
  write(c, ellipsize(c, title, COLUMN_W - 44, { size: 12.5 }), x + 12, y - lift * 6 + 22, { color: '#ffffff', size: 12.5, weight: 'bold' });
  write(c, ellipsize(c, meta, COLUMN_W - 60, { size: 11 }), x + 12, y - lift * 6 + 42, { color: '#b6c2d4', size: 11 });
  avatar(c, x + COLUMN_W - 36, y - lift * 6 + 50, 8, '#9fe6d2', 'D');
}

export const drawBoard: SceneRenderer<'board'> = (c, scene, { p, timeMs }) => {
  c.fillStyle = '#161a1d';
  c.fillRect(0, 0, CONTENT_W, CONTENT_H);
  drawIcon(c, 'Jira', 16, 10, 26);
  write(c, 'Jira', 50, 29, { color: '#ffffff', size: 16, weight: 'bold' });
  write(c, 'Projetos / DEV / Quadro', 104, 29, { color: MUTED, size: 12 });
  const [heading = '', meta = ''] = scene.lines;
  const [ticket = '', summary = ''] = heading.split(' · ');
  write(c, ticket, 16, 66, { color: '#6ea6ff', size: 14, weight: 'bold' });
  write(c, summary, 16 + ticket.length * 9 + 14, 66, { color: '#ffffff', size: 14, weight: 'bold' });
  BOARD_COLUMNS.forEach((label, i) => {
    const x = BOARD_LEFT + i * (COLUMN_W + COLUMN_GAP);
    fillRound(c, x, 80, COLUMN_W, CONTENT_H - 90, 8, '#1f252b');
    write(c, label.toUpperCase(), x + 12, 100, { color: MUTED, size: 11, weight: 'bold' });
  });
  drawCard(c, BOARD_LEFT + 8, CARD_Y + 78, 'Revisar logs', 'DEV-398 · alta', '#ffc857');
  drawCard(c, BOARD_LEFT + 2 * (COLUMN_W + COLUMN_GAP) + 8, CARD_Y + 78, 'Atualizar docs', 'DEV-391 · baixa', GREEN);
  const travel = easeOut(span(p, 0.15, 0.8)) * 2;
  const x = BOARD_LEFT + 8 + travel * (COLUMN_W + COLUMN_GAP);
  const moving = p > 0.15 && p < 0.8;
  drawCard(c, x, CARD_Y, summary.length > 0 ? summary : 'Corrigir sessão', meta || ticket, moving ? '#6ea6ff' : GREEN, moving ? 1 : 0);
  if (p >= 0.8) statusMark(c, x + COLUMN_W - 40, CARD_Y + 14, 'done', timeMs, 7);
};

function splitSpeaker(line: string): { name: string; text: string } {
  const [name = '', ...rest] = line.split(': ');
  return rest.length === 0 ? { name: '', text: line } : { name, text: rest.join(': ') };
}

const SLACK_SIDEBAR_W = 150;

export const drawChat: SceneRenderer<'chat'> = (c, scene, { p, timeMs }) => {
  c.fillStyle = '#1a1d21';
  c.fillRect(0, 0, CONTENT_W, CONTENT_H);
  c.fillStyle = '#3f0e40';
  c.fillRect(0, 0, SLACK_SIDEBAR_W, CONTENT_H);
  drawIcon(c, 'Calindra', 12, 10, 28);
  write(c, 'Calindra', 46, 29, { color: '#ffffff', size: 14, weight: 'bold' });
  const [channel = '# canal', ...messages] = scene.lines;
  ['# geral', channel, '# equipe', '# deploys'].forEach((name, i, all) => {
    const y = 68 + i * 24;
    const active = name === channel && all.indexOf(name) === i;
    if (active) fillRound(c, 6, y - 15, SLACK_SIDEBAR_W - 12, 22, 5, '#1264a3');
    write(c, name, 18, y, { color: active ? '#ffffff' : '#d1b8d3', size: 12.5, weight: active ? 'bold' : 'normal' });
  });
  write(c, 'Mensagens diretas', 14, 178, { color: '#cdb3cf', size: 11 });
  ['Bia', 'Dev'].forEach((name, i) => {
    fillDisc(c, 22, 198 + i * 22, 4, GREEN);
    write(c, name, 34, 202 + i * 22, { color: '#d1b8d3', size: 12.5 });
  });
  write(c, channel, SLACK_SIDEBAR_W + 16, 28, { color: '#ffffff', size: 15, weight: 'bold' });
  line(c, SLACK_SIDEBAR_W, 40, CONTENT_W, 40, 'rgba(255,255,255,0.1)');

  const rows = messages.map(splitSpeaker);
  const bots: readonly { name: string; app: 'GitHub Actions' | 'Jira'; text: string; at: number }[] = [
    { name: 'GitHub Actions', app: 'GitHub Actions', text: 'Build #212 falhou, depois passou · regressão coberta', at: 0.6 },
    { name: 'Jira', app: 'Jira', text: 'DEV-404 movido para Em andamento', at: 0.76 },
  ];
  rows.forEach((row, i) => {
    const appear = easeOut(span(p, 0.05 + i * 0.16, 0.2 + i * 0.16));
    if (appear <= 0) return;
    const y = 52 + i * 54 + (1 - appear) * 14;
    c.save();
    c.globalAlpha = appear;
    avatar(c, SLACK_SIDEBAR_W + 30, y + 18, 15, `hsl(${Math.floor(unitHash(row.name) * 360)} 65% 70%)`, row.name.charAt(0).toUpperCase() || '#');
    write(c, row.name, SLACK_SIDEBAR_W + 54, y + 12, { color: '#ffffff', size: 13, weight: 'bold' });
    write(c, '17:5' + (i + 1), SLACK_SIDEBAR_W + 54 + row.name.length * 8.4 + 10, y + 12, { color: MUTED, size: 10.5 });
    write(c, ellipsize(c, row.text, 420, { size: 13 }), SLACK_SIDEBAR_W + 54, y + 32, { color: '#d9dde3', size: 13 });
    c.restore();
  });
  bots.forEach((bot, i) => {
    const appear = easeOut(span(p, bot.at, bot.at + 0.12));
    if (appear <= 0) return;
    const y = 52 + (rows.length + i) * 54 + (1 - appear) * 14;
    c.save();
    c.globalAlpha = appear;
    drawIcon(c, bot.app, SLACK_SIDEBAR_W + 14, y + 3, 32);
    write(c, bot.name, SLACK_SIDEBAR_W + 54, y + 12, { color: '#ffffff', size: 13, weight: 'bold' });
    chip(c, SLACK_SIDEBAR_W + 54 + bot.name.length * 8.4 + 10, y + 1, 'APP', 'rgba(255,255,255,0.14)', '#d9dde3', 9.5);
    write(c, ellipsize(c, bot.text, 420, { size: 13 }), SLACK_SIDEBAR_W + 54, y + 32, { color: '#d9dde3', size: 13 });
    c.restore();
  });
  fillRound(c, SLACK_SIDEBAR_W + 14, CONTENT_H - 48, CONTENT_W - SLACK_SIDEBAR_W - 28, 34, 8, '#222529');
  strokeRound(c, SLACK_SIDEBAR_W + 14, CONTENT_H - 48, CONTENT_W - SLACK_SIDEBAR_W - 28, 34, 8, 'rgba(255,255,255,0.25)', 1);
  const dots = '.'.repeat(1 + (Math.floor(timeMs / 350) % 3));
  write(c, p < 0.58 ? `Dev está digitando${dots}` : 'Enviar mensagem', SLACK_SIDEBAR_W + 28, CONTENT_H - 26, { color: MUTED, size: 12.5 });
};

function drawEqualizer(c: Ctx, x: number, y: number, timeMs: number, color: string): void {
  for (let i = 0; i < 12; i++) {
    const height = 6 + (Math.sin(timeMs / 170 + i * 0.9) + 1) * 11;
    fillRound(c, x + i * 7, y - height, 4, height, 2, color);
  }
}

function drawSpotify(c: Ctx, lines: readonly string[], p: number, timeMs: number): void {
  const bg = c.createLinearGradient(0, 0, 0, CONTENT_H);
  bg.addColorStop(0, '#1d4a35');
  bg.addColorStop(1, '#101412');
  c.fillStyle = bg;
  c.fillRect(0, 0, CONTENT_W, CONTENT_H);
  drawIcon(c, 'Spotify', 16, 10, 28);
  write(c, 'Spotify', 52, 31, { color: '#ffffff', size: 16, weight: 'bold' });
  const art = c.createLinearGradient(40, 66, 190, 216);
  art.addColorStop(0, '#6a4cff');
  art.addColorStop(1, '#1ed760');
  fillRound(c, 40, 66, 150, 150, 8, art);
  drawIcon(c, 'Spotify', 80, 106, 70);
  const [title = '', subtitle = '', status = ''] = lines;
  write(c, title, 220, 98, { color: '#ffffff', size: 24, weight: 'bold' });
  write(c, subtitle, 220, 124, { color: '#b9c9bf', size: 14 });
  chip(c, 220, 138, status, 'rgba(30,215,96,0.2)', '#1ed760', 11.5);
  drawEqualizer(c, 380, 166, timeMs, '#1ed760');
  fillRound(c, 220, 190, 380, 5, 2.5, 'rgba(255,255,255,0.2)');
  fillRound(c, 220, 190, 380 * (0.15 + p * 0.7), 5, 2.5, '#ffffff');
  write(c, `1:${String(10 + Math.floor(p * 40)).padStart(2, '0')}`, 220, 214, { color: MUTED, size: 11 });
  write(c, '3:12', 600, 214, { color: MUTED, size: 11, align: 'right' });
  fillDisc(c, 410, 246, 16, '#ffffff');
  fillRound(c, 403, 238, 4, 16, 1, '#101412');
  fillRound(c, 412, 238, 4, 16, 1, '#101412');
  fillPolygon(c, [[350, 236], [350, 256], [336, 246]], '#ffffff');
  fillPolygon(c, [[470, 236], [470, 256], [484, 246]], '#ffffff');
}

function drawNetflix(c: Ctx, lines: readonly string[], p: number, timeMs: number): void {
  c.fillStyle = '#0a0a0a';
  c.fillRect(0, 0, CONTENT_W, CONTENT_H);
  const frame = c.createLinearGradient(0, 0, CONTENT_W, CONTENT_H);
  frame.addColorStop(0, '#1b2a4a');
  frame.addColorStop(1, '#3a1d3f');
  fillRound(c, 20, 52, CONTENT_W - 40, CONTENT_H - 72, 6, frame);
  drawIcon(c, 'Netflix', 16, 10, 30);
  const [caption = '', question = '', subtitle = ''] = lines;
  write(c, caption, 56, 31, { color: '#ffffff', size: 14, weight: 'bold' });
  c.fillStyle = 'rgba(0,0,0,0.62)';
  c.fillRect(20, 52, CONTENT_W - 40, CONTENT_H - 72);
  fillRound(c, 150, 92, 340, 130, 10, '#181818');
  strokeRound(c, 150, 92, 340, 130, 10, 'rgba(255,255,255,0.2)', 1);
  write(c, question, CONTENT_W / 2, 132, { color: '#ffffff', size: 17, weight: 'bold', align: 'center' });
  button(c, 176, 160, 170, 36, 'Continuar assistindo', '#e50914', '#ffffff', 12.5);
  button(c, 356, 160, 110, 36, 'Sair', '#3b3b3b', '#ffffff', 12.5);
  const remaining = Math.max(0, 9 - Math.floor(p * 9));
  write(c, `Continua em ${remaining}s`, CONTENT_W / 2, 214, { color: '#9a9a9a', size: 11, align: 'center' });
  fillRound(c, 170, CONTENT_H - 54, 300, 24, 4, 'rgba(0,0,0,0.75)');
  write(c, ellipsize(c, subtitle, 280, { size: 12 }), CONTENT_W / 2, CONTENT_H - 37, { color: '#ffffff', size: 12, align: 'center' });
  const pausePulse = 0.6 + 0.4 * pulse(timeMs, 1200);
  c.save();
  c.globalAlpha = pausePulse;
  fillRound(c, 46, 74, 8, 26, 2, '#ffffff');
  fillRound(c, 60, 74, 8, 26, 2, '#ffffff');
  c.restore();
}

export const drawMedia: SceneRenderer<'media'> = (c, scene, { p, timeMs }) => {
  if (scene.app === 'Spotify') drawSpotify(c, scene.lines, p, timeMs);
  else drawNetflix(c, scene.lines, p, timeMs);
};

const STEP_ROW_H = 44;

function stepState(index: number, count: number, p: number): StepState {
  if (p >= (index + 1) / (count + 1)) return 'done';
  return p >= index / (count + 1) ? 'running' : 'pending';
}

const PIPELINE_LOG = ['$ npm ci', 'added 312 packages', '$ tsc --noEmit', 'no errors', '$ node --test', 'ok 24 passing'] as const;

export const drawPipeline: SceneRenderer<'pipeline'> = (c, scene, { p, timeMs }) => {
  c.fillStyle = '#0f141b';
  c.fillRect(0, 0, CONTENT_W, CONTENT_H);
  drawIcon(c, scene.app, 16, 10, 30);
  write(c, scene.app, 56, 29, { color: '#ffffff', size: 16, weight: 'bold' });
  chip(c, 56 + scene.app.length * 9.6 + 12, 14, 'hotfix/sessao', 'rgba(255,255,255,0.1)', '#cdd8e8', 11);
  const finished = p > 0.9;
  chip(c, CONTENT_W - 112, 14, finished ? 'Sucesso' : 'Executando', finished ? 'rgba(61,220,151,0.2)' : 'rgba(255,200,87,0.2)', finished ? GREEN : '#ffc857', 11.5);
  fillRound(c, 16, 50, CONTENT_W - 32, 4, 2, 'rgba(255,255,255,0.1)');
  fillRound(c, 16, 50, (CONTENT_W - 32) * clamp01(p * 1.05), 4, 2, APP_ACCENT[scene.app]);
  scene.lines.forEach((step, i) => {
    const state = stepState(i, scene.lines.length, p);
    const y = 66 + i * STEP_ROW_H;
    fillRound(c, 16, y, 380, STEP_ROW_H - 6, 8, '#1a222d');
    drawIcon(c, scene.app, 28, y + 8, 22);
    write(c, step, 62, y + 24, { color: state === 'pending' ? MUTED : '#ffffff', size: 14 });
    const seconds = state === 'pending' ? 0 : state === 'running' ? Math.floor(((p * (scene.lines.length + 1)) % 1) * 20) + 1 : 6 + Math.floor(unitHash(step) * 30);
    write(c, `${seconds}s`, 340, y + 24, { color: MUTED, size: 12, align: 'right' });
    statusMark(c, 368, y + 19, state, timeMs, 9);
  });
  fillRound(c, 412, 66, CONTENT_W - 428, CONTENT_H - 82, 8, '#0a0e13');
  write(c, 'log', 426, 86, { color: MUTED, size: 11, weight: 'bold' });
  revealLines(PIPELINE_LOG, span(p, 0.1, 0.9)).forEach((row, i) => {
    const color = row.startsWith('$') ? '#e6edf7' : row.startsWith('ok') ? GREEN : '#9fb0c6';
    write(c, row, 426, 108 + i * 20, { color, size: 12, mono: true });
  });
  if (!finished) spinner(c, CONTENT_W - 32, CONTENT_H - 28, timeMs, 7, '#6ee7cf', 2.4);
};
