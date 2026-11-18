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
  | 'teamWin';

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
};

export const BOT_CHAT_BOT_COOLDOWN_MS = 30_000;
export const BOT_CHAT_GLOBAL_COOLDOWN_MS = 6_000;

/** What one bot remembers between chances to talk. */
export interface BotChatMemory {
  lastAt: number;
  lastLine: string | null;
}

export function newBotChatMemory(): BotChatMemory {
  return { lastAt: -Infinity, lastLine: null };
}

/**
 * Decide whether a bot speaks now. Both rolls are in [0, 1). Returns the line, or null to stay quiet.
 * `lastAnyAt` is the last time any bot of the same room spoke.
 */
export function pickBotChat(
  trigger: BotChatTrigger,
  memory: BotChatMemory,
  lastAnyAt: number,
  now: number,
  chanceRoll: number,
  lineRoll: number,
): string | null {
  if (now - lastAnyAt < BOT_CHAT_GLOBAL_COOLDOWN_MS) return null;
  if (now - memory.lastAt < BOT_CHAT_BOT_COOLDOWN_MS) return null;
  if (chanceRoll >= BOT_CHAT_CHANCE[trigger]) return null;
  const pool = BOT_CHAT_LINES[trigger].filter((line) => line !== memory.lastLine);
  return pool[Math.min(pool.length - 1, Math.floor(lineRoll * pool.length))];
}
