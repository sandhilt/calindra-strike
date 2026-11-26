import * as THREE from 'three';
import { CollisionWorld, DEG, getMaps, TICK_MS, WEAPON, type MapDef } from '@calindra-strike/shared';
import { Sfx, type AmbientLoop } from '../game/audio.ts';
import { NearbyLoops, ambientEmitters, type Emitter } from '../game/nearby-loops.ts';
import { StationTracks } from '../game/station-tracks.ts';
import { groundAt, TOUR_EYE_HEIGHT, tourPoints } from '../benchmark/tours.ts';
import { QUALITY, QUALITY_OPTIONS, renderPixelRatio, type Quality } from '../game/render/quality.ts';
import type { ViewModel } from '../game/render/viewmodel.ts';
import { applyShadowQuality, buildWorld, followShadow } from '../game/render/world.ts';
import type { Settings } from '../settings.ts';
import { buttonRow, checkRow, choiceRow, group, rangeRow } from '../ui/controls.ts';
import { h } from '../ui/dom.ts';
import { lookBy, stepFly, type FlyInput, type FlyPose } from './fly-camera.ts';
import { lookDirection } from './scenario-walk.ts';

const DEFAULT_FOV = 74;
const FAR_PLANE_UNITS = 12000;
const MOUSE_YAW_DEGREES = 0.022;
const MOVEMENT_KEYS = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'Space', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight']);
const stationTracks = new StationTracks<AudioBuffer>((src) => fetch(src));

export function createScenarioExplorer(
  renderer: THREE.WebGLRenderer,
  initialQuality: Quality,
  settings: Settings,
  getGun: () => ViewModel,
  onLock: (locked: boolean) => void,
  resetStats: () => void,
) {
  const canvas = renderer.domElement;
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(DEFAULT_FOV, 1, 1, FAR_PLANE_UNITS);
  const maps = getMaps();
  const pressed = new Set<string>();
  const sunDir = new THREE.Vector3();
  const nothing = () => {};
  let map = maps[0];
  let quality = initialQuality;
  let world = buildWorld(map, scene, QUALITY[quality]);
  let pose: FlyPose;
  let showGun = false;
  let soundsOn = false;
  let sfx: Sfx | undefined;
  let loops: NearbyLoops | undefined;

  function resetPose() {
    const point = tourPoints(map)[0] ?? { x: 0, z: 0 };
    const ground = groundAt(new CollisionWorld(map), point);
    pose = {
      x: point.x, z: point.z, y: (Number.isFinite(ground) ? ground : 0) + TOUR_EYE_HEIGHT,
      yaw: 0, pitch: 0,
    };
  }

  function orientSun() {
    const { x, y, z } = map.theme.sunDir;
    sunDir.set(x, y, z).normalize();
  }

  /** Created on first use, so the audio context starts from a click or key press. */
  function audio(): Sfx {
    sfx ??= new Sfx(settings.volume, settings.soundPack);
    return sfx;
  }

  function startLoop(at: Emitter): AmbientLoop | undefined {
    if (at.kind === 'noise') return audio().ambientLoop(at.voice, at);
    if (settings.musicVolume === 0) return undefined;
    const track = stationTracks.get(at.station);
    if (track.kind === 'ready') return audio().trackLoop(track.buffer, at, at.station, performance.now());
    if (track.kind === 'idle') void stationTracks.load(at.station, (data) => audio().ctx.decodeAudioData(data));
    return undefined;
  }

  function restartLoops() {
    loops?.dispose();
    loops = soundsOn ? new NearbyLoops(ambientEmitters(map.props), startLoop) : undefined;
  }

  function setSounds(on: boolean) {
    soundsOn = on;
    if (on) audio().resume();
    restartLoops();
  }

  function disposeWorld() {
    world.sun.shadow.dispose();
    world.dispose();
  }

  function selectMap(next: MapDef) {
    if (next === map) return;
    disposeWorld();
    map = next;
    world = buildWorld(map, scene, QUALITY[quality]);
    orientSun();
    resetPose();
    restartLoops();
    resetStats();
  }

  function resize() {
    const { innerWidth: width, innerHeight: height, devicePixelRatio } = window;
    renderer.setPixelRatio(renderPixelRatio(QUALITY[quality], devicePixelRatio));
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function selectQuality(next: Quality) {
    if (next === quality) return;
    quality = next;
    applyShadowQuality(world.sun, QUALITY[quality]);
    world.setQuality(QUALITY[quality]);
    resize();
    resetStats();
  }

  const locked = () => document.pointerLockElement === canvas;
  canvas.addEventListener('click', async () => {
    if (locked() || document.pointerLockElement) return;
    try {
      await canvas.requestPointerLock({ unadjustedMovement: true });
    } catch {
      if (listeners.signal.aborted) return;
      try {
        await canvas.requestPointerLock();
      } catch {
        return;
      }
    }
    if (listeners.signal.aborted && locked()) document.exitPointerLock();
  }, options);

  document.addEventListener('pointerlockchange', () => {
    pressed.clear();
    onLock(locked());
  }, options);
  document.addEventListener('mousemove', (event) => {
    if (locked()) pose = lookBy(pose, event.movementX, event.movementY, settings.sensitivity * MOUSE_YAW_DEGREES * DEG);
  }, options);
  window.addEventListener('keydown', (event) => {
    if (!locked() || !MOVEMENT_KEYS.has(event.code)) return;
    event.preventDefault();
    pressed.add(event.code);
  }, options);
  window.addEventListener('keyup', (event) => pressed.delete(event.code), options);
  window.addEventListener('blur', () => pressed.clear(), options);

  const axis = (positive: boolean, negative: boolean): FlyInput['forward'] =>
    positive === negative ? 0 : positive ? 1 : -1;
  const either = (left: string, right: string) => pressed.has(left) || pressed.has(right);
  const controls = group(
    'cenário',
    choiceRow('mapa', maps.map((v) => ({ v, label: v.name })), () => map, selectMap, nothing),
    choiceRow('gráficos', QUALITY_OPTIONS, () => quality, selectQuality, nothing),
    checkRow('sons do cenário', 'ambientes, fontes e a música das caixas', () => soundsOn, setSounds, nothing),
    rangeRow('campo de visão', { min: 40, max: 110, step: 1 }, () => camera.fov, (v) => {
      camera.fov = v;
      camera.updateProjectionMatrix();
    }, (v) => `${v}°`, nothing),
    buttonRow(h('button', { class: 'btn', type: 'button', text: 'voltar ao início', onclick: resetPose })),
    checkRow('mostrar arma', 'arma em primeira pessoa', () => showGun, (v) => {
      showGun = v;
      resetStats();
    }, nothing),
    h('small', { class: 'hint', text: 'Clique no cenário para voar. WASD move, Espaço sobe, Ctrl desce, Shift acelera e Esc volta ao painel.' }),
  );

  orientSun();
  resetPose();
  resize();
  return {
    controls,
    resize,
    update(now: number, dt: number) {
      if (locked()) {
        pose = stepFly(pose, {
          forward: axis(pressed.has('KeyW'), pressed.has('KeyS')),
          right: axis(pressed.has('KeyD'), pressed.has('KeyA')),
          up: axis(pressed.has('Space'), either('ControlLeft', 'ControlRight')),
          fast: either('ShiftLeft', 'ShiftRight'),
        }, dt);
      }
      camera.position.set(pose.x, pose.y, pose.z);
      camera.rotation.set(pose.pitch, pose.yaw, 0, 'YXZ');
      followShadow(world.sun, pose.x, pose.z, sunDir);
      world.sky.position.copy(camera.position);
      world.update(dt, Math.round(now / TICK_MS), camera.position);
      if (sfx) {
        const f = lookDirection(pose.yaw, pose.pitch);
        sfx.setListener(camera.position.x, camera.position.y, camera.position.z, f.x, f.y, f.z);
      }
      loops?.update(dt, camera.position);
      if (!showGun) return;
      const gun = getGun();
      gun.setQuality(quality);
      gun.setWeapon(WEAPON.RIFLE);
      if (gun.camera.aspect !== camera.aspect) {
        gun.camera.aspect = camera.aspect;
        gun.camera.updateProjectionMatrix();
      }
    },
    draw() {
      renderer.render(scene, camera);
      if (showGun) getGun().render(renderer);
    },
    dispose() {
      listeners.abort();
      if (locked()) document.exitPointerLock();
      onLock(false);
      loops?.dispose();
      loops = undefined;
      sfx?.dispose();
      sfx = undefined;
      disposeWorld();
    },
  };
}
