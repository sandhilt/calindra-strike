import '@fontsource-variable/inter';
import '@fontsource/fragment-mono';
import './styles.css';
import { KICK_CLOSE_CODE, type KickReason, PROTOCOL_VERSION, type ServerMsg } from '@calindra-strike/shared';
import { loadBrand } from './brand.ts';
import { KONAMI_CODE, sequenceMatcher } from './easter-egg.ts';
import { SERVER_HTTP, SERVER_WS } from './config.ts';
import { viewerRequest, type ViewerRequest } from './debug/weapon-debug.ts';
import { ClientGame, type Welcome } from './game/client.ts';
import { Connection } from './game/net.ts';
import { type Settings, loadSettings } from './settings.ts';
import { h } from './ui/dom.ts';
import { renderLobby } from './ui/lobby.ts';
import { Overlays } from './ui/overlays.ts';

const app = document.getElementById('app') as HTMLElement;
const settings = loadSettings();
let spectating = false;
try { spectating = sessionStorage.getItem('calindra-strike:spectate') === 'true'; } catch {}
let stopLobby: (() => void) | null = null;

const TOKEN_KEY = 'calindra-strike:token';
/** Rejoin token lives in this tab only: a refresh or a dropped connection gets your score back. */
const token = {
  get(): string {
    try {
      return sessionStorage.getItem(TOKEN_KEY) ?? '';
    } catch {
      return '';
    }
  },
  set(v: string): void {
    try {
      sessionStorage.setItem(TOKEN_KEY, v);
    } catch {
      /* private mode: no rejoin, nothing else breaks */
    }
  },
};

class Rejected extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

function lobby(error = '', benchmark = false): void {
  stopLobby?.();
  stopLobby = renderLobby(app, settings, error, (s, spectate) => void play(s, spectate), benchmark);
}

/** The Konami code on the lobby opens the weapon viewer. */
const konami = sequenceMatcher(KONAMI_CODE);
document.addEventListener('keydown', (e) => {
  const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
  if (!stopLobby || typing || document.querySelector('.benchmark-overlay[open]') || !konami(e.code)) return;
  void openDebug();
});

async function openDebug(request?: ViewerRequest): Promise<void> {
  stopLobby?.();
  stopLobby = null;
  const title = document.title;
  try {
    const { openWeaponViewer } = await import('./debug/weapon-viewer.ts');
    openWeaponViewer(app, settings, () => {
      if (request) document.title = title;
      lobby();
    }, request);
  } catch {
    if (request) document.title = 'viewer:error';
    lobby('Não foi possível abrir o modo debug.');
  }
}

function waitWelcome(net: Connection, ms: number): Promise<Welcome> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(new Error('O servidor não respondeu.'));
    }, ms);
    const off = net.onMessage((m: ServerMsg) => {
      if (m.t === 'welcome') {
        clearTimeout(timer);
        off();
        resolve(m);
      } else if (m.t === 'reject') {
        clearTimeout(timer);
        off();
        reject(new Rejected(m.reason, m.code ?? ''));
      }
    });
    net.onClose(() => {
      clearTimeout(timer);
      reject(new Error('Conexão recusada pelo servidor.'));
    });
  });
}

async function serverProtocol(): Promise<number | null> {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${SERVER_HTTP}/status`, { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(to);
    if (!res.ok) return null;
    const j = (await res.json()) as { protocol?: unknown };
    return typeof j.protocol === 'number' ? j.protocol : null;
  } catch {
    return null;
  }
}

async function connect(s: Settings, spectate: boolean): Promise<{ net: Connection; welcome: Welcome }> {
  const net = new Connection(SERVER_WS);
  try {
    await Promise.all([net.opened(), loadBrand()]);
    net.send({ t: 'hello', v: PROTOCOL_VERSION, name: s.name, color: s.color, primary: s.primary, code: s.code, spectate, token: spectate ? undefined : token.get() });
    const welcome = await waitWelcome(net, 8000);
    if (!spectate) token.set(welcome.token);
    return { net, welcome };
  } catch (e) {
    net.close();
    throw e;
  }
}

/** Remembers the role in this tab so a reload comes back the same way. */
function setSpectating(value: boolean): void {
  spectating = value;
  try { sessionStorage.setItem('calindra-strike:spectate', String(value)); } catch {}
}

async function play(s: Settings, spectate: boolean): Promise<void> {
  setSpectating(spectate);
  try {
    const { net, welcome } = await connect(s, spectate);
    stopLobby?.();
    stopLobby = null;
    start(net, s, welcome);
  } catch (e) {
    if (e instanceof Rejected && e.code === 'version') {
      const proto = await serverProtocol();
      if (proto !== null && proto > PROTOCOL_VERSION) {
        location.reload(); // the site has a newer build than this tab
        return;
      }
      lobby('O servidor está sendo atualizado. Tente de novo em alguns segundos.');
      return;
    }
    lobby(e instanceof Error ? e.message : 'Falha ao conectar.');
  }
}

const KICKED = new Map<string, string>([
  ['afk', 'Você não deu pronto a tempo e voltou para a tela inicial.'],
  ['podium', 'A partida acabou antes de você dar pronto.'],
  ['idle', 'Você ficou parado tempo demais e voltou para a tela inicial.'],
] satisfies [KickReason, string][]);

/** Close codes worth retrying: server restart (deploy), network drop, going away, server error. */
const TRANSIENT = new Set([1001, 1006, 1011, 1012]);

function start(net: Connection, s: Settings, welcome: Welcome): void {
  const root = h('div', { class: 'game' });
  app.replaceChildren(root);
  let game: ClientGame | null = null;
  let stopped = false;
  const exit = (benchmark: boolean) => {
    stopped = true;
    game?.dispose();
    game = null;
    lobby('', benchmark);
  };
  const leave = () => exit(false);

  /** Drops the player slot and rejoins the same match as a watcher. */
  const spectate = () => {
    stopped = true;
    game?.dispose();
    game = null;
    overlays.reconnecting('Entrando como espectador…');
    void play(s, true);
  };

  let joining = false;
  /**
   * Spectator to player. The new connection is opened beside the spectator one, so a full
   * server leaves the spectator view untouched instead of dropping to the lobby.
   */
  const join = async () => {
    if (joining || stopped) return;
    joining = true;
    game?.hud.info('Entrando no jogo…', '#a5fa00');
    try {
      const next = await connect(s, false);
      if (stopped) {
        next.net.close();
        return;
      }
      setSpectating(false);
      stopped = true;
      game?.dispose();
      game = null;
      start(next.net, s, next.welcome);
    } catch (e) {
      const full = e instanceof Rejected && e.code === 'full';
      game?.hud.info(full ? 'Servidor cheio: continue assistindo e tente de novo' : 'Não deu para entrar no jogo agora', '#ffd54f');
    } finally {
      joining = false;
    }
  };

  const reconnect = async () => {
    for (let attempt = 1; attempt <= 60 && !stopped; attempt++) {
      overlays.reconnecting(attempt === 1 ? 'A conexão com o servidor caiu. Voltando…' : `Tentativa ${attempt}…`, leave);
      await new Promise((r) => setTimeout(r, Math.min(4000, 350 * attempt)));
      if (stopped) return;
      const proto = await serverProtocol();
      if (proto === null) continue; // server still restarting
      if (proto > PROTOCOL_VERSION) {
        overlays.reconnecting('Nova versão do jogo: atualizando a página…');
        location.reload();
        return;
      }
      if (proto < PROTOCOL_VERSION) {
        overlays.reconnecting('O servidor está sendo atualizado…', leave);
        continue;
      }
      try {
        const next = await connect(s, spectating);
        if (stopped) {
          next.net.close();
          return;
        }
        // This closure is superseded: a join still in flight must not install a second game.
        stopped = true;
        game?.dispose();
        game = null;
        start(next.net, s, next.welcome);
        return;
      } catch {
        /* keep trying */
      }
    }
    if (!stopped) overlays.disconnected('Não foi possível reconectar ao servidor.', leave);
  };

  const overlays = new Overlays(root, s, {
    join: () => void join(),
    resume: () => void game?.requestPlay(),
    leave,
    benchmark: () => exit(true),
    spectate,
    settingsChanged: (ns) => game?.applySettings(ns),
    switchTeam: () => {
      game?.switchTeam();
      void game?.requestPlay();
    },
    vote: (i) => game?.vote(i),
  });
  if (import.meta.env.DEV) (window as unknown as { __overlays: Overlays }).__overlays = overlays;
  game = new ClientGame(root, net, s, welcome, {
    joinGame: () => void join(),
    showClickToPlay: (v) => overlays.showClick(v),
    showMenu: (v, panel) => overlays.showMenu(v, panel ?? game?.teamPanel() ?? null),
    showPodium: (r, next) => overlays.showPodium(r, next),
    updateVotes: (counts, mine) => overlays.updateVotes(counts, mine),
    updatePodiumCountdown: (sec) => overlays.podiumCountdown(sec),
    updateReadyCountdown: (sec) => overlays.readyCountdown(sec),
    disconnected: (reason, code) => {
      if (code === KICK_CLOSE_CODE) {
        stopped = true;
        game?.dispose();
        game = null;
        lobby(KICKED.get(reason) ?? 'Você foi removido da partida.');
      } else if (TRANSIENT.has(code)) void reconnect();
      else overlays.disconnected(reason, leave);
    },
  });
}

if (new URLSearchParams(location.search).has('benchmark')) {
  void import('./benchmark/harness.ts').then(({ runBenchmarkHarness }) => runBenchmarkHarness(app)).catch((error: unknown) => {
    document.title = 'benchmark:error';
    app.textContent = 'Não foi possível medir o desempenho neste navegador.';
    console.error('[benchmark]', error);
  });
} else {
  void loadBrand();
  const request = viewerRequest(location.search);
  if (request) void openDebug(request);
  else lobby();
}
