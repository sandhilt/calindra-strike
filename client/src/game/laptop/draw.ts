import { SCENARIOS, sceneAt, type Scene, type Scenario } from './scenarios.ts';
const W = 720, H = 460;
type Painter = (ctx: CanvasRenderingContext2D, scene: Scene, local: number, time: number) => void;
function box(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, radius = 8): void {
  c.fillStyle = color; c.beginPath(); c.roundRect(x, y, w, h, radius); c.fill();
}
function text(c: CanvasRenderingContext2D, value: string, x: number, y: number, color = '#d9e7f5', size = 16): void {
  c.fillStyle = color; c.font = `${size}px ui-monospace, monospace`; c.fillText(value, x, y);
}
function spinner(c: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  c.strokeStyle = '#6ee7cf'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 7, time / 180, time / 180 + 4.5); c.stroke();
}
function lines(c: CanvasRenderingContext2D, values: readonly string[], local: number, x = 52, y = 142, spacing = 31): void {
  const chars = Math.floor(local * values.join('').length * 2.6);
  let used = 0;
  for (const [i, value] of values.entries()) { text(c, value.slice(0, Math.max(0, chars - used)), x, y + i * spacing); used += value.length; }
}
const renderers: Record<Scene['kind'], Painter> = {
  editor(c, s, p, t) {
    if (s.kind !== 'editor') return;
    box(c, 35, 105, 145, 260, '#111d30'); text(c, 'EXPLORADOR', 47, 131, '#7f98b5', 13); text(c, s.file, 47, 163, '#68dcc1', 12);
    lines(c, s.lines, p, 195, 143, 28);
    if (s.ai) { box(c, 188, 285, 480, 88, '#25344b'); text(c, 'AI · ' + s.ai.prompt, 202, 310, '#bcacff', 13); text(c, s.ai.answer.slice(0, Math.floor(p * 120)), 202, 341, '#b7cadb', 12); }
    if (Math.floor(t / 450) % 2 === 0) box(c, 201, 255, 8, 17, '#72e4cc', 0);
  },
  agent(c, s, p, t) { if (s.kind !== 'agent') return; text(c, '✦ ASSISTENTE DE DESENVOLVIMENTO', 52, 123, '#bca9ff', 14); lines(c, s.lines, p, 52, 170, 43); spinner(c, 640, 343, t); },
  terminal(c, s, p, t) {
    if (s.kind !== 'terminal') return;
    lines(c, s.lines, Math.min(1, p * 2), 52, 137, 31);
    text(c, p < .52 ? s.tests.failing : s.tests.passing, 52, 285, p < .52 ? '#ff748b' : '#70edaf', 20);
    if (p < .52) spinner(c, 640, 285, t);
    else { box(c, 48, 316, 620, 55, '#154e3c'); text(c, '✓ bug corrigido · produção respirando', 69, 350, '#98ffcb', 21); }
  },
  browser(c, s, p, t) {
    if (s.kind !== 'browser') return;
    box(c, 47, 105, 622, 30, '#28364c'); text(c, '⌕  ' + s.url, 61, 125, '#b7cadb', 14);
    if (s.page === 'login') {
      box(c, 180, 154, 360, 212, '#223249'); lines(c, s.lines, p, 204, 186, 42);
      box(c, 202, 316, 315 * p, 4, '#60e5c0', 2); spinner(c, 514, 341, t);
    } else if (s.page === 'feed') {
      s.lines.forEach((line, i) => { box(c, 48, 145 + i * 36, 620, 31, '#202f45'); text(c, line.slice(0, Math.floor(p * 250)), 59, 165 + i * 36, i < 2 ? '#ffba8c' : '#bed8f5', 12); });
    } else { lines(c, s.lines, p, 58, 177, 42); for (let i = 0; i < 3; i++) box(c, 58, 305 + i * 21, 430 + Math.sin(t / 300 + i) * 35, 10, '#2b4059'); }
  },
  board(c, s, p) {
    if (s.kind !== 'board') return;
    text(c, s.lines[0] ?? '', 52, 139, '#bcacff', 19);
    ['A fazer', 'Em andamento', 'Concluído'].forEach((label, i) => { box(c, 48 + i * 210, 166, 198, 199, '#233249'); text(c, label, 58 + i * 210, 192, '#a8bdd4', 14); });
    const x = 58 + Math.min(2, Math.floor(p * 3)) * 210; box(c, x, 216, 177, 82, '#446091'); text(c, 'Corrigir sessão', x + 8, 245, '#fff', 14); text(c, 'DEV · em progresso', x + 8, 274, '#c9d9ed', 12);
  },
  chat(c, s, p) { if (s.kind !== 'chat') return; box(c, 37, 104, 145, 270, '#312540'); text(c, 'CANAIS', 52, 135, '#d7b7e8', 14); text(c, '# equipe', 52, 170, '#c5a5d9', 13); lines(c, s.lines, p, 199, 148, 49); },
  media(c, s, p, t) { if (s.kind !== 'media') return; box(c, 63, 126, 150, 180, s.app === 'Spotify' ? '#237251' : '#7d263e'); text(c, s.app === 'Spotify' ? '♫' : 'Ⅱ', 108, 238, '#fff', 64); lines(c, s.lines, p, 241, 162, 45); box(c, 243, 315, 370, 5, '#344960'); box(c, 243, 315, 370 * ((t % 8000) / 8000), 5, '#6ee7b7'); },
  pipeline(c, s, p, t) { if (s.kind !== 'pipeline') return; s.lines.forEach((line, i) => { const done = p >= (i + 1) / (s.lines.length + 1); box(c, 53, 115 + i * 60, 607, 49, '#23364a'); text(c, line, 100, 146 + i * 60, done ? '#81efb4' : '#c6d4e7'); if (done) text(c, '✓', 68, 146 + i * 60, '#81efb4'); else spinner(c, 76, 140 + i * 60, t); }); },
};
function scenarioFor(index: number): Scenario { return SCENARIOS[((Math.trunc(index) % SCENARIOS.length) + SCENARIOS.length) % SCENARIOS.length] ?? SCENARIOS[0]; }
function desktop(c: CanvasRenderingContext2D, scenario: Scenario): void {
  const gradient = c.createLinearGradient(0, 0, W, H); gradient.addColorStop(0, '#183649'); gradient.addColorStop(1, '#332348'); c.fillStyle = gradient; c.fillRect(0, 0, W, H);
  box(c, 0, 0, W, 26, '#101725', 0); text(c, scenario.laptop === 'macbook' ? '●  Finder   Arquivo   Editar' : scenario.laptop === 'thinkpad' ? 'Atividades    Desenvolvimento' : '▦  Área de trabalho', 17, 18, '#e4e8ef', 12);
  text(c, scenario.title, 370, 18, '#aabdd0', 12);
  box(c, 200, 413, 320, 39, '#172235');
  for (let i = 0; i < 8; i++) { box(c, 212 + i * 38, 420, 25, 25, `hsl(${(i * 57 + 180) % 360} 45% 48%)`, 6); text(c, ['C', '⌘', '>', 'AI', 'J', '#', 'G', '♫'][i] ?? '', 216 + i * 38, 438, '#fff', 11); }
}
export function drawLaptopScreen(ctx: CanvasRenderingContext2D, width: number, height: number, scenario: number, progress: number, timeMs: number): void {
  ctx.save(); ctx.scale(width / W, height / H);
  const data = scenarioFor(scenario); desktop(ctx, data);
  const { index, local } = sceneAt(data, progress); const entry = data.scenes[index];
  if (entry) {
    const open = Math.min(1, local * 12); ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(.94 + .06 * open, .94 + .06 * open); ctx.translate(-W / 2, -H / 2); ctx.globalAlpha = .25 + .75 * open;
    box(ctx, 27, 56, 666, 341, '#050b15'); box(ctx, 31, 51, 658, 341, '#172337'); box(ctx, 31, 51, 658, 42, '#2c3a50');
    ['#ff7585', '#f4cb6c', '#70d7a4'].forEach((color, i) => box(ctx, 47 + i * 19, 67, 11, 11, color, 6)); text(ctx, entry.scene.app, 125, 78, '#f0f5fc', 16);
    ctx.save(); ctx.beginPath(); ctx.rect(35, 96, 650, 290); ctx.clip(); renderers[entry.scene.kind](ctx, entry.scene, local, timeMs); ctx.restore(); ctx.restore();
  }
  const seed = ((Math.imul(index + 1, 2654435761) >>> 0) % 97) / 97;
  const x = 460 + Math.sin(timeMs / 750 + seed) * 100, y = 270 + Math.cos(timeMs / 950 + seed) * 65;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#18202a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y + 22); ctx.lineTo(x + 10, y + 15); ctx.lineTo(x + 21, y + 15); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
export function drawLaptop(ctx: CanvasRenderingContext2D, width: number, height: number, scenario: number, progress: number, timeMs: number): void {
  ctx.save(); ctx.scale(width / W, height / H); ctx.clearRect(0, 0, W, H);
  const model = scenarioFor(scenario).laptop; const chassis = model === 'thinkpad' ? '#23272d' : model === 'macbook' ? '#67717c' : '#abb7c6';
  box(ctx, 54, 8, 612, 340, chassis, 15); box(ctx, 62, 15, 596, 318, '#080d14', 10);
  ctx.save(); ctx.translate(71, 25); drawLaptopScreen(ctx, 578, 296, scenario, progress, timeMs); ctx.restore();
  if (model === 'macbook') box(ctx, 319, 24, 82, 12, '#080d14', 5);
  text(ctx, model === 'macbook' ? 'MacBook M' : model === 'thinkpad' ? 'ThinkPad' : 'Dell Inspiron', 306, 343, '#dce1e8', 10);
  box(ctx, 25, 349, 670, 106, chassis, 12); box(ctx, 89, 356, 542, 55, '#171e28', 6);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 17; col++) box(ctx, 96 + col * 31, 361 + row * 12, 26, 8, '#3d4652', 2);
  box(ctx, 285, 419, 150, 29, '#86929e', 5); if (model === 'thinkpad') box(ctx, 357, 381, 8, 8, '#ee334b', 5); ctx.restore();
}
export function drawIdleScreen(ctx: CanvasRenderingContext2D, width: number, height: number, scenario: number, secondsLeft: number, timeMs: number): void {
  ctx.save(); ctx.scale(width / W, height / H); ctx.fillStyle = '#240f1c'; ctx.fillRect(0, 0, W, H);
  text(ctx, 'INCIDENTE · ' + scenarioFor(scenario).title, 37, 46, '#ffa8b6', 17);
  text(ctx, 'prod caiu', 37, 117, '#ff5c7c', 53); text(ctx, `${Math.max(0, Math.ceil(secondsLeft))} s`, 526, 117, '#ffb8c5', 40);
  lines(ctx, ['Error: sexta-feira em produção', '  at deploy (release.ts:42)', '  at missingRegression (tests.ts:0)', '  at coffeeBreak (team.ts:17)', '> Aguardando alguém depurar…'], 1, 39, 185, 37);
  spinner(ctx, 49, 399, timeMs); text(ctx, 'Conecte o notebook para corrigir o bug', 73, 405, '#efadb9', 17); ctx.restore();
}
