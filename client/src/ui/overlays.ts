import { browserEngine } from '../game/speech.ts';
import { checkRow, choiceRow, controlsList, rangeRow, withIcon } from './controls.ts';
import { FIRST_MENU_TAB, MENU_TAB_IDS, type MenuTabId, menuTabForKey } from './menu-tabs.ts';
import { QUALITY_OPTIONS } from '../game/render/quality.ts';
import { RT_OPTIONS } from '../game/render/rt-levels.ts';
import { SOUND_PACKS } from '../game/sound-packs/index.ts';
import { MODE_LABEL, PRIMARY_CHOICES, isTeamMode, TEAMS, WEAPON, type VoteInfo, type WeaponId, getMap, weaponDef } from '@calindra-strike/shared';
import type { PodiumData, TeamPanel } from '../game/client.ts';
import { CROSSHAIR_COLORS, type Settings, saveSettings } from '../settings.ts';
import { isReadyKey, weaponMenuKey } from '../game/weapon-menu.ts';
import { ICONS, type IconName, gameLogo, h, svg } from './dom.ts';

const WEAPON_INFO: Record<number, { icon: string; blurb: string }> = {
  [WEAPON.RIFLE]: { icon: ICONS.rifle, blurb: '1 tiro na cabeça. Spray que sobe.' },
  [WEAPON.SMG]: { icon: ICONS.smg, blurb: 'Rápida e precisa correndo.' },
  [WEAPON.SHOTGUN]: { icon: ICONS.shotgun, blurb: 'Rainha do corpo a corpo.' },
};

export interface OverlayHooks {
  join(): void;
  resume(): void;
  leave(): void;
  /** Leaves the match and opens the graphics test in the lobby: running it beside a live match would measure both. */
  benchmark(): void;
  spectate(): void;
  switchTeam(): void;
  vote(option: number): void;
  settingsChanged(s: Settings): void;
}

type OptionList<T> = readonly { v: T; label: string; style?: string }[];

/** The row builders a tab page uses, already wired to save and announce a change. */
interface MenuRows {
  slider(icon: IconName, label: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt: (v: number) => string): HTMLElement;
  seg<T>(icon: IconName, label: string, options: OptionList<T>, get: () => T, set: (v: T) => void, hint?: string): HTMLElement;
  toggle(icon: IconName, label: string, text: string, get: () => boolean, set: (v: boolean) => void, available?: boolean): HTMLElement;
  readonly canSpeak: boolean;
  benchmark(): void;
}

interface MenuTab {
  readonly label: string;
  readonly icon: IconName;
  readonly build: (s: Settings, rows: MenuRows) => HTMLElement;
}

/** The pause menu's pages: a page is one row here. Tab order comes from `MENU_TAB_IDS`. */
const MENU_TABS: Record<MenuTabId, MenuTab> = {
  game: {
    label: 'jogo',
    icon: 'game',
    build: (s, r) =>
      h('div', { class: 'menu-rows' }, [
        h('div', { class: 'primary-settings' }, [
          r.seg(
            'gun',
            'arma principal',
            PRIMARY_CHOICES.map((id: WeaponId) => ({ v: id, label: weaponDef(id).name })),
            () => s.primary,
            (v) => (s.primary = v),
            'vale a partir do próximo salto',
          ),
          r.seg(
            'swap',
            'lado da arma',
            [
              { v: false, label: 'direita' },
              { v: true, label: 'esquerda' },
            ],
            () => s.leftHanded,
            (v) => (s.leftHanded = v),
          ),
        ]),
        r.slider('eye', 'campo de visão', 75, 110, 1, () => s.fov, (v) => (s.fov = v), (v) => `${v}°`),
        r.slider('mouse', 'sensibilidade', 0.3, 8, 0.05, () => s.sensitivity, (v) => (s.sensitivity = v), (v) => v.toFixed(2)),
      ]),
  },
  audio: {
    label: 'áudio',
    icon: 'audio',
    build: (s, r) =>
      h('div', { class: 'menu-rows' }, [
        r.slider('audio', 'volume', 0, 1, 0.05, () => s.volume, (v) => (s.volume = v), (v) => `${Math.round(v * 100)}%`),
        r.seg('music', 'pacote de sons', SOUND_PACKS.map((p) => ({ v: p.id, label: p.label })), () => s.soundPack, (v) => (s.soundPack = v)),
        r.toggle('mic', 'anunciador', 'voz nas sequências de kills', () => s.announcer, (v) => (s.announcer = v), r.canSpeak),
        r.toggle('radio', 'voz do rádio', 'fala o rádio do seu time em voz alta', () => s.radioVoice, (v) => (s.radioVoice = v), r.canSpeak),
      ]),
  },
  video: {
    label: 'vídeo',
    icon: 'video',
    build: (s, r) =>
      h('div', { class: 'menu-rows' }, [
        r.seg('video', 'gráficos', QUALITY_OPTIONS, () => s.quality, (v) => (s.quality = v), 'bordas suaves aplicam ao reentrar'),
        r.seg('sun', 'ray tracing', RT_OPTIONS, () => s.lightRt, (v) => (s.lightRt = v), 'luz e sombra de contato, só no gráfico alta; mais alto pesa mais na placa de vídeo'),
        r.seg(
          'activity',
          'estatísticas',
          [
            { v: false, label: 'ocultas' },
            { v: true, label: 'fps + ping' },
          ],
          () => s.showNet,
          (v) => (s.showNet = v),
        ),
        h('button', { class: 'btn benchmark-launch', type: 'button', title: 'Sai da partida e mede cada nível de gráficos neste PC', onclick: () => r.benchmark() }, [svg(ICONS.gauge), 'testar desempenho']),
      ]),
  },
  aim: {
    label: 'mira',
    icon: 'target',
    build: (s, r) =>
      h('div', { class: 'menu-rows' }, [
        r.slider('expand', 'tamanho', 2, 14, 1, () => s.crosshairSize, (v) => (s.crosshairSize = v), (v) => `${v}px`),
        r.slider('crosshair', 'abertura', 0, 10, 1, () => s.crosshairGap, (v) => (s.crosshairGap = v), (v) => `${v}px`),
        r.seg(
          'palette',
          'cor',
          CROSSHAIR_COLORS.map((c) => ({ v: c, label: '●', style: `color:${c}` })),
          () => s.crosshairColor,
          (v) => (s.crosshairColor = v),
        ),
        r.seg(
          'sliders',
          'comportamento',
          [
            { v: true, label: 'dinâmica' },
            { v: false, label: 'fixa' },
          ],
          () => s.dynamicCrosshair,
          (v) => (s.dynamicCrosshair = v),
        ),
      ]),
  },
  controls: {
    label: 'controles',
    icon: 'controls',
    build: () => controlsList(),
  },
};

/** The tab the menu was last left on, kept for the page session so reopening the menu returns to it. */
let lastMenuTab: MenuTabId = FIRST_MENU_TAB;

/** Click-to-play, pause/settings menu, podium results and disconnect overlays. */
export class Overlays {
  private readonly click: HTMLElement;
  private readonly weaponRows = new Map<WeaponId, HTMLButtonElement>();
  private readonly menu: HTMLElement;
  private readonly podium: HTMLElement;
  private readonly podiumCards = h('div', { class: 'podium-cards' });
  private readonly finalRows = h('tbody');
  private readonly finalCount = h('span', { class: 'label' });
  private readonly finalScroll = h('div', { class: 'final-scroll', tabindex: 0, 'aria-label': 'Resultados de todos os jogadores' }, [
    h('table', {}, [
      h('caption', { class: 'sr-only', text: 'Placar completo da partida' }),
      h('thead', {}, [h('tr', {}, ['#', 'jogador', 'kills', 'mortes', 'hs'].map((text) => h('th', { scope: 'col', text })))]),
      this.finalRows,
    ]),
  ]);
  private readonly finalScoreboard = h('section', { class: 'final-scoreboard glass', 'aria-label': 'Placar final' }, [
    h('header', {}, [h('h3', { text: 'placar completo' }), this.finalCount]),
    this.finalScroll,
  ]);
  private readonly podiumNext = h('div', { class: 'podium-next' });
  private readonly voteBox = h('div', { class: 'vote glass hidden' });
  private vote: VoteInfo | null = null;
  private reconnectEl: HTMLElement | null = null;
  private readonly podiumLabel = h('div', { class: 'label', text: 'fim de partida' });
  private readonly podiumTitle = h('h2', { text: 'pódio' });
  private readonly podiumScore = h('div', { class: 'podium-score hidden' });
  private readonly menuTabs = new Map<MenuTabId, HTMLButtonElement>();
  private readonly menuBody = h('div', { class: 'menu-body' });
  private readonly menuPanels = new Map<MenuTabId, HTMLElement>();
  private readonly teamRow = h('div', { class: 'team-switch hidden' });
  private readonly menuTitle = h('h2', { text: 'pausado' });
  private nextMap = '';
  private lastSeconds = -1;
  private readonly readyCountdownEl = h('p', { class: 'ready-countdown hidden' });

  constructor(
    private readonly root: HTMLElement,
    private readonly settings: Settings,
    private readonly hooks: OverlayHooks,
  ) {
    PRIMARY_CHOICES.forEach((id, i) => {
      const { icon, blurb } = WEAPON_INFO[id];
      const row = h('button', { class: 'cs-row', type: 'button', onclick: () => this.pickPrimary(id) }, [
        h('span', { class: 'cs-key', text: `${i + 1}.` }),
        h('span', { class: 'cs-name', text: weaponDef(id).name }),
        h('small', { text: blurb }),
        svg(icon),
      ]);
      this.weaponRows.set(id, row);
    });
    this.renderPrimaryChoice();
    const play = h('button', { class: 'cs-row cs-ready', type: 'button', title: 'Enter ou espaço também confirmam', 'aria-label': 'jogar (enter)', onclick: () => hooks.resume() }, [
      h('span', { class: 'cs-key', 'aria-hidden': 'true', text: '↵' }),
      h('span', { class: 'cs-name', text: 'Jogar' }),
      h('small', { text: 'entra na partida' }),
    ]);
    const weapons = h('div', { class: 'cs-menu', role: 'group', 'aria-label': 'Arma principal' }, [
      h('div', { class: 'cs-title', text: 'Escolha sua arma' }),
      ...this.weaponRows.values(),
      play,
      h('div', { class: 'cs-foot', text: 'Aperte o número ou clique' }),
    ]);
    this.click = h('div', { class: 'overlay' }, [
      h('div', { class: 'click-to-play' }, [
        gameLogo('game-logo cta-logo'),
        h('h2', { class: 'wordmark', text: 'pronto?' }),
        h('p', { text: 'Planeje a queda com WASD e dispute o pódio com mais kills.' }),
        weapons,
        this.readyCountdownEl,
        h('p', { class: 'label', text: 'esc solta o mouse · tab mostra o placar' }),
      ]),
    ]);
    this.menu = h('div', { class: 'overlay hidden' }, [this.buildMenu()]);
    this.podium = h('div', { class: 'podium-ui hidden' }, [
      h('div', { class: 'head' }, [gameLogo('game-logo podium-logo'), this.podiumLabel, this.podiumTitle, this.podiumScore]),
      h('div', {}, [this.podiumCards, this.podiumNext]),
      this.voteBox,
      this.finalScoreboard,
    ]);
    root.append(this.podium, this.click, this.menu);
  }

  private buildMenu(): HTMLElement {
    const s = this.settings;
    const changed = () => {
      saveSettings(s);
      this.hooks.settingsChanged(s);
    };
    const rows: MenuRows = {
      slider: (icon, label, min, max, step, get, set, fmt) => withIcon(icon, rangeRow(label, { min, max, step }, get, set, fmt, changed)),
      seg: (icon, label, options, get, set, hint) => withIcon(icon, choiceRow(label, options, get, set, changed, hint)),
      toggle: (icon, label, text, get, set, available = true) =>
        withIcon(icon, checkRow(label, text, get, set, changed, available ? undefined : 'este navegador não tem voz sintetizada')),
      canSpeak: browserEngine() !== null,
      benchmark: () => this.hooks.benchmark(),
    };

    for (const id of MENU_TAB_IDS) {
      const { label, icon, build } = MENU_TABS[id];
      const tab = h('button', { class: 'menu-tab', type: 'button', role: 'tab', id: `menu-tab-${id}`, 'aria-controls': `menu-panel-${id}`, onclick: () => this.selectMenuTab(id) }, [svg(ICONS[icon]), label]);
      this.menuTabs.set(id, tab);
      const page = build(s, rows);
      // A page with nothing to focus (the key list) is itself a stop, so the keyboard can scroll it.
      const readOnly = page.querySelector('button, input, a') === null;
      this.menuPanels.set(id, h('div', { class: 'menu-panel', role: 'tabpanel', id: `menu-panel-${id}`, 'aria-labelledby': `menu-tab-${id}`, tabindex: readOnly ? 0 : undefined }, [page]));
    }
    const tabList = h('div', { class: 'menu-tabs', role: 'tablist', 'aria-label': 'Configurações' }, [...this.menuTabs.values()]);
    tabList.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const next = menuTabForKey(e.key, lastMenuTab);
      if (next === null) return;
      e.preventDefault();
      e.stopPropagation();
      this.selectMenuTab(next);
      this.menuTabs.get(next)?.focus();
    });
    this.menuBody.append(...this.menuPanels.values());
    this.selectMenuTab(lastMenuTab);

    return h('div', { class: 'menu glass' }, [
      h('header', { class: 'menu-head' }, [h('div', {}, [this.menuTitle, h('p', { class: 'sub', text: 'O jogo continua rolando para os outros: volte logo.' })]), this.teamRow]),
      tabList,
      this.menuBody,
      h('div', { class: 'actions' }, [
        h('button', { class: 'btn btn-primary', type: 'button', text: 'voltar ao jogo', onclick: () => this.hooks.resume() }),
        h('button', { class: 'btn join-action', type: 'button', text: 'entrar no jogo', title: 'Entra na partida como jogador (J)', onclick: () => this.hooks.join() }),
        h('button', { class: 'btn spectate-action', type: 'button', text: 'assistir', title: 'Sai do jogo e entra só olhando', onclick: () => this.hooks.spectate() }),
        h('button', { class: 'btn', type: 'button', text: 'sair da partida', onclick: () => this.hooks.leave() }),
      ]),
    ]);
  }

  /** One tab is selected at a time. The others stay built but hidden and out of the tab order, so their rows keep their state. */
  private selectMenuTab(id: MenuTabId): void {
    lastMenuTab = id;
    this.menuBody.scrollTop = 0;
    for (const [tabId, tab] of this.menuTabs) {
      const selected = tabId === id;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      const panel = this.menuPanels.get(tabId);
      if (!panel) continue;
      panel.classList.toggle('active', selected);
      panel.inert = !selected;
    }
  }

  private pickPrimary(id: WeaponId): void {
    this.settings.primary = id;
    saveSettings(this.settings);
    this.hooks.settingsChanged(this.settings);
    this.renderPrimaryChoice();
  }

  private renderPrimaryChoice(): void {
    for (const [id, row] of this.weaponRows) {
      row.setAttribute('aria-pressed', String(this.settings.primary === id));
    }
  }

  /** The number keys pick a weapon and Enter or Space confirms while the "pronto?" screen is up. Nothing else sees them, so they cannot act in the world. */
  private readonly onMenuKey = (e: KeyboardEvent): void => {
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    if (isReadyKey(e.code)) {
      e.preventDefault();
      e.stopPropagation();
      this.hooks.resume();
      return;
    }
    const id = weaponMenuKey(e.code);
    if (id === null) return;
    e.preventDefault();
    e.stopPropagation();
    this.pickPrimary(id);
  };

  showClick(v: boolean): void {
    if (v) this.renderPrimaryChoice();
    this.click.classList.toggle('hidden', !v);
    document.removeEventListener('keydown', this.onMenuKey, true);
    if (v) document.addEventListener('keydown', this.onMenuKey, true);
  }

  showMenu(v: boolean, team: TeamPanel | null = null): void {
    this.menu.classList.toggle('hidden', !v);
    if (v) this.click.classList.add('hidden');
    const spectating = team?.kind === 'spectator';
    this.menu.classList.toggle('spectator-menu', spectating);
    this.menuTitle.textContent = spectating ? 'assistindo' : 'pausado';
    if (v) this.renderTeamRow(team);
  }

  /** Spectators pick their team on the HUD bar, so only players get a row here. */
  private renderTeamRow(team: TeamPanel | null): void {
    this.teamRow.classList.toggle('hidden', team?.kind !== 'player');
    if (team?.kind !== 'player') return;
    const otherTeam = team.team === 0 ? 1 : 0;
    const mine = TEAMS[team.team];
    const other = TEAMS[otherTeam];
    this.teamRow.replaceChildren(
      h('div', { class: 'team-current', style: `--team:${mine.color}` }, [h('span', { class: 'label', text: 'seu time' }), h('b', { text: mine.name })]),
      h('button', {
        class: 'btn',
        type: 'button',
        style: `--team:${other.color}`,
        disabled: !team.canSwitch,
        title: team.canSwitch ? '' : 'O outro time já tem a mesma quantidade ou mais jogadores',
        text: team.canSwitch ? `ir para os ${other.name}` : `${other.name}: time cheio`,
        onclick: () => this.hooks.switchTeam(),
      }),
    );
  }

  showPodium(data: PodiumData | null, next: string): void {
    this.podium.classList.toggle('hidden', !data);
    if (!data) return;
    this.vote = data.vote;
    this.updateVotes(data.vote?.counts ?? [], -1);
    this.nextMap = next;
    this.lastSeconds = -1;
    const tdm = isTeamMode(data.mode);
    this.podiumScore.classList.toggle('hidden', !tdm);
    if (tdm) {
      const w = data.winner;
      this.podiumLabel.textContent = w < 0 ? `fim de partida · ${MODE_LABEL[data.mode]}` : w === data.myTeam ? `seu time venceu! · ${MODE_LABEL[data.mode]}` : `não foi dessa vez · ${MODE_LABEL[data.mode]}`;
      this.podiumTitle.textContent = w < 0 ? 'empate' : `${TEAMS[w].name} venceram`;
      this.podiumTitle.style.color = w < 0 ? '' : TEAMS[w].color;
      this.podiumScore.replaceChildren(
        h('span', { style: `color:${TEAMS[0].color}`, text: TEAMS[0].name }),
        h('b', { text: `${data.teams[0] ?? 0} × ${data.teams[1] ?? 0}` }),
        h('span', { style: `color:${TEAMS[1].color}`, text: TEAMS[1].name }),
      );
    } else {
      this.podiumLabel.textContent = 'fim de partida';
      this.podiumTitle.textContent = 'pódio';
      this.podiumTitle.style.color = '';
    }
    const order = [1, 0, 2];
    const cls = ['first', 'second', 'third'];
    const place = tdm && data.winner >= 0 ? ['mvp do time', '2º do time', '3º do time'] : ['1º lugar', '2º lugar', '3º lugar'];
    this.podiumCards.replaceChildren(
      ...order.map((i) => {
        const r = data.featured[i];
        if (!r) return h('div');
        return h('div', { class: `pcard glass ${cls[i]}` }, [
          h('div', { class: 'place', text: place[i] }),
          h('div', { class: 'pname', style: `color:${data.colorFor(r)}`, text: r.name }),
          h('div', { class: 'stats', text: `${r.kills} kills · ${r.deaths} mortes · ${r.hs} hs` }),
        ]);
      }),
    );
    this.finalCount.textContent = `${data.results.length} jogadores`;
    this.finalRows.replaceChildren(
      ...data.results.map((r, i) =>
        h('tr', { class: r.id === data.myId ? 'is-me' : '' }, [
          h('td', { class: 'final-rank', text: String(i + 1) }),
          h('td', { class: 'final-player' }, [
            h('b', { style: `color:${data.colorFor(r)}`, text: r.name }),
            h('small', { text: [tdm && r.team >= 0 ? TEAMS[r.team].name : '', r.bot ? 'bot' : '', r.id === data.myId ? 'você' : ''].filter(Boolean).join(' · ') }),
          ]),
          h('td', { class: 'final-kills', text: String(r.kills) }),
          h('td', { text: String(r.deaths) }),
          h('td', { text: String(r.hs) }),
        ]),
      ),
    );
    this.finalScroll.scrollTop = 0;
  }

  podiumCountdown(seconds: number): void {
    if (seconds === this.lastSeconds) return;
    this.lastSeconds = seconds;
    this.podiumNext.replaceChildren('próxima partida em ', h('b', { text: `${seconds}s` }), this.vote ? ' · vote no próximo mapa (1, 2 ou 3)' : this.nextMap ? ` · ${this.nextMap}` : '');
  }

  readyCountdown(seconds: number | null): void {
    this.readyCountdownEl.classList.toggle('hidden', seconds === null);
    if (seconds === null) return;
    const text = `${seconds}s para dar pronto ou você volta para a tela inicial`;
    if (this.readyCountdownEl.textContent !== text) this.readyCountdownEl.textContent = text;
  }

  /** Map vote panel on the podium. */
  updateVotes(counts: number[], mine: number): void {
    const v = this.vote;
    this.voteBox.classList.toggle('hidden', !v || v.options.length === 0);
    if (!v) return;
    const total = counts.reduce((a, b) => a + b, 0);
    this.voteBox.replaceChildren(
      h('div', { class: 'label', text: 'próxima partida · vote' }),
      ...v.options.map((o, i) => {
        const n = counts[i] ?? 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        return h(
          'button',
          {
            class: `vote-option${i === mine ? ' mine' : ''}`,
            type: 'button',
            'aria-pressed': String(i === mine),
            onclick: () => this.hooks.vote(i),
          },
          [
            h('span', { class: 'kbd', text: String(i + 1) }),
            h('span', { class: 'vote-text' }, [h('b', { text: getMap(o.map).name }), h('small', { text: MODE_LABEL[o.mode] })]),
            h('span', { class: 'vote-count', text: `${n}` }),
            h('i', { class: 'vote-bar', style: `width:${pct}%` }),
          ],
        );
      }),
    );
  }

  /** Small "reconnecting" panel while the client retries on its own. */
  reconnecting(text: string | null, onBack?: () => void): void {
    if (!text) {
      this.reconnectEl?.remove();
      this.reconnectEl = null;
      return;
    }
    if (!this.reconnectEl) {
      this.reconnectEl = h('div', { class: 'overlay' });
      this.root.append(this.reconnectEl);
    }
    this.reconnectEl.replaceChildren(
      h('div', { class: 'toast glass' }, [
        h('div', { class: 'spinner' }),
        h('h3', { text: 'reconectando…' }),
        h('p', { text }),
        onBack ? h('button', { class: 'btn', type: 'button', text: 'voltar ao lobby', onclick: onBack }) : null,
      ]),
    );
  }

  disconnected(reason: string, onBack: () => void): void {
    this.root.append(
      h('div', { class: 'overlay' }, [
        h('div', { class: 'toast glass' }, [
          h('h3', { text: 'desconectado' }),
          h('p', { text: reason }),
          h('button', { class: 'btn btn-primary', type: 'button', text: 'voltar ao lobby', onclick: onBack }),
        ]),
      ]),
    );
  }
}
