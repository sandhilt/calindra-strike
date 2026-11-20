import { ellipsize, fillRound, line, span, strokeRound, textWidth, write, type Ctx } from '../canvas.ts';
import { drawIcon } from '../icons.ts';
import { CONTENT_H, CONTENT_W, type SceneOf, type SceneRenderer } from './frame.ts';
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

const drawExplorer: SceneRenderer<'files'> = (c, scene, { p, timeMs }) => {
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

const FINDER_SIDEBAR_W = 150;
const FINDER_TOOLBAR_H = 38;
const FINDER_HEAD_Y = FINDER_TOOLBAR_H + 18;
const FINDER_ROWS_Y = FINDER_TOOLBAR_H + 30;
const FINDER_ROW_H = 26;
const FINDER_PATH_Y = CONTENT_H - 9;
const FINDER_INK = '#1d1d1f';
const FINDER_SELECTION = '#0a84ff';
const FINDER_SELECTED_FAVORITE = 'Projetos';
const FINDER_FAVORITES = ['Recentes', 'Downloads', 'Documentos', 'Área de Trabalho', 'Projetos'] as const;
const FINDER_COLUMNS = { name: FINDER_SIDEBAR_W + 44, modified: 368, kind: 510 } as const;

function drawFinderSidebar(c: Ctx): void {
  c.fillStyle = '#ececee';
  c.fillRect(0, 0, FINDER_SIDEBAR_W, CONTENT_H);
  write(c, 'Favoritos', 14, 22, { color: MUTED, size: 10.5, weight: 'bold' });
  FINDER_FAVORITES.forEach((name, i) => {
    const y = 30 + i * 22;
    if (name === FINDER_SELECTED_FAVORITE) fillRound(c, 8, y, FINDER_SIDEBAR_W - 16, 20, 5, 'rgba(0,0,0,0.09)');
    fillRound(c, 14, y + 5, 10, 10, 3, '#4aa8f5');
    write(c, name, 32, y + 14, { color: FINDER_INK, size: 12 });
  });
  write(c, 'Locais', 14, 164, { color: MUTED, size: 10.5, weight: 'bold' });
  fillRound(c, 14, 172, 10, 10, 3, '#8e8e93');
  write(c, 'Macintosh HD', 32, 181, { color: FINDER_INK, size: 12 });
}

function drawFinderToolbar(c: Ctx, path: string): void {
  c.fillStyle = '#f6f6f7';
  c.fillRect(FINDER_SIDEBAR_W, 0, CONTENT_W - FINDER_SIDEBAR_W, FINDER_TOOLBAR_H);
  line(c, FINDER_SIDEBAR_W, FINDER_TOOLBAR_H, CONTENT_W, FINDER_TOOLBAR_H, 'rgba(0,0,0,0.1)');
  write(c, '‹', FINDER_SIDEBAR_W + 14, 25, { color: MUTED, size: 18 });
  write(c, '›', FINDER_SIDEBAR_W + 36, 25, { color: MUTED, size: 18 });
  const folder = path.split('/').filter(Boolean).at(-1) ?? '';
  write(c, folder, FINDER_SIDEBAR_W + (CONTENT_W - FINDER_SIDEBAR_W) / 2, 24, { color: FINDER_INK, size: 13, weight: 'bold', align: 'center' });
  fillRound(c, CONTENT_W - 150, 10, 136, 20, 5, 'rgba(0,0,0,0.07)');
  write(c, 'Pesquisar', CONTENT_W - 140, 24, { color: MUTED, size: 11.5 });
}

function finderFolder(c: Ctx, x: number, y: number): void {
  fillRound(c, x, y, 9, 4, 1.5, '#7cc9ff');
  fillRound(c, x, y + 3, 20, 13, 3, '#4aa8f5');
}

function finderDocument(c: Ctx, x: number, y: number): void {
  fillRound(c, x + 3, y, 13, 17, 2, '#ffffff');
  strokeRound(c, x + 3, y, 13, 17, 2, '#c7c7cc', 1);
}

function drawFinderPathBar(c: Ctx, path: string, count: number): void {
  line(c, FINDER_SIDEBAR_W, CONTENT_H - 22, CONTENT_W, CONTENT_H - 22, 'rgba(0,0,0,0.08)');
  const style = { color: MUTED, size: 11 } as const;
  const crumbs = ['Macintosh HD', ...path.split('/').filter(Boolean)];
  let x = FINDER_SIDEBAR_W + 14;
  crumbs.forEach((crumb, i) => {
    write(c, crumb, x, FINDER_PATH_Y, style);
    x += textWidth(c, crumb, style) + 6;
    if (i < crumbs.length - 1) {
      write(c, '›', x, FINDER_PATH_Y, style);
      x += 12;
    }
  });
  write(c, `${count} itens`, CONTENT_W - 14, FINDER_PATH_Y, { ...style, align: 'right' });
}

const drawFinder: SceneRenderer<'files'> = (c, scene, { p }) => {
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, CONTENT_W, CONTENT_H);
  drawFinderSidebar(c);
  drawFinderToolbar(c, scene.path);
  for (const [label, x] of [['Nome', FINDER_COLUMNS.name], ['Data de modificação', FINDER_COLUMNS.modified], ['Tipo', FINDER_COLUMNS.kind]] as const) {
    write(c, label, x, FINDER_HEAD_Y, { color: MUTED, size: 11 });
  }
  line(c, FINDER_SIDEBAR_W, FINDER_ROWS_Y - 4, CONTENT_W, FINDER_ROWS_Y - 4, 'rgba(0,0,0,0.08)');
  const selected = Math.min(scene.lines.length - 1, Math.floor(span(p, 0.2, 0.9) * scene.lines.length));
  scene.lines.forEach((name, i) => {
    const y = FINDER_ROWS_Y + i * FINDER_ROW_H;
    const folder = !name.includes('.');
    const picked = i === selected;
    if (picked) fillRound(c, FINDER_SIDEBAR_W + 8, y, CONTENT_W - FINDER_SIDEBAR_W - 16, FINDER_ROW_H - 3, 5, FINDER_SELECTION);
    if (folder) finderFolder(c, FINDER_COLUMNS.name - 26, y + 4);
    else finderDocument(c, FINDER_COLUMNS.name - 26, y + 3);
    const ink = picked ? '#ffffff' : FINDER_INK;
    const muted = picked ? '#dbeaff' : MUTED;
    write(c, name, FINDER_COLUMNS.name, y + 17, { color: ink, size: 12.5 });
    write(c, '12/11/2026 17:4' + i, FINDER_COLUMNS.modified, y + 17, { color: muted, size: 11.5 });
    write(c, folder ? 'Pasta' : 'Documento', FINDER_COLUMNS.kind, y + 17, { color: muted, size: 11.5 });
  });
  drawFinderPathBar(c, scene.path, scene.lines.length);
};

type FilesScene = SceneOf['files'];

/** One renderer per file manager; the scene's app picks which one draws it. */
const FILE_MANAGERS: Readonly<Record<FilesScene['app'], SceneRenderer<'files'>>> = {
  Explorer: drawExplorer,
  Finder: drawFinder,
};

export const drawFiles: SceneRenderer<'files'> = (c, scene, frame) => FILE_MANAGERS[scene.app](c, scene, frame);
