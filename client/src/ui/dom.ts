import { BRAND } from '../brand.ts';

export { ICONS, type IconName } from './icons.ts';

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
