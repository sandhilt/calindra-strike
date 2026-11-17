import { fillRound, line, span, strokeRound, write, ellipsize, type Ctx } from '../canvas.ts';
import { drawIcon } from '../icons.ts';
import { CONTENT_H, CONTENT_W, type SceneRenderer } from './frame.ts';
import { MUTED, statusMark } from './widgets.ts';

const SIDEBAR_W = 168;
const ROW_H = 30;
const LIST_TOP = 112;

function drawSidebar(c: Ctx): void {
  c.fillStyle = '#1b1b1b';
  c.fillRect(0, 0, SIDEBAR_W, CONTENT_H);
  const common = ['Início', 'Galeria', 'Área de Trabalho', 'Downloads', 'Documentos'];
  common.forEach((name, i) => {
    fillRound(c, 14, 62 + i * 24 - 9, 10, 10, 3, i === 0 ? '#60cdff' : '#8a8a8a');
    write(c, name, 32, 62 + i * 24, { color: '#d8d8d8', size: 12 });
  });
  line(c, 12, 182, SIDEBAR_W - 12, 182, 'rgba(255,255,255,0.12)');
  write(c, 'Linux', 14, 202, { color: MUTED, size: 11, weight: 'bold' });
  fillRound(c, 8, 210, SIDEBAR_W - 16, 26, 6, 'rgba(255,255,255,0.12)');
  drawIcon(c, 'Ubuntu', 16, 214, 18);
  write(c, 'Ubuntu', 40, 228, { color: '#ffffff', size: 12.5, weight: 'bold' });
  drawIcon(c, 'Docker', 16, 244, 18);
  write(c, 'docker-desktop', 40, 258, { color: '#d8d8d8', size: 12 });
}

function drawAddressBar(c: Ctx, path: string): void {
  const x = SIDEBAR_W + 12;
  fillRound(c, x, 38, CONTENT_W - x - 12, 28, 6, '#2b2b2b');
  drawIcon(c, 'WSL', x + 8, 43, 18);
  const crumbs = path.split('\\').filter(Boolean);
  const shown = ['Linux', ...crumbs.slice(1)];
  let cursorX = x + 34;
  shown.forEach((crumb, i) => {
    write(c, crumb, cursorX, 57, { color: '#e8e8e8', size: 12 });
    cursorX += crumb.length * 6.9 + 6;
    if (i < shown.length - 1) {
      write(c, '›', cursorX, 57, { color: MUTED, size: 13 });
      cursorX += 14;
    }
  });
}

export const drawFiles: SceneRenderer<'files'> = (c, scene, { p, timeMs }) => {
  c.fillStyle = '#202020';
  c.fillRect(0, 0, CONTENT_W, CONTENT_H);
  ['Novo', 'Recortar', 'Copiar', 'Renomear', 'Classificar'].forEach((label, i) => {
    fillRound(c, SIDEBAR_W + 12 + i * 84, 6, 78, 24, 6, 'rgba(255,255,255,0.06)');
    fillRound(c, SIDEBAR_W + 20 + i * 84, 14, 8, 8, 2, '#60cdff');
    write(c, label, SIDEBAR_W + 34 + i * 84, 23, { color: '#d8d8d8', size: 11.5 });
  });
  drawSidebar(c);
  drawAddressBar(c, scene.path);
  write(c, ellipsize(c, scene.path, CONTENT_W - SIDEBAR_W - 24, { size: 11.5, mono: true }), SIDEBAR_W + 16, 90, { color: MUTED, size: 11.5, mono: true });
  const columns: readonly (readonly [string, number])[] = [['Nome', SIDEBAR_W + 40], ['Data de modificação', 400], ['Tipo', 530]];
  columns.forEach(([label, x]) => write(c, label, x, LIST_TOP - 4, { color: MUTED, size: 11 }));
  line(c, SIDEBAR_W + 12, LIST_TOP, CONTENT_W - 12, LIST_TOP, 'rgba(255,255,255,0.1)');
  const selected = Math.min(scene.lines.length - 1, Math.floor(span(p, 0.2, 0.9) * scene.lines.length));
  scene.lines.forEach((name, i) => {
    const y = LIST_TOP + 6 + i * ROW_H;
    const folder = !name.includes('.');
    if (i === selected) {
      fillRound(c, SIDEBAR_W + 12, y, CONTENT_W - SIDEBAR_W - 24, ROW_H - 4, 6, 'rgba(96,205,255,0.16)');
      strokeRound(c, SIDEBAR_W + 12, y, CONTENT_W - SIDEBAR_W - 24, ROW_H - 4, 6, 'rgba(96,205,255,0.45)', 1);
    }
    if (folder) drawIcon(c, 'Explorer', SIDEBAR_W + 20, y + 3, 20);
    else fillRound(c, SIDEBAR_W + 25, y + 4, 12, 17, 2, '#d8d8d8');
    write(c, name, SIDEBAR_W + 48, y + 18, { color: '#ffffff', size: 12.5 });
    write(c, '12/11/2026 17:4' + i, 400, y + 18, { color: '#b8b8b8', size: 11.5 });
    write(c, folder ? 'Pasta de arquivos' : name.endsWith('.json') ? 'Arquivo JSON' : 'Arquivo TS', 530, y + 18, { color: '#b8b8b8', size: 11.5 });
  });
  write(c, `${scene.lines.length} itens`, 14, CONTENT_H - 12, { color: MUTED, size: 11 });
  if (p < 0.2) statusMark(c, CONTENT_W - 24, CONTENT_H - 16, 'running', timeMs, 6);
};
