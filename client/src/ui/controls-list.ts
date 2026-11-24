import { RADIO_MENUS } from '@calindra-strike/shared';
import { type ControlGroup, type Bindings, actionBindingLabel, bindingLabel } from '../game/bindings.ts';
import type { IconName } from './icons.ts';

export const CONTROL_SECTIONS: readonly { id: ControlGroup; icon: IconName }[] = [
  { id: 'movimento', icon: 'move' },
  { id: 'combate', icon: 'gun' },
  { id: 'interface', icon: 'scoreboard' },
];

export function controlRows(bindings: Bindings, group: ControlGroup): { keys: string; label: string }[] {
  const crouch = actionBindingLabel(bindings, 'crouch');
  const sprint = actionBindingLabel(bindings, 'sprint');
  if (group === 'movimento') return [
    { keys: `${sprint} + ${crouch}`, label: 'deslizar' },
    { keys: crouch, label: 'deitar (dois toques)' },
  ];
  if (group === 'combate') return [];
  return [
    { keys: 'Esc', label: 'menu / soltar o mouse / cancelar captura (fixo)' },
    { keys: RADIO_MENUS.map((menu) => bindingLabel(menu.key)).join(' '), label: 'abrir o rádio (fixo)' },
    { keys: '1–9 / 0', label: 'escolher / fechar no rádio aberto (fixo)' },
    { keys: 'Enter / Esc', label: 'enviar / fechar no chat aberto (fixo)' },
    { keys: '1–3', label: 'escolher arma em «pronto?» / votar no pódio (fixo)' },
    { keys: 'F1–F3', label: 'votar no próximo mapa nos primeiros minutos da partida (fixo)' },
    { keys: 'Enter / Espaço', label: 'jogar em «pronto?» (fixo)' },
    { keys: '← → / Home / End', label: 'navegar na barra de abas (fixo)' },
    { keys: 'WASD / Shift / E / Q / C', label: 'voar com a câmera livre (fixo)' },
    { keys: 'Espaço / ← → / Mouse 1 / Mouse 2 / 1–2 / J / Tab', label: 'câmera, alvo, equipe, jogar e placar ao assistir (fixo)' },
  ];
}
