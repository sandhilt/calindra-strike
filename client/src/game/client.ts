import {
  BTN,
  IDLE_WARNING_LEAD_MS,
  isActiveCommand,
  type Readiness,
  isTeamMode,
  PLAYER_RADIUS,
  type SpectatorInfo,
  type Cmd,
  CMDS_PER_PACKET_MAX,
  CollisionWorld,
  DEG,
  LEAN_OFFSET_UNITS,
  type GameEvent,
  type GameMode,
  INTERP_DELAY_MS,
  MODE_LABEL,
  type MapDef,
  type MatchInfo,
  PLAYER_COLORS,
  radioLine,
  radioMenuById,
  TEAMS,
  LUNCH_COLLEAGUES,
  ZOOM_SENSITIVITY_RATIO,
  PROTOCOL_VERSION,
  type PlayerState,
  RESPAWN_TICKS,
  RF_ALIVE,
  RF_DROP,
  RF_GROUND,
  RF_PROTECT,
  RF_RELOAD,
  RF_SLIDE,
  RF_SPRINT,
  RF_ZOOM,
  type ResultRow,
  type RosterEntry,
  STAND_EYE,
  STAMINA_MAX,
  STANCES,
  type ServerMsg,
  type ShotInfo,
  type VoteInfo,
  type DayCycle,
  type DayPhase,
  dayCycleAt,
  dayCycleTarget,
  TICK_MS,
  TICK_RATE,
  WEAPON,
  type WeaponId,
  applyCmd,
  refillReserve,
  bombStandBox,
  clamp,
  computeSpread,
  copyState,
  createPlayerState,
  encodeCmd,
  getMap,
  waterSurfaceAt,
  lerpAngle,
  rayHitbox,
  recoilOffset,
  shellsToLoad,
  stanceFromFlags,
  unpackState,
  weaponDef,
} from '@calindra-strike/shared';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Settings } from '../settings.ts';
import { Hud, type FeedInvolvement, type LeaderRow, type Marker, type ScoreRow, type SpectatorBar } from '../ui/hud.ts';
import { Sfx } from './audio.ts';
import { VentHum } from './vent-hum.ts';
import { radioMenuKey, type OpenRadioMenu, type RadioKeyResult } from './radio-menu.ts';
import { RADIO_VOICE, createSpeaker } from './speech.ts';
import type { StreakSound } from './sound-packs/types.ts';
import { Input } from './input.ts';
import { ReloadPlayback } from './reload-playback.ts';
import type { Connection } from './net.ts';
import { BLACK_FRIDAY_PITCH, BLACK_FRIDAY_TAG, DEFUSE_BANNER_MS, useRefusal, beepIntervalMs, bombMessage, bombRole, bombStatus, bombView, carryNotice, defuseBannerScene, defuseProgress, fuseUrgency, plantProgress, scoreUnit, type BombView, type DefuseBanner } from './bomb.ts';
import { flagViews, flagMessage, flagStatus, type FlagView } from './flags.ts';
import { BombRenderer, type CarrierPose } from './render/bomb.ts';
import { FlagsView } from './render/flags.ts';
import { ColleaguesView } from './render/colleagues.ts';
import { lunchMessage, lunchStatus, lunchView, type LunchView } from './lunch.ts';
import { AirdropView } from './render/airdrop.ts';
import { Avatar } from './render/avatar.ts';
import type { GroundAt } from './render/debris-sim.ts';
import { Wader } from './wading.ts';
import { Effects } from './render/effects.ts';
import { FPS_HINT_TEXT, FpsHintWatch } from './fps-hint.ts';
import { LightRt, readGpuFacts } from './render/light-rt.ts';
import { QUALITY, renderPixelRatio, type Quality } from './render/quality.ts';
import { DAY_EXPOSURE, type DayLook, buildLooks, createLook, lookAt } from './render/day-look.ts';
import { RtGovernor } from './render/rt-governor.ts';
import { RT, capRtLevel, rtLabel, type RtLevel } from './render/rt-levels.ts';
import { lightRtSupported } from './render/rt-support.ts';
import { surfaceOf } from './surface.ts';
import { PodiumScene } from './render/podium.ts';
import { FollowedViewTracker } from './render/follow-view.ts';
import { bombActivity } from './spectate/activity.ts';
import { type CameraMode, type FollowedPlayer, type Pose, NO_FREE_KEYS, chasePose, eyePose, freeKeysFrom, mouseLooks, nextCameraMode, overviewPose, stepFreeCam } from './spectate/camera.ts';
import { type SpectatorAction, scrollsPage, spectatorAction, stepTarget } from './spectate/controls.ts';
import { ViewModel } from './render/viewmodel.ts';
import { weaponIcon } from './render/weapon-icons.ts';
import { LEAN_ROLL_RAD, SPRINT_FOV_KICK_DEG, movementEye } from './render/movement-pose.ts';
import { easeFov } from './render/zoom.ts';
import { type WorldView, applyShadowQuality, buildWorld, followShadow } from './render/world.ts';

// Typing rhythm of the bug keyboard while planting or defusing, in ms between keystrokes.
const KEYSTROKE_MIN_MS = 55;
const KEYSTROKE_JITTER_MS = 90;

/** One per page, so the performance suggestion shows at most once however many matches are joined. */
const performanceHint = new FpsHintWatch();

interface Snap {
  t: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  flags: number;
  w: number;
  lean: number;
}

interface Remote {
  id: number;
  avatar: Avatar;
  buf: Snap[];
  visible: boolean;
  last: THREE.Vector3;
  speed: number;
  step: number;
  ground: boolean;
  dropping: boolean;
  sliding: boolean;
  reload: ReloadPlayback;
  wader: Wader;
}

export interface Welcome {
  spectator: SpectatorInfo | null;
  id: number;
  time: number;
  roster: RosterEntry[];
  match: MatchInfo;
  maxPlayers: number;
  token: string;
  ready: Readiness;
  idleKickMs: number | null;
  idleKickWarmupMs: number | null;
}

export interface PodiumData {
  mode: GameMode;
  featured: ResultRow[]; // who stands on the podium (TDM: best of the winning team)
  results: ResultRow[]; // full ranking, including both teams
  myId: number;
  winner: number; // TDM winning team, -1 draw / FFA
  teams: number[];
  myTeam: number;
  colorFor: (r: ResultRow) => string;
  vote: VoteInfo | null;
}

export type TeamPanel =
  | { kind: 'player'; team: number; canSwitch: boolean }
  | { kind: 'spectator' };

export interface UiHooks {
  /** Asks the shell to swap this spectator connection for a player one. */
  joinGame(): void;
  showClickToPlay(show: boolean): void;
  showMenu(show: boolean, panel?: TeamPanel | null): void;
  showPodium(data: PodiumData | null, next: string): void;
  updateVotes(counts: number[], mine: number): void;
  updatePodiumCountdown(seconds: number): void;
  /** Seconds left to confirm "pronto" before the server kicks the player, null once confirmed. */
  updateReadyCountdown(seconds: number | null): void;
  disconnected(reason: string, code: number): void;
}

/**
 * Kill-streak titles and their stingers. Each title is paired with the
 * Quake / Unreal announcer line it echoes; the sound is synthesized to match.
 */
const STREAKS: Record<number, { text: string; sound: StreakSound }> = {
  2: { text: 'double kill', sound: 'double' }, // Double Kill
  3: { text: 'triple kill', sound: 'triple' }, // Triple Kill
  4: { text: 'multi kill', sound: 'multi' }, // Multi Kill
  5: { text: 'rampage!', sound: 'rampage' }, // Rampage
  7: { text: 'imparável', sound: 'unstoppable' }, // Unstoppable
  10: { text: 'deus da forja', sound: 'godlike' }, // Godlike
};

const v3 = new THREE.Vector3();
const v3b = new THREE.Vector3();
const fxPoint = new THREE.Vector3();
const shotOrigin = new THREE.Vector3();
const shotMuzzle = new THREE.Vector3();
const shotEnd = new THREE.Vector3();
const fxDir = new THREE.Vector3();

/** Shooter key of the local player in the per-shooter gun effects; remote players use their id. */
const LOCAL_SHOOTER = -1;
/** Units in front of the camera where a viewmodel point is re-created in the world scene. */
const VIEWMODEL_MUZZLE_FX_DISTANCE_UNITS = 30;
const VIEWMODEL_MAGAZINE_FX_DISTANCE_UNITS = 22;
/** Half-width of the floor probe under a magazine or casing. */
const DEBRIS_PROBE_HALF_SIZE_UNITS = 2;
/** The kill feed line when the light starts heading for a phase. */
const DAY_PHASE_NOTICE: Readonly<Record<DayPhase, string>> = { day: 'amanheceu', afternoon: 'fim de tarde', night: 'anoitecendo…' };

export class ClientGame {
  readonly renderer: THREE.WebGLRenderer;
  readonly input: Input;
  readonly hud: Hud;
  readonly sfx: Sfx;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(74, 1, 1, 12000);
  private readonly effects: Effects;
  private readonly view: ViewModel;
  private readonly podium = new PodiumScene();
  private readonly muzzleLight = new THREE.PointLight('#ffcf8a', 0, 420, 0);
  private world: WorldView | null = null;
  private ventHum: VentHum | null = null;
  private collision!: CollisionWorld;
  private map!: MapDef;
  private mapIndex = -1;
  private dayLooks: Record<DayPhase, DayLook> | null = null;
  private readonly dayLook = createLook();
  private readonly dayCycle: DayCycle = { phase: 'day', next: 'afternoon', blend: 0 };
  private dayLit = false;
  private dayAnnounced: DayPhase | null = null;

  readonly myId: number;
  private readonly names = new Map<number, { name: string; personal: string; team: number; bot: boolean }>();
  private myVote = -1;
  private voteCounts: number[] = [];
  private teamScores = [0, 0];
  private readonly online = new Set<number>();
  private readonly scores = new Map<number, { kills: number; deaths: number; ping: number; streak: number; hs: number }>();
  match: MatchInfo;

  private readonly me: PlayerState = createPlayerState();
  private readonly serverState: PlayerState = createPlayerState();
  private prev = new THREE.Vector3();
  private spectator: SpectatorInfo | null;
  /** Until 'ready' is sent the player stays out of the world. */
  private ready: Readiness;
  private readonly idleKickMs: number | null;
  private readonly idleKickWarmupMs: number | null;
  /** Phase the idle clock last ran in: the server restarts it when the match starts. */
  private idlePhase: MatchInfo['phase'] | null = null;
  /** Local mirror of the server's idle clock, only to warn before the kick. */
  private lastActiveAt = performance.now();
  private idleWarned = false;
  private lastCmdYaw = 0;
  private lastCmdPitch = 0;
  private followedId = -1;
  private cameraMode: CameraMode = 'first';
  /** Where the spectator camera stood last frame: the start of the free camera and the view while nobody can be followed. */
  private spectatorPose: Pose = { x: 0, y: 700, z: 0, yaw: 0, pitch: -0.6 };
  private readonly heldKeys = new Set<string>();
  private readonly followedView = new FollowedViewTracker();
  private viewColorFor = -1;
  private alive = false;
  private pending: Cmd[] = [];
  private outbox: Cmd[] = [];
  private seq = 0;
  private correction = new THREE.Vector3();
  private eye = STAND_EYE;
  private spectatorEye = STAND_EYE;
  private eyeTargetId = -1;
  private punch = 0;
  private stepAcc = 0;
  private readonly localWader = new Wader();
  private readonly localReload = new ReloadPlayback();

  private readonly remotes = new Map<number, Remote>();
  private flags: FlagView[] = [];
  private flagRenderer?: FlagsView;
  private lunch: LunchView | null = null;
  private colleaguesView?: ColleaguesView;
  private bomb: BombView | null = null;
  private announcedBombRound = '';
  private bombRenderer?: BombRenderer;
  private nextBombBeepAt = 0;
  private defuseVariant = 0;
  private defuseBanner: DefuseBanner | null = null;
  private lastButtons = 0;
  private nextKeystrokeAt = 0;
  private readonly airdrops = new Map<number, AirdropView>();

  private clockOffset = 0;
  private rtt = 0;
  private gotPong = false;
  private accum = 0;
  private lastFrame = 0;
  private tickCount = 0;
  private running = true;
  private raf = 0;
  private lastPing = 0;
  private fps = 0;
  private fpsAcc = 0;
  private fpsN = 0;
  private appliedQuality: Quality | null = null;
  private lastBeep = -1;

  private deathAt = 0;
  private deathPos = new THREE.Vector3();
  private killerId = -1;
  private scoreboardOpen = false;
  private chatOpen = false;
  private radioMenu: OpenRadioMenu = null;
  private readonly speakRadio = createSpeaker(RADIO_VOICE, 'radio');
  private podiumActive = false;
  /** The graphics card can run the light ray-marched lighting; cleared for good if it ever throws. */
  private lightRtAvailable = false;
  private lightRt: LightRt | null = null;
  private lightRtLevel: RtLevel = 'off';
  /** Lowered by the frame-time governor and kept for the rest of the match. */
  private rtCeiling: RtLevel = 'high';
  private readonly rtGovernor = new RtGovernor();
  private menuOpen = false;
  private elapsed = 0;

  constructor(
    private readonly container: HTMLElement,
    private readonly net: Connection,
    private settings: Settings,
    welcome: Welcome,
    private readonly ui: UiHooks,
  ) {
    this.spectator = welcome.spectator;
    this.ready = welcome.spectator ? { kind: 'confirmed' } : welcome.ready;
    this.idleKickMs = welcome.spectator ? null : welcome.idleKickMs;
    this.idleKickWarmupMs = welcome.spectator ? null : welcome.idleKickWarmupMs;
    this.myId = welcome.id;
    this.match = welcome.match;
    this.clockOffset = welcome.time - performance.now();

    this.renderer = new THREE.WebGLRenderer({ antialias: QUALITY[settings.quality].antialias, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = DAY_EXPOSURE;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.autoClear = true;
    this.lightRtAvailable = lightRtSupported(readGpuFacts(this.renderer));
    container.append(this.renderer.domElement);
    this.renderer.domElement.tabIndex = -1;

    this.input = new Input(this.renderer.domElement);
    this.input.sensitivity = settings.sensitivity;
    this.input.onKey = (code, down, e) => this.onKey(code, down, e);
    this.hud = new Hud(container);
    this.sfx = new Sfx(settings.volume, settings.soundPack);
    this.sfx.setAnnouncer(settings.announcer);
    this.effects = new Effects(this.scene);
    this.view = new ViewModel(PLAYER_COLORS[settings.color], settings.quality);
    this.view.setLeftHanded(settings.leftHanded);
    this.applyQuality();
    this.scene.add(this.camera, this.muzzleLight);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size: QUALITY[settings.quality].envMapPx }).texture;
    this.view.setEnvironment(env);
    this.podium.scene.environment = env;
    this.podium.scene.environmentIntensity = 0.4;
    pmrem.dispose();
    if (import.meta.env.DEV) (window as unknown as { __game: ClientGame }).__game = this;

    this.setRoster(welcome.roster);
    this.loadMap(this.match.map);

    net.onMessage((m) => this.onMessage(m));
    net.onClose((code, reason) => {
      if (!this.running) return;
      this.running = false;
      if (document.pointerLockElement) document.exitPointerLock();
      const why =
        reason === 'policy' ? 'Conexão encerrada pelo servidor (tráfego inválido).' : code === 1006 ? 'A conexão caiu.' : reason || 'Desconectado do servidor.';
      this.ui.disconnected(why, code);
    });

    this.renderer.domElement.addEventListener('click', () => {
      if (this.spectator) { this.onSpectatorClick(); return; }
      if (!this.input.locked && !this.menuOpen) void this.requestPlay();
    });
    this.renderer.domElement.addEventListener('contextmenu', (e) => {
      if (!this.spectator) return;
      e.preventDefault();
      if (!this.menuOpen && this.cameraMode !== 'free') this.stepTarget(-1);
    });
    this.hud.onSpectate = (action) => this.runSpectatorAction(action);
    document.addEventListener('pointerlockchange', this.onLockChange);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('beforeunload', this.onBeforeUnload);
    this.hud.chatInput.addEventListener('keydown', this.onChatKey);
    this.onResize();
    this.ui.showClickToPlay(!this.spectator);
    if (this.match.phase === 'podium') this.enterPodium(this.match);
    this.lastFrame = performance.now();
    performanceHint.restart();
    this.rtGovernor.restart();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ------------------------------------------------------------------ setup

  private onBeforeUnload = (e: BeforeUnloadEvent): void => {
    // browsers reserve Ctrl+W, so keydown cannot cancel it; the leave-site prompt is the only guard (crouch + forward closes the tab otherwise)
    if (this.running) {
      e.preventDefault();
      e.returnValue = '';
    }
  };

  private onResize = (): void => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h, false);
    this.lightRt?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.view.camera.aspect = w / h;
    this.view.camera.updateProjectionMatrix();
    this.podium.resize(w, h);
  };

  private onBlur = (): void => {
    this.heldKeys.clear();
  };

  private onLockChange = (): void => {
    if (!this.running) return;
    if (!this.input.locked) this.setRadioMenu(null); // losing the pointer (Esc) closes the radio menu
    if (this.input.locked) {
      this.menuOpen = false;
      this.ui.showMenu(false);
      this.ui.showClickToPlay(false);
      this.sfx.resume();
    } else if (this.spectator) {
      this.heldKeys.clear(); // Esc only frees the mouse for a spectator; the menu has its own press
    } else if (!this.chatOpen && !this.podiumActive) {
      this.menuOpen = true;
      this.ui.showMenu(true, this.teamPanel());
    }
  };

  async requestPlay(): Promise<void> {
    this.sfx.resume();
    if (this.spectator) { this.menuOpen = false; this.ui.showMenu(false); return; }
    this.confirmReady();
    await this.input.lock();
  }

  private confirmReady(): void {
    if (this.ready.kind === 'confirmed') return;
    this.ready = { kind: 'confirmed' };
    this.net.send({ t: 'ready' });
    this.ui.updateReadyCountdown(null);
  }

  applySettings(s: Settings): void {
    this.settings = s;
    if (s.quality !== this.appliedQuality) {
      this.applyQuality();
      this.onResize();
    }
    this.applyLightRt(this.wantedRtLevel());
    this.input.sensitivity = s.sensitivity;
    this.view.setLeftHanded(s.leftHanded);
    this.sfx.setVolume(s.volume);
    this.sfx.setAnnouncer(s.announcer);
    if (this.sfx.setPack(s.soundPack)) this.sfx.shot(s.primary, null, false);
    if (!this.spectator) this.net.send({ t: 'loadout', primary: s.primary });
  }

  /** The parts of a tier that can change mid-match. Edge smoothing needs a new renderer, so it waits for the next join. */
  private applyQuality(): void {
    const quality = this.settings.quality;
    const profile = QUALITY[quality];
    this.appliedQuality = quality;
    this.renderer.setPixelRatio(renderPixelRatio(profile, window.devicePixelRatio));
    this.applyLightRt(this.wantedRtLevel());
    this.effects.setQuality(quality);
    this.view.setQuality(quality);
    if (this.world) {
      applyShadowQuality(this.world.sun, profile);
      this.world.setQuality(profile);
    }
    this.bombRenderer?.setScreenRefreshMs(profile.laptopScreenRefreshMs);
  }

  /** The level the player chose, on a tier that has the pass. */
  private wantedRtLevel(): RtLevel {
    return QUALITY[this.settings.quality].lightRt ? capRtLevel(this.settings.lightRt, this.rtCeiling) : 'off';
  }

  /** Builds the ray-marched lighting at a level for a card that can run it, and tears it down for `off`. A level change rebuilds it. */
  private applyLightRt(level: RtLevel): void {
    const profile = this.lightRtAvailable ? RT[level] : null;
    if (!profile) {
      this.lightRt?.dispose();
      this.lightRt = null;
      this.lightRtLevel = 'off';
      return;
    }
    if (this.lightRt && this.lightRtLevel === level) return;
    this.lightRt?.dispose();
    this.lightRt = null;
    this.lightRtLevel = 'off';
    this.rtGovernor.restart();
    try {
      this.lightRt = new LightRt(this.renderer, this.scene, this.camera, this.container.clientWidth || 1, this.container.clientHeight || 1, profile);
      this.lightRtLevel = level;
    } catch {
      this.lightRtAvailable = false;
    }
  }

  /** Lights the world for the shared clock's phase. Settled phases cost nothing, a transition only rewrites values. */
  private updateDayLight(world: WorldView): void {
    const looks = this.dayLooks;
    if (!looks) return;
    const cycle = this.dayCycle;
    const settled = this.dayLit && cycle.blend === 0;
    const before = cycle.phase;
    dayCycleAt(this.serverNow(), cycle);
    this.announceDayPhase(dayCycleTarget(cycle));
    if (settled && cycle.blend === 0 && cycle.phase === before) return;
    this.dayLit = true;
    const look = this.dayLook;
    lookAt(look, looks, cycle);
    world.applyLook(look);
    this.renderer.toneMappingExposure = look.exposure;
    this.view.setLighting(look.hemiSky, look.hemiGround, look.sun, look.sunIntensity, look.hemiIntensity / looks.day.hemiIntensity);
  }

  private announceDayPhase(target: DayPhase): void {
    if (target === this.dayAnnounced) return;
    if (this.dayAnnounced !== null) this.hud.info(DAY_PHASE_NOTICE[target]);
    this.dayAnnounced = target;
  }

  private drawScene(): void {
    if (this.lightRt) {
      try {
        this.lightRt.render();
        return;
      } catch {
        this.lightRtAvailable = false;
        this.applyLightRt('off');
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  private setRoster(roster: RosterEntry[]): void {
    this.online.clear();
    for (const [id, name, color, team, bot] of roster) {
      const prev = this.names.get(id);
      this.names.set(id, { name, personal: PLAYER_COLORS[color] ?? '#f0f0f0', team, bot: bot === 1 });
      this.online.add(id);
      if (prev && prev.team !== team) this.dropAvatar(id); // rebuilt next snapshot in the new team colour
    }
    for (const id of [...this.remotes.keys()]) if (!this.online.has(id)) this.dropAvatar(id);
    this.view.setSleeveColor(this.nameOf(this.myId).color);
  }

  private dropAvatar(id: number): void {
    const r = this.remotes.get(id);
    if (!r) return;
    this.scene.remove(r.avatar.root);
    r.avatar.dispose();
    this.remotes.delete(id);
  }

  /** Display identity: team colour in TDM, personal colour in free-for-all. */
  private feedInvolvement(killerId: number, victimId: number): FeedInvolvement {
    if (victimId === this.myId) return 'death';
    return killerId === this.myId ? 'kill' : null;
  }

  private nameOf(id: number): { name: string; color: string; team: number } {
    const n = this.names.get(id);
    if (!n) return { name: `#${id}`, color: '#9b9b94', team: -1 };
    const color = isTeamMode(this.match.mode) && n.team >= 0 ? TEAMS[n.team].color : n.personal;
    return { name: n.name, color, team: n.team };
  }

  get myTeam(): number {
    return this.names.get(this.myId)?.team ?? -1;
  }

  private isTeammate(id: number): boolean {
    const t = this.myTeam;
    return isTeamMode(this.match.mode) && t >= 0 && this.names.get(id)?.team === t;
  }

  teamPanel(): TeamPanel | null {
    if (this.spectator) return { kind: 'spectator' };
    if (!isTeamMode(this.match.mode) || this.myTeam < 0) return null;
    let mine = 0;
    let other = 0;
    for (const id of this.online) {
      const t = this.names.get(id)?.team;
      if (t === this.myTeam) mine++;
      else if (t === 1 - this.myTeam) other++;
    }
    return { kind: 'player', team: this.myTeam, canSwitch: this.match.phase !== 'podium' && other < mine };
  }

  switchTeam(): void {
    if (this.spectator) return;
    const st = this.teamPanel();
    if (st?.kind === 'player' && st.canSwitch) this.net.send({ t: 'team', team: 1 - st.team });
  }

  private loadMap(index: number): void {
    if (index === this.mapIndex) return;
    this.mapIndex = index;
    this.map = getMap(index);
    this.collision = new CollisionWorld(this.map);
    this.spectatorPose = overviewPose(this.map.bounds);
    this.world?.dispose();
    this.world = buildWorld(this.map, this.scene, QUALITY[this.settings.quality]);
    this.ventHum?.dispose();
    this.ventHum = new VentHum(this.map.props.filter((p) => p.kind === 'vent'), (at) => this.sfx.airLoop(at));
    this.dayLooks = buildLooks(this.map.theme);
    this.dayLit = false;
    for (const a of this.airdrops.values()) {
      this.scene.remove(a.group);
      a.dispose();
    }
    this.airdrops.clear();
    this.flags = [];
    this.bomb = null;
    this.announcedBombRound = '';
    const bases = this.map.flagBases.map(base => ({ ...base, y: this.collision.groundBelow(base.x, this.map.dropHeight, base.z, PLAYER_RADIUS) }));
    this.flagRenderer?.dispose();
    this.flagRenderer = new FlagsView(bases);
    this.scene.add(this.flagRenderer.group);
    this.lunch = null;
    this.colleaguesView?.dispose();
    this.colleaguesView = new ColleaguesView();
    this.scene.add(this.colleaguesView.group);
    this.bombRenderer?.dispose();
    this.bombRenderer = new BombRenderer(bases, QUALITY[this.settings.quality].laptopScreenRefreshMs);
    this.scene.add(this.bombRenderer.group);
    for (const r of this.remotes.values()) r.buf.length = 0;
    this.effects.clear();
  }

  serverNow(): number {
    return performance.now() + this.clockOffset;
  }

  // ------------------------------------------------------------------ messages

  private onMessage(m: ServerMsg): void {
    switch (m.t) {
      case 'spectate':
        this.spectator = m.state;
        this.followedId = -1;
        break;
      case 'snap':
        this.onSnap(m);
        break;
      case 'ev':
        for (const e of m.e) this.onEvent(e);
        break;
      case 'roster':
        this.setRoster(m.roster);
        break;
      case 'score':
        this.scores.clear();
        for (const [id, kills, deaths, ping, streak, hs] of m.s) this.scores.set(id, { kills, deaths, ping, streak, hs });
        if (Array.isArray(m.ts)) this.teamScores = m.ts;
        break;
      case 'match':
        this.onMatch(m.match);
        break;
      case 'readiness':
        if (this.spectator) break;
        this.ready = m.ready;
        // Still holding the mouse (clicked during the podium): that click already was the "pronto".
        if (this.input.locked) this.confirmReady();
        break;
      case 'votes':
        this.voteCounts = m.counts;
        this.ui.updateVotes(m.counts, this.myVote);
        break;
      case 'pong': {
        const now = performance.now();
        const rtt = now - m.c;
        this.rtt = this.gotPong ? this.rtt * 0.8 + rtt * 0.2 : rtt;
        const sample = m.s + rtt / 2 - now;
        this.clockOffset = this.gotPong ? this.clockOffset + (sample - this.clockOffset) * 0.15 : sample;
        this.gotPong = true;
        break;
      }
      case 'chat': {
        const n = this.nameOf(m.id);
        this.hud.chatLine(n.name, n.color, m.text);
        break;
      }
      case 'radio': {
        const line = radioLine(m.line);
        if (!line) break;
        const n = this.nameOf(m.id);
        this.hud.radioLine(n.name, n.color, line.text);
        if (this.settings.radioVoice) this.speakRadio(line.speech, this.settings.volume);
        break;
      }
      default:
        break;
    }
  }

  private onSnap(m: Extract<ServerMsg, { t: 'snap' }>): void {
    this.flags = flagViews(m.fl);
    this.lunch = this.match.mode === 'almoco' ? lunchView(m.lu, m.lc) : null;
    const bomb = this.match.mode === 'defuse' ? bombView(m.bm) : null;
    this.bomb = bomb;
    this.collision.setProp(bomb ? bombStandBox(bomb.state, bomb) : null);
    if (bomb && this.match.phase !== 'podium') {
      const key = `${bomb.attackers}:${bomb.variant}`;
      if (bomb.blackFriday && key !== this.announcedBombRound) {
        this.hud.announceBlackFriday();
        this.hud.info(`${BLACK_FRIDAY_TAG}! ${BLACK_FRIDAY_PITCH}`, '#ffd54f');
        this.sfx.blackFriday();
      }
      if (!bomb.blackFriday && this.announcedBombRound !== '') this.hud.clearBlackFridayBanner();
      this.announcedBombRound = bomb.blackFriday ? key : '';
    } else {
      if (this.announcedBombRound !== '') this.hud.clearBlackFridayBanner();
      this.announcedBombRound = '';
    }
    // drift guard: snapshots should never be "from the future"
    const est = this.serverNow();
    if (m.time > est + 30) this.clockOffset += (m.time - est) * 0.5;

    if (m.me) {
      unpackState(m.me, this.serverState);
      this.pending = this.pending.filter((c) => c.seq > m.ack);
      if (!this.alive) {
        this.alive = true;
        this.input.clearProne();
        copyState(this.me, this.serverState);
        for (const c of this.pending) this.predict(this.me, c);
        this.prev.set(this.me.x, this.me.y, this.me.z);
        this.eye = STANCES[this.me.stance].eye;
        this.correction.set(0, 0, 0);
        // Skydivers face the centre of the arena below.
        this.input.yaw = Math.atan2(this.me.x, this.me.z);
        this.input.pitch = -0.55;
        this.hud.setDeath(null);
        this.view.setWeapon(this.me.weapon);
      } else {
        const ox = this.me.x;
        const oy = this.me.y;
        const oz = this.me.z;
        copyState(this.me, this.serverState);
        for (const c of this.pending) this.predict(this.me, c);
        const dx = ox - this.me.x;
        const dy = oy - this.me.y;
        const dz = oz - this.me.z;
        const d = Math.hypot(dx, dy, dz);
        if (d > 0.001) {
          this.prev.x -= dx;
          this.prev.y -= dy;
          this.prev.z -= dz;
          if (d < 64) this.correction.add(v3.set(dx, dy, dz));
          else this.correction.set(0, 0, 0);
        }
      }
    } else if (this.alive) {
      this.alive = false;
      this.input.clearProne();
    }

    const seen = new Set<number>();
    for (const p of m.ps) {
      const [id, x, y, z, yaw, pitch, flags, w, lean = 0] = p;
      if (id === this.myId) continue;
      seen.add(id);
      let r = this.remotes.get(id);
      if (!r) {
        const n = this.nameOf(id);
        r = { id, avatar: new Avatar(n.name, n.color), buf: [], visible: false, last: new THREE.Vector3(x, y, z), speed: 0, step: 0, ground: true, dropping: false, sliding: false, reload: new ReloadPlayback(), wader: new Wader() };
        this.scene.add(r.avatar.root);
        this.remotes.set(id, r);
      }
      r.buf.push({ t: m.time, x, y, z, yaw, pitch, flags, w, lean });
      if (r.buf.length > 40) r.buf.shift();
    }
    for (const r of this.remotes.values()) {
      if (!seen.has(r.id)) {
        const lastSnap = r.buf[r.buf.length - 1];
        if (lastSnap && lastSnap.flags & RF_ALIVE) r.buf.push({ ...lastSnap, t: m.time, flags: 0 });
      }
    }

    const present = new Set<number>();
    for (const [id, x, y, z, w, landed] of m.ad) {
      present.add(id);
      let a = this.airdrops.get(id);
      if (!a) {
        a = new AirdropView(id, x, z, y, w as WeaponId);
        a.groundY = Math.max(0, this.collision.groundBelow(x, this.map.dropHeight + 300, z, 22));
        this.scene.add(a.group);
        this.airdrops.set(id, a);
      }
      a.target(y, landed === 1);
    }
    for (const [id, a] of this.airdrops) {
      if (!present.has(id)) {
        this.scene.remove(a.group);
        a.dispose();
        this.airdrops.delete(id);
      }
    }
  }

  private onEvent(e: GameEvent): void {
    switch (e.k) {
      case 'spray':
        this.effects.spray(new THREE.Vector3(...e.p), new THREE.Vector3(...e.n), e.r, this.names.get(e.id)?.personal ?? '#9b9b94');
        this.sfx.spray({ x: e.p[0], y: e.p[1], z: e.p[2] }, e.left === 0);
        break;
      case 'flag': {
        const actor = this.nameOf(e.by);
        this.hud.info(flagMessage(e.what, e.team, e.by, actor.name), e.by < 0 ? TEAMS[e.team].color : actor.color);
        if (e.what !== 'drop') this.sfx.flag(e.what, (e.by < 0 ? e.team : actor.team) === this.myTeam);
        break;
      }
      case 'bomb':
        this.onBombEvent(e);
        break;
      case 'lunch':
        this.onLunchEvent(e);
        break;
      case 'shot':
        this.onRemoteShot(e);
        break;
      case 'hit': {
        if (e.by === this.myId && e.to !== this.myId) {
          this.hud.hit(e.hp <= 0 ? 'kill' : e.zone === 0 ? 'head' : 'body');
          if (e.zone === 0) this.sfx.headshot();
          else this.sfx.hitmarker();
          const r = this.remotes.get(e.to);
          if (r?.visible) this.effects.burst(v3.copy(r.avatar.root.position).setY(r.avatar.root.position.y + (e.zone === 0 ? 64 : 40)), this.nameOf(e.to).color, e.zone === 0 ? 16 : 8);
        }
        if (e.to === this.myId) {
          const [fx, , fz] = e.from;
          const ang = Math.atan2(-(fx - this.me.x), -(fz - this.me.z));
          const rel = ang - this.input.yaw;
          this.hud.damage(-rel);
          this.sfx.hurt();
          this.punch = Math.min(3, this.punch + e.dmg / 25);
        }
        break;
      }
      case 'kill': {
        const k = this.nameOf(e.by);
        const v = this.nameOf(e.to);
        const def = weaponDef(e.w);
        this.hud.killfeed(k.name, k.color, v.name, v.color, def.tag, weaponIcon(def.id), e.hs === 1, this.feedInvolvement(e.by, e.to));
        if (e.by === this.myId && e.to !== this.myId) {
          const tier = STREAKS[e.streak];
          this.sfx.kill(e.streak, tier?.sound ?? 'kill');
          if (tier) this.hud.announce(tier.text, `${e.streak} em sequência`);
          else if (e.hs) this.hud.announce('headshot', undefined, true);
        }
        if (e.to === this.myId) {
          this.alive = false;
          this.input.clearProne();
          this.deathAt = performance.now();
          this.deathPos.set(this.me.x, this.me.y, this.me.z);
          this.killerId = e.by;
          this.hud.setDeath({ killer: k.name, color: k.color, weapon: def.name, hs: e.hs === 1 });
          this.sfx.setWind(0);
        } else {
          const r = this.remotes.get(e.to);
          if (r?.visible) {
            const c = r.avatar.corpse();
            this.effects.corpse(c, r.avatar.root.rotation.y);
            this.effects.burst(v3.copy(r.avatar.root.position).setY(r.avatar.root.position.y + 40), v.color, 22);
            r.avatar.root.visible = false;
            r.visible = false;
          }
        }
        break;
      }
      case 'drop': {
        this.sfx.airdrop();
        const d = weaponDef(e.w);
        this.hud.announce('suprimento a caminho', `${d.name} (${d.tag}) · siga o feixe verde`);
        break;
      }
      case 'loot': {
        const def = weaponDef(e.w);
        if (e.id === this.myId) {
          this.sfx.loot();
          this.hud.announce(`${def.name.toLowerCase()} na mão`, def.zoomFov.length ? 'botão direito: mira 40° → 10° · fique parado pra acertar' : 'arma lendária + armadura completa');
          this.view.setWeapon(e.w as WeaponId);
        } else {
          this.hud.info(`${this.nameOf(e.id).name} pegou ${def.name}`);
        }
        break;
      }
      case 'join':
        if (e.id !== this.myId) this.hud.info(`${this.nameOf(e.id).name} entrou no jogo`);
        break;
      case 'leave':
        this.hud.info(`${this.nameOf(e.id).name} saiu`);
        break;
      case 'team': {
        const t = TEAMS[e.team];
        if (!t) break;
        if (e.id === this.myId) this.hud.announce(`agora você é ${t.name.toLowerCase()}`, e.auto ? 'balanceamento automático de times' : 'troca de time', true);
        else this.hud.info(`${this.nameOf(e.id).name} foi para os ${t.name}${e.auto ? ' (balanceamento)' : ''}`);
        break;
      }
    }
  }

  private readonly carrierPose = (id: number): CarrierPose | undefined => {
    if (id === this.myId && !this.spectator) return { x: this.me.x, y: this.me.y, z: this.me.z, yaw: this.input.yaw, firstPerson: true };
    const remote = this.remotes.get(id);
    if (!remote?.visible) return undefined;
    const p = remote.avatar.root.position;
    return { x: p.x, y: p.y, z: p.z, yaw: remote.avatar.root.rotation.y, firstPerson: this.spectator !== null && this.cameraMode === 'first' && id === this.followedId };
  };

  private onBombEvent(e: Extract<GameEvent, { k: 'bomb' }>): void {
    const actor = this.nameOf(e.by);
    this.hud.info(bombMessage(e.what, e.team, actor.name), e.by < 0 ? TEAMS[e.team].color : actor.color);
    if (e.what === 'plant' || e.what === 'defused') this.sfx.beep(true);
    if (e.what === 'take' && e.by === this.myId) this.sfx.bombTaken();
    if (e.what === 'defused' && e.by === this.laptopViewerId()) {
      this.defuseBanner = { variant: this.defuseVariant, until: this.serverNow() + DEFUSE_BANNER_MS };
    }
    if (e.what !== 'exploded') return;
    const at = this.bomb?.state === 'planted' ? this.bomb : this.bombRenderer?.position();
    if (!at) return;
    this.sfx.boom({ x: at.x, y: at.y, z: at.z });
    this.effects.burst(v3.set(at.x, at.y + 24, at.z), '#ff7a1a', 70);
    this.effects.burst(v3.set(at.x, at.y + 24, at.z), '#ffd23f', 40);
  }

  /** E pressed where it cannot plant or defuse: say why instead of failing silently. */
  private explainUse(): void {
    const bomb = this.bomb;
    const site = bomb && this.map.flagBases[1 - bomb.attackers];
    if (!bomb || !site) return;
    const reason = useRefusal({ bomb, myId: this.myId, myTeam: this.myTeam, me: this.me, site: { x: site.x, y: this.me.y, z: site.z }, name: id => this.nameOf(id).name, practice: this.match.phase === 'warmup' });
    if (!reason) return;
    this.hud.info(reason);
    this.sfx.denied();
  }

  /** Keyboard clatter from the laptop while someone plants or defuses it, so everyone nearby hears the race. */
  private typeOnBomb(): void {
    const bomb = this.bomb;
    const typingAt = bomb?.state === 'planting' ? this.carrierPose(bomb.carrier) : bomb?.state === 'planted' && bomb.defuser >= 0 ? bomb : undefined;
    const wall = performance.now();
    if (!typingAt || wall < this.nextKeystrokeAt) return;
    this.sfx.keystroke({ x: typingAt.x, y: typingAt.y, z: typingAt.z });
    this.nextKeystrokeAt = wall + KEYSTROKE_MIN_MS + Math.random() * KEYSTROKE_JITTER_MS;
  }

  private beepBomb(now: number): void {
    const bomb = this.bomb;
    if (bomb?.state !== 'planted') {
      this.nextBombBeepAt = 0;
      return;
    }
    const wall = performance.now();
    if (wall < this.nextBombBeepAt) return;
    const urgency = fuseUrgency(bomb, now);
    if (bomb.blackFriday) this.sfx.rushBeep(bomb, urgency);
    else this.sfx.bombBeep(bomb, urgency);
    this.nextBombBeepAt = wall + beepIntervalMs(urgency);
  }

  private updateBombHud(hud: Hud, now: number): void {
    const bomb = this.bomb;
    if (!bomb) {
      hud.setBomb({ text: null, plant: -1, role: null, blackFriday: false, carry: null, activity: null });
      hud.setDefuse(defuseBannerScene(this.defuseBanner, now));
      return;
    }
    hud.setBomb({
      text: bombStatus(bomb, now, this.myId, this.myTeam, id => this.nameOf(id).name, this.match.phase === 'warmup'),
      plant: plantProgress(bomb, now),
      role: bombRole(bomb, this.myTeam, this.match.phase === 'warmup'),
      blackFriday: bomb.blackFriday,
      carry: this.spectator ? null : carryNotice(bomb, this.myId),
      activity: this.spectator ? bombActivity(bomb, now, id => this.nameOf(id)) : null,
    });
    const defusing = bomb.state === 'planted' && bomb.defuser >= 0 && bomb.defuser === this.laptopViewerId();
    if (defusing) this.defuseVariant = bomb.variant;
    hud.setDefuse(defusing ? { variant: bomb.variant, progress: defuseProgress(bomb, now), timeMs: now } : defuseBannerScene(this.defuseBanner, now));
  }

  /** Whose hands the full-size laptop shows: yours, or the followed player's in first person; -1 for the other spectator cameras. */
  private laptopViewerId(): number {
    if (!this.spectator) return this.myId;
    return this.cameraMode === 'first' ? this.followedId : -1;
  }

  private onLunchEvent(e: Extract<GameEvent, { k: 'lunch' }>): void {
    const actor = this.nameOf(e.by);
    const text = lunchMessage(e, actor.name, LUNCH_COLLEAGUES[e.who] ?? 'colega', this.match.phase === 'live');
    if (e.what === 'served' || e.what === 'full') {
      this.hud.announce(e.what === 'full' ? 'acabaram os lugares' : 'todo mundo almoçou', text, e.team !== this.myTeam);
      return;
    }
    this.hud.info(text, e.by >= 0 ? actor.color : TEAMS[e.team].color);
  }

  private onMatch(info: MatchInfo): void {
    const before = this.match;
    this.match = info;
    if (info.mode !== 'ctf') this.flags = [];
    if (info.mode !== 'almoco') this.lunch = null;
    if (info.mode !== 'defuse') {
      this.bomb = null;
      this.announcedBombRound = '';
      this.collision.setProp(null);
    } else if (before.phase !== 'live' && info.phase === 'live') {
      this.announcedBombRound = '';
    }
    if (Array.isArray(info.teams)) this.teamScores = info.teams;
    if (info.mode !== before.mode) {
      this.dropAllAvatars();
      this.view.setSleeveColor(this.nameOf(this.myId).color);
    }
    if (info.map !== this.mapIndex) this.loadMap(info.map);
    if (info.phase === 'podium') {
      this.enterPodium(info);
    } else {
      if (this.podiumActive) this.exitPodium();
      const min = Math.round((info.endsAt - this.serverNow()) / 60000);
      if (info.phase === 'live' && isTeamMode(info.mode)) {
        const t = TEAMS[this.myTeam];
        this.hud.announce(MODE_LABEL[info.mode], `${t ? `você é dos ${t.name}` : this.map.name} · ${info.limit ? `${info.limit} ${scoreUnit(info.mode)} ou ` : ''}${min} min`);
      } else if (info.phase === 'live') this.hud.announce('todos contra todos', `${this.map.name} · ${min} min · mais kills vence`);
      else if (before.phase !== 'warmup') this.hud.announce('aquecimento', 'esperando mais jogadores', true);
    }
  }

  private dropAllAvatars(): void {
    for (const id of [...this.remotes.keys()]) this.dropAvatar(id);
  }

  private enterPodium(info: MatchInfo): void {
    const results = info.results ?? [];
    const tdm = isTeamMode(info.mode);
    const winner = tdm ? (info.winner ?? -1) : -1;
    const featured = winner >= 0 ? results.filter((r) => r.team === winner) : results;
    const colorFor = (r: ResultRow) => (tdm && r.team >= 0 ? TEAMS[r.team].color : (PLAYER_COLORS[r.color] ?? '#f0f0f0'));
    this.podiumActive = true;
    this.podium.setResults(featured.slice(0, 3), colorFor);
    this.hud.setVisible(false);
    this.sfx.fanfare();
    this.sfx.setWind(0);
    const next = info.next ? `${getMap(info.next.map).name} · ${MODE_LABEL[info.next.mode]}` : '';
    this.myVote = -1;
    this.voteCounts = info.vote?.counts ?? [];
    // free the mouse so people can click a map in the vote
    if (document.pointerLockElement) document.exitPointerLock();
    this.menuOpen = false;
    this.setRadioMenu(null);
    this.ui.showMenu(false);
    this.ui.showPodium({ mode: info.mode, featured, results, myId: this.myId, winner, teams: info.teams ?? [0, 0], myTeam: this.myTeam, colorFor, vote: this.spectator ? null : info.vote ?? null }, next);
  }

  /** Map vote on the podium (keys 1-3 or click). */
  vote(option: number): void {
    if (this.spectator || !this.podiumActive || !this.match.vote || option < 0 || option >= this.match.vote.options.length) return;
    this.myVote = option;
    this.net.send({ t: 'vote', option });
    this.ui.updateVotes(this.voteCounts, this.myVote);
    this.sfx.click();
  }

  private exitPodium(): void {
    this.podiumActive = false;
    this.deathAt = 0;
    this.hud.setDeath(null);
    this.hud.setVisible(true);
    this.ui.showPodium(null, '');
    this.effects.clear();
    if (!this.input.locked) this.ui.showClickToPlay(!this.spectator);
  }

  // ------------------------------------------------------------------ input

  private onKey(code: string, down: boolean, e: KeyboardEvent): boolean {
    if (this.chatOpen) return true;
    if (this.spectator) return this.onSpectatorKey(code, down, e);
    if (this.podiumActive && down && /^(Digit|Numpad)[1-3]$/.test(code)) {
      this.vote(Number(code.slice(-1)) - 1);
      return true;
    }
    if (down) {
      const radio = radioMenuKey(this.radioMenu, code, this.canUseRadio());
      if (radio.consumed) {
        if (!e.repeat) this.applyRadioKey(radio);
        return true;
      }
    }
    if (code === 'KeyG') {
      if (down && !e.repeat && this.input.locked && !this.menuOpen && !this.podiumActive) this.net.send({ t: 'spray' });
      return true;
    }
    if (code === 'Tab') {
      if (this.input.locked) e.preventDefault();
      this.scoreboardOpen = down;
      return true;
    }
    if (down && this.input.locked && (code === 'Enter' || code === 'KeyY' || code === 'KeyT')) {
      e.preventDefault();
      this.chatOpen = true;
      this.setRadioMenu(null);
      this.input.enabled = false;
      this.input.releaseAll();
      this.hud.openChat(true);
      return true;
    }
    return false;
  }

  private canUseRadio(): boolean {
    return this.input.locked && !this.chatOpen && !this.podiumActive && !this.spectator && !this.menuOpen;
  }

  private applyRadioKey(r: RadioKeyResult): void {
    this.setRadioMenu(r.open);
    if (r.pick !== undefined) this.net.send({ t: 'radio', line: r.pick });
  }

  private setRadioMenu(open: OpenRadioMenu): void {
    this.radioMenu = open;
    this.hud.showRadioMenu(open === null ? null : (radioMenuById(open) ?? null));
  }

  private onSpectatorKey(code: string, down: boolean, e: KeyboardEvent): boolean {
    // With the menu open Tab keeps its job of moving focus through the menu.
    if (code === 'Tab' && !this.menuOpen) {
      e.preventDefault();
      this.scoreboardOpen = down;
      return true;
    }
    if (down) this.heldKeys.add(code);
    else this.heldKeys.delete(code);
    const action = spectatorAction(code);
    if (!down || e.repeat) return true;
    if (!this.menuOpen && scrollsPage(code)) e.preventDefault();
    if (action) this.runSpectatorAction(action);
    return true;
  }

  private onSpectatorClick(): void {
    if (this.menuOpen) return;
    if (mouseLooks(this.cameraMode) && !this.input.locked) void this.input.lock();
    else if (this.cameraMode !== 'free') this.stepTarget(1);
  }

  private runSpectatorAction(action: SpectatorAction): void {
    switch (action.kind) {
      case 'join':
        this.ui.joinGame();
        return;
      case 'menu':
        if (this.input.locked) return; // the browser is already releasing the mouse for this press
        this.menuOpen = !this.menuOpen;
        this.ui.showMenu(this.menuOpen, this.teamPanel());
        return;
    }
    if (this.menuOpen) return;
    switch (action.kind) {
      case 'mode':
        this.setCameraMode(nextCameraMode(this.cameraMode));
        return;
      case 'next':
        this.stepTarget(1);
        return;
      case 'prev':
        this.stepTarget(-1);
        return;
      case 'team':
        if (isTeamMode(this.match.mode)) this.net.send({ t: 'watch', team: action.team });
        return;
    }
  }

  private setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    if (mouseLooks(mode)) {
      this.input.yaw = this.spectatorPose.yaw;
      this.input.pitch = this.spectatorPose.pitch;
    } else if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  private onChatKey = (e: KeyboardEvent): void => {
    e.stopPropagation();
    if (e.code === 'Enter') {
      const text = this.hud.chatInput.value.trim();
      if (text) this.net.send({ t: 'chat', text: text.slice(0, 100) });
      this.closeChat();
    } else if (e.code === 'Escape') {
      this.closeChat();
    }
  };

  private closeChat(): void {
    this.chatOpen = false;
    this.input.enabled = true;
    this.hud.openChat(false);
    if (!this.input.locked) void this.requestPlay();
  }

  private resolveWeaponRequest(req: number): number {
    if (req !== 5 && req !== 6) return req;
    const order = [this.me.primary, WEAPON.PISTOL, WEAPON.HAMMER];
    const idx = Math.max(0, order.indexOf(this.me.weapon));
    const next = (idx + (req === 5 ? 1 : 2)) % 3;
    return next + 1;
  }

  // ------------------------------------------------------------------ simulation

  private tick(): void {
    if (this.spectator) return;
    this.tickCount++;
    const renderTime = Math.max(0, this.serverNow() - INTERP_DELAY_MS);
    const canPlay = this.alive && this.match.phase !== 'podium';
    if (!canPlay) this.input.clearProne();
    const buttons = this.input.buttons();
    if (canPlay && buttons & BTN.USE && !(this.lastButtons & BTN.USE)) this.explainUse();
    const req = this.resolveWeaponRequest(this.input.takeWeaponRequest());
    const cmd: Cmd = { seq: ++this.seq, buttons, yaw: this.input.yaw, pitch: this.input.pitch, weapon: req, interp: Math.round(renderTime) };
    this.warnIdle(cmd);
    this.lastButtons = buttons;
    if (canPlay) {
      const s = this.me;
      const before = { ground: s.onGround, drop: s.dropping, reload: s.reload, weapon: s.weapon, nextFire: s.nextFire, vy: s.vy, zoom: s.zoom, slide: s.slide, sprinting: s.sprinting };
      this.prev.set(s.x, s.y, s.z);
      const shot = this.predict(s, cmd);
      this.pending.push(cmd);
      if (this.pending.length > 180) this.pending.shift();
      if (shot) this.onLocalShot(shot);
      this.localSounds(before, cmd, shot);
    }
    this.outbox.push(cmd);
    if (this.tickCount % 2 === 0) this.flush();
  }

  private warnIdle(cmd: Cmd): void {
    const now = performance.now();
    const active = isActiveCommand(cmd, { buttons: this.lastButtons, yaw: this.lastCmdYaw, pitch: this.lastCmdPitch });
    this.lastCmdYaw = cmd.yaw;
    this.lastCmdPitch = cmd.pitch;
    const phase = this.match.phase;
    const timeout = phase === 'warmup' ? this.idleKickWarmupMs : this.idleKickMs;
    const phaseChanged = phase !== this.idlePhase;
    this.idlePhase = phase;
    if (active || phaseChanged || timeout === null || this.ready.kind === 'pending' || phase === 'podium') {
      this.lastActiveAt = now;
      this.idleWarned = false;
      return;
    }
    const lead = Math.min(IDLE_WARNING_LEAD_MS, timeout / 2);
    if (this.idleWarned || now - this.lastActiveAt < timeout - lead) return;
    this.idleWarned = true;
    const left = Math.round(lead / 1000);
    this.hud.info(`Você está parado: mexa-se ou volta para a tela inicial em ${left}s`, '#ffd54f');
  }

  private flush(): void {
    while (this.outbox.length) {
      const chunk = this.outbox.splice(0, CMDS_PER_PACKET_MAX);
      this.net.send({ t: 'in', c: chunk.map(encodeCmd) });
    }
  }

  private localSounds(before: { ground: boolean; drop: boolean; reload: number; weapon: WeaponId; nextFire: number; vy: number; zoom: number; slide: number; sprinting: boolean }, cmd: Cmd, shot: ShotInfo | null): void {
    const s = this.me;
    if (before.zoom !== s.zoom && s.zoom > 0) this.sfx.zoom();
    if (before.ground && !s.onGround && s.vy > 0) this.sfx.jump();
    const surface = waterSurfaceAt(this.map, s.x, s.y, s.z);
    const skydiveEnded = before.drop && !s.dropping;
    const landed = (!before.ground && s.onGround && !before.drop) || skydiveEnded;
    const heavy = skydiveEnded || before.vy < -480;
    const wade = this.localWader.update(surface !== null, s.onGround, landed);
    if (wade === 'splash') {
      this.sfx.splash(heavy);
      if (surface !== null) this.effects.water.ripple(s.x, surface, s.z, 1);
    } else if (wade === 'thud') this.sfx.land(heavy);
    if (skydiveEnded) this.hud.announce('pousou!', 'proteção de spawn por 1,5 s', true);
    if (before.weapon !== s.weapon) {
      this.view.setWeapon(s.weapon);
      this.sfx.deploy();
    }
    this.localReloadSounds(before.weapon);
    if (!shot && !before.sprinting && cmd.buttons & BTN.ATTACK && s.nextFire !== before.nextFire && s.reload === 0) this.sfx.dryFire();
    const speed = Math.hypot(s.vx, s.vz);
    if (s.slide > 0 && before.slide === 0) this.sfx.slide();
    if (s.onGround && s.slide === 0 && speed > 150) {
      this.stepAcc += speed / TICK_RATE;
      if (this.stepAcc > 76) {
        this.stepAcc = 0;
        const stepLoud = s.sprinting ? 0.68 : 0.55;
        if (surface !== null) {
          this.sfx.wetStep(null, stepLoud);
          this.effects.water.ripple(s.x, surface, s.z, 0.5);
        } else this.sfx.footstep(null, stepLoud);
      }
    }
  }

  /** Starts, plays and stops the local reload from the predicted state, so sound and viewmodel follow the simulation. */
  private localReloadSounds(weaponBefore: WeaponId): void {
    const s = this.me;
    const def = weaponDef(s.weapon);
    if (s.reload === 0 || weaponBefore !== s.weapon) this.localReload.end();
    // Also restarts after a weapon switch that starts a new reload on the same tick, or a replay that skipped the start.
    if (s.reload > 0 && !this.localReload.active) this.localReload.begin(def, shellsToLoad(def, s.mag[def.id], s.reserve[def.id]), s.tick);
    for (const cue of this.localReload.due(s.tick)) {
      this.sfx.reload(s.weapon, cue);
      if (cue === 'out') this.dropLocalMagazine();
    }
  }

  private readonly debrisGround: GroundAt = (x, y, z) => Math.max(0, this.collision.groundBelow(x, y, z, DEBRIS_PROBE_HALF_SIZE_UNITS));

  /** A viewmodel point as it appears on screen, re-created in the world `distance` units in front of the camera. */
  private viewmodelPointInWorld(point: THREE.Vector3, distance: number): THREE.Vector3 {
    point.project(this.view.camera);
    point.set(point.x, point.y, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    return point.multiplyScalar(distance).add(this.camera.position);
  }

  /** Gun effects are anchored to the viewmodel, so they are skipped while it is hidden (scoped in or parachuting). */
  private viewmodelVisible(): boolean {
    const scoped = this.me.zoom > 0 && weaponDef(this.me.weapon).zoomFov.length > 0;
    return !scoped && !this.me.dropping;
  }

  private dropLocalMagazine(): void {
    if (!this.viewmodelVisible() || !this.view.magazineWorld(fxPoint)) return;
    this.effects.gun.dropMagazine(this.viewmodelPointInWorld(fxPoint, VIEWMODEL_MAGAZINE_FX_DISTANCE_UNITS), this.me.vx, this.me.vz);
  }

  private localGunFx(weapon: WeaponId): void {
    if (!this.viewmodelVisible()) return;
    const muzzle = this.viewmodelPointInWorld(this.view.muzzleWorld(fxPoint), VIEWMODEL_MUZZLE_FX_DISTANCE_UNITS);
    fxDir.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.effects.gun.fire(LOCAL_SHOOTER, weapon, muzzle, fxDir, this.me.vx, this.me.vz);
  }

  /** One predicted command, with the same warmup ammo rule as the server so the reserve never mispredicts. */
  private predict(s: PlayerState, cmd: Cmd): ShotInfo | null {
    const shot = applyCmd(this.collision, s, cmd, this.myId);
    if (this.match.phase === 'warmup') refillReserve(s);
    return shot;
  }

  private gunOrigin(out: THREE.Vector3): THREE.Vector3 {
    const fwd = v3b.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const down = new THREE.Vector3(0, -1, 0).applyQuaternion(this.camera.quaternion);
    return out.copy(this.camera.position).addScaledVector(fwd, 30).addScaledVector(right, 7).addScaledVector(down, 6);
  }

  private onLocalShot(shot: ShotInfo): void {
    const def = weaponDef(shot.weapon);
    this.view.fire(shot.heavy);
    this.sfx.shot(shot.weapon, null, shot.heavy);
    const melee = def.slot === 3;
    if (!melee) this.muzzleLight.intensity = 3.5;
    const origin = this.gunOrigin(shotMuzzle);
    shotOrigin.set(shot.ox, shot.oy, shot.oz);
    const renderT = this.serverNow() - INTERP_DELAY_MS;
    const projectile = this.effects.gun.projectile(LOCAL_SHOOTER, shot.weapon);
    if (!melee) this.localGunFx(shot.weapon);
    for (let i = 0; i < shot.dirs.length; i += 3) {
      const dx = shot.dirs[i];
      const dy = shot.dirs[i + 1];
      const dz = shot.dirs[i + 2];
      const wall = this.collision.trace(shot.ox, shot.oy, shot.oz, dx, dy, dz, def.range);
      let dist = wall ? wall.t : def.range;
      let hitPlayer = false;
      for (const r of this.remotes.values()) {
        if (!r.visible || this.isTeammate(r.id)) continue; // no friendly fire: rounds pass through
        const s = this.sample(r, renderT);
        if (!s || !(s.flags & RF_ALIVE) || s.flags & (RF_DROP | RF_PROTECT)) continue;
        const h = rayHitbox(shot.ox, shot.oy, shot.oz, dx, dy, dz, s.x, s.y, s.z, stanceFromFlags(s.flags), s.lean, s.yaw, dist);
        if (h) {
          dist = h.t;
          hitPlayer = true;
        }
      }
      const end = shotEnd.set(shot.ox + dx * dist, shot.oy + dy * dist, shot.oz + dz * dist);
      if (i / 3 < projectile.pelletsPerShot) {
        this.effects.projectile(origin, end, shotOrigin, projectile);
      }
      if (!hitPlayer && wall && wall.t <= dist + 0.01 && (!melee || wall.t < def.range)) {
        const surface = surfaceOf(wall.mat);
        this.effects.impact(end, new THREE.Vector3(wall.nx, wall.ny, wall.nz), surface);
        this.sfx.impact(surface, end);
      }
    }
  }

  private onRemoteShot(e: Extract<GameEvent, { k: 'shot' }>): void {
    const def = weaponDef(e.w);
    const [ox, oy, oz] = e.o;
    this.sfx.shot(e.w as WeaponId, { x: ox, y: oy, z: oz }, e.h === 1);
    const r = this.remotes.get(e.id);
    if (this.spectator && e.id === this.followedId) this.view.fire(e.h === 1);
    if (def.slot === 3) {
      if (r?.visible) r.avatar.swingHammer(e.h === 1);
      return;
    }
    const origin = shotMuzzle.set(ox, oy, oz);
    shotOrigin.set(ox, oy, oz);
    if (r?.visible) {
      r.avatar.muzzleWorld(origin);
      r.avatar.kick();
    }
    this.effects.muzzleFlash(origin);
    const projectile = this.effects.gun.projectile(e.id, e.w as WeaponId);
    if (r?.visible && e.e.length >= 3) {
      fxDir.set(e.e[0] - origin.x, e.e[1] - origin.y, e.e[2] - origin.z).normalize();
      this.effects.gun.fire(e.id, e.w as WeaponId, origin, fxDir, 0, 0);
    }
    for (let i = 0; i < e.e.length; i += 3) {
      const end = shotEnd.set(e.e[i], e.e[i + 1], e.e[i + 2]);
      if (i / 3 < projectile.pelletsPerShot) {
        this.effects.projectile(origin, end, shotOrigin, projectile);
      }
      const dir = v3.copy(end).sub(v3b.set(ox, oy, oz));
      const len = dir.length();
      dir.divideScalar(len || 1);
      const hit = this.collision.trace(ox, oy, oz, dir.x, dir.y, dir.z, len + 2);
      if (hit && Math.abs(hit.t - len) < 3) {
        const surface = surfaceOf(hit.mat);
        this.effects.impact(end, new THREE.Vector3(hit.nx, hit.ny, hit.nz), surface);
        this.sfx.impact(surface, end);
      }
    }
  }

  private sample(r: Remote, t: number): Snap | null {
    const b = r.buf;
    while (b.length >= 2 && b[1].t <= t) b.shift();
    if (b.length === 0) return null;
    const a = b[0];
    const c = b[1];
    if (!c || t <= a.t) return a;
    const k = (t - a.t) / Math.max(1, c.t - a.t);
    if (!(a.flags & RF_ALIVE) || !(c.flags & RF_ALIVE)) return k < 0.5 ? a : c;
    if (Math.hypot(c.x - a.x, c.z - a.z) > 400) return k < 0.5 ? a : c; // respawn teleport
    return {
      t,
      x: a.x + (c.x - a.x) * k,
      y: a.y + (c.y - a.y) * k,
      z: a.z + (c.z - a.z) * k,
      yaw: lerpAngle(a.yaw, c.yaw, k),
      pitch: a.pitch + (c.pitch - a.pitch) * k,
      flags: k < 0.5 ? a.flags : c.flags,
      w: k < 0.5 ? a.w : c.w,
      lean: a.lean + (c.lean - a.lean) * k,
    };
  }

  // ------------------------------------------------------------------ frame

  private frame = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const frameSeconds = (now - this.lastFrame) / 1000;
    let dt = frameSeconds;
    this.lastFrame = now;
    if (dt > 0.25) dt = 0.25;
    this.elapsed += dt;
    this.fpsAcc += dt;
    this.fpsN++;
    if (this.fpsAcc >= 0.5) {
      this.fps = Math.round(this.fpsN / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsN = 0;
    }

    if (now - this.lastPing > 2000) {
      this.lastPing = now;
      this.net.send({ t: 'ping', c: now });
    }

    this.accum += dt * 1000;
    let n = 0;
    while (this.accum >= TICK_MS && n < 15) {
      this.tick();
      this.accum -= TICK_MS;
      n++;
    }
    if (n === 15) this.accum = 0;

    if (this.ready.kind === 'pending' && this.ready.kickAt !== null) this.ui.updateReadyCountdown(Math.max(0, Math.ceil((this.ready.kickAt - this.serverNow()) / 1000)));

    if (this.podiumActive) {
      this.podium.update(dt);
      this.podium.render(this.renderer);
      const left = Math.max(0, Math.ceil((this.match.endsAt - this.serverNow()) / 1000));
      this.ui.updatePodiumCountdown(left);
      return;
    }

    if (performanceHint.sample(frameSeconds, this.settings.quality)) this.hud.info(FPS_HINT_TEXT);
    const cheaper = this.rtGovernor.sample(frameSeconds, this.lightRtLevel);
    if (cheaper) {
      this.rtCeiling = cheaper;
      this.applyLightRt(this.wantedRtLevel());
      this.hud.info(`quadros lentos: ray tracing baixou para ${rtLabel(cheaper)}`);
    }

    const [ldx, ldy] = this.input.takeLook();
    this.updateCamera(dt);
    this.updateRemotes(dt);
    for (const a of this.airdrops.values()) a.update(dt, this.elapsed, this.camera.position);
    this.flagRenderer?.update(this.flags, this.serverNow(), this.elapsed, this.carrierPose);
    this.colleaguesView?.update(this.lunch?.colleagues ?? [], dt);
    this.bombRenderer?.update(this.bomb, this.serverNow(), this.elapsed, this.camera.position, this.carrierPose);
    this.beepBomb(this.serverNow());
    this.typeOnBomb();
    this.effects.update(dt, this.debrisGround);
    this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 60);
    this.muzzleLight.position.copy(this.camera.position).add(v3.set(0, 0, -40).applyQuaternion(this.camera.quaternion));
    if (this.world) {
      this.world.update(dt);
      this.updateDayLight(this.world);
      followShadow(this.world.sun, this.camera.position.x, this.camera.position.z, this.world.sunDir);
      this.world.sky.position.copy(this.camera.position);
    }

    const def = weaponDef(this.me.weapon);
    const zoomed = this.alive && this.me.zoom > 0 && def.zoomFov.length > 0;
    const showView = this.spectator ? this.cameraMode === 'first' && this.updateFollowedView(dt) : this.alive && !zoomed && !this.me.dropping;
    if (!this.spectator) {
      this.view.update({
        dt,
        speed: Math.hypot(this.me.vx, this.me.vz),
        stance: this.me.stance,
        sprinting: this.me.sprinting,
        sliding: this.me.slide > 0,
        firing: (this.lastButtons & (BTN.ATTACK | BTN.ATTACK2)) !== 0,
        onGround: this.me.onGround,
        lookDX: ldx,
        lookDY: ldy,
        reloadElapsed: this.me.reload > 0 ? this.localReload.elapsed(this.me.tick) : -1,
        reloadShells: this.localReload.shells,
        deployFrac: this.me.deploy > 0 ? 1 - this.me.deploy / def.deployTicks : -1,
        hidden: !showView,
      });
    }

    this.drawScene();
    if (showView) this.view.render(this.renderer);

    this.updateHud(zoomed);
    const f = v3.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.sfx.setListener(this.camera.position.x, this.camera.position.y, this.camera.position.z, f.x, f.y, f.z);
    this.ventHum?.update(dt, this.camera.position);
  };

  /** Holds the followed player's weapon in the viewmodel; false when there is nothing to draw. */
  private updateFollowedView(dt: number): boolean {
    const remote = this.remotes.get(this.followedId);
    const sample = this.followedSample();
    if (!remote || !sample) return false;
    if (this.viewColorFor !== remote.id) {
      this.viewColorFor = remote.id;
      this.view.setSleeveColor(this.nameOf(remote.id).color);
    }
    const { weapon, ...pose } = this.followedView.pose(
      remote.id,
      {
        weapon: sample.w as WeaponId,
        flags: sample.flags,
        speed: remote.speed,
        onGround: (sample.flags & RF_GROUND) !== 0,
        reloadElapsed: (sample.flags & RF_RELOAD) !== 0 ? remote.reload.elapsed(performance.now() / TICK_MS) : -1,
        reloadShells: remote.reload.shells,
      },
      performance.now(),
      dt,
    );
    this.view.setWeapon(weapon);
    this.view.update(pose);
    return !pose.hidden;
  }

  private followedSample(): Snap | null {
    const remote = this.remotes.get(this.followedId);
    return (remote && this.sample(remote, this.serverNow() - INTERP_DELAY_MS)) || null;
  }

  private watchTargets(): Remote[] {
    const state = this.spectator;
    if (state?.kind !== 'watching') return [];
    return [...this.remotes.values()].filter(r => {
      const s = this.sample(r, this.serverNow() - INTERP_DELAY_MS);
      return s && (s.flags & RF_ALIVE) && (state.team === -1 || this.names.get(r.id)?.team === state.team);
    }).sort((a, b) => a.id - b.id);
  }

  private stepTarget(dir: 1 | -1): void {
    this.followedId = stepTarget(this.watchTargets().map(r => r.id), this.followedId, dir);
  }

  /** Places the spectator camera for the current mode and remembers where it stands. */
  private updateSpectatorCamera(dt: number): boolean {
    const targets = this.watchTargets();
    if (!targets.some(r => r.id === this.followedId)) this.followedId = targets[0]?.id ?? -1;
    let roll = 0;
    let sprinting = false;
    if (this.cameraMode === 'free') {
      this.eyeTargetId = -1;
      const keys = this.menuOpen ? NO_FREE_KEYS : freeKeysFrom(this.heldKeys);
      const limits = { bounds: this.map.bounds, maxY: this.map.dropHeight };
      this.spectatorPose = stepFreeCam({ ...this.spectatorPose, yaw: this.input.yaw, pitch: this.input.pitch }, keys, dt, limits);
    } else {
      const sample = this.followedSample();
      const followed: FollowedPlayer | null = sample && {
        ...sample,
        stance: stanceFromFlags(sample.flags),
        onGround: (sample.flags & RF_GROUND) !== 0,
        sliding: (sample.flags & RF_SLIDE) !== 0,
      };
      const view = this.cameraMode === 'orbit' ? { yaw: this.input.yaw, pitch: this.input.pitch } : followed;
      if (sample && followed && this.cameraMode === 'first') {
        const eye = movementEye(followed.stance, followed.onGround, Number(followed.sliding));
        if (this.eyeTargetId !== this.followedId) this.spectatorEye = eye;
        this.eyeTargetId = this.followedId;
        this.spectatorEye += (eye - this.spectatorEye) * Math.min(1, dt * 18);
        this.spectatorPose = eyePose(followed, this.spectatorEye);
        roll = -followed.lean * LEAN_ROLL_RAD;
        sprinting = (sample.flags & RF_SPRINT) !== 0;
      } else {
        this.eyeTargetId = -1;
        if (followed) this.spectatorPose = chasePose(followed, this.collision, view ?? undefined);
      }
    }
    const { x, y, z, yaw, pitch } = this.spectatorPose;
    this.camera.position.set(x, y, z);
    this.camera.rotation.set(pitch, yaw, roll, 'YXZ');
    return sprinting;
  }

  private updateCamera(dt: number): void {
    const s = this.me;
    const def = weaponDef(s.weapon);
    this.correction.multiplyScalar(Math.exp(-dt * 14));
    this.punch = Math.max(0, this.punch - dt * 8);

    // field of view: CS-style horizontal FOV defined at 4:3, Hor+ for wider screens
    const csToVertical = (h: number) => (2 * Math.atan(Math.tan((h * DEG) / 2) * 0.75)) / DEG;
    const baseV = csToVertical(this.settings.fov);
    let vfov = baseV;
    const zoomed = this.alive && s.zoom > 0 && def.zoomFov.length > 0;
    if (zoomed) vfov = csToVertical(def.zoomFov[s.zoom - 1]);
    if (this.alive && s.dropping) vfov = baseV + 8;
    if (!zoomed && this.alive && s.sprinting) vfov += SPRINT_FOV_KICK_DEG;
    if (this.spectator) vfov = baseV + (this.updateSpectatorCamera(dt) ? SPRINT_FOV_KICK_DEG : 0);
    if (this.camera.fov !== vfov) {
      this.camera.fov = easeFov(this.camera.fov, vfov, dt);
      this.camera.updateProjectionMatrix();
    }
    this.input.zoomSensScale = zoomed ? (def.zoomFov[s.zoom - 1] / this.settings.fov) * ZOOM_SENSITIVITY_RATIO : 1;

    if (this.spectator) return;
    if (this.alive) {
      const alpha = clamp(this.accum / TICK_MS, 0, 1);
      const x = this.prev.x + (s.x - this.prev.x) * alpha + this.correction.x;
      const y = this.prev.y + (s.y - this.prev.y) * alpha + this.correction.y;
      const z = this.prev.z + (s.z - this.prev.z) * alpha + this.correction.z;
      const eyeTarget = movementEye(s.stance, s.onGround, Number(s.slide > 0));
      this.eye += (eyeTarget - this.eye) * Math.min(1, dt * 18);
      const lean = s.lean * LEAN_OFFSET_UNITS;
      this.camera.position.set(x + Math.cos(s.yaw) * lean, y + this.eye, z - Math.sin(s.yaw) * lean);
      const [rp, ry] = recoilOffset(def, s.recoil);
      this.camera.rotation.set(this.input.pitch + rp + this.punch * 0.012, this.input.yaw + ry, -s.lean * LEAN_ROLL_RAD, 'YXZ');
    } else {
      // death cam: rise above the body and look at the killer
      const t = (performance.now() - this.deathAt) / 1000;
      const rise = Math.min(1, t / 1.2);
      this.camera.position.set(this.deathPos.x, this.deathPos.y + 40 + rise * 90, this.deathPos.z);
      const k = this.remotes.get(this.killerId);
      if (k?.visible) {
        this.camera.lookAt(k.avatar.root.position.x, k.avatar.root.position.y + 50, k.avatar.root.position.z);
      } else {
        this.camera.rotation.set(-0.9 * rise - 0.2, this.input.yaw, 0, 'YXZ');
      }
    }
  }

  private updateRemotes(dt: number): void {
    const renderT = this.serverNow() - INTERP_DELAY_MS;
    const camFwd = v3b.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    for (const r of this.remotes.values()) {
      const s = this.sample(r, renderT);
      const visible = !!s && (s.flags & RF_ALIVE) !== 0;
      if (!visible || !s) {
        r.avatar.root.visible = false;
        r.visible = false;
        r.wader.reset();
        r.reload.end();
        continue;
      }
      const pos = r.avatar.root.position;
      const wasVisible = r.visible;
      pos.set(s.x, s.y, s.z);
      r.avatar.root.rotation.y = s.yaw;
      r.avatar.root.visible = !(this.spectator && this.cameraMode === 'first' && r.id === this.followedId);
      r.visible = true;
      const moved = wasVisible ? Math.hypot(s.x - r.last.x, s.z - r.last.z) : 0;
      const inst = dt > 0 ? moved / dt : 0;
      r.speed += (Math.min(inst, 600) - r.speed) * Math.min(1, dt * 10);
      r.last.set(s.x, s.y, s.z);
      const ground = (s.flags & RF_GROUND) !== 0;
      const dropping = (s.flags & RF_DROP) !== 0;
      const sprinting = (s.flags & RF_SPRINT) !== 0;
      const sliding = (s.flags & RF_SLIDE) !== 0;
      if (wasVisible && sliding && !r.sliding) this.sfx.slide(pos);
      r.sliding = sliding;
      const surface = waterSurfaceAt(this.map, s.x, s.y, s.z);
      const landed = wasVisible && ground && !r.ground;
      const wade = r.wader.update(surface !== null, ground, landed);
      if (wasVisible && ground && !sliding && r.speed > 150) {
        r.step += moved;
        if (r.step > 76) {
          r.step = 0;
          const stepLoud = sprinting ? 1.22 : 1;
          if (surface !== null) {
            this.sfx.wetStep(pos, stepLoud);
            this.effects.water.ripple(s.x, surface, s.z, 0.5);
          } else this.sfx.footstep(pos, stepLoud);
        }
      }
      if (wasVisible && wade === 'splash' && surface !== null) {
        this.sfx.splash(r.dropping, pos);
        this.effects.water.ripple(s.x, surface, s.z, 1);
      } else if (wasVisible && wade === 'thud') this.sfx.land(r.dropping, pos);
      r.ground = ground;
      r.dropping = dropping;
      r.avatar.setWeapon(s.w as WeaponId);
      this.remoteReloadSounds(r, s);
      const stance = stanceFromFlags(s.flags);
      r.avatar.update(dt, {
        speed: r.speed,
        stance,
        sprinting,
        sliding,
        lean: s.lean,
        dropping,
        onGround: ground,
        pitch: s.pitch,
        protect: (s.flags & RF_PROTECT) !== 0,
        reloading: (s.flags & RF_RELOAD) !== 0,
      });
      // name tags only up close or when aimed at (no wallhack-style radar)
      const to = v3.set(s.x - this.camera.position.x, s.y + STANCES[stance].aimHead - this.camera.position.y, s.z - this.camera.position.z);
      const dist = to.length();
      const aim = to.divideScalar(dist || 1).dot(camFwd);
      r.avatar.showTag(this.isTeammate(r.id) || dist < 380 || aim > 0.9985 || dropping);
    }
  }

  /** Snapshots only carry the reload flag, so another player's reload is timed locally from the moment it turns on. */
  private remoteReloadSounds(r: Remote, s: Snap): void {
    const nowTicks = performance.now() / TICK_MS;
    r.reload.follow((s.flags & RF_RELOAD) !== 0, weaponDef(s.w), nowTicks);
    const at = { x: s.x, y: s.y + 40, z: s.z };
    for (const cue of r.reload.due(nowTicks)) {
      this.sfx.reload(s.w as WeaponId, cue, at);
      if (cue === 'out') this.effects.gun.dropMagazine(r.avatar.magazineWorld(fxPoint), 0, 0);
    }
  }

  private updateHud(zoomed: boolean): void {
    const hud = this.hud;
    hud.root.classList.toggle('spectating', !!this.spectator);
    const s = this.me;
    const def = weaponDef(s.weapon);
    const now = this.serverNow();

    // timer + leaders
    if (this.match.phase === 'live') {
      const left = Math.max(0, this.match.endsAt - now);
      const sec = Math.ceil(left / 1000);
      hud.setTimer(`${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`, `${this.map.name} · ${this.match.mode}`, sec <= 30);
      if (sec <= 10 && sec > 0 && sec !== this.lastBeep) {
        this.lastBeep = sec;
        this.sfx.beep(sec <= 3);
      }
    } else hud.setTimer('aquec.', 'esperando jogadores', false);

    const rows = this.ranked();
    const leaders: LeaderRow[] = rows.slice(0, 3).map((r, i) => ({ name: r.name, color: r.color, kills: r.kills, rank: i + 1, me: r.me }));
    const myIdx = rows.findIndex((r) => r.me);
    const meRow = myIdx >= 0 ? { name: rows[myIdx].name, color: rows[myIdx].color, kills: rows[myIdx].kills, rank: myIdx + 1, me: true } : null;
    const tdm = isTeamMode(this.match.mode);
    if (tdm) hud.setTeams(this.teamScores, this.match.limit, this.myTeam, scoreUnit(this.match.mode));
    else hud.setLeaders(leaders, meRow);
    hud.setTeamBadge(tdm ? this.myTeam : -1);
    hud.setSpectatorBar(this.spectatorBar());
    const title = `${this.map.name} · ${MODE_LABEL[this.match.mode]} · ${rows.length} jogador${rows.length === 1 ? '' : 'es'}`;
    hud.showScoreboard(this.scoreboardOpen, rows, title, tdm ? this.teamScores : null, scoreUnit(this.match.mode));
    hud.setFlags(this.lunch ? lunchStatus(this.lunch, now) : this.flags.map(flag => ({ team: flag.team, text: flagStatus(flag, now, id => this.nameOf(id).name) })), !this.spectator && this.flags.some(flag => flag.state === 'carried' && flag.carrier === this.myId));
    this.updateBombHud(hud, now);
    const showStamina = !this.spectator && this.alive && (s.sprinting || s.winded || s.stamina < STAMINA_MAX);
    hud.setStamina(s.stamina / STAMINA_MAX, showStamina, showStamina && s.winded);
    hud.setStance(s.stance);

    if (this.spectator) {
      // other players' crosshair settings are not on the wire, so the viewer's own style is drawn
      const target = this.followedSample();
      const open = this.cameraMode === 'first' && !!target && !(target.flags & (RF_ZOOM | RF_DROP)) && target.w !== WEAPON.SNIPER;
      hud.setCrosshair(this.settings.crosshairGap, this.settings.crosshairSize, this.settings.crosshairColor, open);
      hud.setDrop(null);
      hud.setScope(false);
      hud.setProtect(false);
      this.sfx.setWind(0);
      hud.setMarkers(this.markers());
      return;
    }

    if (!this.alive) {
      const left = Math.max(0, RESPAWN_TICKS * TICK_MS - (performance.now() - this.deathAt));
      if (this.deathAt > 0) hud.setRespawn(left > 0 ? `voltando do céu em ${(left / 1000).toFixed(1)} s` : 'saltando…');
      hud.setCrosshair(0, 0, '', false);
      hud.setDrop(null);
      hud.setScope(false);
      hud.setProtect(false);
      this.sfx.setWind(0);
      hud.setMarkers(this.markers());
      return;
    }

    hud.setVitals(Math.max(0, Math.ceil(s.health)), Math.ceil(s.armor));
    const slots = [
      { key: '1', label: weaponDef(s.primary).tag, active: s.weapon === s.primary },
      { key: '2', label: 'FAÍSCA', active: s.weapon === WEAPON.PISTOL },
      { key: '3', label: 'MARTELO', active: s.weapon === WEAPON.HAMMER },
    ];
    hud.setWeapon(def.name, def.tag, s.mag[def.id], this.match.phase === 'warmup' ? '∞' : s.reserve[def.id], def.legendary, def.slot === 3, slots);
    hud.setReload(s.reload > 0 ? this.localReload.progress(s.tick) : -1);
    hud.setScope(zoomed);
    hud.setProtect(s.protect > 0 || s.dropping);

    // dynamic crosshair: gap follows the real spread used by the simulation
    const showCh = !zoomed && !s.dropping && !(def.id === WEAPON.SNIPER);
    let gap = this.settings.crosshairGap;
    if (this.settings.dynamicCrosshair && def.slot !== 3) {
      const spread = computeSpread(s, def);
      const pxPerRad = this.renderer.domElement.clientHeight / 2 / Math.tan((this.camera.fov * DEG) / 2);
      gap = Math.max(gap, Math.min(80, spread * pxPerRad * 0.9));
    }
    hud.setCrosshair(gap, this.settings.crosshairSize, this.settings.crosshairColor, showCh);

    if (s.dropping) {
      const ground = this.collision.groundBelow(s.x, s.y, s.z, 16);
      hud.setDrop(s.y - Math.max(0, ground));
      this.sfx.setWind(clamp(-s.vy / 950, 0, 1));
    } else {
      hud.setDrop(null);
      this.sfx.setWind(0);
    }
    hud.setMarkers(this.markers());

    if (this.settings.showNet) {
      const kb = (this.net.bytesIn / 1024 / Math.max(1, this.elapsed)).toFixed(1);
      hud.setNetstat(`${this.fps} fps\nping ${Math.round(this.rtt)} ms\npred ${this.pending.length}\n${kb} KB/s`);
    } else hud.setNetstat(null);
  }

  private spectatorBar(): SpectatorBar | undefined {
    const state = this.spectator;
    if (!state) return undefined;
    const followed = this.remotes.has(this.followedId) ? this.nameOf(this.followedId) : null;
    const teams = isTeamMode(this.match.mode)
      ? {
          active: state.kind === 'watching' ? state.team : -1,
          pickSecondsLeft: state.kind === 'choosing' ? Math.max(0, Math.ceil((state.pickEndsAt - this.serverNow()) / 1000)) : null,
        }
      : null;
    return { target: followed && { name: followed.name, color: followed.color }, mode: this.cameraMode, teams, pointerLocked: this.input.locked };
  }

  private markers(): Marker[] {
    const out: Marker[] = [];
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    const targets: { x: number; y: number; z: number; label: string }[] = [];
    for (const a of this.airdrops.values()) targets.push({ x: a.x, y: a.group.position.y + 70, z: a.z, label: a.label });
    const carrying = !this.spectator && this.flags.some(f => f.state === 'carried' && f.carrier === this.myId);
    for (const flag of this.flags) {
      if (flag.team !== this.myTeam || flag.state === 'dropped') {
        if (flag.state === 'carried' && flag.carrier === this.myId) continue;
        const at = this.flagRenderer?.position(flag.team) ?? flag;
        targets.push({ x: at.x, y: at.y + 100, z: at.z, label: 'bandeira dos ' + TEAMS[flag.team].name });
      }
    }
    this.bombMarkers(targets);
    if (carrying && this.myTeam >= 0) {
      const base = this.map.flagBases[this.myTeam];
      targets.push({ ...base, y: this.collision.groundBelow(base.x, this.map.dropHeight, base.z, PLAYER_RADIUS) + 100, label: 'sua base · capture aqui' });
    }
    for (const a of targets) {
      v3.set(a.x, a.y, a.z);
      const dist = v3.distanceTo(this.camera.position);
      v3.project(this.camera);
      const behind = v3.z > 1;
      let x = (v3.x * 0.5 + 0.5) * w;
      let y = (-v3.y * 0.5 + 0.5) * h;
      if (behind) {
        x = w - x;
        y = h - 40;
      }
      const off = behind || x < 30 || x > w - 30 || y < 70 || y > h - 30;
      x = clamp(x, 30, w - 30);
      y = clamp(y, 70, h - 30);
      out.push({ x, y, label: a.label, dist, offscreen: off });
    }
    return out;
  }

  private bombMarkers(targets: { x: number; y: number; z: number; label: string }[]): void {
    const bomb = this.bomb;
    if (!bomb) return;
    const carrying = !this.spectator && (bomb.state === 'carried' || bomb.state === 'planting') && bomb.carrier === this.myId;
    if (carrying) {
      const site = this.map.flagBases[1 - bomb.attackers];
      targets.push({ ...site, y: this.collision.groundBelow(site.x, this.map.dropHeight, site.z, PLAYER_RADIUS) + 100, label: 'site · segure E para plantar' });
      return;
    }
    const at = this.bombRenderer?.position() ?? bomb;
    const defending = this.myTeam >= 0 && this.myTeam !== bomb.attackers;
    targets.push({ x: at.x, y: at.y + 60, z: at.z, label: bomb.state === 'planted' && defending ? 'desarme o bug' : 'o bug' });
  }

  ranked(): ScoreRow[] {
    const rows: ScoreRow[] = [];
    for (const id of this.online) {
      const n = this.nameOf(id);
      const sc = this.scores.get(id) ?? { kills: 0, deaths: 0, ping: 0, streak: 0, hs: 0 };
      rows.push({ id, name: n.name, color: n.color, team: n.team, bot: this.names.get(id)?.bot ?? false, kills: sc.kills, deaths: sc.deaths, hs: sc.hs, ping: sc.ping, me: id === this.myId });
    }
    rows.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || a.id - b.id);
    return rows;
  }

  dispose(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    if (document.pointerLockElement) document.exitPointerLock();
    this.input.dispose();
    this.sfx.dispose();
    this.flagRenderer?.dispose();
    this.colleaguesView?.dispose();
    this.bombRenderer?.dispose();
    this.world?.dispose();
    this.ventHum?.dispose();
    this.lightRt?.dispose();
    this.effects.water.setEnabled(false);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.hud.root.remove();
    this.net.close();
  }
}

export { PROTOCOL_VERSION };
