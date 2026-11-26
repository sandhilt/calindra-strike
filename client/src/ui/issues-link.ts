import { PROTOCOL_VERSION } from '@calindra-strike/shared';
import { newIssueUrl } from '../feedback.ts';
import { ICONS, h, svg } from './dom.ts';

function currentIssueUrl(): string {
  return newIssueUrl({
    build: __BUILD_COMMIT__,
    protocol: PROTOCOL_VERSION,
    userAgent: navigator.userAgent,
    screen: `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio}x`,
    language: navigator.language,
  });
}

export function issuesLink(): HTMLAnchorElement {
  const mark = svg(ICONS.github);
  mark.setAttribute('aria-hidden', 'true');
  const link = h('a', {
    class: 'github-link',
    href: currentIssueUrl(),
    target: '_blank',
    rel: 'noopener noreferrer',
    title: 'Relatar um problema no GitHub',
  }, [mark, 'issues?']);
  // The window size can change before the click.
  link.addEventListener('click', () => { link.href = currentIssueUrl(); });
  return link;
}
