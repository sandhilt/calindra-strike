export type LaptopModel = 'macbook' | 'thinkpad' | 'inspiron';
type Lines = readonly string[];
export type Scene =
  | { kind: 'editor'; app: 'Cursor' | 'VS Code' | 'Xcode'; file: string; lines: Lines; ai?: { prompt: string; answer: string } }
  | { kind: 'agent'; app: 'Claude Code' | 'Codex' | 'Gemini' | 'Grok'; lines: Lines }
  | { kind: 'terminal'; app: 'iTerm2' | 'WezTerm'; lines: Lines; tests: { failing: string; passing: string } }
  | { kind: 'browser'; app: 'Chrome' | 'Firefox'; url: string; page: 'login' | 'dashboard' | 'pr' | 'pipeline' | 'feed' | 'docs' | 'calendar' | 'video'; lines: Lines }
  | { kind: 'board'; app: 'Jira'; lines: Lines }
  | { kind: 'chat'; app: 'Slack'; lines: Lines }
  | { kind: 'media'; app: 'Spotify' | 'Netflix'; lines: Lines }
  | { kind: 'pipeline'; app: 'GitHub Actions' | 'Bitbucket Pipelines'; lines: Lines };
export interface Scenario { readonly id: string; readonly title: string; readonly laptop: LaptopModel; readonly scenes: readonly { weight: number; scene: Scene }[] }
const browser = (url: string, page: Extract<Scene, { kind: 'browser' }>['page'], lines: Lines, app: 'Chrome' | 'Firefox' = 'Chrome'): Scene => ({ kind: 'browser', app, url, page, lines });
const editor = (app: 'Cursor' | 'VS Code' | 'Xcode', file: string): Scene => ({ kind: 'editor', app, file, lines: ['export function resolveSession(token) {', '  if (!token) return signIn();', '  return refreshSession(token);', '}', '// regression covered: expired token'], ai: { prompt: 'Corrija sem quebrar a sessão.', answer: 'Guard aplicado. Adicionei um teste de regressão.' } });
const terminal = (app: 'iTerm2' | 'WezTerm'): Scene => ({ kind: 'terminal', app, lines: ['$ node --version', 'v24.0.0 · Node.js', '$ node --test', 'session.test.ts · regression'], tests: { failing: 'FAIL expired session · 1 failed', passing: 'PASS session.test.ts · 24 passed' } });
const agent = (app: 'Claude Code' | 'Codex' | 'Gemini' | 'Grok'): Scene => ({ kind: 'agent', app, lines: ['> Investigue o bug da sessão', 'Lendo contexto e teste de regressão…', 'Causa: token expirado reutilizado.', 'Patch pronto. Vamos rodar os testes.'] });
const login = (url: string): Scene => browser(url, 'login', ['Acesso da equipe', 'dev@equipe.example', '••••••••••••', 'Entrar com segurança']);
const scenarios: { id: string; title: string; laptop: LaptopModel; scenes: Scene[] }[] = [
  { id: 'friday', title: 'Hotfix de sexta', laptop: 'macbook', scenes: [
    { kind: 'chat', app: 'Slack', lines: ['# incidente-prod', 'Bia: caiu bem na hora do café.', 'Dev: já estou olhando.'] }, login('console.eitri.tech'), terminal('iTerm2'), editor('Xcode', 'Session.swift'), agent('Claude Code'), browser('GitHub / pull/42', 'pr', ['GitHub · Pull request #42', '+ Guard de sessão', 'Revisado · pronto para merge']), { kind: 'pipeline', app: 'GitHub Actions', lines: ['Install Node.js', 'Typecheck', 'Regression tests', 'Deploy hotfix'] }, terminal('iTerm2')] },
  { id: 'jira', title: 'Task do Jira', laptop: 'thinkpad', scenes: [
    { kind: 'board', app: 'Jira', lines: ['DEV-404 · Sessão desapareceu', 'A fazer', 'Em andamento', 'Concluído'] }, login('matrix.eitri.tech'), editor('Cursor', 'session.ts'), agent('Codex'), { kind: 'media', app: 'Spotify', lines: ['Foco sem reunião', 'Lo-fi para corrigir bugs', 'Em reprodução'] }, browser('Bitbucket / pull-requests/18', 'pr', ['Bitbucket · Revisão #18', 'Teste de regressão adicionado', 'Aprovado pela equipe']), { kind: 'pipeline', app: 'Bitbucket Pipelines', lines: ['Node.js setup', 'Lint', 'Tests', 'Publish'] }, terminal('WezTerm')] },
  { id: 'login', title: 'Login na Eitri', laptop: 'inspiron', scenes: [login('console.eitri.tech'), login('matrix.eitri.tech'), login('calindra.tech'), browser('console.eitri.tech', 'dashboard', ['Serviços da equipe', 'Sessões · alerta', 'Fila de eventos · normal']), agent('Gemini'), editor('VS Code', 'auth.ts'), { kind: 'pipeline', app: 'GitHub Actions', lines: ['Node.js', 'Validate session', 'Deploy'] }, terminal('WezTerm')] },
  { id: 'feed', title: 'Doomscroll no X', laptop: 'thinkpad', scenes: [
    browser('X / para-voce', 'feed', ['@cafe_seguranca · token npm vazou. Revogue!', '@patch_do_dia · supply chain CVE: atualize.', '@modelo_de_bolso · Anthropic: novo Claude!', '@prompt_da_firma · OpenAI / ChatGPT: novo modelo!', '@busca_sem_fim · Google Gemini ganhou versão.', '@lab_ficticio · DeepSeek, Qwen e Kimi / Moonshot!']), agent('Grok'), { kind: 'board', app: 'Jira', lines: ['SEC-42 · Revogar token de exemplo', 'Prioridade alta', 'Em andamento'] }, login('calindra.tech'), editor('VS Code', 'credentials.ts'), agent('Codex'), { kind: 'pipeline', app: 'Bitbucket Pipelines', lines: ['Audit dependencies', 'Scan secrets', 'Regression tests'] }, terminal('WezTerm')] },
  { id: 'meeting', title: 'Reunião que podia ser email', laptop: 'macbook', scenes: [
    browser('Google Calendar / agenda', 'calendar', ['Google Calendar', '09:00 · Alinhamento do alinhamento', '09:30 · Foco (talvez)'], 'Firefox'), browser('Google Workspace / docs', 'docs', ['Google Workspace · Docs / Meet', 'Ata: corrigir o bug da sessão', 'Ação: menos reuniões'], 'Firefox'), { kind: 'media', app: 'Netflix', lines: ['Netflix · aba pausada', 'Você ainda está corrigindo?', 'Pausado · voltar depois do deploy'] }, { kind: 'chat', app: 'Slack', lines: ['# equipe', 'Dev: poderia ter sido um email.', 'Bia: PR aprovado!'] }, agent('Claude Code'), editor('Cursor', 'meeting.ts'), browser('GitHub / pull/43', 'pr', ['GitHub · Pull request #43', 'Merged', 'A reunião terminou. O bug também.']), terminal('iTerm2')] },
];
export const SCENARIOS: readonly Scenario[] = scenarios.map(s => ({ ...s, scenes: s.scenes.map(scene => ({ weight: scene.kind === 'browser' && scene.page === 'feed' ? 1.6 : 1, scene })) }));
export function sceneAt(scenario: Scenario, progress: number): { index: number; local: number } {
  const p = Number.isNaN(progress) ? 0 : Math.max(0, Math.min(1, progress));
  const total = scenario.scenes.reduce((sum, entry) => sum + entry.weight, 0);
  let remaining = p * total;
  for (const [index, entry] of scenario.scenes.entries()) {
    if (remaining < entry.weight || index === scenario.scenes.length - 1) return { index, local: Math.max(0, Math.min(1, remaining / entry.weight)) };
    remaining -= entry.weight;
  }
  return { index: 0, local: 0 };
}
