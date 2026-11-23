import { ACTIONS, ACTION_IDS, type ActionId, type Bindings, actionBindingLabel, bindingConflicts, canBind, effectiveBindings, mouseBinding, resetBinding, resetBindings, setBinding } from '../game/bindings.ts';
import { CONTROL_SECTIONS, controlRows } from './controls-list.ts';
import { ICONS, type IconName, h, svg } from './dom.ts';

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

/** Puts an icon in front of a settings row's label. */
export function withIcon(icon: IconName, settingsRow: HTMLElement): HTMLElement {
  settingsRow.querySelector('.row-label')?.prepend(svg(ICONS[icon]));
  return settingsRow;
}

export function controlsList(initial: Bindings, changed?: (bindings: Bindings) => void): HTMLElement {
  let bindings = initial;
  const list = h('div', { class: 'controls' });
  const status = h('p', { class: 'hint', role: 'status' });
  const captureStatus = h('p', { class: 'hint', role: 'status' });
  const dialog = h('dialog', { class: 'binding-capture glass', 'aria-label': 'Alterar atalho' }, [
    h('p', { text: 'pressione uma tecla (Esc cancela)' }),
    h('small', { text: 'Você também pode clicar com um botão do mouse.' }),
    captureStatus,
  ]);
  let capture: ActionId | undefined;

  const save = (next: Bindings, id?: ActionId) => {
    if (id) {
      const conflicts = bindingConflicts(next, id, effectiveBindings(next, id));
      if (conflicts.length) {
        const labels = conflicts.map((other) => ACTIONS[other].label).join(', ');
        if (!window.confirm(`Atalho já usado por ${labels}. Compartilhar mesmo assim? Algumas ações têm prioridade quando usadas juntas.`)) {
          status.textContent = 'Atalho mantido.';
          return;
        }
      }
    }
    bindings = next;
    changed?.(bindings);
    draw();
    status.textContent = id ? `Atalho atualizado: ${ACTIONS[id].label}.` : 'Atalhos padrão restaurados.';
    list.querySelector<HTMLButtonElement>(id ? `[data-action="${id}"]` : '.bindings-reset')?.focus();
  };

  const take = (code: string) => {
    if (!capture) return;
    const id = capture;
    if (!canBind(id, code)) {
      captureStatus.textContent = 'Este atalho está reservado ou não está disponível.';
      return;
    }
    dialog.close();
    save(setBinding(bindings, id, code), id);
  };

  dialog.addEventListener('close', () => {
    if (!dialog.open) capture = undefined;
  });
  dialog.addEventListener('keydown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat || e.isComposing) return;
    if (e.code === 'Escape') dialog.close();
    else take(e.code);
  });
  dialog.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  const takeMouse = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    take(mouseBinding(e.button));
  };
  dialog.addEventListener('click', takeMouse);
  dialog.addEventListener('auxclick', takeMouse);
  dialog.addEventListener('contextmenu', (e) => e.preventDefault());
  dialog.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY !== 0 && capture && ACTIONS[capture].weapon !== undefined) take(e.deltaY > 0 ? 'WheelDown' : 'WheelUp');
  }, { passive: false });

  const draw = () => list.replaceChildren(
    ...(changed ? [
      h('button', { class: 'btn bindings-reset', type: 'button', text: 'restaurar todos', onclick: () => save(resetBindings()) }),
      status,
    ] : []),
    ...CONTROL_SECTIONS.map(({ id: group, icon }) => h('section', { class: 'controls-section' }, [
      h('h4', {}, [svg(ICONS[icon]), group]),
      h('div', { class: changed ? 'bindings-grid' : 'controls-grid' }, [
        ...ACTION_IDS.filter((id) => ACTIONS[id].group === group).map((id) => {
          const label = ACTIONS[id].label;
          const keys = actionBindingLabel(bindings, id);
          if (!changed) return h('div', { class: 'control' }, [h('span', { class: 'kbd', text: keys }), h('span', { text: label })]);
          const button = h('button', { class: 'kbd binding-key', type: 'button', text: keys, 'data-action': id, 'aria-label': `Alterar ${label}: ${keys}` });
          button.addEventListener('click', () => {
            capture = id;
            captureStatus.textContent = ACTIONS[id].weapon === undefined ? '' : 'Você também pode girar a roda do mouse.';
            dialog.showModal();
            dialog.focus();
          });
          return h('div', { class: 'binding-row' }, [
            h('span', { text: label }),
            button,
            h('button', { class: 'btn', type: 'button', text: 'padrão', 'aria-label': `Restaurar padrão: ${label}`, disabled: bindings[id] === undefined, onclick: () => save(resetBinding(bindings, id), id) }),
          ]);
        }),
        ...controlRows(bindings, group).map(({ keys, label }) =>
          h('div', { class: 'control binding-hint' }, [h('span', { class: 'kbd', text: keys }), h('span', { text: label })])),
      ]),
    ])),
    ...(changed ? [dialog] : []),
  );
  draw();
  return list;
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

export function choiceRow<T>(label: string, options: readonly { v: T; label: string; style?: string; icon?: string }[], get: () => T, set: (v: T) => void, changed: () => void, hint?: string): HTMLElement {
  const wrap = h('div', { class: 'seg' });
  const draw = () =>
    wrap.replaceChildren(
      ...options.map((o) =>
        h('button', {
          type: 'button',
          style: o.style,
          'aria-pressed': String(get() === o.v),
          onclick: () => {
            set(o.v);
            changed();
            draw();
          },
        }, [...(o.icon ? [svg(o.icon)] : []), o.label]),
      ),
    );
  draw();
  return row(label, wrap, undefined, hint);
}

export function checkRow(label: string, text: string, get: () => boolean, set: (v: boolean) => void, changed: () => void, unavailable?: string): HTMLElement {
  const input = h('input', { type: 'checkbox' });
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
