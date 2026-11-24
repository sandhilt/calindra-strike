import { type GameMode, MODE_LABEL, isTeamMode, PLAYER_COLORS, sanitizeName } from '@calindra-strike/shared';
import { SERVER_HTTP } from '../config.ts';
import { QUALITY_OPTIONS } from '../game/render/quality.ts';
import { type Settings, saveSettings } from '../settings.ts';
import { GITHUB_URL } from '../feedback.ts';
import { controlsList } from './controls.ts';
import { ICONS, eitriLogo, gameLogo, h, svg } from './dom.ts';

interface Status {
  players: number;
  maxPlayers: number;
  map: string;
  phase: string;
  endsInMs: number | null;
  leaders: { name: string; kills: number }[];
  codeRequired: boolean;
  mode?: GameMode;
  modes?: GameMode[];
  bots?: number;
  teams?: number[] | null;
}

/** The lobby has no login, so password managers must not offer to fill its fields: Bitwarden, LastPass and 1Password each read their own opt-out. */
const NO_PASSWORD_MANAGER = { 'data-bwignore': 'true', 'data-lpignore': 'true', 'data-1p-ignore': 'true' } as const;

function fmt(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** `benchmark` opens the graphics test as soon as the lobby is up (the pause menu leaves the match to run it). */
export function renderLobby(app: HTMLElement, settings: Settings, error: string, onPlay: (s: Settings, spectate: boolean) => void, benchmark = false): () => void {
  let status: Status | null = null;
  let disposed = false;
  let closeBenchmark: (() => void) | undefined;

  const cover = h('div', { class: 'lobby-cover', 'aria-hidden': 'true' });
  const dot = h('span', { class: 'dot' });
  const sTitle = h('div', { class: 'title', text: 'Procurando servidor…' });
  const sSub = h('div', { class: 'sub', text: 'arena da Calindra' });
  const sCount = h('div', { class: 'count', text: '' });
  const server = h('div', { class: 'server' }, [h('div', { class: 'info' }, [dot, h('div', { style: 'min-width:0' }, [sTitle, sSub])]), sCount]);
  const leaders = h('div', { class: 'leaders' });

  const nameInput = h('input', {
    class: 'input',
    id: 'nick',
    name: 'nickname',
    maxlength: 16,
    placeholder: 'seu apelido',
    autocomplete: 'nickname',
    spellcheck: 'false',
    ...NO_PASSWORD_MANAGER,
    value: settings.name,
  });

  const swatches = h('div', { class: 'swatches', role: 'group', 'aria-label': 'Cor do jogador' });
  const drawSwatches = () => {
    swatches.replaceChildren(
      ...PLAYER_COLORS.map((c, i) =>
        h('button', {
          class: 'swatch',
          type: 'button',
          style: `background:${c}`,
          'aria-label': `Cor ${i + 1}`,
          'aria-pressed': String(settings.color === i),
          onclick: () => {
            settings.color = i;
            drawSwatches();
          },
        }),
      ),
    );
  };
  drawSwatches();

  const graphics = h('div', { class: 'seg', role: 'group', 'aria-label': 'Gráficos' });
  const drawGraphics = () => {
    graphics.replaceChildren(
      ...QUALITY_OPTIONS.map((o) =>
        h('button', {
          type: 'button',
          'aria-pressed': String(settings.quality === o.v),
          text: o.label,
          onclick: () => {
            settings.quality = o.v;
            saveSettings(settings);
            drawGraphics();
          },
        }),
      ),
    );
  };
  drawGraphics();
  const benchmarkError = h('p', { class: 'form-error', role: 'alert' });
  const startBenchmark = async () => {
    benchmarkButton.disabled = true;
    benchmarkError.textContent = '';
    try {
      const { openBenchmark } = await import('../benchmark/overlay.ts');
      if (disposed) return;
      closeBenchmark = openBenchmark((tier) => {
        settings.quality = tier;
        saveSettings(settings);
        drawGraphics();
      });
    } catch {
      benchmarkError.textContent = 'Não foi possível abrir o teste de desempenho.';
    } finally {
      benchmarkButton.disabled = false;
    }
  };
  const benchmarkButton = h('button', {
    class: 'btn benchmark-launch', type: 'button', title: 'Mede cada nível de gráficos neste PC e recomenda o melhor', onclick: () => void startBenchmark(),
  }, [svg(ICONS.gauge), 'testar desempenho']);

  const codeInput = h('input', { class: 'input', name: 'office-code', maxlength: 64, placeholder: 'código do escritório', autocomplete: 'off', ...NO_PASSWORD_MANAGER, value: settings.code });
  const codeField = h('div', { class: 'field hidden' }, [h('label', { class: 'label', text: 'código de acesso' }), codeInput]);

  const err = h('p', { class: 'form-error', role: 'alert', text: error });
  const play = h('button', { class: 'btn btn-primary play', type: 'submit', text: 'jogar agora' });

  const watch = h('button', { class: 'btn', type: 'submit', text: 'só assistir' });
  const footnote = h('p', { class: 'footnote', text: 'Partidas de 5 min · quem fizer mais kills sobe no pódio' });
  const form = h('form', { class: 'card', novalidate: true }, [
    server,
    h('div', { class: 'field' }, [h('label', { class: 'label', for: 'nick', text: 'apelido' }), nameInput]),
    h('div', { class: 'field' }, [h('span', { class: 'label', text: 'sua cor' }), swatches]),
    h('div', { class: 'field' }, [
      h('span', { class: 'label', text: 'gráficos' }),
      h('div', { class: 'lobby-graphics' }, [graphics, benchmarkButton]),
      benchmarkError,
      h('p', { class: 'field-hint', text: 'PC fraco ou jogo travando? Use desempenho: a tela inteira com menos detalhes.' }),
    ]),
    codeField,
    h('div', { class: 'join-actions' }, [play, watch]),
    err,
    leaders,
    h('p', { class: 'mobile-note', text: 'Calindra Strike precisa de mouse e teclado. Abra no computador.' }),
    footnote,
  ]);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = sanitizeName(nameInput.value);
    if (!name) {
      err.textContent = 'Escolha um apelido (letras e números).';
      nameInput.focus();
      return;
    }
    if (status?.codeRequired && !codeInput.value.trim()) {
      err.textContent = 'Este servidor pede o código do escritório.';
      codeInput.focus();
      return;
    }
    settings.name = name;
    settings.code = codeInput.value.trim();
    saveSettings(settings);
    play.disabled = true;
    watch.disabled = true;
    play.textContent = 'conectando…';
    onPlay(settings, e.submitter === watch);
  });

  const controlsButton = h('button', { class: 'btn controls-open', type: 'button', title: 'Ver e trocar as teclas do jogo', onclick: () => showControls(true) }, [svg(ICONS.controls), 'controles']);
  const controlsBack = h('button', { class: 'btn controls-back', type: 'button', text: 'voltar', onclick: () => showControls(false) });
  const controlsView = h('section', { class: 'lobby-controls', hidden: true, 'aria-label': 'Controles' }, [
    h('header', {}, [
      h('h2', { text: 'controles' }),
      h('p', { class: 'sub', text: 'Clique numa tecla para trocar. O menu do jogo (Esc) mostra a mesma lista.' }),
      controlsBack,
    ]),
    controlsList(settings.bindings, (bindings) => {
      settings.bindings = bindings;
      saveSettings(settings);
    }),
  ]);
  controlsView.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    e.preventDefault();
    showControls(false);
  });

  const modeChipText = h('span', { text: 'TDM · todos contra todos' });
  const hero = h('section', { class: 'hero' }, [
    h('div', { class: 'top' }, [
      gameLogo('game-logo hero-logo'),
      h('div', { class: 'lockup' }, [
        h('span', { class: 'label', text: 'arena do escritório' }),
        h('span', { class: 'powered' }, [eitriLogo(), 'calindra × eitri']),
      ]),
    ]),
    h('h1', { class: 'wordmark' }, ['calindra', h('br'), h('em', { text: 'strike' })]),
    h('p', { class: 'tagline' }, [
      'Tiro tático com alma de ',
      h('strong', { text: 'CS 1.6' }),
      ', direto no navegador. Salte do céu, pouse onde quiser e ',
      h('strong', { text: 'dispute o pódio' }),
      ' com o time.',
    ]),
    h('div', { class: 'features' }, [
      h('span', { class: 'chip' }, [svg(ICONS.users), modeChipText]),
      h('span', { class: 'chip' }, [svg(ICONS.scope), 'AWP no airdrop']),
      h('span', { class: 'chip' }, [svg(ICONS.podium), 'Pódio dos 3 melhores']),
      h('span', { class: 'chip' }, [svg(ICONS.jump), 'Bunny hop liberado']),
    ]),
    h('div', { class: 'hero-links' }, [
      controlsButton,
      h('a', { class: 'github-link', href: GITHUB_URL, target: '_blank', rel: 'noopener noreferrer', title: 'Ver o código no GitHub', 'aria-label': 'Código do jogo no GitHub' }, [svg(ICONS.github)]),
    ]),
  ]);

  const showControls = (open: boolean) => {
    hero.hidden = open;
    form.hidden = open;
    controlsView.hidden = !open;
    lobby.scrollTop = 0;
    (open ? controlsBack : controlsButton).focus();
  };

  const lobby = h('div', { class: 'lobby' }, [cover, h('div', { class: 'lobby-inner' }, [hero, form, controlsView])]);
  app.replaceChildren(lobby);
  if (!settings.name) nameInput.focus();

  const poll = async () => {
    if (document.hidden) return;
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`${SERVER_HTTP}/status`, { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(to);
      if (!res.ok) throw new Error(String(res.status));
      status = (await res.json()) as Status;
    } catch {
      status = null;
    }
    if (disposed) return;
    server.classList.toggle('online', !!status);
    server.classList.toggle('offline', !status);
    if (!status) {
      sTitle.textContent = 'Servidor offline';
      sSub.textContent = 'tente de novo em instantes';
      sCount.textContent = '';
      leaders.replaceChildren();
      return;
    }
    const enabledModes: GameMode[] = status.modes?.length ? status.modes : ['tdm', 'ffa'];
    modeChipText.textContent = enabledModes.map((mode) => MODE_LABEL[mode]).join(' · ');
    footnote.textContent = 'Partidas de 5 min · quem fizer mais kills sobe no pódio';
    const label = MODE_LABEL[status.mode ?? 'ffa'] ?? 'todos contra todos';
    const mode = isTeamMode(status.mode ?? 'ffa') && status.teams ? `${label} ${status.teams[0]}×${status.teams[1]}` : label;
    const phase =
      status.phase === 'live' && status.endsInMs !== null
        ? `${status.map} · ${mode} · ${fmt(status.endsInMs)}`
        : status.phase === 'podium'
          ? `${status.map} · pódio`
          : `${status.map} · ${mode} · aquecimento`;
    sTitle.textContent = status.players > 0 ? 'Partida rolando' : 'Arena vazia: chegue primeiro';
    sSub.textContent = phase;
    sCount.textContent = `${status.players}/${status.maxPlayers} online${status.bots ? ` · ${status.bots} bots` : ''}`;
    codeField.classList.toggle('hidden', !status.codeRequired);
    leaders.replaceChildren(
      ...status.leaders
        .filter((l) => l.kills > 0)
        .map((l, i) => h('span', { class: 'chip' }, [`${['🥇', '🥈', '🥉'][i]} `, l.name, ` · ${l.kills}`])),
    );
  };
  void poll();
  const iv = setInterval(() => void poll(), 5000);
  if (benchmark) void startBenchmark();

  return () => {
    disposed = true;
    closeBenchmark?.();
    clearInterval(iv);
  };
}
