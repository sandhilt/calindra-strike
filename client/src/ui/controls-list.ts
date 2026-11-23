import type { IconName } from './icons.ts';

export type ControlSectionId = 'movimento' | 'combate' | 'interface';

export interface ControlSection {
  readonly id: ControlSectionId;
  readonly icon: IconName;
}

export interface ControlRow {
  readonly section: ControlSectionId;
  readonly keys: string;
  readonly label: string;
  readonly icon: IconName;
}

export const CONTROL_SECTIONS: readonly ControlSection[] = [
  { id: 'movimento', icon: 'move' },
  { id: 'combate', icon: 'gun' },
  { id: 'interface', icon: 'scoreboard' },
];

/** The keys shown in the lobby and in the pause menu, so the two never drift apart. */
export const CONTROLS: readonly ControlRow[] = [
  { section: 'movimento', keys: 'WASD', label: 'mover', icon: 'move' },
  { section: 'movimento', keys: 'Espaço', label: 'pular', icon: 'jump' },
  { section: 'movimento', keys: 'Ctrl', label: 'agachar / mergulhar', icon: 'crouch' },
  { section: 'movimento', keys: 'Shift', label: 'correr', icon: 'sprint' },
  { section: 'movimento', keys: 'Shift + Ctrl', label: 'deslizar', icon: 'slide' },
  { section: 'movimento', keys: '← →', label: 'inclinar', icon: 'lean' },
  { section: 'movimento', keys: 'Ctrl Ctrl', label: 'deitar (dois toques) · ↓', icon: 'prone' },
  { section: 'movimento', keys: 'Alt', label: 'andar em silêncio', icon: 'mute' },
  { section: 'combate', keys: '1 2 3', label: 'armas · Q última', icon: 'gun' },
  { section: 'combate', keys: 'R', label: 'recarregar', icon: 'reload' },
  { section: 'combate', keys: 'E', label: 'plantar / desarmar o bug', icon: 'bug' },
  { section: 'combate', keys: 'Mouse 2', label: 'mirar (segurar) · luneta da AWP', icon: 'scope' },
  { section: 'interface', keys: 'Tab', label: 'placar · Y chat', icon: 'scoreboard' },
  { section: 'interface', keys: 'Z X V B', label: 'rádio', icon: 'radio' },
  { section: 'interface', keys: 'Esc', label: 'menu', icon: 'menu' },
];
