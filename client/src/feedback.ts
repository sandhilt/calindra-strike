/** The game's repository, which the lobby links to. */
export const GITHUB_URL = 'https://github.com/sandhilt/calindra-strike';

/** Where players send feedback on the experimental movement: a prefilled GitHub "new issue" page. */
const ISSUES_NEW_URL = `${GITHUB_URL}/issues/new`;

const FEEDBACK_TITLE = 'Feedback: movimento experimental';

const FEEDBACK_BODY = [
  'Sobre o movimento experimental (correr, fôlego, deslizar, inclinar e deitar):',
  '',
  '**O que você gostou?**',
  '',
  '**O que incomodou?**',
  '',
  '**Versão / navegador:**',
].join('\n');

export const FEEDBACK_URL = `${ISSUES_NEW_URL}?${new URLSearchParams({ title: FEEDBACK_TITLE, body: FEEDBACK_BODY })}`;

export const FEEDBACK_LABEL = 'enviar feedback do movimento experimental';
