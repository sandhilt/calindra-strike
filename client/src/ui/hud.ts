import { BLACK_FRIDAY_DISCOUNT_PERCENT, TEAMS, type RadioMenu } from '@calindra-strike/shared';
import { type ActionId, type Bindings, actionBindingLabel } from '../game/bindings.ts';
import { BLACK_FRIDAY_PITCH, type BombRole, type CarryNotice } from '../game/bomb.ts';
import { CARRAPETA_BANNERS, CARRAPETA_SYMBOL, type CarrapetaBanner } from '../game/carrapeta.ts';
import type { LunchRow } from '../game/lunch.ts';
import { drawLaptop } from '../game/laptop/draw.ts';
import type { BombActivity } from '../game/spectate/activity.ts';
import { CAMERA_MODE_LABEL, type CameraMode } from '../game/spectate/camera.ts';
import type { SpectatorAction } from '../game/spectate/controls.ts';
import type { ScopeOverlay } from '../game/render/ads-view.ts';
import { RULER_STOPS_METERS, rangeLabel, rulerFraction, type RangeReading } from '../game/scope-range.ts';
import type { WeaponIcon } from '../game/render/weapon-icons.ts';
import { ICONS, h, svg } from './dom.ts';
import { STANCE, type Stance } from '@calindra-strike/shared';
import { STANCE_VIEWS, leanTilt } from './stance-view.ts';
import { STAMINA_RESUME_FRACTION, type StaminaLevel, staminaLevel } from './stamina-meter.ts';

export interface VoteRow { key: string; map: string; mode: string; count: number; mine: boolean }
export interface VotePanel { rows: VoteRow[]; secondsLeft: number }

export interface LeaderRow {
  name: string;
  color: string;
  score: number;
  rank: number;
  me: boolean;
}

export interface ScoreRow {
  id: number;
  name: string;
  color: string;
  kills: number;
  points?: number;
  deaths: number;
  hs: number;
  ping: number;
  me: boolean;
  team: number;
  bot: boolean;
}

export interface Marker {
  x: number;
  y: number;
  label: string;
  dist: number;
  offscreen: boolean;
}

export type FeedInvolvement = 'kill' | 'death' | null;

/** What the bug HUD shows this frame; a null text hides the status line. */
export interface BombHud { text: string | null; plant: number; role: BombRole | null; blackFriday: boolean; carry: CarryNotice | null; activity: BombActivity | null }

/** What the always-visible spectator bar shows this frame. */
export interface SpectatorBar {
  target: { name: string; color: string } | null;
  mode: CameraMode;
  /** Team choice in team modes: the watched team (-1 until picked) and the pick countdown while the server waits. */
  teams: { active: number; pickSecondsLeft: number | null } | null;
  pointerLocked: boolean;
}

/** How long the Black Friday banner stays on screen, in ms. */
const BLACK_FRIDAY_BANNER_MS = 4500;

/** How long the lunch round banner stays on screen, in ms. */
const LUNCH_BANNER_MS = 4500;
const RANK_COLORS = ['#ffd23f', '#dfe4ea', '#e8a066'];

export class Hud {
  readonly root = h('div', { class: 'hud' });
  private readonly timerT = h('div', { class: 't', text: '--:--' });
  private readonly timerS = h('div', { class: 's', text: '' });
  private readonly timer = h('div', { class: 'timer glass' }, [this.timerT, this.timerS]);
  private readonly leadersLeft = h('div', { style: 'display:flex;gap:8px' });
  private readonly leadersRight = h('div', { style: 'display:flex;gap:8px' });
  private readonly flagStatus = h('div', { class: 'flag-status glass hidden' });
  private readonly flagBanner = h('div', { class: 'flag-banner glass hidden', text: 'você está com a bandeira, volte à base' });
  private readonly bombRole = h('div', { class: 'bomb-role glass hidden' });
  private readonly bombStatus = h('div', { class: 'bomb-status glass hidden' });
  private readonly blackFridayBanner = h('div', { class: 'black-friday-banner hidden', role: 'alert' }, [
    h('b', { text: 'BLACK FRIDAY' }),
    h('strong', { class: 'black-friday-off', text: `${BLACK_FRIDAY_DISCOUNT_PERCENT}% OFF` }),
    h('span', { text: BLACK_FRIDAY_PITCH }),
  ]);
  private blackFridayTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly lunchBanner = h('div', { class: 'lunch-banner hidden', role: 'alert' });
  private lunchBannerTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly carrapetaBanner = h('div', { class: 'lunch-banner carrapeta-banner hidden', role: 'alert' });
  private carrapetaBannerTimer: ReturnType<typeof setTimeout> | undefined;
  private carrapetaBannerKind: CarrapetaBanner | undefined;
  private queuedCarrapetaTake = false;
  private readonly carrapetaStatus = h('div', { class: 'lunch-followers carrapeta-status glass hidden' });
  private readonly carrapetaAura = h('div', { class: 'carrapeta-aura hidden', 'aria-hidden': 'true' });
  private readonly lunchFollowers = h('div', { class: 'lunch-followers glass hidden', role: 'status' });
  private lunchFollowersText = '';
  private readonly bombCarry = h('div', { class: 'bomb-carry hidden', role: 'status' });
  private readonly plantFill = h('i', { style: 'width:0%' });
  private readonly plantBar = h('div', { class: 'bomb-bar glass hidden' }, [this.plantFill]);
  private readonly activityLabel = h('span', { class: 'activity-label' });
  private readonly activityFill = h('i', { style: 'width:0%' });
  private readonly bombActivity = h('div', { class: 'bomb-activity glass hidden', role: 'status' }, [this.activityLabel, h('div', { class: 'track' }, [this.activityFill])]);
  private readonly defuseCanvas = h('canvas', { class: 'defuse-overlay hidden' });
  private readonly feed = h('div', { class: 'killfeed' });
  private readonly hpV = h('div', { class: 'v', text: '100' });
  private readonly hpBar = h('i', { style: 'width:100%' });
  private readonly hp = h('div', { class: 'vital glass' }, [svg(ICONS.heart), h('div', {}, [this.hpV, h('div', { class: 'bar' }, [this.hpBar])])]);
  private readonly arV = h('div', { class: 'v', text: '0' });
  private readonly arBar = h('i', { style: 'width:0%' });
  private readonly armor = h('div', { class: 'vital armor glass' }, [svg(ICONS.shield), h('div', {}, [this.arV, h('div', { class: 'bar' }, [this.arBar])])]);
  private readonly staminaFill = h('i');
  private readonly staminaPct = h('b', { class: 'stamina-pct', text: '100%' });
  private readonly staminaBar = h('div', { class: 'stamina level-ok', role: 'meter', 'aria-label': 'fôlego', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '100', 'aria-hidden': 'true' }, [
    h('div', { class: 'stamina-head' }, [svg(ICONS.stamina), h('span', { class: 'stamina-name', text: 'fôlego' }), h('span', { class: 'stamina-winded', text: 'sem fôlego' }), this.staminaPct]),
    h('div', { class: 'stamina-track' }, [this.staminaFill, h('u', { class: 'stamina-tick', style: `left:${STAMINA_RESUME_FRACTION * 100}%` })]),
  ]);
  private staminaPercent = 100;
  private staminaVisible = false;
  private staminaLevel: StaminaLevel = 'ok';
  private readonly stanceIcon = h('span', { class: 'stance-icon', 'aria-hidden': 'true' });
  private readonly stanceName = h('span', { class: 'stance-name' });
  private readonly stanceChip = h('div', { class: 'vital stance glass', role: 'status' }, [this.stanceIcon, this.stanceName]);
  private stance: Stance | null = null;
  private stanceTilt = 0;
  private readonly wName = h('b', { text: '' });
  private readonly wTag = h('small', { text: '' });
  private readonly wBox = h('div', { class: 'wname' }, [this.wName, this.wTag]);
  private readonly ammoCount = h('div', { class: 'count' });
  private readonly slotsEl = h('div', { class: 'slots' });
  private readonly reloadI = h('i', { style: 'width:0%' });
  private readonly reloadBar = h('div', { class: 'reload-bar hidden' }, [this.reloadI]);
  private readonly ch = h('div', { class: 'crosshair' });
  private readonly chLines: HTMLElement[] = [];
  private readonly hitm = h('div', { class: 'hitmarker' });
  private readonly dmgRing = h('div', { class: 'dmg-ring' });
  private readonly vignette = h('div', { class: 'vignette' });
  private readonly protect = h('div', { class: 'protect-vignette' });
  private readonly votePanel = h('div', { class: 'vote-live glass hidden' });
  private readonly scopeRangeText = h('b');
  private readonly scopeMarker = h('i', { class: 'scope-marker' });
  private readonly scopeRange = h('div', { class: 'scope-range' }, [this.scopeRangeText]);
  private readonly scopeRuler = h('div', { class: 'scope-ruler' }, [
    ...RULER_STOPS_METERS.map((m) => h('span', { class: 'scope-tick', style: `top:${(rulerFraction(m) * 100).toFixed(1)}%`, text: String(m) })),
    this.scopeMarker,
  ]);
  private readonly scope = h('div', { class: 'scope', 'aria-hidden': 'true' }, [
    h('div', { class: 'scope-glass' }),
    h('div', { class: 'scope-glare' }),
    this.scopeRuler,
    this.scopeRange,
    svg(`<svg class="scope-reticle" viewBox="-100 -100 200 200">
      <path d="M-100 0H100 M0 -100V100" fill="none" stroke="black" stroke-width=".35"/>
      ${[0, 90, 180, 270].map((angle) => `
        <g transform="rotate(${angle})">
          <path d="M100 -1.2H63L51 0 63 1.2H100Z"/>
          <path d="M4 -1V1 M12 -1V1 M20 -1V1 M28 -1V1 M36 -1V1 M44 -1V1"
                fill="none" stroke="black" stroke-width=".3"/>
          <circle cx="8" r=".65"/><circle cx="16" r=".65"/><circle cx="24" r=".65"/>
          <circle cx="32" r=".65"/><circle cx="40" r=".65"/><circle cx="48" r=".65"/>
        </g>`).join('')}
    </svg>`),
  ]);
  private readonly teamBadge = h('div', { class: 'team-badge hidden' });
  /** Spectator controls call back here; the game decides what each action does. */
  onSpectate: (action: SpectatorAction) => void = () => {};
  private readonly watchName = h('b', { class: 'watch-name' });
  private readonly watchModeLabel = h('span');
  private readonly watchTeamButtons = ([0, 1] as const).map(team =>
    h('button', { class: 'watch-btn watch-team', type: 'button', style: `--team:${TEAMS[team].color}`, title: `Assistir os ${TEAMS[team].name} (${team + 1})`, onclick: () => this.onSpectate({ kind: 'team', team }) }, [
      h('span', { class: 'kbd', text: String(team + 1) }),
      TEAMS[team].name,
    ]),
  );
  private readonly watchCountdown = h('span', { class: 'watch-countdown' });
  private readonly watchTeams = h('div', { class: 'watch-teams hidden' }, [...this.watchTeamButtons, this.watchCountdown]);
  private readonly watchHint = h('div', { class: 'watch-hint' });
  private readonly watchBadge = h('div', { class: 'watch-bar glass hidden' }, [
    h('div', { class: 'watch-row' }, [
      h('i', { class: 'watch-dot' }),
      h('span', { class: 'watch-who' }, [h('span', { class: 'label', text: 'assistindo' }), this.watchName]),
      h('button', { class: 'watch-btn', type: 'button', title: 'Jogador anterior (seta esquerda)', 'aria-label': 'jogador anterior', text: '‹', onclick: () => this.onSpectate({ kind: 'prev' }) }),
      h('button', { class: 'watch-btn', type: 'button', title: 'Próximo jogador (seta direita)', 'aria-label': 'próximo jogador', text: '›', onclick: () => this.onSpectate({ kind: 'next' }) }),
      h('button', { class: 'watch-btn watch-mode', type: 'button', title: 'Trocar a câmera (Espaço)', onclick: () => this.onSpectate({ kind: 'mode' }) }, [h('span', { class: 'kbd', text: 'Espaço' }), this.watchModeLabel]),
      this.watchTeams,
      h('button', { class: 'watch-btn watch-join', type: 'button', title: 'Entrar na partida como jogador (J)', onclick: () => this.onSpectate({ kind: 'join' }) }, [h('span', { class: 'kbd', text: 'J' }), 'entrar no jogo']),
    ]),
    this.watchHint,
  ]);
  private readonly center = h('div', { class: 'center' });
  private readonly dropAlt = h('div', { class: 'alt', text: '' });
  private readonly dropHint = h('div', { class: 'hint' });
  private readonly drop = h('div', { class: 'drop-hud glass hidden' }, [
    h('div', { class: 'label', text: 'em queda livre' }),
    this.dropAlt,
    this.dropHint,
  ]);
  private readonly deathBy = h('div', { class: 'by' });
  private readonly deathMeta = h('div', { class: 'meta' });
  private readonly deathRespawn = h('div', { class: 'respawn' });
  private readonly death = h('div', { class: 'death glass hidden' }, [h('div', { class: 'label', text: 'eliminado' }), this.deathBy, this.deathMeta, this.deathRespawn]);
  private readonly markersEl = h('div', { class: 'markers' });
  private readonly markerPool: HTMLElement[] = [];
  readonly chat = h('div', { class: 'chat' });
  readonly chatInput = h('input', { class: 'chat-input hidden', maxlength: 100, placeholder: 'mensagem para todos…', autocomplete: 'off', spellcheck: 'false' });
  private readonly radioMenu = h('div', { class: 'radio-menu glass hidden' });
  private readonly sbBody = h('tbody');
  private readonly sbScore = h('th', { text: 'kills' });
  private readonly sbTitle = h('span', { class: 'label', text: '' });
  readonly scoreboard = h('div', { class: 'scoreboard glass hidden' }, [
    h('header', {}, [h('h2', { text: 'placar' }), this.sbTitle]),
    h('table', {}, [
      h('thead', {}, [h('tr', {}, [
        h('th', { text: '#' }), h('th', { text: 'jogador' }), this.sbScore,
        ...['mortes', 'hs', 'ping'].map((t) => h('th', { text: t })),
      ])]),
      this.sbBody,
    ]),
  ]);
  private readonly netstat = h('div', { class: 'netstat hidden' });
  private dmgTimers = new Map<HTMLElement, number>();
  private last = new Map<string, string>();

  setBindings(bindings: Bindings): void {
    const movement = (['forward', 'left', 'back', 'right'] satisfies ActionId[])
      .map((id) => actionBindingLabel(bindings, id)).join(' · ');
    this.dropHint.replaceChildren(hintKey(movement), 'planar · ', hintKey(actionBindingLabel(bindings, 'crouch')), 'mergulhar');
  }

  constructor(parent: HTMLElement, bindings: Bindings) {
    this.setBindings(bindings);
    for (let i = 0; i < 4; i++) {
      const l = h('i');
      this.chLines.push(l);
      this.ch.append(l);
    }
    this.ch.append(h('i', { class: 'dot hidden' }));
    for (let i = 0; i < 4; i++) {
      const l = h('i');
      l.style.transform = `rotate(${45 + i * 90}deg)`;
      this.hitm.append(l);
    }
    this.root.append(
      this.vignette,
      this.protect,
      this.scope,
      this.votePanel,
      this.markersEl,
      h('div', { class: 'topbar' }, [this.leadersLeft, this.timer, this.leadersRight]),
      this.feed,
      this.flagStatus,
      this.flagBanner,
      this.bombRole,
      this.bombStatus,
      this.bombCarry,
      this.blackFridayBanner,
      this.lunchBanner,
      this.carrapetaAura,
      this.carrapetaBanner,
      this.carrapetaStatus,
      this.lunchFollowers,
      this.plantBar,
      this.bombActivity,
      this.defuseCanvas,
      this.staminaBar,
      h('div', { class: 'vitals' }, [this.teamBadge, this.hp, this.armor, this.stanceChip]),
      h('div', { class: 'ammo' }, [this.reloadBar, h('div', { class: 'main glass' }, [this.wBox, this.ammoCount]), this.slotsEl]),
      this.ch,
      this.hitm,
      this.dmgRing,
      this.center,
      this.watchBadge,
      this.drop,
      this.death,
      this.chat,
      this.radioMenu,
      this.scoreboard,
      this.netstat,
    );
    this.chat.append(this.chatInput);
    parent.append(this.root);
  }

  private set(key: string, v: string, apply: () => void): void {
    if (this.last.get(key) === v) return;
    this.last.set(key, v);
    apply();
  }

  setTimer(text: string, sub: string, urgent: boolean): void {
    this.set('timer', `${text}|${sub}|${urgent}`, () => {
      this.timerT.textContent = text;
      this.timerS.textContent = sub;
      this.timer.classList.toggle('urgent', urgent);
    });
  }

  setLeaders(rows: LeaderRow[], me: LeaderRow | null, unit: string): void {
    const key = JSON.stringify([rows, me, unit]);
    this.set('leaders', key, () => {
      const card = (r: LeaderRow | null, rank: number) => {
        if (!r) return h('div', { class: 'leader glass empty' }, [h('div', { class: 'rank', style: `background:${RANK_COLORS[rank - 1] ?? '#444'}`, text: String(rank) }), h('div', { class: 'who' }, [h('div', { class: 'name', text: '—' }), h('div', { class: 'k', text: `0 ${unit}` })])]);
        return h('div', { class: `leader glass${r.me ? ' me' : ''}` }, [
          h('div', { class: 'rank', style: `background:${RANK_COLORS[r.rank - 1] ?? r.color}`, text: String(r.rank) }),
          h('div', { class: 'who' }, [h('div', { class: 'name', text: r.name }), h('div', { class: 'k', text: `${r.score} ${r.score === 1 ? unit.replace(/s$/, '') : unit}` })]),
        ]);
      };
      this.leadersLeft.replaceChildren(card(rows[0] ?? null, 1), card(rows[1] ?? null, 2));
      const right = [card(rows[2] ?? null, 3)];
      if (me && me.rank > 3) right.push(card(me, me.rank));
      this.leadersRight.replaceChildren(...right);
    });
  }

  /** Team scores share the same cards across team modes. */
  setTeams(scores: number[], limit: number, myTeam: number, unit = 'kills'): void {
    this.set('leaders', JSON.stringify(['teams', scores, limit, myTeam, unit]), () => {
      const card = (t: number) =>
        h('div', { class: `team-card glass${t === myTeam ? ' mine' : ''}`, style: `--team:${TEAMS[t].color}` }, [
          h('div', { class: 'team-meta' }, [h('div', { class: 'team-name', text: TEAMS[t].name }), h('div', { class: 'k', text: limit ? `meta ${limit} ${unit}` : t === myTeam ? 'seu time' : '' })]),
          h('div', { class: 'team-score', text: String(scores[t] ?? 0) }),
        ]);
      this.leadersLeft.replaceChildren(card(0));
      this.leadersRight.replaceChildren(card(1));
    });
  }

  setFlags(flags: (LunchRow | { team: number; text: string })[], carrying: boolean): void {
    this.set('flags', JSON.stringify([flags, carrying]), () => {
      this.flagStatus.classList.toggle('hidden', !flags.length);
      this.flagBanner.classList.toggle('hidden', !carrying);
      this.flagStatus.replaceChildren(...flags.map(flag => {
        const label = h('span', { text: TEAMS[flag.team].name + ': ' + flag.text });
        if (!('big' in flag)) return h('span', { style: 'color:' + TEAMS[flag.team].color }, [label]);
        return h('span', { class: 'lunch-row', style: 'color:' + TEAMS[flag.team].color }, [
          ...(flag.tag ? [h('strong', { class: 'lunch-row-tag', text: flag.tag })] : []),
          label,
          h('b', { class: 'lunch-row-big', text: flag.big }),
          h('small', { text: flag.unit }),
        ]);
      }));
    });
  }

  /** Status line for the bug, the plant progress (0..1, negative hides the bar), the viewer's side and the warning for whoever carries the bug. */
  setBomb({ text, plant, role, blackFriday, carry, activity }: BombHud): void {
    const percent = Math.round(plant * 100);
    this.set('bomb-activity', JSON.stringify(activity && [activity.kind, activity.label, activity.color, Math.round(activity.progress * 100)]), () => {
      this.bombActivity.classList.toggle('hidden', activity === null);
      if (!activity) return;
      this.bombActivity.dataset.kind = activity.kind;
      this.bombActivity.style.setProperty('--actor', activity.color);
      this.activityLabel.textContent = activity.label;
      this.activityFill.style.width = Math.round(activity.progress * 100) + '%';
    });
    this.set('bomb-carry', JSON.stringify(carry), () => {
      this.bombCarry.classList.toggle('hidden', carry === null);
      if (carry) this.bombCarry.replaceChildren(svg(ICONS.target), h('b', { text: carry.title }), h('span', { text: carry.hint }));
    });
    this.set('bomb-role', JSON.stringify(role), () => {
      this.bombRole.classList.toggle('hidden', role === null);
      if (!role) return;
      this.bombRole.dataset.side = role.side;
      this.bombRole.replaceChildren(svg(role.side === 'attack' ? ICONS.target : ICONS.shield), h('b', { text: role.label }), h('span', { text: role.goal }));
    });
    this.set('bomb', JSON.stringify([text, percent, blackFriday, activity !== null]), () => {
      this.bombStatus.classList.toggle('hidden', text === null);
      this.bombStatus.classList.toggle('black-friday', blackFriday);
      this.bombStatus.textContent = text ?? '';
      this.plantBar.classList.toggle('hidden', percent < 0 || activity !== null);
      this.plantFill.style.width = Math.max(0, percent) + '%';
    });
  }

  /** Full-size laptop shown to the player who is defusing, redrawn every frame. */
  setDefuse(scene: { variant: number; progress: number; timeMs: number } | null): void {
    this.set('defuse', String(scene !== null), () => this.defuseCanvas.classList.toggle('hidden', scene === null));
    if (!scene) return;
    const width = this.defuseCanvas.clientWidth;
    const height = this.defuseCanvas.clientHeight;
    const ctx = this.defuseCanvas.getContext('2d');
    if (!ctx || width === 0 || height === 0) return;
    const ratio = window.devicePixelRatio || 1;
    const backingWidth = Math.round(width * ratio);
    const backingHeight = Math.round(height * ratio);
    if (this.defuseCanvas.width !== backingWidth || this.defuseCanvas.height !== backingHeight) {
      this.defuseCanvas.width = backingWidth;
      this.defuseCanvas.height = backingHeight;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawLaptop(ctx, width, height, scene.variant, scene.progress, scene.timeMs);
  }

  setTeamBadge(team: number): void {
    this.set('badge', String(team), () => {
      this.teamBadge.classList.toggle('hidden', team < 0);
      if (team < 0) return;
      this.teamBadge.textContent = TEAMS[team].name;
      this.teamBadge.style.setProperty('--team', TEAMS[team].color);
    });
  }

  /** Spectator bar at the bottom of the screen; `undefined` hides it for players. */
  setSpectatorBar(bar: SpectatorBar | undefined): void {
    this.set('watch', JSON.stringify(bar ?? false), () => {
      this.watchBadge.classList.toggle('hidden', !bar);
      if (!bar) return;
      const choosing = bar.teams?.pickSecondsLeft != null;
      this.watchBadge.classList.toggle('idle', bar.target === null);
      this.watchBadge.dataset.mode = bar.mode;
      this.watchBadge.style.setProperty('--team', bar.target?.color ?? 'var(--muted)');
      this.watchName.textContent = bar.target ? bar.target.name : choosing ? 'escolha um time' : 'aguardando jogadores';
      this.watchModeLabel.textContent = CAMERA_MODE_LABEL[bar.mode];
      this.watchTeams.classList.toggle('hidden', bar.teams === null);
      if (bar.teams) {
        const { active, pickSecondsLeft: left } = bar.teams;
        this.watchTeamButtons.forEach((button, team) => button.setAttribute('aria-pressed', String(active === team)));
        this.watchCountdown.textContent = left === null ? '' : left > 0 ? `escolha em ${left} s` : 'o servidor escolhe…';
      }
      this.watchHint.replaceChildren(...spectatorHints(bar));
    });
  }

  /** `icon` is the weapon's silhouette; without one (no WebGL to bake it) the text tag stands in. */
  killfeed(killer: string, kc: string, victim: string, vc: string, weapon: string, icon: WeaponIcon | null, hs: boolean, involvement: FeedInvolvement): void {
    const el = h('div', { class: `kf glass${involvement ? ` mine-${involvement}` : ''}` }, [
      h('span', { style: `color:${kc}`, text: killer }),
      icon
        ? h('img', { class: 'w-icon', src: icon.src, alt: weapon, title: weapon, width: icon.width, height: icon.height, draggable: 'false' })
        : h('span', { class: 'w', text: weapon }),
      hs ? h('span', { class: 'hs', title: 'headshot', 'aria-label': 'headshot' }, [svg(ICONS.headshot)]) : null,
      h('span', { style: `color:${vc}`, text: victim }),
    ]);
    this.pushFeed(el);
  }

  /** Big centred banner for the moment Black Friday switches on; it restarts its animation if it fires again. */
  announceBlackFriday(durationMs = BLACK_FRIDAY_BANNER_MS): void {
    clearTimeout(this.blackFridayTimer);
    this.blackFridayBanner.classList.remove('hidden');
    this.blackFridayBanner.style.animation = 'none';
    void this.blackFridayBanner.offsetWidth;
    this.blackFridayBanner.style.animation = '';
    this.blackFridayTimer = setTimeout(() => this.blackFridayBanner.classList.add('hidden'), durationMs);
  }

  /** Big centred banner at the start of a lunch round: the restaurant's logo and name, and the rush hour call when it is one. */
  announceLunch(logo: HTMLCanvasElement, restaurant: string, rush: { tag: string; pitch: string } | null, durationMs = LUNCH_BANNER_MS): void {
    clearTimeout(this.lunchBannerTimer);
    logo.className = 'lunch-logo';
    const nodes: Node[] = [h('span', { class: 'lunch-kicker', text: 'destino do almoço' }), logo, h('b', { class: 'lunch-name', text: restaurant })];
    if (rush) nodes.push(h('strong', { class: 'lunch-rush', text: rush.tag }), h('span', { class: 'lunch-pitch', text: rush.pitch }));
    this.lunchBanner.replaceChildren(...nodes);
    this.lunchBanner.classList.toggle('rush', rush !== null);
    this.lunchBanner.classList.remove('hidden');
    this.lunchBanner.style.animation = 'none';
    void this.lunchBanner.offsetWidth;
    this.lunchBanner.style.animation = '';
    this.lunchBannerTimer = setTimeout(() => this.lunchBanner.classList.add('hidden'), durationMs);
  }

  clearLunchBanner(): void {
    clearTimeout(this.lunchBannerTimer);
    this.lunchBanner.classList.add('hidden');
  }

  announceCarrapeta(kind: CarrapetaBanner): void {
    if (kind === 'take' && this.carrapetaBannerKind === 'on') {
      this.queuedCarrapetaTake = true;
      return;
    }
    if (kind === 'on' && this.carrapetaBannerKind === 'take') this.queuedCarrapetaTake = true;
    this.carrapetaBannerKind = kind;
    clearTimeout(this.carrapetaBannerTimer);
    this.carrapetaBanner.classList.add('hidden');
    const { title, text, durationMs } = CARRAPETA_BANNERS[kind];
    this.carrapetaBanner.replaceChildren(
      h('strong', { class: 'carrapeta-symbol', 'aria-hidden': 'true' }, [svg(ICONS.carrapeta)]),
      h('b', { class: 'lunch-name', text: title }),
      h('span', { text }),
    );
    this.carrapetaBanner.classList.toggle('rush', kind === 'on');
    this.carrapetaBanner.style.setProperty('--carrapeta-banner-duration', `${durationMs}ms`);
    void this.carrapetaBanner.offsetWidth;
    this.carrapetaBanner.classList.remove('hidden');
    this.carrapetaBannerTimer = setTimeout(() => {
      const queuedTake = this.queuedCarrapetaTake;
      this.clearCarrapetaBanner();
      if (queuedTake) this.announceCarrapeta('take');
    }, durationMs);
  }

  clearCarrapetaBanner(): void {
    clearTimeout(this.carrapetaBannerTimer);
    this.carrapetaBanner.classList.add('hidden');
    this.carrapetaBannerKind = undefined;
    this.queuedCarrapetaTake = false;
  }

  clearCarrapetaTake(): void {
    this.queuedCarrapetaTake = false;
    if (this.carrapetaBannerKind === 'take') this.clearCarrapetaBanner();
  }

  setCarrapetaStatus(text: string | null): void {
    this.set('carrapeta', text ?? '', () => {
      this.carrapetaStatus.classList.toggle('hidden', text === null);
      this.carrapetaStatus.textContent = text ? `${CARRAPETA_SYMBOL} ${text}` : '';
    });
  }

  setCarrapetaAura(active: boolean): void {
    this.carrapetaAura.classList.toggle('hidden', !active);
  }

  /** The colleagues following this player; hidden at zero, so only a leader sees it. */
  setLunchFollowers(count: number, total: number, text: string): void {
    const key = `${count}/${total}`;
    if (this.lunchFollowersText === key) return;
    this.lunchFollowersText = key;
    this.lunchFollowers.classList.toggle('hidden', count === 0);
    if (count === 0) return;
    const dots = Array.from({ length: total }, (_, i) => h('i', { class: i < count ? 'on' : '' }));
    this.lunchFollowers.replaceChildren(...dots, h('span', { text }));
  }

  clearBlackFridayBanner(): void {
    clearTimeout(this.blackFridayTimer);
    this.blackFridayBanner.classList.add('hidden');
  }

  info(text: string, color?: string): void {
    this.pushFeed(h('div', { class: 'kf glass info', text, style: color ? `color:${color}` : '' }));
  }

  private pushFeed(el: HTMLElement): void {
    this.feed.append(el);
    while (this.feed.children.length > 6) this.feed.firstElementChild?.remove();
    setTimeout(() => el.remove(), 6500);
  }

  /**
   * Standing, crouched or lying down: the icon follows the local player and is only redrawn when the stance changes.
   * A dead player shows standing, the stance the next spawn starts in, instead of the pose they died in.
   */
  setStance(stance: Stance, alive = true, lean = 0): void {
    const shown = alive ? stance : STANCE.STAND;
    const { degrees, arrow } = leanTilt(alive ? lean : 0);
    if (this.stance === shown && this.stanceTilt === degrees) return;
    const view = STANCE_VIEWS[shown];
    if (this.stance !== shown) {
      this.stance = shown;
      this.stanceIcon.replaceChildren(svg(ICONS[view.icon]));
      this.stanceChip.classList.toggle('lowered', shown !== STANCE.STAND);
    }
    this.stanceTilt = degrees;
    this.stanceIcon.style.transform = degrees === 0 ? '' : `rotate(${degrees}deg)`;
    this.stanceName.textContent = arrow === '' ? view.label : `${view.label} ${arrow}`;
    this.stanceChip.setAttribute('aria-label', `postura: ${view.label}${arrow === '' ? '' : arrow === '‹' ? ', inclinado à esquerda' : ', inclinado à direita'}`);
  }

  setStamina(fraction: number, visible: boolean, winded: boolean): void {
    const percent = Math.round(fraction * 100);
    if (this.staminaPercent !== percent) {
      this.staminaPercent = percent;
      this.staminaFill.style.transform = `scaleX(${percent / 100})`;
      this.staminaPct.textContent = `${percent}%`;
      this.staminaBar.setAttribute('aria-valuenow', String(percent));
    }
    if (this.staminaVisible !== visible) {
      this.staminaVisible = visible;
      this.staminaBar.classList.toggle('active', visible);
      this.staminaBar.setAttribute('aria-hidden', String(!visible));
    }
    const level = staminaLevel(fraction, winded);
    if (this.staminaLevel !== level) {
      this.staminaBar.classList.replace(`level-${this.staminaLevel}`, `level-${level}`);
      this.staminaLevel = level;
    }
  }

  setVitals(hp: number, armor: number): void {
    this.set('vitals', `${hp}|${armor}`, () => {
      this.hpV.textContent = String(hp);
      this.hpBar.style.width = `${hp}%`;
      this.hp.classList.toggle('low', hp <= 25);
      this.arV.textContent = String(armor);
      this.arBar.style.width = `${Math.min(100, armor)}%`;
      this.armor.classList.toggle('hidden', armor <= 0);
      this.vignette.style.opacity = hp <= 25 ? '0.7' : '0';
    });
  }

  setWeapon(name: string, tag: string, mag: number, reserve: number | '∞', legendary: boolean, melee: boolean, slots: { key: string; label: string; active: boolean }[], capacity: number | null = null): void {
    this.set('weapon', JSON.stringify([name, mag, reserve, slots, capacity]), () => {
      this.wName.textContent = name;
      this.wTag.textContent = legendary ? 'LENDÁRIA' : tag;
      this.wBox.classList.toggle('legendary', legendary);
      if (melee) this.ammoCount.replaceChildren('∞');
      else this.ammoCount.replaceChildren(String(mag), h('small', { text: ` / ${reserve}` }));
      if (capacity !== null) this.ammoCount.append(h('small', { class: 'ammo-capacity', text: `pente máx. ${capacity}` }));
      this.ammoCount.classList.toggle('empty', !melee && mag === 0);
      this.slotsEl.replaceChildren(...slots.map((s) => h('div', { class: `slot glass${s.active ? ' active' : ''}`, text: `${s.key} ${s.label}` })));
    });
  }

  setReload(frac: number): void {
    const show = frac >= 0;
    this.reloadBar.classList.toggle('hidden', !show);
    if (show) this.reloadI.style.width = `${Math.round(frac * 100)}%`;
  }

  setCrosshair(gapPx: number, sizePx: number, color: string, visible: boolean): void {
    const g = Math.round(gapPx);
    const size = Math.round(sizePx);
    this.set('ch', `${g}|${size}|${color}|${visible}`, () => {
      this.ch.style.display = visible ? '' : 'none';
      this.ch.style.setProperty('--ch-color', color);
      const t = 2;
      const [up, down, left, right] = this.chLines;
      Object.assign(up.style, { width: `${t}px`, height: `${size}px`, left: `${-t / 2}px`, top: `${-g - size}px` });
      Object.assign(down.style, { width: `${t}px`, height: `${size}px`, left: `${-t / 2}px`, top: `${g}px` });
      Object.assign(left.style, { width: `${size}px`, height: `${t}px`, top: `${-t / 2}px`, left: `${-g - size}px` });
      Object.assign(right.style, { width: `${size}px`, height: `${t}px`, top: `${-t / 2}px`, left: `${g}px` });
    });
  }

  hit(kind: 'body' | 'head' | 'kill'): void {
    this.hitm.className = `hitmarker ${kind}`;
    void this.hitm.offsetWidth;
    this.hitm.classList.add('show');
  }

  damage(angle: number): void {
    const el = h('i');
    el.style.transform = `rotate(${angle}rad)`;
    el.style.opacity = '1';
    this.dmgRing.append(el);
    requestAnimationFrame(() => {
      setTimeout(() => (el.style.opacity = '0'), 350);
    });
    setTimeout(() => el.remove(), 1100);
    this.vignette.style.opacity = '0.8';
    const prev = this.dmgTimers.get(this.vignette);
    if (prev) clearTimeout(prev);
    this.dmgTimers.set(
      this.vignette,
      window.setTimeout(() => {
        this.last.delete('vitals');
        this.vignette.style.opacity = '0';
      }, 180),
    );
  }

  setProtect(on: boolean): void {
    this.protect.style.opacity = on ? '1' : '0';
  }

  setScopeBlur(enabled: boolean): void {
    this.scope.classList.toggle('scope-blur', enabled);
  }

  /** Next-match vote during the first minutes of a round: one row per option with its key, the votes so far and the seconds left. `null` hides it. */
  setVote(panel: VotePanel | null, onPick: (option: number) => void): void {
    const key = panel ? `${panel.secondsLeft}|${panel.rows.map((r) => `${r.map}${r.mode}${r.count}${r.mine}`).join(',')}` : 'off';
    this.set('vote', key, () => {
      this.votePanel.classList.toggle('hidden', !panel);
      if (!panel) return;
      this.votePanel.replaceChildren(
        h('div', { class: 'label', text: `próxima partida · vote · ${panel.secondsLeft}s` }),
        ...panel.rows.map((r, i) =>
          h('button', { class: `vote-live-row${r.mine ? ' mine' : ''}`, type: 'button', 'aria-pressed': String(r.mine), onclick: () => onPick(i) }, [
            h('span', { class: 'kbd', text: r.key }),
            h('span', { class: 'vote-text' }, [h('b', { text: r.map }), h('small', { text: r.mode })]),
            h('span', { class: 'vote-count', text: String(r.count) }),
          ]),
        ),
      );
    });
  }

  setScope(overlay: ScopeOverlay): void {
    this.scope.classList.toggle('on', overlay !== 'none');
  }

  /** The range inside the AWP scope: the ruler marker and the readout. `null` when the scope is down. */
  setScopeRange(reading: RangeReading | null): void {
    const key = reading ? `${reading.meters === null ? '-' : Math.round(reading.meters)}|${reading.onEnemy}` : 'off';
    this.set('scopeRange', key, () => {
      const label = reading ? rangeLabel(reading) : '';
      this.scope.classList.toggle('on-target', !!reading?.onEnemy);
      this.scope.classList.toggle('ranged', reading?.meters != null);
      this.scopeRangeText.textContent = label;
      if (reading?.meters != null) this.scopeMarker.style.top = `${(rulerFraction(reading.meters) * 100).toFixed(1)}%`;
    });
  }

  announce(text: string, sub?: string, white = false): void {
    const nodes: Node[] = [h('div', { class: `announce${white ? ' white' : ''}`, text })];
    if (sub) nodes.push(h('div', { class: 'announce-sub glass', text: sub }));
    this.center.replaceChildren(...nodes);
  }

  setDrop(alt: number | null): void {
    this.drop.classList.toggle('hidden', alt === null);
    if (alt !== null) this.dropAlt.textContent = `${Math.max(0, Math.round(alt * 0.0254))} m`;
  }

  setDeath(info: { killer: string; color: string; weapon: string; hs: boolean } | null): void {
    this.death.classList.toggle('hidden', !info);
    if (!info) return;
    this.deathBy.replaceChildren('por ', h('span', { style: `color:${info.color}`, text: info.killer }));
    this.deathMeta.textContent = `${info.weapon}${info.hs ? ' · headshot' : ''}`;
  }

  setRespawn(text: string): void {
    this.deathRespawn.textContent = text;
  }

  setMarkers(list: Marker[]): void {
    while (this.markerPool.length < list.length) {
      const el = h('div', { class: 'marker' }, [h('div', { class: 'icon', text: '★' }), h('span'), h('span')]);
      this.markerPool.push(el);
      this.markersEl.append(el);
    }
    this.markerPool.forEach((el, i) => {
      const m = list[i];
      el.classList.toggle('hidden', !m);
      if (!m) return;
      el.style.left = `${m.x}px`;
      el.style.top = `${m.y}px`;
      el.classList.toggle('offscreen', m.offscreen);
      const [, a, b] = el.children;
      a.textContent = m.label;
      b.textContent = `${Math.round(m.dist * 0.0254)} m`;
    });
  }

  chatLine(name: string, color: string, text: string): void {
    const line = h('div', { class: 'chat-line' }, [h('b', { style: `color:${color}`, text: name }), text]);
    this.chat.insertBefore(line, this.chatInput);
    const lines = this.chat.querySelectorAll('.chat-line');
    if (lines.length > 7) lines[0].remove();
  }

  /** A radio line in the chat column, tagged and tinted with the sender's team colour. */
  radioLine(name: string, color: string, text: string): void {
    const line = h('div', { class: 'chat-line radio' }, [h('b', { style: `color:${color}`, text: `(RÁDIO) ${name}:` }), text]);
    this.chat.insertBefore(line, this.chatInput);
    const lines = this.chat.querySelectorAll('.chat-line');
    if (lines.length > 7) lines[0].remove();
  }

  /** The numbered radio menu on the left, or hidden when `menu` is null. */
  showRadioMenu(menu: RadioMenu | null): void {
    this.radioMenu.classList.toggle('hidden', !menu);
    if (!menu) return;
    const rows = menu.lines.map((line, i) =>
      h('div', { class: 'radio-row' }, [h('span', { class: 'kbd', text: String(i + 1) }), h('span', { text: line.text })]),
    );
    this.radioMenu.replaceChildren(
      h('div', { class: 'label', text: `rádio · ${menu.label}` }),
      ...rows,
      h('div', { class: 'radio-row radio-close' }, [h('span', { class: 'kbd', text: '0' }), h('span', { text: 'fechar' })]),
    );
  }

  openChat(open: boolean): void {
    this.chat.classList.toggle('open', open);
    this.chatInput.classList.toggle('hidden', !open);
    if (open) {
      this.chatInput.value = '';
      this.chatInput.focus();
    } else this.chatInput.blur();
  }

  showScoreboard(show: boolean, rows: ScoreRow[], title: string, teams: number[] | null, unit = 'kills'): void {
    this.scoreboard.classList.toggle('hidden', !show);
    if (!show) return;
    this.set('sb', JSON.stringify([rows, title, teams, unit]), () => {
      this.sbTitle.textContent = title;
      this.sbScore.textContent = teams ? 'kills' : unit;
      const line = (r: ScoreRow, i: number) =>
        h('tr', { class: r.me ? 'me' : '' }, [
          h('td', { text: String(i + 1) }),
          h('td', {}, [h('span', { class: 'pdot', style: `background:${r.color}` }), r.name]),
          h('td', { text: String(r.points ?? r.kills) }),
          h('td', { text: String(r.deaths) }),
          h('td', { text: String(r.hs) }),
          h('td', { class: r.bot ? 'bot-tag' : '', text: r.bot ? 'bot' : String(r.ping) }),
        ]);
      if (!teams) {
        this.sbBody.replaceChildren(...rows.map(line));
        return;
      }
      const out: HTMLElement[] = [];
      for (const t of [0, 1]) {
        const mine = rows.filter((r) => r.team === t);
        out.push(
          h('tr', { class: 'team-row', style: `--team:${TEAMS[t].color}` }, [
            h('td', { colspan: 6 }, [h('span', { class: 'team-name', text: TEAMS[t].name }), h('span', { class: 'team-total', text: `${teams[t] ?? 0} ${unit} · ${mine.length} jogador${mine.length === 1 ? '' : 'es'}` })]),
          ]),
          ...mine.map(line),
        );
      }
      this.sbBody.replaceChildren(...out);
    });
  }

  setNetstat(text: string | null): void {
    this.netstat.classList.toggle('hidden', text === null);
    if (text !== null) this.netstat.textContent = text;
  }

  setVisible(v: boolean): void {
    this.root.style.display = v ? '' : 'none';
  }
}

const hintKey = (text: string): HTMLElement => h('span', { class: 'kbd', text });

/** Key hints under the spectator bar; they depend on the camera mode. */
function spectatorHints(bar: SpectatorBar): (Node | string)[] {
  if (bar.mode === 'free') {
    return [hintKey('WASD'), 'voar', hintKey('Shift'), 'rápido', hintKey('E'), hintKey('Q'), 'subir e descer', bar.pointerLocked ? 'Esc solta o mouse' : 'clique para travar o mouse'];
  }
  if (bar.mode === 'orbit' && !bar.pointerLocked) return ['clique para girar com o mouse', hintKey('→'), 'próximo', hintKey('←'), 'anterior'];
  if (bar.mode === 'orbit') return ['mouse gira', 'clique ou', hintKey('→'), 'próximo', hintKey('←'), 'anterior', 'Esc solta o mouse'];
  return ['clique ou', hintKey('→'), 'próximo', hintKey('←'), 'anterior', ...(bar.teams ? [hintKey('1'), hintKey('2'), 'time'] : [])];
}
