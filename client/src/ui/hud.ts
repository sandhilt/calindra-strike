import { BLACK_FRIDAY_DISCOUNT_PERCENT, TEAMS, type RadioMenu } from '@calindra-strike/shared';
import { BLACK_FRIDAY_PITCH, type BombRole, type CarryNotice } from '../game/bomb.ts';
import { drawLaptop } from '../game/laptop/draw.ts';
import type { BombActivity } from '../game/spectate/activity.ts';
import { CAMERA_MODE_LABEL, type CameraMode } from '../game/spectate/camera.ts';
import type { SpectatorAction } from '../game/spectate/controls.ts';
import type { WeaponIcon } from '../game/render/weapon-icons.ts';
import { ICONS, h, svg } from './dom.ts';

export interface LeaderRow {
  name: string;
  color: string;
  kills: number;
  rank: number;
  me: boolean;
}

export interface ScoreRow {
  id: number;
  name: string;
  color: string;
  kills: number;
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
  private readonly staminaBar = h('div', { class: 'stamina', role: 'meter', 'aria-label': 'fôlego', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '100', 'aria-hidden': 'true' }, [
    h('span', { text: 'fôlego' }),
    h('div', { class: 'stamina-track' }, [this.staminaFill]),
  ]);
  private staminaPercent = 100;
  private staminaVisible = false;
  private staminaWinded = false;
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
  private readonly scope = h('div', { class: 'scope' }, [h('div', { class: 'scope-glass' })]);
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
  private readonly drop = h('div', { class: 'drop-hud glass hidden' }, [
    h('div', { class: 'label', text: 'em queda livre' }),
    this.dropAlt,
    h('div', { class: 'hint' }, [h('span', { class: 'kbd', text: 'WASD' }), 'planar  ·  ', h('span', { class: 'kbd', text: 'Ctrl' }), 'mergulhar']),
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
  private readonly sbTitle = h('span', { class: 'label', text: '' });
  readonly scoreboard = h('div', { class: 'scoreboard glass hidden' }, [
    h('header', {}, [h('h2', { text: 'placar' }), this.sbTitle]),
    h('table', {}, [
      h('thead', {}, [h('tr', {}, ['#', 'jogador', 'kills', 'mortes', 'hs', 'ping'].map((t) => h('th', { text: t })))]),
      this.sbBody,
    ]),
  ]);
  private readonly netstat = h('div', { class: 'netstat hidden' });
  private dmgTimers = new Map<HTMLElement, number>();
  private last = new Map<string, string>();

  constructor(parent: HTMLElement) {
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
      this.markersEl,
      h('div', { class: 'topbar' }, [this.leadersLeft, this.timer, this.leadersRight]),
      this.feed,
      this.flagStatus,
      this.flagBanner,
      this.bombRole,
      this.bombStatus,
      this.bombCarry,
      this.blackFridayBanner,
      this.plantBar,
      this.bombActivity,
      this.defuseCanvas,
      this.staminaBar,
      h('div', { class: 'vitals' }, [this.teamBadge, this.hp, this.armor]),
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

  setLeaders(rows: LeaderRow[], me: LeaderRow | null): void {
    const key = JSON.stringify([rows, me]);
    this.set('leaders', key, () => {
      const card = (r: LeaderRow | null, rank: number) => {
        if (!r) return h('div', { class: 'leader glass empty' }, [h('div', { class: 'rank', style: `background:${RANK_COLORS[rank - 1] ?? '#444'}`, text: String(rank) }), h('div', { class: 'who' }, [h('div', { class: 'name', text: '—' }), h('div', { class: 'k', text: '0 kills' })])]);
        return h('div', { class: `leader glass${r.me ? ' me' : ''}` }, [
          h('div', { class: 'rank', style: `background:${RANK_COLORS[r.rank - 1] ?? r.color}`, text: String(r.rank) }),
          h('div', { class: 'who' }, [h('div', { class: 'name', text: r.name }), h('div', { class: 'k', text: `${r.kills} kill${r.kills === 1 ? '' : 's'}` })]),
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

  setFlags(flags: { team: number; text: string }[], carrying: boolean): void {
    this.set('flags', JSON.stringify([flags, carrying]), () => {
      this.flagStatus.classList.toggle('hidden', !flags.length);
      this.flagBanner.classList.toggle('hidden', !carrying);
      this.flagStatus.replaceChildren(...flags.map(flag => h('span', { style: 'color:' + TEAMS[flag.team].color, text: TEAMS[flag.team].name + ': ' + flag.text })));
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
      hs ? h('span', { class: 'hs', title: 'headshot', text: 'HS' }) : null,
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

  setStamina(fraction: number, visible: boolean, winded: boolean): void {
    const percent = Math.round(fraction * 100);
    if (this.staminaPercent !== percent) {
      this.staminaPercent = percent;
      this.staminaFill.style.transform = `scaleX(${percent / 100})`;
      this.staminaBar.setAttribute('aria-valuenow', String(percent));
    }
    if (this.staminaVisible !== visible) {
      this.staminaVisible = visible;
      this.staminaBar.classList.toggle('active', visible);
      this.staminaBar.setAttribute('aria-hidden', String(!visible));
    }
    if (this.staminaWinded !== winded) {
      this.staminaWinded = winded;
      this.staminaBar.classList.toggle('winded', winded);
    }
  }

  setVitals(hp: number, armor: number): void {
    this.set('vitals', `${hp}|${armor}`, () => {
      this.hpV.textContent = String(hp);
      this.hpBar.style.width = `${hp}%`;
      this.hp.classList.toggle('low', hp <= 25);
      this.arV.textContent = String(armor);
      this.arBar.style.width = `${armor}%`;
      this.armor.classList.toggle('hidden', armor <= 0);
      this.vignette.style.opacity = hp <= 25 ? '0.7' : '0';
    });
  }

  setWeapon(name: string, tag: string, mag: number, reserve: number | '∞', legendary: boolean, melee: boolean, slots: { key: string; label: string; active: boolean }[]): void {
    this.set('weapon', JSON.stringify([name, mag, reserve, slots]), () => {
      this.wName.textContent = name;
      this.wTag.textContent = legendary ? 'LENDÁRIA' : tag;
      this.wBox.classList.toggle('legendary', legendary);
      if (melee) this.ammoCount.replaceChildren('∞');
      else this.ammoCount.replaceChildren(String(mag), h('small', { text: ` / ${reserve}` }));
      this.ammoCount.classList.toggle('empty', !melee && mag === 0);
      this.slotsEl.replaceChildren(...slots.map((s) => h('div', { class: `slot glass${s.active ? ' active' : ''}`, text: `${s.key} ${s.label}` })));
    });
  }

  setReload(frac: number): void {
    const show = frac >= 0;
    this.reloadBar.classList.toggle('hidden', !show);
    if (show) this.reloadI.style.width = `${Math.round(frac * 100)}%`;
  }

  setCrosshair(gapPx: number, size: number, color: string, visible: boolean): void {
    const g = Math.round(gapPx);
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

  setScope(on: boolean): void {
    this.scope.classList.toggle('on', on);
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
      const line = (r: ScoreRow, i: number) =>
        h('tr', { class: r.me ? 'me' : '' }, [
          h('td', { text: String(i + 1) }),
          h('td', {}, [h('span', { class: 'pdot', style: `background:${r.color}` }), r.name]),
          h('td', { text: String(r.kills) }),
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
