/**
 * Radio menus, CS 1.6 style. Each menu opens on a key and holds up to nine numbered lines.
 * The wire only carries a line id; text and speech live here so both sides agree and the
 * server never relays free text through this channel.
 */

interface RadioLineSource {
  /** Shown in the feed and the menu. */
  readonly text: string;
  /** Spelling for the speech synthesizer when the display text reads badly aloud. */
  readonly speech?: string;
}

export const RADIO_MENUS = [
  {
    id: 'comandos',
    key: 'KeyZ',
    keyLabel: 'Z',
    label: 'comandos',
    lines: [
      { text: 'Me cobre!' },
      { text: 'Vai na frente!' },
      { text: 'Segura essa posição!' },
      { text: 'Reagrupar, time!' },
      { text: 'Me segue!' },
      { text: 'Tô tomando tiro!' },
    ],
  },
  {
    id: 'grupo',
    key: 'KeyX',
    keyLabel: 'X',
    label: 'grupo',
    lines: [
      { text: 'Vai, vai, vai!' },
      { text: 'Recua!' },
      { text: 'Fiquem juntos!' },
      { text: 'Tomem posição!' },
      { text: 'Avança pela frente!' },
      { text: 'Reportem!' },
    ],
  },
  {
    id: 'respostas',
    key: 'KeyV',
    keyLabel: 'V',
    label: 'respostas',
    lines: [
      { text: 'Positivo!' },
      { text: 'Inimigo à vista!' },
      { text: 'Preciso de reforço!' },
      { text: 'Setor limpo!' },
      { text: 'Tô em posição!' },
      { text: 'Reportando!' },
      { text: 'Vai explodir!' },
      { text: 'Negativo!' },
      { text: 'Inimigo abatido!' },
    ],
  },
  {
    id: 'calindra',
    key: 'KeyB',
    keyLabel: 'B',
    label: 'Calindra',
    lines: [
      { text: 'Borumbaaa!', speech: 'Borumbá!' },
      { text: 'O cachorro comeu minha branch!' },
      { text: 'Aí é cabeçada!' },
      { text: 'Hoje é quarta-feira, meus bacanos!' },
      { text: 'Eiiiitriiiiii!', speech: 'Êitri!' },
    ],
  },
] as const satisfies readonly {
  id: string;
  key: string;
  keyLabel: string;
  label: string;
  lines: readonly RadioLineSource[];
}[];

export type RadioMenu = (typeof RADIO_MENUS)[number];
export type RadioMenuId = RadioMenu['id'];

export const RADIO_MENU_IDS: readonly RadioMenuId[] = RADIO_MENUS.map((m) => m.id);

export interface RadioLine {
  /** Wire id: menu number (1-based) times ten plus the slot, so Z is 11-16 and B is 41-45. */
  readonly id: number;
  readonly menu: RadioMenuId;
  readonly slot: number;
  readonly text: string;
  readonly speech: string;
}

export const RADIO_LINES: readonly RadioLine[] = RADIO_MENUS.flatMap((menu, menuIndex) =>
  menu.lines.map((line: RadioLineSource, i): RadioLine => ({
    id: (menuIndex + 1) * 10 + i + 1,
    menu: menu.id,
    slot: i + 1,
    text: line.text,
    speech: line.speech ?? line.text,
  })),
);

const LINES_BY_ID: ReadonlyMap<number, RadioLine> = new Map(RADIO_LINES.map((l) => [l.id, l]));

export function radioLine(id: number): RadioLine | undefined {
  return LINES_BY_ID.get(id);
}

export function radioMenuById(id: string): RadioMenu | undefined {
  return RADIO_MENUS.find((m) => m.id === id);
}

/** The line a menu offers on a slot (1-based), or undefined past the end of the menu. */
export function radioLineAt(menu: RadioMenuId, slot: number): RadioLine | undefined {
  return RADIO_LINES.find((l) => l.menu === menu && l.slot === slot);
}
