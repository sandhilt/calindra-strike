import * as THREE from 'three';
import { drawLidBadge } from './game/laptop/badge.ts';
import { BombRenderer } from './game/render/bomb.ts';
import { LAPTOP_MODELS, chassisColor, drawIdleScreen, drawLaptop, drawLaptopScreen } from './game/laptop/draw.ts';
import { SCENARIOS } from './game/laptop/scenarios.ts';

const PREVIEW_W = 720;
const PREVIEW_H = 460;
const TEXTURE_W = 512;
const TEXTURE_H = 320;
const BADGE_W = 256;
const BADGE_H = 96;
const LOOP_MS = 8000;
const IDLE_SECONDS = 40;

const style = document.createElement('style');
style.textContent = `
  body { margin: 0; background: #0c1320; color: #dce8f7; font: 16px system-ui; }
  main { max-width: 1500px; margin: auto; padding: 28px; }
  h1 { margin-bottom: 6px; }
  p { color: #a0b6d0; }
  #controls { position: sticky; top: 0; background: #182539; padding: 16px; border-radius: 12px; z-index: 1; }
  input { width: min(55vw, 600px); vertical-align: middle; }
  button { background: #80e5c2; border: 0; padding: 9px 20px; border-radius: 6px; margin-right: 20px; }
  output { margin-left: 16px; font-variant-numeric: tabular-nums; }
  #scenarios, #textures, #idles, #badges { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 480px), 1fr)); gap: 24px; }
  canvas { width: 100%; max-width: 720px; background: #101c2d; border-radius: 12px; }
  h2 { font-size: 18px; }
`;
document.head.append(style);

function mountCanvas(container: Element | null, label: string, width: number, height: number): CanvasRenderingContext2D | null {
  const ratio = window.devicePixelRatio || 1;
  const section = document.createElement('section');
  const title = document.createElement('h2');
  title.textContent = label;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.setAttribute('aria-label', label);
  section.append(title, canvas);
  container?.append(section);
  return canvas.getContext('2d');
}

const laptops = SCENARIOS.map((scenario) => mountCanvas(document.querySelector('#scenarios'), scenario.title, PREVIEW_W, PREVIEW_H));
const textures = SCENARIOS.map((scenario) => mountCanvas(document.querySelector('#textures'), scenario.title, TEXTURE_W, TEXTURE_H));
const idles = SCENARIOS.map((scenario) => mountCanvas(document.querySelector('#idles'), scenario.title, PREVIEW_W, PREVIEW_H));
LAPTOP_MODELS.forEach((model) => {
  const ctx = mountCanvas(document.querySelector('#badges'), `Selo da tampa · ${model}`, BADGE_W, BADGE_H);
  if (!ctx) return;
  ctx.fillStyle = chassisColor(model);
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.scale(ctx.canvas.width / BADGE_W, ctx.canvas.height / BADGE_H);
  drawLidBadge(ctx, BADGE_W, BADGE_H, model);
});
const slider = document.querySelector<HTMLInputElement>('#progress');
const play = document.querySelector<HTMLButtonElement>('#play');
const readout = document.querySelector<HTMLOutputElement>('#readout');

let playing = true;
let progress = 0;
let previous: number | undefined;

slider?.addEventListener('input', () => {
  progress = Number(slider.value);
  playing = false;
  if (play) play.textContent = 'Retomar';
});
play?.addEventListener('click', () => {
  playing = !playing;
  play.textContent = playing ? 'Pausar' : 'Retomar';
});

function scaled(ctx: CanvasRenderingContext2D, width: number, height: number, draw: (w: number, h: number) => void): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const ratio = ctx.canvas.width / width;
  ctx.scale(ratio, ratio);
  draw(width, height);
}

function frame(time: number): void {
  if (playing) progress = (progress + (previous === undefined ? 0 : time - previous) / LOOP_MS) % 1;
  previous = time;
  if (slider) slider.value = String(progress);
  if (readout) readout.value = progress.toFixed(3);
  laptops.forEach((ctx, index) => ctx && scaled(ctx, PREVIEW_W, PREVIEW_H, (w, h) => drawLaptop(ctx, w, h, index, progress, time)));
  textures.forEach((ctx, index) => ctx && scaled(ctx, TEXTURE_W, TEXTURE_H, (w, h) => drawLaptopScreen(ctx, w, h, index, progress, time)));
  idles.forEach((ctx, index) => ctx && scaled(ctx, PREVIEW_W, PREVIEW_H, (w, h) => drawIdleScreen(ctx, w, h, index, IDLE_SECONDS - progress * IDLE_SECONDS, time)));
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

const MODEL_W = 1100;
const MODEL_H = 520;
const ORBIT_RADIUS_UNITS = 190;
const ORBIT_HEIGHT_UNITS = 110;
const SWAY_PERIOD_MS = 9000;
const SWAY_RAD = 0.7;

function mountModel(container: Element | null): void {
  const canvas = document.createElement('canvas');
  canvas.style.maxWidth = `${MODEL_W}px`;
  container?.append(canvas);
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch {
    canvas.replaceWith(Object.assign(document.createElement('p'), { textContent: 'Sem WebGL neste navegador.' }));
    return;
  }
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(MODEL_W, MODEL_H, false);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b2433');
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#3a3326', 1.6));
  const sun = new THREE.DirectionalLight('#ffffff', 1.4);
  sun.position.set(120, 260, 160);
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(900, 500), new THREE.MeshStandardMaterial({ color: '#4a4f57', roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const camera = new THREE.PerspectiveCamera(55, MODEL_W / MODEL_H, 1, 3000);
  const at = { y: 0, variant: 0, attackers: 0 };
  const stations = [
    { renderer: new BombRenderer([]), bomb: (now: number) => ({ ...at, x: -90, z: 0, variant: 5, state: 'planted' as const, explodeAt: now + 20000, defuser: 1, defuseDoneAt: now + 3000 }) },
    { renderer: new BombRenderer([]), bomb: () => ({ ...at, x: 90, z: 0, variant: 0, state: 'home' as const }) },
  ];
  for (const s of stations) scene.add(s.renderer.group);
  const frame = (now: number) => {
    const angle = Math.sin((now / SWAY_PERIOD_MS) * Math.PI * 2) * SWAY_RAD;
    camera.position.set(Math.sin(angle) * ORBIT_RADIUS_UNITS, ORBIT_HEIGHT_UNITS, Math.cos(angle) * ORBIT_RADIUS_UNITS);
    camera.lookAt(0, 30, 0);
    for (const s of stations) s.renderer.update(s.bomb(now), now, now / 1000, camera.position, () => undefined);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

mountModel(document.querySelector('#model3d'));
