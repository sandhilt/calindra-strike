import { newTalkMemory, pickTalk, type TalkCooldowns, type TalkMemory } from './bot-talk.ts';

/** Occasional table talk for bots. Pure: the caller passes the rolls and the clock, so server and tools share it. */

export type BotChatTrigger =
  | 'kill'
  | 'headshot'
  | 'hammer'
  | 'death'
  | 'plant'
  | 'defused'
  | 'exploded'
  | 'flagTake'
  | 'capture'
  | 'roundStart'
  | 'teamWin'
  | 'killStreakFoe'
  | 'killStreakAlly'
  | 'deathStreakFoe'
  | 'deathStreakAlly';

/** Lines may hold {name}, which fillBotChat replaces with the player the line is about. */
export const BOT_CHAT_LINES: Readonly<Record<BotChatTrigger, readonly string[]>> = {
  kill: [
    'Esse bug eu já corrigi.',
    'Fechei o ticket.',
    'Rollback aplicado.',
    'Mais um merge sem conflito.',
    'Isso era hotfix, né?',
    'Café depois, kill agora.',
    'Passou no code review.',
    'Deploy concluído com sucesso.',
    'Essa era a feature do Jira.',
    'Git push --force e dormi.',
  ],
  headshot: [
    'Direto na cabeça, sem lint.',
    'Cabeçada certeira!',
    'Esse passou pelo QA inteiro.',
    'Mirei no bug, acertei a testa.',
    'Headshot de produção!',
    'Tiro limpo, zero warnings.',
    'Cabeça fria, mira quente.',
    'Um commit, um headshot.',
    'Headshot sem code review.',
    'Cabeça no Docker, bug no chão.',
  ],
  hammer: [
    'Martelada de forja!',
    'Bati o martelo nessa reunião.',
    'Marretei o bug.',
    'Hotfix na marreta.',
    'Na base do martelo.',
    'Eitri aprova essa martelada.',
    'Quem precisa de rifle?',
    'Martelo na mão, bug no chão.',
    'Marretei o Docker, subiu de novo.',
    'Marretei o Bitbucket Pipelines.',
  ],
  death: [
    'Foi lag, juro.',
    'Deploy na sexta, deu nisso.',
    'Preciso de mais café.',
    'Meu ping foi almoçar.',
    'Isso não aparecia no staging.',
    'Volto já, vou reiniciar.',
    'Bug no cliente, não em mim.',
    'Me pegaram no merge.',
    'Meu Docker travou, não eu.',
    'Estava no Slack, juro.',
  ],
  plant: [
    'Notebook no chão, torçam!',
    'Plantei o deploy de sexta.',
    'Agora é só esperar o build.',
    'Instalado. Ninguém mexe!',
    'Subi o laptop, boa sorte.',
    'Cronômetro rodando, pessoal.',
    'Deploy agendado, sem rollback.',
    'Plantado e sem pull request.',
    'Docker subindo, bora plantar.',
    'Notebook plantado, Postman aberto.',
    'Plantei e abri um card no Jira.',
    'Mandei no Slack: já plantei.',
    'Claude Code disse que é seguro.',
    'Codex revisou, pode plantar.',
    'Cursor sugeriu plantar aqui.',
    'Plantado no VS Code, sem lint.',
    'Xcode compilou, laptop no chão.',
    'GitHub Actions verde, plantando.',
    'Bitbucket Pipelines liberou a bomba.',
    'Windows Terminal aberto, plantei.',
  ],
  defused: [
    'Desarmado antes do standup!',
    'Cortei o fio certo.',
    'Rollback a tempo!',
    'Sexta-feira salva.',
    'Quase foi pra produção.',
    'Bug contido!',
    'Desarmei sem café, imagina.',
    'Reverti o deploy na hora.',
    'Desarmado. O Docker nem precisou.',
    'Rollback no Postman, bomba parada.',
    'Jira fechado, bug desarmado.',
    'Slack calou, laptop também.',
    'Claude Code achou o fio certo.',
    'Codex corrigiu, eu só cortei.',
    'Cursor achou o fio vermelho.',
    'VS Code salvou a sexta.',
    'iTerm2 aberto, fio cortado.',
    'WezTerm: fio certo, bomba parada.',
    'Chrome fechou a aba do incidente.',
    'Firefox abriu, bomba fechou.',
    'Edge: fio cortado, bomba quieta.',
    'Spotify no lo-fi, fio cortado.',
    'Node.js passou nos testes, bomba desarmada.',
  ],
  exploded: [
    'Subiu pra produção!',
    'Explodiu o servidor, bonito.',
    'Sexta-feira cumpriu o prometido.',
    'Deploy com fogos de artifício.',
    'Incidente aberto, boa noite.',
    'Ninguém avisou o on-call?',
    'Build quebrou com estilo.',
    'Boom! Pode abrir o postmortem.',
    'Subiu sem passar no GitHub Actions.',
    'Docker rodando, laptop explodindo.',
    'Abre um card no Jira pra isso.',
    'Postman mandou 500 e explodiu.',
    'Netflix pausou, laptop não.',
    'Gemini disse que ia dar certo.',
    'Grok aprovou o deploy de sexta.',
    'WSL caiu e levou o notebook.',
    'Finder nem abriu, já explodiu.',
    'Safari fechou, bomba não.',
    'O Datadog latiu, ninguém viu.',
    'Firebase em chamas. Literalmente.',
    'A AWS já lançou na fatura.',
    'Bitbucket Pipelines: verde até explodir.',
    'Xcode avisou, eu ignorei.',
    'iTerm2 com 40 abas, explodiu.',
  ],
  flagTake: [
    'Peguei a bandeira, me cubram!',
    'Com a bandeira, indo pra casa.',
    'Bandeira na mão, café na outra.',
    'Entregando a build!',
    'Segura o escritório, eu corro.',
    'Bandeira é minha, release é nossa.',
    'Peguei, agora ninguém me alcança.',
    'Rumo ao deploy da bandeira!',
    'Bandeira no Jira, status: em andamento.',
    'Peguei a bandeira, sem PR aprovado.',
  ],
  capture: [
    'Bandeira entregue, é merge!',
    'Ponto no quadro da forja!',
    'Release entregue no prazo.',
    'Mais um ponto pro sprint.',
    'Capturei! Alguém anota.',
    'Entregue, sem retrabalho.',
    'Isso rende um café pra todos.',
    'Passou pelo pipeline inteiro!',
    'Capturado, pipeline verde.',
    'Entregue, o Jira fechou sozinho.',
  ],
  roundStart: [
    'Bora, que o café esfriou.',
    'Vamos lá, time!',
    'Que comece o sprint.',
    'Sem deploy na sexta, prometo.',
    'Boa sorte e bom jogo.',
    'Modo forja ativado.',
    'Reunião rápida? Só tiro.',
    'Respira, é só um build.',
    'Docker de pé, bora pro round.',
    'Postman com a request pronta!',
    'Jira com card novo, bora!',
    'Slack aberto, notebook armado.',
    'Cursor aberto, café na mão.',
    'Claude Code, me ajuda aqui!',
    'Codex, faz o plano e vai.',
    'iTerm2 aberto, vamos nessa.',
    'Spotify no lo-fi, round começando.',
    'Netflix pausado, bora trabalhar.',
    'Gemini e Grok na torcida.',
    'Node.js instalado, bora nessa.',
    'WSL ligado, Windows fingindo.',
    'Finder aberto, bug escondido.',
    'Safari aberto, bora pro round.',
    'gcloud no projeto certo? Então bora.',
    'Datadog de olho, café na mão.',
    'Edge aberto, aba da pipeline.',
    'Windows Terminal aberto, bora!',
    'GitHub Actions de olho, bora.',
    'Xcode aberto, bora buildar.',
    'WezTerm aberto, vamos nessa.',
  ],
  teamWin: [
    'Ganhamos! Alguém paga o café.',
    'Time da forja não perde sprint.',
    'Merge aprovado, valeu pessoal!',
    'Vitória sem hotfix.',
    'Bom trabalho, equipe!',
    'Essa vai pro changelog.',
    'Release vitoriosa!',
    'Placar atualizado, humildade ligada.',
    'Ganhamos, sem deploy na sexta.',
    'Vitória no GitHub Actions, verde!',
  ],
  killStreakFoe: [
    'Alguém para esse {name}!',
    'Tá de aimbot, {name}?',
    'Isso é hack, reporta o {name}!',
    'O {name} tá com o Claude Code no mouse.',
    'Alguém tira o {name} do servidor!',
    'Esse {name} tá no lag de propósito.',
  ],
  killStreakAlly: [
    'Não para, {name}, tá voando!',
    'Esse {name} é o nosso CI verde!',
    'Vai, {name}, sobe o hotfix!',
    '{name}, o Docker tá com inveja!',
    'Bora, {name}, o time tá vendo!',
    'Esse {name} merece um café!',
  ],
  deathStreakFoe: [
    'Respawn é de graça, né, {name}?',
    '{name} tá de férias por aqui.',
    'Tá fazendo estágio no respawn, {name}?',
    '{name}, o ping tá de folga?',
    'Mais uma morte pro board, {name}.',
    'Esse {name} tá doando pro respawn.',
  ],
  deathStreakAlly: [
    'Bora, {name}, você consegue!',
    'Respira e volta com tudo, {name}!',
    'Próximo round é seu, {name}!',
    'Um bug não define a sprint, {name}.',
    'Vai, {name}, o time tá contigo!',
    'Morrer faz parte do deploy, {name}.',
  ],
};

export const BOT_CHAT_CHANCE: Readonly<Record<BotChatTrigger, number>> = {
  kill: 0.25,
  headshot: 0.4,
  hammer: 0.4,
  death: 0.25,
  plant: 0.35,
  defused: 0.4,
  exploded: 0.35,
  flagTake: 0.25,
  capture: 0.4,
  roundStart: 0.3,
  teamWin: 0.35,
  killStreakFoe: 0.45,
  killStreakAlly: 0.45,
  deathStreakFoe: 0.35,
  deathStreakAlly: 0.4,
};

export const BOT_CHAT_BOT_COOLDOWN_MS = 30_000;
export const BOT_CHAT_GLOBAL_COOLDOWN_MS = 6_000;
const BOT_CHAT_COOLDOWNS: TalkCooldowns = { speakerMs: BOT_CHAT_BOT_COOLDOWN_MS, roomMs: BOT_CHAT_GLOBAL_COOLDOWN_MS };

export type BotChatMemory = TalkMemory<string>;

export function newBotChatMemory(): BotChatMemory {
  return newTalkMemory<string>();
}

/** A kill streak draws a callout on the third kill in a row, then on every fifth kill from five on. */
export const KILL_STREAK_FIRST_CALLOUT = 3;
export const KILL_STREAK_CALLOUT_EVERY = 5;
/** A death streak (no kill in between) draws a callout on every fourth death from four on. */
export const DEATH_STREAK_CALLOUT_EVERY = 4;

export function isKillStreakCallout(streak: number): boolean {
  return streak === KILL_STREAK_FIRST_CALLOUT || (streak > KILL_STREAK_FIRST_CALLOUT && streak % KILL_STREAK_CALLOUT_EVERY === 0);
}

export function isDeathStreakCallout(deaths: number): boolean {
  return deaths >= DEATH_STREAK_CALLOUT_EVERY && deaths % DEATH_STREAK_CALLOUT_EVERY === 0;
}

export function fillBotChat(line: string, name: string): string {
  return line.replaceAll('{name}', name);
}

/** Decide whether a bot speaks now. Both rolls are in [0, 1). Returns the line template, or null to stay quiet. */
export function pickBotChat(
  trigger: BotChatTrigger,
  memory: BotChatMemory,
  lastAnyAt: number,
  now: number,
  chanceRoll: number,
  lineRoll: number,
): string | null {
  return pickTalk(
    { lines: BOT_CHAT_LINES[trigger], chance: BOT_CHAT_CHANCE[trigger], cooldowns: BOT_CHAT_COOLDOWNS },
    memory,
    lastAnyAt,
    now,
    { chance: chanceRoll, line: lineRoll },
  );
}
