import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PLAYER_COLORS, STANCE, WEAPONS, reloadCursor, weaponDef, type WeaponId } from '@calindra-strike/shared';
import { QUALITY, QUALITY_OPTIONS, type Quality } from '../game/render/quality.ts';
import { ViewModel } from '../game/render/viewmodel.ts';
import { type GunPlacement, formatPlacement } from '../game/render/weapon-placement.ts';
import type { Settings } from '../settings.ts';
import { buttonRow, checkRow, choiceRow, controlsList, group, rangeRow, row } from '../ui/controls.ts';
import { h } from '../ui/dom.ts';
import { fullscreenButtonLabel, toggleFullscreen } from '../ui/fullscreen.ts';
import { stepBlend } from '../game/render/movement-pose.ts';
import { ADS_BLEND_SECONDS } from '../game/render/ads-view.ts';
import { createPerfHud } from './perf-hud.ts';
import { createScenarioExplorer } from './scenario-explorer.ts';
import { autoFireShots, previewAim, previewMovementSpeed, reloadTotal, scrubTo, startReload, stepReload, type ReloadScrub } from './weapon-debug.ts';

type DebugView = 'weapon' | 'scenario';

const DEFAULT_FOV = 58;
const BACKGROUND = 0x8a7a5e;
const MAX_FRAME_S = 0.05;
const SCRUB_STEPS = 1000;
const SPEEDS = [0.25, 0.5, 1, 2];

/** Mutable copy of a placement, so a slider can move one number at a time. */
interface Placement {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

const copyOf = (p: GunPlacement): Placement => ({ position: [...p.position], rotation: [...p.rotation], scale: p.scale });
const degrees = (rad: number): string => `${Math.round((rad * 180) / Math.PI)}°`;

/**
 * Debug mode: the real first-person weapon on its own, to try a weapon, its animations and its angle without joining a match.
 * Opened from the lobby by an easter egg. Needs WebGL; without it only a notice and the way out are shown.
 */
export function openWeaponViewer(root: HTMLElement, settings: Settings, onExit: () => void): void {
  const exit = h('button', { class: 'btn', type: 'button', text: 'sair do debug' });
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    root.replaceChildren(h('div', { class: 'overlay' }, [h('div', { class: 'menu glass dbg-notice' }, [h('h2', { text: 'modo debug' }), h('p', { class: 'sub', text: 'Este navegador precisa de WebGL para abrir o modo debug.' }), exit])]));
    exit.addEventListener('click', onExit);
    return;
  }
  renderer.setClearColor(BACKGROUND);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  let quality: Quality = settings.quality;
  const view = new ViewModel(PLAYER_COLORS[settings.color], quality);
  view.setLeftHanded(settings.leftHanded);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const studio = new RoomEnvironment();
  const environment = pmrem.fromScene(studio, 0.04, 0.1, 100, { size: QUALITY[quality].envMapPx });
  studio.dispose();
  view.setEnvironment(environment.texture);
  let scenarioGun: ViewModel | undefined;
  const getScenarioGun = () => {
    if (scenarioGun) return scenarioGun;
    scenarioGun = new ViewModel(PLAYER_COLORS[settings.color], quality);
    scenarioGun.setLeftHanded(settings.leftHanded);
    scenarioGun.setEnvironment(environment.texture);
    return scenarioGun;
  };

  let weapon: WeaponId = WEAPONS[WEAPONS.length - 1].id;
  const reload: ReloadScrub = { elapsed: -1, playing: false, speed: 1, loop: true };
  const carry = { ticks: 0 };
  let holdFire = false;
  let walking = false;
  let running = false;
  let aiming = false;
  let aimT = 0;
  let leftHanded = settings.leftHanded;
  let shells = 0;
  let placement = copyOf(view.placement());

  const select = (id: WeaponId) => {
    weapon = id;
    view.setWeapon(id);
    placement = copyOf(view.placement());
    shells = weaponDef(id).mag;
    reload.elapsed = -1;
    reload.playing = false;
    placementHost.replaceChildren(placementGroup());
    reloadHost.replaceChildren(reloadGroup());
  };
  const place = () => view.setPlacement(placement);
  const nothing = () => {};

  const weaponGroup = () =>
    group(
      'arma',
      choiceRow('arma', WEAPONS.map((w) => ({ v: w.id, label: w.name })), () => weapon, (v) => select(v), nothing),
      choiceRow('gráficos', QUALITY_OPTIONS, () => quality, (v) => {
        quality = v;
        view.setQuality(v);
        view.setWeapon(weapon);
        place();
      }, nothing, 'a correia da metralhadora muda por modo'),
      rangeRow('campo de visão', { min: 40, max: 110, step: 1 }, () => view.camera.fov, (v) => {
        view.camera.fov = v;
        view.camera.updateProjectionMatrix();
      }, (v) => `${v}°`, nothing),
      checkRow('andando', 'balanço de caminhada', () => walking, (v) => (walking = v), nothing),
      checkRow('correndo', 'pose de corrida', () => running, (v) => (running = v), nothing),
      checkRow('mirando', 'pose de mira, com o ponto vermelho', () => aiming, (v) => (aiming = v), nothing),
      checkRow('canhoto', 'arma no lado esquerdo', () => leftHanded, (v) => view.setLeftHanded((leftHanded = v)), nothing),
    );

  const scrub = h('input', { type: 'range', min: 0, max: SCRUB_STEPS, step: 1, value: 0, 'aria-label': 'progresso da recarga' }) as HTMLInputElement;
  const phase = h('output', { class: 'dbg-readout', text: '' });
  const reloadGroup = () => {
    const def = weaponDef(weapon);
    const total = reloadTotal(def, shells);
    scrub.disabled = total === 0;
    return group(
      'ações',
      buttonRow(
        h('button', { class: 'btn btn-primary', type: 'button', text: 'atirar', onclick: () => view.fire(false) }),
        h('button', { class: 'btn', type: 'button', text: 'recarregar', disabled: total === 0, onclick: () => startReload(reload) }),
        h('button', { class: 'btn', type: 'button', text: reload.playing ? 'pausar' : 'continuar', onclick: (e: Event) => {
          reload.playing = !reload.playing && reload.elapsed >= 0;
          (e.currentTarget as HTMLButtonElement).textContent = reload.playing ? 'pausar' : 'continuar';
        } }),
      ),
      checkRow('rajada', 'segura o gatilho no ritmo da arma', () => holdFire, (v) => (holdFire = v), nothing),
      row('recarga', scrub, phase),
      choiceRow('velocidade', SPEEDS.map((s) => ({ v: s, label: `${s}×` })), () => reload.speed, (v) => (reload.speed = v), nothing),
      checkRow('repetir', 'recomeça quando termina', () => reload.loop, (v) => (reload.loop = v), nothing),
    );
  };
  scrub.addEventListener('input', () => scrubTo(reload, Number(scrub.value) / SCRUB_STEPS, reloadTotal(weaponDef(weapon), shells)));

  const placementGroup = () => {
    const axis = (label: string, key: 'position' | 'rotation', i: number, range: { min: number; max: number; step: number }, fmt: (v: number) => string) =>
      rangeRow(label, range, () => placement[key][i], (v) => {
        placement[key][i] = v;
        place();
      }, fmt, nothing);
    const pos = { min: -30, max: 30, step: 0.1 };
    const rot = { min: -Math.PI, max: Math.PI, step: 0.005 };
    return group(
      'posição e ângulo da arma',
      axis('x', 'position', 0, pos, (v) => v.toFixed(1)),
      axis('y', 'position', 1, pos, (v) => v.toFixed(1)),
      axis('z', 'position', 2, pos, (v) => v.toFixed(1)),
      axis('giro x', 'rotation', 0, rot, degrees),
      axis('giro y', 'rotation', 1, rot, degrees),
      axis('giro z', 'rotation', 2, rot, degrees),
      rangeRow('escala', { min: 0.2, max: 1.4, step: 0.01 }, () => placement.scale, (v) => {
        placement.scale = v;
        place();
      }, (v) => v.toFixed(2), nothing),
      buttonRow(
        h('button', { class: 'btn', type: 'button', text: 'restaurar', onclick: () => select(weapon) }),
        h('button', { class: 'btn', type: 'button', text: 'copiar para o código', onclick: () => void copy(formatPlacement(placement)) }),
      ),
      h('small', { class: 'hint', text: 'cole em client/src/game/render/weapon-placement.ts' }),
    );
  };

  const placementHost = h('div');
  const reloadHost = h('div');
  const weaponHost = h('div', {}, [weaponGroup()]);
  const readout = h('div', { class: 'dbg-readout' });
  const copied = h('small', { class: 'hint', text: '' });
  async function copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      copied.textContent = 'copiado';
    } catch {
      copied.textContent = text;
    }
  }

  const perf = createPerfHud(renderer);
  const fpsRow = checkRow('mostrar FPS', 'tempos de quadro e memória', () => perf.visible, (v) => perf.setVisible(v), nothing);
  const listeners = new AbortController();
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'F3') return;
    event.preventDefault();
    if (event.repeat) return;
    perf.setVisible(!perf.visible);
    const checkbox = fpsRow.querySelector('input');
    if (checkbox) checkbox.checked = perf.visible;
  }, { signal: listeners.signal });

  let mode: DebugView = 'weapon';
  let scenario: ReturnType<typeof createScenarioExplorer> | undefined;
  const weaponControls = h('div', {}, [
    weaponHost, reloadHost, placementHost, copied, readout, group('controles da partida', controlsList(settings.bindings)),
  ]);
  const scenarioHost = h('div', { hidden: true });
  const fullscreen = h('button', { class: 'btn', type: 'button', onclick: () => void toggleFullscreen(stage) });
  const panel = h('aside', { class: 'menu glass dbg-panel' }, [
    h('header', { class: 'menu-head' }, [h('h2', { text: 'debug' }), exit]),
    h('div', { class: 'menu-body' }, [h('div', { class: 'menu-col' }, [
      choiceRow<DebugView>('modo', [{ v: 'weapon', label: 'arma' }, { v: 'scenario', label: 'cenário' }], () => mode, setMode, nothing),
      fullscreen, fpsRow, weaponControls, scenarioHost,
    ])]),
  ]);
  const scopeHost = h('div', { class: 'scope' }, [h('div', { class: 'scope-glass' })]);
  const stage = h('div', { class: 'dbg-stage' }, [renderer.domElement, scopeHost, panel, perf.element]);
  root.replaceChildren(stage);

  function setMode(next: DebugView) {
    if (next === mode) return;
    mode = next;
    weaponControls.hidden = mode !== 'weapon';
    scenarioHost.hidden = mode !== 'scenario';
    perf.reset();
    if (mode === 'scenario') {
      scopeHost.className = 'scope';
      scenario = createScenarioExplorer(renderer, quality, settings.sensitivity, getScenarioGun, (locked) => {
        panel.hidden = locked;
      }, perf.reset);
      scenarioHost.replaceChildren(scenario.controls);
      return;
    }
    scenario?.dispose();
    scenario = undefined;
    scenarioHost.replaceChildren();
    resize();
  }

  function resize() {
    if (scenario) {
      scenario.resize();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY[quality].maxPixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
    view.camera.aspect = window.innerWidth / window.innerHeight;
    view.camera.updateProjectionMatrix();
  }
  function updateFullscreenButton() {
    const label = fullscreenButtonLabel('debug', document.fullscreenEnabled, document.fullscreenElement === stage);
    fullscreen.disabled = label === null;
    fullscreen.textContent = label ?? 'maximizar janela';
  }
  document.addEventListener('fullscreenchange', () => {
    updateFullscreenButton();
    resize();
  }, { signal: listeners.signal });
  updateFullscreenButton();
  window.addEventListener('resize', resize);
  view.camera.fov = DEFAULT_FOV;
  select(weapon);
  resize();

  let last: number | undefined;
  let frame = 0;
  const tick = (now: number) => {
    const frameMs = last === undefined ? 0 : now - last;
    const dt = Math.min(MAX_FRAME_S, frameMs / 1000);
    last = now;
    frame = requestAnimationFrame(tick);
    if (scenario) {
      scenario.update(now, dt);
      perf.render(scenario.draw, now, frameMs);
      return;
    }
    const def = weaponDef(weapon);
    const total = reloadTotal(def, shells);
    stepReload(reload, dt, total);
    if (holdFire && def.fireTicks > 0) for (let i = autoFireShots(carry, dt, def.fireTicks); i > 0; i--) view.fire(false);
    aimT = stepBlend(aimT, previewAim(def, aiming && !running, aimT).aiming, dt, ADS_BLEND_SECONDS);
    const aim = previewAim(def, aiming && !running, aimT);
    scopeHost.className = `scope${aim.overlay === 'none' ? '' : ' on'}`;
    view.update({
      speed: previewMovementSpeed(walking, running),
      stance: STANCE.STAND,
      sprinting: running,
      sliding: false,
      firing: holdFire,
      onGround: true,
      dt,
      lookDX: 0,
      lookDY: 0,
      reloadElapsed: reload.elapsed,
      reloadShells: shells,
      deployFrac: -1,
      aim: aimT,
      hidden: aim.overlay !== 'none',
    });
    if (reload.playing && total > 0) scrub.value = String(Math.round((reload.elapsed / total) * SCRUB_STEPS));
    const cursor = def.reloadTiming && reload.elapsed >= 0 ? reloadCursor(def.reloadTiming, reload.elapsed, shells) : null;
    phase.textContent = cursor ? `${cursor.phase} ${Math.round(cursor.t * 100)}%` : '';
    readout.textContent = `${def.name}\nposição ${placement.position.map((v) => v.toFixed(1)).join(' ')}\ngiro ${placement.rotation.map(degrees).join(' ')}\nescala ${placement.scale.toFixed(2)}`;
    perf.render(drawWeapon, now, frameMs);
  };
  function drawWeapon() {
    renderer.clear();
    view.render(renderer);
  }
  frame = requestAnimationFrame(tick);

  exit.addEventListener('click', async () => {
    exit.disabled = true;
    fullscreen.disabled = true;
    cancelAnimationFrame(frame);
    listeners.abort();
    scenario?.dispose();
    perf.dispose();
    window.removeEventListener('resize', resize);
    environment.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    if (document.fullscreenElement === stage) await toggleFullscreen(stage);
    onExit();
  });
}
