import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PLAYER_COLORS, WEAPONS, reloadCursor, weaponDef, type WeaponId } from '@calindra-strike/shared';
import { QUALITY, QUALITY_OPTIONS, type Quality } from '../game/render/quality.ts';
import { ViewModel } from '../game/render/viewmodel.ts';
import { type GunPlacement, formatPlacement } from '../game/render/weapon-placement.ts';
import type { Settings } from '../settings.ts';
import { buttonRow, checkRow, choiceRow, group, rangeRow, row } from '../ui/controls.ts';
import { h } from '../ui/dom.ts';
import { autoFireShots, reloadTotal, scrubTo, startReload, stepReload, type ReloadScrub } from './weapon-debug.ts';

const DEFAULT_FOV = 58;
const WALK_SPEED = 250;
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
    root.replaceChildren(h('div', { class: 'overlay' }, [h('div', { class: 'menu glass dbg-notice' }, [h('h2', { text: 'modo debug' }), h('p', { class: 'sub', text: 'Este navegador não tem WebGL, então o visualizador de armas não abre.' }), exit])]));
    exit.addEventListener('click', onExit);
    return;
  }
  renderer.setClearColor(BACKGROUND);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  let quality: Quality = settings.quality;
  const view = new ViewModel(PLAYER_COLORS[settings.color], quality);
  view.setLeftHanded(settings.leftHanded);
  const pmrem = new THREE.PMREMGenerator(renderer);
  view.setEnvironment(pmrem.fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size: QUALITY[quality].envMapPx }).texture);

  let weapon: WeaponId = WEAPONS[WEAPONS.length - 1].id;
  const reload: ReloadScrub = { elapsed: -1, playing: false, speed: 1, loop: true };
  const carry = { ticks: 0 };
  let holdFire = false;
  let walking = false;
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

  const panel = h('aside', { class: 'menu glass dbg-panel' }, [
    h('header', { class: 'menu-head' }, [h('div', {}, [h('h2', { text: 'debug' }), h('p', { class: 'sub', text: 'armas, animações e ângulo' })]), exit]),
    h('div', { class: 'menu-body' }, [h('div', { class: 'menu-col' }, [weaponHost, reloadHost, placementHost, copied, readout])]),
  ]);
  const stage = h('div', { class: 'dbg-stage' }, [renderer.domElement, panel]);
  root.replaceChildren(stage);

  const resize = () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, QUALITY[quality].maxPixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
    view.camera.aspect = window.innerWidth / window.innerHeight;
    view.camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  view.camera.fov = DEFAULT_FOV;
  select(weapon);
  resize();

  let last = performance.now();
  let frame = 0;
  const tick = (now: number) => {
    const dt = Math.min(MAX_FRAME_S, (now - last) / 1000);
    last = now;
    const def = weaponDef(weapon);
    const total = reloadTotal(def, shells);
    stepReload(reload, dt, total);
    if (holdFire && def.fireTicks > 0) for (let i = autoFireShots(carry, dt, def.fireTicks); i > 0; i--) view.fire(false);
    view.update({ speed: walking ? WALK_SPEED : 0, onGround: true, dt, lookDX: 0, lookDY: 0, reloadElapsed: reload.elapsed, reloadShells: shells, deployFrac: -1, hidden: false });
    if (reload.playing && total > 0) scrub.value = String(Math.round((reload.elapsed / total) * SCRUB_STEPS));
    const cursor = def.reloadTiming && reload.elapsed >= 0 ? reloadCursor(def.reloadTiming, reload.elapsed, shells) : null;
    phase.textContent = cursor ? `${cursor.phase} ${Math.round(cursor.t * 100)}%` : '';
    readout.textContent = `${def.name}\nposição ${placement.position.map((v) => v.toFixed(1)).join(' ')}\ngiro ${placement.rotation.map(degrees).join(' ')}\nescala ${placement.scale.toFixed(2)}`;
    renderer.clear();
    view.render(renderer);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  exit.addEventListener('click', () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', resize);
    pmrem.dispose();
    renderer.dispose();
    onExit();
  });
}
