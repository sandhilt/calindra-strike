export type LaptopModel = 'macbook' | 'thinkpad' | 'inspiron';
export type OsName = 'macos' | 'linux' | 'windows';

type Lines = readonly string[];
type EditorApp = 'Cursor' | 'VS Code' | 'Xcode';
type AgentApp = 'Claude Code' | 'Codex' | 'Gemini' | 'Grok';
type TerminalApp = 'iTerm2' | 'WezTerm' | 'Windows Terminal';
type BrowserApp = 'Chrome' | 'Firefox' | 'Edge' | 'Safari';
type BrowserPage = 'login' | 'dashboard' | 'pr' | 'feed' | 'docs' | 'calendar';

export type Scene =
  | { kind: 'request'; app: 'Postman'; url: string; response: { error: string; message: string } }
  | { kind: 'editor'; app: EditorApp; file: string; lines: Lines; remote?: 'WSL'; ai?: { prompt: string; answer: string } }
  | { kind: 'agent'; app: AgentApp; lines: Lines }
  | { kind: 'terminal'; app: TerminalApp; lines: Lines; tests: { failing: string; passing: string } }
  | { kind: 'browser'; app: BrowserApp; url: string; page: BrowserPage; lines: Lines }
  | { kind: 'files'; app: 'Explorer' | 'Finder'; path: string; lines: Lines }
  | { kind: 'board'; app: 'Jira'; lines: Lines }
  | { kind: 'chat'; app: 'Slack'; lines: Lines }
  | { kind: 'media'; app: 'Spotify' | 'Netflix'; lines: Lines }
  | { kind: 'pipeline'; app: 'GitHub Actions' | 'Bitbucket Pipelines'; lines: Lines };

export interface Scenario {
  readonly id: string;
  readonly title: string;
  readonly laptop: LaptopModel;
  readonly os: OsName;
  readonly scenes: readonly { weight: number; scene: Scene }[];
}

const TERMINAL_LINES = ['$ node --version', 'v24.0.0 · Node.js', '$ node --test', 'session.test.ts · regression'];
const WSL_TERMINAL_LINES = [
  'PS C:\\> wsl -l -v',
  '* Ubuntu-24.04   Running   2',
  'PS C:\\> wsl --update',
  'dev@ubuntu:~/projetos/app$ node --test',
  'v24.0.0 · Node.js',
];

/** The closing terminal gets extra time so the red to green flip lands before the final montage. */
const FINAL_SCENE_WEIGHT = 1.8;
const FEED_SCENE_WEIGHT = 1.6;

const browser = (url: string, page: BrowserPage, lines: Lines, app: BrowserApp = 'Chrome'): Scene => ({ kind: 'browser', app, url, page, lines });

const editor = (app: EditorApp, file: string, remote?: 'WSL'): Scene => ({
  kind: 'editor',
  app,
  file,
  ...(remote ? { remote } : {}),
  lines: [
    'export function resolveSession(token) {',
    '  if (!token) return signIn();',
    '  return refreshSession(token);',
    '}',
    '// regression covered: expired token',
  ],
  ai: { prompt: 'Corrija sem quebrar a sessão.', answer: 'Guard aplicado. Adicionei um teste de regressão.' },
});

const terminal = (app: TerminalApp): Scene => ({
  kind: 'terminal',
  app,
  lines: app === 'Windows Terminal' ? WSL_TERMINAL_LINES : TERMINAL_LINES,
  tests: { failing: 'FAIL expired session · 1 failed', passing: 'PASS session.test.ts · 24 passed' },
});

const agent = (app: AgentApp): Scene => ({
  kind: 'agent',
  app,
  lines: ['> Investigue o bug da sessão', 'Lendo contexto e teste de regressão…', 'Causa: token expirado reutilizado.', 'Patch pronto. Vamos rodar os testes.'],
});

const login = (url: string, app: BrowserApp = 'Chrome'): Scene =>
  browser(url, 'login', ['Acesso da equipe', 'dev@equipe.example', '••••••••••••', 'Entrar com segurança'], app);

const scenarios: { id: string; title: string; laptop: LaptopModel; os: OsName; scenes: Scene[] }[] = [
  {
    id: 'friday',
    title: 'Hotfix de sexta',
    laptop: 'macbook',
    os: 'macos',
    scenes: [
      { kind: 'chat', app: 'Slack', lines: ['# incidente-prod', 'Bia: caiu bem na hora do café.', 'Dev: já estou olhando.'] },
      login('console.eitri.tech', 'Safari'),
      {
        kind: 'request',
        app: 'Postman',
        url: 'https://api.example/v1/session',
        response: { error: 'SESSION_REFRESH_FAILED', message: 'Token expirado' },
      },
      { kind: 'files', app: 'Finder', path: '/Users/dev/projetos/app', lines: ['Sources', 'Tests', 'Package.swift', 'hotfix.md'] },
      terminal('iTerm2'),
      editor('Xcode', 'Session.swift'),
      agent('Claude Code'),
      browser('GitHub / pull/42', 'pr', ['GitHub · Pull request #42', '+ Guard de sessão', 'Revisado · pronto para merge'], 'Safari'),
      { kind: 'pipeline', app: 'GitHub Actions', lines: ['Install Node.js', 'Typecheck', 'Regression tests', 'Deploy hotfix'] },
      terminal('iTerm2'),
    ],
  },
  {
    id: 'jira',
    title: 'Task do Jira',
    laptop: 'thinkpad',
    os: 'linux',
    scenes: [
      { kind: 'board', app: 'Jira', lines: ['DEV-404 · Sessão desapareceu', 'A fazer', 'Em andamento', 'Concluído'] },
      login('matrix.eitri.tech'),
      editor('Cursor', 'session.ts'),
      agent('Codex'),
      { kind: 'media', app: 'Spotify', lines: ['Foco sem reunião', 'Lo-fi para corrigir bugs', 'Em reprodução'] },
      browser('Bitbucket / pull-requests/18', 'pr', ['Bitbucket · Revisão #18', 'Teste de regressão adicionado', 'Aprovado pela equipe']),
      { kind: 'pipeline', app: 'Bitbucket Pipelines', lines: ['Node.js setup', 'Lint', 'Tests', 'Publish'] },
      terminal('WezTerm'),
    ],
  },
  {
    id: 'login',
    title: 'Login na Eitri',
    laptop: 'inspiron',
    os: 'windows',
    scenes: [
      login('console.eitri.tech'),
      login('matrix.eitri.tech'),
      login('calindra.tech'),
      browser('console.eitri.tech', 'dashboard', ['Serviços da equipe', 'Sessões · alerta', 'Fila de eventos · normal']),
      agent('Gemini'),
      editor('VS Code', 'auth.ts'),
      { kind: 'pipeline', app: 'GitHub Actions', lines: ['Node.js', 'Validate session', 'Deploy'] },
      terminal('WezTerm'),
    ],
  },
  {
    id: 'feed',
    title: 'Doomscroll no X',
    laptop: 'thinkpad',
    os: 'linux',
    scenes: [
      browser('X / para-voce', 'feed', [
        '@cafe_seguranca · token npm vazou. Revogue!',
        '@patch_do_dia · supply chain CVE: atualize.',
        '@modelo_de_bolso · Anthropic: novo Claude!',
        '@prompt_da_firma · OpenAI / ChatGPT: novo modelo!',
        '@busca_sem_fim · Google Gemini ganhou versão.',
        '@lab_ficticio · DeepSeek, Qwen e Kimi / Moonshot!',
      ]),
      agent('Grok'),
      { kind: 'board', app: 'Jira', lines: ['SEC-42 · Revogar token de exemplo', 'Prioridade alta', 'Em andamento'] },
      login('calindra.tech'),
      editor('VS Code', 'credentials.ts'),
      agent('Codex'),
      { kind: 'pipeline', app: 'Bitbucket Pipelines', lines: ['Audit dependencies', 'Scan secrets', 'Regression tests'] },
      terminal('WezTerm'),
    ],
  },
  {
    id: 'meeting',
    title: 'Reunião que podia ser email',
    laptop: 'macbook',
    os: 'macos',
    scenes: [
      browser('Google Calendar / agenda', 'calendar', ['Google Calendar', '09:00 · Alinhamento do alinhamento', '09:30 · Foco (talvez)'], 'Firefox'),
      browser('Google Workspace / docs', 'docs', ['Google Workspace · Docs / Meet', 'Ata: corrigir o bug da sessão', 'Ação: menos reuniões'], 'Firefox'),
      { kind: 'media', app: 'Netflix', lines: ['Netflix · aba pausada', 'Você ainda está corrigindo?', 'Pausado · voltar depois do deploy'] },
      { kind: 'chat', app: 'Slack', lines: ['# equipe', 'Dev: poderia ter sido um email.', 'Bia: PR aprovado!'] },
      agent('Claude Code'),
      editor('Cursor', 'meeting.ts'),
      browser('GitHub / pull/43', 'pr', ['GitHub · Pull request #43', 'Merged', 'A reunião terminou. O bug também.']),
      terminal('iTerm2'),
    ],
  },
  {
    id: 'wsl',
    title: 'Build no WSL',
    laptop: 'inspiron',
    os: 'windows',
    scenes: [
      { kind: 'chat', app: 'Slack', lines: ['# incidente-prod', 'Bia: o build quebrou só no Windows.', 'Dev: abrindo o WSL agora.'] },
      { kind: 'files', app: 'Explorer', path: '\\\\wsl.localhost\\Ubuntu\\home\\dev\\projetos\\app', lines: ['src', 'test', 'package.json', 'session.test.ts'] },
      editor('VS Code', 'session.ts', 'WSL'),
      agent('Claude Code'),
      login('calindra.tech', 'Edge'),
      { kind: 'pipeline', app: 'GitHub Actions', lines: ['Setup Node.js', 'Typecheck', 'Windows tests', 'Deploy hotfix'] },
      browser('GitHub / pull/44', 'pr', ['GitHub · Pull request #44', 'Build verde no WSL', 'Aprovado · pronto para merge'], 'Edge'),
      terminal('Windows Terminal'),
    ],
  },
  {
    id: 'works-here',
    title: 'Funciona na minha máquina',
    laptop: 'thinkpad',
    os: 'windows',
    scenes: [
      { kind: 'chat', app: 'Slack', lines: ['# incidente-prod', 'Bia: a sessão cai no ThinkPad da recepção.', 'Dev: na minha máquina (Linux) passa.'] },
      login('matrix.eitri.tech', 'Edge'),
      editor('VS Code', 'cache.ts'),
      agent('Codex'),
      { kind: 'board', app: 'Jira', lines: ['DEV-512 · Sessão some no Windows', 'A fazer', 'Em andamento', 'Concluído'] },
      { kind: 'pipeline', app: 'Bitbucket Pipelines', lines: ['Install Node.js', 'Rodar na máquina do dev', 'Regression tests', 'Deploy hotfix'] },
      browser('GitHub / pull/45', 'pr', ['GitHub · Pull request #45', '+ Teste de sessão no Windows', 'Aprovado · funciona na minha máquina'], 'Edge'),
      terminal('Windows Terminal'),
    ],
  },
];

export const SCENARIOS: readonly Scenario[] = scenarios.map((scenario) => ({
  ...scenario,
  scenes: scenario.scenes.map((scene, index) => ({
    weight: sceneWeight(scene, index === scenario.scenes.length - 1),
    scene,
  })),
}));

function sceneWeight(scene: Scene, isFinal: boolean): number {
  if (isFinal) return FINAL_SCENE_WEIGHT;
  return scene.kind === 'browser' && scene.page === 'feed' ? FEED_SCENE_WEIGHT : 1;
}

export function sceneAt(scenario: Scenario, progress: number): { index: number; local: number } {
  const p = Number.isNaN(progress) ? 0 : Math.max(0, Math.min(1, progress));
  const total = scenario.scenes.reduce((sum, entry) => sum + entry.weight, 0);
  let remaining = p * total;
  for (const [index, entry] of scenario.scenes.entries()) {
    const isLast = index === scenario.scenes.length - 1;
    if (remaining < entry.weight || isLast) return { index, local: Math.max(0, Math.min(1, remaining / entry.weight)) };
    remaining -= entry.weight;
  }
  return { index: 0, local: 0 };
}
