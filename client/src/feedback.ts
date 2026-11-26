/** Issue tracker shared by the lobby and pause menu. */
export const GITHUB_ISSUES_URL = 'https://github.com/sandhilt/calindra-strike/issues';

/** What a bug report needs to say about the build and machine it came from. */
export interface IssueMeta {
  readonly build: string;
  readonly protocol: number;
  readonly userAgent: string;
  readonly screen: string;
  readonly language: string;
}

/** New-issue link with the metadata prefilled in the body, under the player's own text. */
export function newIssueUrl(meta: IssueMeta): string {
  const body = [
    '<!-- Descreva o problema aqui -->',
    '',
    '',
    '---',
    `- Versão: \`${meta.build}\``,
    `- Protocolo: ${meta.protocol}`,
    `- Navegador: ${meta.userAgent}`,
    `- Tela: ${meta.screen}`,
    `- Idioma: ${meta.language}`,
  ].join('\n');
  return `${GITHUB_ISSUES_URL}/new?${new URLSearchParams({ body })}`;
}
