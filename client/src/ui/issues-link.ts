import { GITHUB_ISSUES_URL } from '../feedback.ts';
import { ICONS, h, svg } from './dom.ts';

export function issuesLink(): HTMLAnchorElement {
  const mark = svg(ICONS.github);
  mark.setAttribute('aria-hidden', 'true');
  return h('a', {
    class: 'github-link',
    href: GITHUB_ISSUES_URL,
    target: '_blank',
    rel: 'noopener noreferrer',
    title: 'Relatar um problema no GitHub',
  }, [mark, 'issues?']);
}
