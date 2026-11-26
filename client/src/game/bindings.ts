import { BTN, RADIO_MENUS } from '@calindra-strike/shared';

export type ControlGroup = 'movimento' | 'combate' | 'interface';
export type ActionId =
  | 'forward' | 'back' | 'left' | 'right' | 'jump' | 'crouch' | 'sprint' | 'walk' | 'leanLeft' | 'leanRight' | 'prone'
  | 'fire' | 'aim' | 'reload' | 'use' | 'primary' | 'secondary' | 'melee' | 'lastWeapon' | 'nextWeapon' | 'previousWeapon'
  | 'spray' | 'scoreboard' | 'chat' | 'screenshot';

export type Bindings = Partial<Record<ActionId, readonly string[]>>;

interface Action {
  label: string;
  group: ControlGroup;
  defaults: readonly [string, ...string[]];
  bit?: number;
  weapon?: number;
}

export const ACTIONS: Readonly<Record<ActionId, Action>> = {
  forward: { label: 'avançar', group: 'movimento', defaults: ['KeyW'], bit: BTN.FWD },
  back: { label: 'recuar', group: 'movimento', defaults: ['KeyS'], bit: BTN.BACK },
  left: { label: 'mover para a esquerda', group: 'movimento', defaults: ['KeyA'], bit: BTN.LEFT },
  right: { label: 'mover para a direita', group: 'movimento', defaults: ['KeyD'], bit: BTN.RIGHT },
  jump: { label: 'pular', group: 'movimento', defaults: ['Space'], bit: BTN.JUMP },
  crouch: { label: 'agachar / mergulhar', group: 'movimento', defaults: ['ControlLeft', 'ControlRight', 'KeyC'], bit: BTN.DUCK },
  sprint: { label: 'correr', group: 'movimento', defaults: ['ShiftLeft', 'ShiftRight'], bit: BTN.SPRINT },
  walk: { label: 'andar em silêncio', group: 'movimento', defaults: ['AltLeft', 'AltRight'], bit: BTN.WALK },
  leanLeft: { label: 'inclinar à esquerda', group: 'movimento', defaults: ['ArrowLeft', 'KeyF', 'Mouse4'], bit: BTN.LEAN_LEFT },
  leanRight: { label: 'inclinar à direita', group: 'movimento', defaults: ['ArrowRight', 'KeyH', 'Mouse5'], bit: BTN.LEAN_RIGHT },
  prone: { label: 'deitar / levantar', group: 'movimento', defaults: ['ArrowDown'] },
  fire: { label: 'atirar', group: 'combate', defaults: ['Mouse1'], bit: BTN.ATTACK },
  aim: { label: 'mirar (segurar) / luneta', group: 'combate', defaults: ['Mouse2'], bit: BTN.ATTACK2 },
  reload: { label: 'recarregar', group: 'combate', defaults: ['KeyR'], bit: BTN.RELOAD },
  use: { label: 'interagir / plantar / desarmar', group: 'combate', defaults: ['KeyE'], bit: BTN.USE },
  primary: { label: 'arma principal', group: 'combate', defaults: ['Digit1'], weapon: 1 },
  secondary: { label: 'arma secundária', group: 'combate', defaults: ['Digit2'], weapon: 2 },
  melee: { label: 'martelo', group: 'combate', defaults: ['Digit3'], weapon: 3 },
  lastWeapon: { label: 'última arma', group: 'combate', defaults: ['KeyQ'], weapon: 4 },
  nextWeapon: { label: 'próxima arma', group: 'combate', defaults: ['WheelDown'], weapon: 5 },
  previousWeapon: { label: 'arma anterior', group: 'combate', defaults: ['WheelUp'], weapon: 6 },
  spray: { label: 'spray', group: 'interface', defaults: ['KeyG'] },
  scoreboard: { label: 'placar', group: 'interface', defaults: ['Tab'] },
  chat: { label: 'chat', group: 'interface', defaults: ['KeyY', 'KeyT', 'Enter'] },
  screenshot: { label: 'tirar print', group: 'interface', defaults: ['F2'] },
};

function isActionId(id: string): id is ActionId {
  return Object.hasOwn(ACTIONS, id);
}

export const ACTION_IDS = Object.keys(ACTIONS).filter(isActionId);

const RESERVED = new Set(['Escape', ...RADIO_MENUS.map((menu) => menu.key)]);
const KEY_CODE = /^(?:Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Arrow(?:Up|Down|Left|Right)|(?:Alt|Control|Shift|Meta)(?:Left|Right)|Numpad(?:[0-9]|Add|Subtract|Multiply|Divide|Decimal|Enter|Equal|Comma)|Space|Tab|Enter|Backspace|Delete|Insert|Home|End|PageUp|PageDown|CapsLock|NumLock|ScrollLock|Pause|PrintScreen|ContextMenu|Backquote|Backslash|BracketLeft|BracketRight|Comma|Equal|IntlBackslash|IntlRo|IntlYen|Minus|Period|Quote|Semicolon|Slash|Mouse[1-5])$/;

export function canBind(id: ActionId, code: string): boolean {
  return !RESERVED.has(code) && (KEY_CODE.test(code) || (ACTIONS[id].weapon !== undefined && (code === 'WheelUp' || code === 'WheelDown')));
}

export function mouseBinding(button: number): string {
  // DOM button 1 is middle, while the game labels the secondary button Mouse 2.
  return ['Mouse1', 'Mouse3', 'Mouse2', 'Mouse4', 'Mouse5'][button] ?? '';
}

export function effectiveBindings(bindings: Bindings, id: ActionId): readonly string[] {
  return bindings[id] ?? ACTIONS[id].defaults;
}

export function resetBinding(bindings: Bindings, id: ActionId): Bindings {
  const next = { ...bindings };
  delete next[id];
  return next;
}

export function resetBindings(): Bindings {
  return {};
}

function normalizeBinding(bindings: Bindings, id: ActionId, codes: readonly string[]): Bindings {
  const defaults = ACTIONS[id].defaults;
  return codes.length === defaults.length && defaults.every((code) => codes.includes(code))
    ? resetBinding(bindings, id)
    : { ...bindings, [id]: codes };
}

export function setBinding(bindings: Bindings, id: ActionId, code: string): Bindings {
  return canBind(id, code) ? normalizeBinding(bindings, id, [code]) : bindings;
}

export function parseBindings(value: unknown): Bindings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  let bindings: Bindings = {};
  for (const [id, raw] of Object.entries(value)) {
    if (!isActionId(id) || !Array.isArray(raw) || raw.length === 0 || raw.length > ACTIONS[id].defaults.length) continue;
    const entries: readonly unknown[] = raw;
    const codes = entries.filter((code): code is string => typeof code === 'string' && canBind(id, code));
    if (codes.length !== entries.length || new Set(codes).size !== codes.length) continue;
    bindings = normalizeBinding(bindings, id, codes);
  }
  return bindings;
}

export function bindingConflicts(bindings: Bindings, id: ActionId, codes: readonly string[]): ActionId[] {
  return ACTION_IDS.filter((other) => other !== id && effectiveBindings(bindings, other).some((code) => codes.includes(code)));
}

const KEY_LABELS: Readonly<Record<string, string>> = {
  Escape: 'Esc', Space: 'Espaço', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  ControlLeft: 'Ctrl Esq.', ControlRight: 'Ctrl Dir.', ShiftLeft: 'Shift Esq.', ShiftRight: 'Shift Dir.',
  AltLeft: 'Alt Esq.', AltRight: 'Alt Dir.', WheelDown: 'Roda ↓', WheelUp: 'Roda ↑',
};

export function bindingLabel(code: string): string {
  return KEY_LABELS[code] ?? code.replace(/^(Key|Digit)/, '').replace(/^Mouse/, 'Mouse ').replace(/^Numpad/, 'Num ');
}

export function actionBindingLabel(bindings: Bindings, id: ActionId): string {
  return effectiveBindings(bindings, id).map(bindingLabel).join(' / ');
}
