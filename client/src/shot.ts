import * as THREE from 'three';
import { getMap } from '@calindra-strike/shared';
import { QUALITY } from './game/render/quality.ts';
import { buildWorld } from './game/render/world.ts';
import { DAY_EXPOSURE, buildLooks } from './game/render/day-look.ts';

const q = new URLSearchParams(location.search);
const n = (key: string, fallback: number) => (q.has(key) ? Number(q.get(key)) : fallback);
const map = getMap(n('map', 2));
const width = n('w', 1280);
const height = n('h', 720);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(width, height);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = DAY_EXPOSURE;
document.body.append(renderer.domElement);

const scene = new THREE.Scene();
const world = buildWorld(map, scene, QUALITY.low);
const looks = buildLooks(map.theme);
world.applyLook(looks.day);
renderer.toneMappingExposure = looks.day.exposure;
world.update(0, 0);

const camera = new THREE.PerspectiveCamera(n('fov', 75), width / height, 1, 12000);
const yaw = (n('yaw', 0) * Math.PI) / 180;
const pitch = (n('pitch', 0) * Math.PI) / 180;
camera.position.set(n('x', 0), n('y', 100), n('z', 0));
camera.rotation.order = 'YXZ';
camera.rotation.set(pitch, yaw, 0);
renderer.render(scene, camera);
document.title = 'shot-done';
