import type { Scenario, Scene } from './scenarios.ts';

export type SiteName =
  | 'GitHub'
  | 'Bitbucket'
  | 'X'
  | 'Google Calendar'
  | 'Google Workspace'
  | 'Eitri Console'
  | 'Eitri Matrix'
  | 'Calindra'
  | 'Datadog'
  | 'Firebase'
  | 'Google Cloud'
  | 'AWS';

export type LabName = 'DeepSeek' | 'Qwen' | 'Kimi';

/** Everything that gets an icon: scene apps, websites inside browsers, tools used behind the scenes. */
export type AppName = Scene['app'] | SiteName | LabName | 'Node.js' | 'PowerShell' | 'WSL' | 'Ubuntu' | 'Docker' | 'Windows';

const SITE_BY_URL_PREFIX: readonly (readonly [prefix: string, site: SiteName])[] = [
  ['console.eitri.tech', 'Eitri Console'],
  ['matrix.eitri.tech', 'Eitri Matrix'],
  ['calindra.tech', 'Calindra'],
  ['app.datadoghq.com', 'Datadog'],
  ['console.firebase.google.com', 'Firebase'],
  ['console.cloud.google.com', 'Google Cloud'],
  ['console.aws.amazon.com', 'AWS'],
  ['GitHub', 'GitHub'],
  ['Bitbucket', 'Bitbucket'],
  ['X /', 'X'],
  ['Google Calendar', 'Google Calendar'],
  ['Google Workspace', 'Google Workspace'],
];

/** Helpers running behind the scenes; the Windows taskbar leaves them out and shows them in the tray or tabs instead. */
export const BACKGROUND_TOOLS: ReadonlySet<AppName> = new Set<AppName>(['Node.js', 'PowerShell', 'WSL', 'Ubuntu', 'Docker']);

/** Terminals run Node.js tests; Windows Terminal hosts PowerShell and Ubuntu tabs on top of WSL and Docker. */
const TERMINAL_TOOLS: Readonly<Record<string, readonly AppName[]>> = {
  iTerm2: ['Node.js'],
  WezTerm: ['Node.js'],
  'Windows Terminal': ['Node.js', 'PowerShell', 'WSL', 'Ubuntu', 'Docker'],
};

/** Brand colour of each app, used for glows, title bar tints and accents. */
export const APP_ACCENT: Readonly<Record<AppName, string>> = {
  Cursor: '#e8e8e8',
  'VS Code': '#2fa4ff',
  Xcode: '#2b8cff',
  'Claude Code': '#ec8a62',
  Codex: '#d6dbe4',
  Gemini: '#8e9cff',
  Grok: '#f1f1f1',
  iTerm2: '#3be37a',
  WezTerm: '#b48cff',
  'Windows Terminal': '#9fb4ff',
  Chrome: '#4f9bff',
  Postman: '#FF6C37',
  Firefox: '#ff8a3d',
  Edge: '#2fd1b6',
  Safari: '#1fd0ff',
  Explorer: '#ffc94d',
  Finder: '#6ec6ff',
  Jira: '#3b8cff',
  Slack: '#e8a1d6',
  Spotify: '#1ed760',
  Netflix: '#e50914',
  'GitHub Actions': '#58a6ff',
  'Bitbucket Pipelines': '#3b8cff',
  GitHub: '#c9d1d9',
  Bitbucket: '#3b8cff',
  X: '#e7e9ea',
  'Google Calendar': '#4285f4',
  'Google Workspace': '#fbbc04',
  'Eitri Console': '#a6ff00',
  'Eitri Matrix': '#a6ff00',
  Calindra: '#b6ff1a',
  Datadog: '#632ca6',
  Firebase: '#ff9100',
  'Google Cloud': '#4285f4',
  AWS: '#ff9900',
  DeepSeek: '#4d6bfe',
  Qwen: '#7c6bff',
  Kimi: '#3aa0ff',
  'Node.js': '#6cc24a',
  PowerShell: '#3b78d8',
  WSL: '#ffb454',
  Ubuntu: '#ff7a3d',
  Docker: '#6172FF',
  Windows: '#2ea0ff',
};

export function sceneSite(scene: Scene): SiteName | undefined {
  if (scene.kind !== 'browser') return undefined;
  return SITE_BY_URL_PREFIX.find(([prefix]) => scene.url.startsWith(prefix))?.[1];
}

/** The app whose splash opens before the scene: the website for browser scenes, else the app itself. */
export function launchApp(scene: Scene): AppName {
  return sceneSite(scene) ?? scene.app;
}

export function sceneApps(scene: Scene): readonly AppName[] {
  const site = sceneSite(scene);
  const tools = scene.kind === 'terminal' ? (TERMINAL_TOOLS[scene.app] ?? []) : [];
  return [scene.app, ...(site ? [site] : []), ...tools];
}

/** Apps that appear in the dock or taskbar, in order of first use. */
export function dockApps(scenario: Scenario): readonly AppName[] {
  const apps = scenario.scenes.flatMap(({ scene }) => sceneApps(scene));
  return [...new Set(apps)];
}

/** Every app a scenario touches, including the lab avatars of its X feed posts. */
export function allApps(scenario: Scenario): readonly AppName[] {
  return [...new Set([...dockApps(scenario), ...scenario.scenes.flatMap(({ scene }) => sceneAvatars(scene))])];
}

const LAB_KEYWORDS: readonly (readonly [keyword: string, app: AppName])[] = [
  ['Anthropic', 'Claude Code'],
  ['OpenAI', 'Codex'],
  ['Gemini', 'Gemini'],
  ['DeepSeek', 'DeepSeek'],
  ['Qwen', 'Qwen'],
  ['Kimi', 'Kimi'],
];

/** Lab icons referenced by the text of AI-model posts. */
export function postLabs(text: string): readonly AppName[] {
  return LAB_KEYWORDS.filter(([keyword]) => text.includes(keyword)).map(([, app]) => app);
}

function sceneAvatars(scene: Scene): readonly AppName[] {
  return scene.kind === 'browser' && scene.page === 'feed' ? scene.lines.flatMap(postLabs) : [];
}
