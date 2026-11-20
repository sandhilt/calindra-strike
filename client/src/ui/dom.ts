import { BRAND } from '../brand.ts';

type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>;

/** Tiny DOM builder. Text is always set via textContent: no HTML injection possible. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, children: (Node | string | null | undefined)[] = []): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, '').toLowerCase(), v);
    else if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

/** Inline SVG from a trusted, hard-coded markup string (never user data). */
export function svg(markup: string): SVGSVGElement {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  return t.content.firstElementChild as SVGSVGElement;
}

/** Calindra Strike logo. */
export function gameLogo(cls = 'game-logo'): HTMLImageElement {
  return h('img', { class: cls, src: BRAND.logoSmall, alt: 'Calindra Strike', width: 256, height: 256, draggable: 'false' });
}

/** Official Eitri app icon. */
export function eitriLogo(cls = 'eitri-icon'): HTMLImageElement {
  return h('img', { class: cls, src: BRAND.eitriSmall, alt: 'Eitri', width: 64, height: 64, draggable: 'false' });
}

export const ICONS = {
  heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z"/></svg>',
  crate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="15" rx="3"/><path d="M3 11h18M12 6v15M8 3l4 3 4-3"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5"/></svg>',
};
