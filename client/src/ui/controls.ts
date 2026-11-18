import { h } from './dom.ts';

/** One settings row: label, control (with an optional hint under it) and an optional value on the right. */
export function row(label: string, control: HTMLElement, value?: HTMLElement, hint?: string): HTMLElement {
  return h('div', { class: value ? 'row row-value' : 'row' }, [
    h('span', { class: 'row-label', text: label }),
    h('div', { class: 'row-control' }, hint ? [control, h('small', { class: 'hint', text: hint })] : [control]),
    ...(value ? [value] : []),
  ]);
}

export function group(title: string, ...rows: HTMLElement[]): HTMLElement {
  return h('section', { class: 'menu-group' }, [h('h3', { text: title }), ...rows]);
}

export function rangeRow(label: string, range: { min: number; max: number; step: number }, get: () => number, set: (v: number) => void, fmt: (v: number) => string, changed: () => void): HTMLElement {
  const out = h('output', { text: fmt(get()) });
  const input = h('input', { type: 'range', min: range.min, max: range.max, step: range.step, value: get(), 'aria-label': label });
  input.addEventListener('input', () => {
    set(Number(input.value));
    out.textContent = fmt(get());
    changed();
  });
  return row(label, input, out);
}

export function choiceRow<T>(label: string, options: readonly { v: T; label: string; style?: string }[], get: () => T, set: (v: T) => void, changed: () => void, hint?: string): HTMLElement {
  const wrap = h('div', { class: 'seg' });
  const draw = () =>
    wrap.replaceChildren(
      ...options.map((o) =>
        h('button', {
          type: 'button',
          style: o.style,
          'aria-pressed': String(get() === o.v),
          text: o.label,
          onclick: () => {
            set(o.v);
            changed();
            draw();
          },
        }),
      ),
    );
  draw();
  return row(label, wrap, undefined, hint);
}

export function checkRow(label: string, text: string, get: () => boolean, set: (v: boolean) => void, changed: () => void, unavailable?: string): HTMLElement {
  const input = h('input', { type: 'checkbox' }) as HTMLInputElement;
  // Unavailable: shown off and locked, while the saved choice stays as it was.
  input.disabled = unavailable !== undefined;
  input.checked = unavailable === undefined && get();
  input.addEventListener('change', () => {
    set(input.checked);
    changed();
  });
  return row(label, h('label', { class: 'toggle' }, [input, h('span', { text: unavailable ?? text })]));
}

export function buttonRow(...buttons: HTMLElement[]): HTMLElement {
  return h('div', { class: 'row-buttons' }, buttons);
}
