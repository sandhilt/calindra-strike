import * as THREE from 'three';
import { CollisionWorld, DEG, STANCE, WEAPONS, applyCmd, eyePosition, getMaps, giveWeapon, magCapacity, onDuct, shellsToLoad, TICK_MS, WEAPON, weaponDef, type Cmd, type MapDef, type PlayerState, type ShotInfo, type WeaponId } from '@calindra-strike/shared';
import { Sfx, type AmbientLoop } from '../game/audio.ts';
import { mouseBinding } from '../game/bindings.ts';
import { NearbyLoops, ambientEmitters, type Emitter } from '../game/nearby-loops.ts';
import { StationTracks } from '../game/station-tracks.ts';
import { ReloadPlayback } from '../game/reload-playback.ts';
import { Effects } from '../game/render/effects.ts';
import { ADS_BLEND_SECONDS } from '../game/render/ads-view.ts';
import { stepBlend } from '../game/render/movement-pose.ts';
import { groundAt, TOUR_EYE_HEIGHT, tourPoints } from '../benchmark/tours.ts';
import { QUALITY, QUALITY_OPTIONS, renderPixelRatio, type Quality } from '../game/render/quality.ts';
import type { ViewModel } from '../game/render/viewmodel.ts';
import { applyShadowQuality, buildWorld, followShadow } from '../game/render/world.ts';
import type { Settings } from '../settings.ts';
import { buttonRow, checkRow, choiceRow, group, rangeRow } from '../ui/controls.ts';
import { h } from '../ui/dom.ts';
import { lookBy, stepFly, type FlyInput, type FlyPose } from './fly-camera.ts';
import { lookDirection, shotPaths, spawnWalker, ticksDue, walkButtons, weaponRequest } from './scenario-walk.ts';

const DEFAULT_FOV = 74;
const FAR_PLANE_UNITS = 12000;
const MOUSE_YAW_DEGREES = 0.022;
/** Any simulation seed: the explorer is single-player, so its spread only needs to vary between shots. */
const WALK_SEED = 1;
const MELEE_SLOT = 3;
/** The explorer shoots as the local player, so its tracers and shots carry the same shooter id as the match. */
const LOCAL_SHOOTER = -1;
type Mode = 'fly' | 'walk';
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
  let collision = new CollisionWorld(map);
  let quality = initialQuality;
  let world = buildWorld(map, scene, QUALITY[quality]);
  let pose: FlyPose;
  let showGun = false;
  let mode: Mode = 'fly';
  let weapon: WeaponId = WEAPON.RIFLE;
  let player: PlayerState;
  let carry = 0;
  let pendingWeapon = 0;
  let gunWeapon: WeaponId | undefined;
  let aimT = 0;
  /** Built on the first shot, so flying never pays for the pooled tracers and decals. */
  let effects: Effects | undefined;
  const reload = new ReloadPlayback();
  let soundsOn = false;
  let sfx: Sfx | undefined;
  let loops: NearbyLoops | undefined;

  function resetPose() {
    const point = tourPoints(map)[0] ?? { x: 0, z: 0 };
    const ground = groundAt(collision, point);
    pose = {
      x: point.x, z: point.z, y: (Number.isFinite(ground) ? ground : 0) + TOUR_EYE_HEIGHT,
      yaw: 0, pitch: 0,
    };
    if (mode === 'walk') spawnPlayer();
  }

  /** Drops the walker where the camera stands, so switching modes keeps the place. */
  function spawnPlayer() {
    player = spawnWalker(collision, pose.x, pose.z, pose.yaw, weapon, pose.y);
    carry = 0;
  }

  const gunShown = () => showGun || mode === 'walk';

  function setMode(next: Mode) {
    if (next === mode) return;
    mode = next;
    pendingWeapon = 0;
    reload.end();
    if (mode === 'walk') spawnPlayer();
  }

  /** Runs the walker through the game's own movement, one command per simulation tick. */
  function stepWalk(now: number, dt: number) {
    const due = ticksDue(carry, dt);
    carry = due.carry;
    // The cab clock advances one tick per simulated command and ends on the frame's clock, the one the cab is drawn with.
    collision.liftTick = Math.round(now / TICK_MS) - due.ticks;
    const buttons = walkButtons(pressed, settings.bindings);
    for (let i = 0; i < due.ticks; i++) {
      collision.liftTick += 1;
      const cmd: Cmd = { seq: player.tick, buttons, yaw: pose.yaw, pitch: pose.pitch, weapon: pendingWeapon, interp: 0 };
      pendingWeapon = 0;
      const shot = applyCmd(collision, player, cmd, WALK_SEED);
      if (shot) fire(shot);
    }
    weapon = player.weapon;
    syncReload(player);
    // The camera sits at the eye the shots leave from, so a lean moves the view with the shot.
    const eye = eyePosition(player);
    pose = { ...pose, x: eye.x, y: eye.y, z: eye.z };
  }

  function selectWeapon(id: WeaponId) {
    weapon = id;
    if (mode === 'walk') giveWeapon(player, id);
  }

  /** Where a shot's tracer leaves the gun, as the client places it: a little ahead of the camera and below it. */
  function muzzlePoint(): THREE.Vector3 {
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const down = new THREE.Vector3(0, -1, 0).applyQuaternion(camera.quaternion);
    return camera.position.clone().addScaledVector(fwd, 30).addScaledVector(right, 7).addScaledVector(down, 6);
  }

  /** Plays the reload sounds at the tick they come due, the way the client plays the local player's reload. */
  function syncReload(p: PlayerState) {
    if (p.reload === 0) {
      reload.end();
      return;
    }
    const def = weaponDef(p.weapon);
    if (!reload.active) reload.begin(def, shellsToLoad(def, p.mag[def.id], p.reserve[def.id]), p.tick);
    for (const cue of reload.due(p.tick)) audio().reload(p.weapon, cue);
  }

  /** The shot as the client plays its own: kick, shot, tracers and each impact with its sound. */
  function fire(shot: ShotInfo) {
    effects ??= new Effects(scene);
    const fx = effects;
    getGun().fire(shot.heavy);
    audio().shot(shot.weapon, null, shot.heavy);
    const eye = new THREE.Vector3(shot.ox, shot.oy, shot.oz);
    const muzzle = muzzlePoint();
    if (weaponDef(shot.weapon).slot !== MELEE_SLOT) fx.muzzleFlash(muzzle);
    const pattern = fx.gun.projectile(LOCAL_SHOOTER, shot.weapon);
    shotPaths(collision, shot).forEach((path, pellet) => {
      const end = new THREE.Vector3(path.end.x, path.end.y, path.end.z);
      if (pellet < pattern.pelletsPerShot) fx.projectile(muzzle, end, eye, pattern);
      for (const impact of path.impacts) {
        const at = new THREE.Vector3(impact.at.x, impact.at.y, impact.at.z);
        const normal = new THREE.Vector3(impact.normal.x, impact.normal.y, impact.normal.z);
        fx.impact(at, normal, impact.surface);
        audio().impact(impact.surface, impact.at);
        if (onDuct(map, at.x, at.y, at.z)) fx.gun.leak(at, normal);
      }
    });
  }

  /** Drives the held weapon's pose from the walker, so the sway, sprint, ADS and reload match the match. */
  function animateGun(gun: ViewModel, p: PlayerState, dt: number) {
    const def = weaponDef(p.weapon);
    aimT = stepBlend(aimT, p.aiming, dt, ADS_BLEND_SECONDS);
    gun.update({
      speed: Math.hypot(p.vx, p.vz),
      stance: p.stance,
      sprinting: p.sprinting,
      sliding: p.slide > 0,
      firing: p.attackHeld,
      onGround: p.onGround,
      dt,
      lookDX: 0,
      lookDY: 0,
      reloadElapsed: reload.elapsed(p.tick),
      reloadShells: reload.shells,
      deployFrac: p.deploy > 0 ? 1 - p.deploy / def.deployTicks : -1,
      rounds: { mag: p.mag[p.weapon], capacity: magCapacity(def, p.halvedAmmo) },
      aim: aimT,
      lean: p.lean,
      hidden: false,
    });
  }

  /** The gun at rest while flying, so a pose from walking does not stay on screen. */
  function animateIdle(gun: ViewModel, dt: number) {
    aimT = stepBlend(aimT, false, dt, ADS_BLEND_SECONDS);
    gun.update({
      speed: 0,
      stance: STANCE.STAND,
      sprinting: false,
      sliding: false,
      firing: false,
      onGround: true,
      dt,
      lookDX: 0,
      lookDY: 0,
      reloadElapsed: -1,
      reloadShells: 0,
      deployFrac: -1,
      aim: aimT,
      lean: 0,
      hidden: false,
    });
  }

  function orientSun() {
    const { x, y, z } = map.theme.sunDir;
    sunDir.set(x, y, z).normalize();
  }

  /** Created on first use, so the audio context starts from a click or key press. */
  function audio(): Sfx {
    if (!sfx) {
      sfx = new Sfx(settings.volume, settings.soundPack);
      sfx.setMusicVolume(settings.musicVolume);
    }
    return sfx;
  }

  /** A track decoded after the explorer closed must not reopen an audio context, so it decodes in a throwaway one. */
  async function decodeTrack(data: ArrayBuffer): Promise<AudioBuffer> {
    if (sfx) return sfx.ctx.decodeAudioData(data);
    const ctx = new AudioContext();
    try {
      return await ctx.decodeAudioData(data);
    } finally {
      void ctx.close();
    }
  }

  function startLoop(at: Emitter): AmbientLoop | undefined {
    if (at.kind === 'noise') return audio().ambientLoop(at.voice, at);
    if (settings.musicVolume === 0) return undefined;
    const track = stationTracks.get(at.station);
    if (track.kind === 'ready') return audio().trackLoop(track.buffer, at, at.station, performance.now());
    if (track.kind === 'idle') void stationTracks.load(at.station, decodeTrack);
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
    effects?.clear();
    collision = new CollisionWorld(map);
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
    pendingWeapon = 0;
    onLock(locked());
  }, options);
  document.addEventListener('mousemove', (event) => {
    if (locked()) pose = lookBy(pose, event.movementX, event.movementY, settings.sensitivity * MOUSE_YAW_DEGREES * DEG);
  }, options);
  window.addEventListener('keydown', (event) => {
    if (!locked() || event.metaKey) return;
    event.preventDefault();
    pressed.add(event.code);
    if (mode === 'walk') pendingWeapon = weaponRequest(event.code, settings.bindings) || pendingWeapon;
  }, options);
  window.addEventListener('mousedown', (event) => {
    if (!locked()) return;
    if (mode === 'walk') audio().resume();
    const code = mouseBinding(event.button);
    pressed.add(code);
    if (mode === 'walk') pendingWeapon = weaponRequest(code, settings.bindings) || pendingWeapon;
  }, options);
  window.addEventListener('mouseup', (event) => pressed.delete(mouseBinding(event.button)), options);
  window.addEventListener('keyup', (event) => pressed.delete(event.code), options);
  window.addEventListener('blur', () => pressed.clear(), options);

  const axis = (positive: boolean, negative: boolean): FlyInput['forward'] =>
    positive === negative ? 0 : positive ? 1 : -1;
  const either = (left: string, right: string) => pressed.has(left) || pressed.has(right);
  const controls = group(
    'cenário',
    choiceRow('mapa', maps.map((v) => ({ v, label: v.name })), () => map, selectMap, nothing),
    choiceRow<Mode>('movimento', [{ v: 'fly', label: 'voar' }, { v: 'walk', label: 'andar' }], () => mode, setMode, nothing),
    choiceRow('arma', WEAPONS.map((w) => ({ v: w.id, label: w.name })), () => weapon, selectWeapon, nothing),
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
    h('small', { class: 'hint', text: 'Clique no cenário para entrar. Voar: WASD move, Espaço sobe, Ctrl desce e Shift acelera. Andar: WASD anda, Espaço pula, Ctrl agacha, Shift corre, clique esquerdo atira e R recarrega. Esc volta ao painel.' }),
  );

  orientSun();
  resetPose();
  resize();
  return {
    controls,
    resize,
    update(now: number, dt: number) {
      if (mode === 'walk') stepWalk(now, dt);
      else if (locked()) {
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
      effects?.update(dt, (x, y, z) => Math.max(0, collision.groundBelow(x, y, z, 0)));
      if (!gunShown()) return;
      const gun = getGun();
      gun.setQuality(quality);
      if (gunWeapon !== weapon) {
        gun.setWeapon(weapon);
        gunWeapon = weapon;
      }
      if (gun.camera.aspect !== camera.aspect) {
        gun.camera.aspect = camera.aspect;
        gun.camera.updateProjectionMatrix();
      }
      if (mode === 'walk') animateGun(gun, player, dt);
      else animateIdle(gun, dt);
    },
    draw() {
      renderer.render(scene, camera);
      if (gunShown()) getGun().render(renderer);
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
