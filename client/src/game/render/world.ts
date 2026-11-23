import { brandOfMat, isBrandMat, type Box, type MapDef, type Mat } from '@calindra-strike/shared';
import * as THREE from 'three';
import type { DayLook } from './day-look.ts';
import type { QualityProfile } from './quality.ts';
import type { Rider } from './prop-motion.ts';
import { buildProps } from './props.ts';
import { signMaterial } from './store-signs.ts';
import { TEX, TEX_SCALE } from './textures.ts';

interface Bucket {
  pos: number[];
  nrm: number[];
  uv: number[];
  col: number[];
  idx: number[];
}

const FACES: { n: [number, number, number]; v: (b: Box) => number[][] }[] = [
  // +X
  { n: [1, 0, 0], v: (b) => [[b.max.x, b.min.y, b.max.z], [b.max.x, b.min.y, b.min.z], [b.max.x, b.max.y, b.min.z], [b.max.x, b.max.y, b.max.z]] },
  // -X
  { n: [-1, 0, 0], v: (b) => [[b.min.x, b.min.y, b.min.z], [b.min.x, b.min.y, b.max.z], [b.min.x, b.max.y, b.max.z], [b.min.x, b.max.y, b.min.z]] },
  // +Y
  { n: [0, 1, 0], v: (b) => [[b.min.x, b.max.y, b.max.z], [b.max.x, b.max.y, b.max.z], [b.max.x, b.max.y, b.min.z], [b.min.x, b.max.y, b.min.z]] },
  // -Y
  { n: [0, -1, 0], v: (b) => [[b.min.x, b.min.y, b.min.z], [b.max.x, b.min.y, b.min.z], [b.max.x, b.min.y, b.max.z], [b.min.x, b.min.y, b.max.z]] },
  // +Z
  { n: [0, 0, 1], v: (b) => [[b.min.x, b.min.y, b.max.z], [b.max.x, b.min.y, b.max.z], [b.max.x, b.max.y, b.max.z], [b.min.x, b.max.y, b.max.z]] },
  // -Z
  { n: [0, 0, -1], v: (b) => [[b.max.x, b.min.y, b.min.z], [b.min.x, b.min.y, b.min.z], [b.min.x, b.max.y, b.min.z], [b.max.x, b.max.y, b.min.z]] },
];

function faceUV(n: [number, number, number], p: number[], scale: number, b: Box, corner: number): [number, number] {
  if (scale === 0) {
    const c = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ][corner];
    return [c[0], c[1]];
  }
  if (n[0] !== 0) return [(p[2] * -n[0]) / scale, p[1] / scale];
  if (n[1] !== 0) return [p[0] / scale, p[2] / scale];
  void b;
  return [(p[0] * n[2]) / scale, p[1] / scale];
}

function materialFor(mat: Mat): THREE.Material {
  const brand = brandOfMat(mat);
  if (brand) return signMaterial(brand);
  switch (mat) {
    case 'lamp':
      return new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffe7b0', emissiveIntensity: 1.5, roughness: 0.5 });
    case 'lime':
      return new THREE.MeshStandardMaterial({ color: '#a5fa00', emissive: '#a5fa00', emissiveIntensity: 1.8, roughness: 0.4 });
    case 'glass':
      return new THREE.MeshStandardMaterial({
        color: '#cdeeff',
        transparent: true,
        opacity: 0.2,
        roughness: 0.05,
        metalness: 0.2,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
    case 'screen': {
      const t = TEX.screen();
      return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.9, roughness: 0.3 });
    }
    case 'eitri': {
      const t = TEX.eitri();
      // painted mural: transparent mark with a soft shadow, no square behind it
      return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.45, transparent: true, alphaTest: 0.02, depthWrite: false, roughness: 0.6 });
    }
    case 'logo': {
      const t = TEX.logo();
      return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.7, roughness: 0.5 });
    }
    case 'water':
      return new THREE.MeshStandardMaterial({
        map: TEX.water(),
        color: '#8fd8f2',
        emissive: '#1d6a8a',
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.78,
        roughness: 0.05,
        metalness: 0.15,
        depthWrite: false,
      });
    case 'plant':
      return new THREE.MeshStandardMaterial({ map: TEX.plant(), roughness: 0.9, vertexColors: true });
    default: {
      const tex = TEX[mat]?.();
      const rough: Partial<Record<Mat, number>> = { metal: 0.45, container: 0.55, charcoal: 0.75, desk: 0.55, tile: 0.35 };
      const metal: Partial<Record<Mat, number>> = { metal: 0.55, container: 0.3 };
      return new THREE.MeshStandardMaterial({
        map: tex,
        roughness: rough[mat] ?? 0.9,
        metalness: metal[mat] ?? 0,
        vertexColors: true,
      });
    }
  }
}

export interface WorldView {
  group: THREE.Group;
  sky: THREE.Mesh;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  fog: THREE.Fog;
  /** Where the sun's light comes from now; the day cycle moves it, `followShadow` reads it. */
  sunDir: THREE.Vector3;
  /** Paints the sky, lights, fog and glows with a look of the day cycle. Only writes values, nothing is allocated. */
  applyLook(look: DayLook): void;
  /** Advances the moving scenery (fans, escalator steps, fountain water, vent smoke) by dt seconds. */
  /** `riders` are the people in the world, so lift cabs can follow them; none when nobody is. */
  update(dt: number, riders?: readonly Rider[]): void;
  /** Takes a graphics tier chosen mid-match: starts or stops the ambient motion and builds or drops the vent smoke. */
  setQuality(profile: QualityProfile): void;
  dispose(): void;
}

const WHITE = new THREE.Color(1, 1, 1);
const TINT = new THREE.Color();

type SkyUniforms = {
  top: { value: THREE.Color };
  horizon: { value: THREE.Color };
  bottom: { value: THREE.Color };
  sunColor: { value: THREE.Color };
  sunDir: { value: THREE.Vector3 };
  stars: { value: number };
};

function skyDome(map: MapDef): { mesh: THREE.Mesh; uniforms: SkyUniforms } {
  const t = map.theme;
  const sd = new THREE.Vector3(t.sunDir.x, t.sunDir.y, t.sunDir.z).normalize();
  const uniforms: SkyUniforms = {
    top: { value: new THREE.Color(t.skyTop) },
    horizon: { value: new THREE.Color(t.skyHorizon) },
    bottom: { value: new THREE.Color(t.skyBottom) },
    sunColor: { value: new THREE.Color(t.sun) },
    sunDir: { value: sd },
    stars: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunColor; uniform vec3 sunDir; uniform float stars;
      varying vec3 vDir;
      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.zyx + 31.32);
        return fract((p.x + p.y) * p.z);
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = h > 0.0 ? mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(horizon, bottom, pow(clamp(-h, 0.0, 1.0), 0.35));
        float s = max(dot(d, sunDir), 0.0);
        c += sunColor * (pow(s, 900.0) * 6.0 + pow(s, 18.0) * 0.35 + pow(s, 3.0) * 0.08);
        if (stars > 0.0 && h > 0.04) {
          vec3 p = d * 170.0;
          vec3 cell = floor(p);
          float r = hash31(cell);
          float twinkle = step(0.965, r) * smoothstep(0.42, 0.0, length(fract(p) - 0.5));
          c += vec3(0.85, 0.9, 1.0) * twinkle * (0.55 + 0.9 * fract(r * 91.7)) * stars * smoothstep(0.04, 0.3, h);
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 24), mat);
  m.frustumCulled = false;
  m.renderOrder = -10;
  return { mesh: m, uniforms };
}

/** Distant silhouettes: mountains for Forja, a skyline for the office. */
function horizon(map: MapDef): THREE.Object3D {
  const g = new THREE.Group();
  const seedRand = (s: number) => () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const r = seedRand(map.id.length * 7919 + 13);
  if (map.id === 'escritorio') {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ color: '#8a9bb3', roughness: 1 });
    const count = 140;
    const inst = new THREE.InstancedMesh(geo, mat, count);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + r() * 0.05;
      const rad = 3400 + r() * 2200;
      const w = 160 + r() * 380;
      const h = 300 + r() ** 2 * 2200;
      m4.compose(
        new THREE.Vector3(Math.cos(a) * rad, -40, Math.sin(a) * rad),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * Math.PI, 0)),
        new THREE.Vector3(w, h, 160 + r() * 300),
      );
      inst.setMatrixAt(i, m4);
    }
    g.add(inst);
    return g;
  }
  for (const [rad, col, amp] of [
    [5600, '#5a4560', 1300],
    [4300, '#3a2f3d', 800],
  ] as const) {
    const n = 160;
    const pos: number[] = [];
    const idx: number[] = [];
    let hPrev = 0.5;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      hPrev = Math.max(0.15, Math.min(1, hPrev + (r() - 0.5) * 0.5));
      const h = i === n ? pos[1 + 3 * 1] : hPrev * amp + 150;
      const x = Math.cos(a) * rad;
      const z = Math.sin(a) * rad;
      pos.push(x, -60, z, x, h, z);
      if (i < n) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
    g.add(mesh);
  }
  return g;
}

/** Opacity of a map light's halo in daylight; the night look raises it. */
const GLOW_OPACITY = 0.55;

function glowSprite(color: string): THREE.SpriteMaterial {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, color);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.SpriteMaterial({ map: t, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: GLOW_OPACITY });
}

export function buildWorld(map: MapDef, scene: THREE.Scene, profile: QualityProfile): WorldView {
  const group = new THREE.Group();
  const buckets = new Map<Mat, Bucket>();
  const materials = new Map<Mat, THREE.Material>();

  for (const b of map.boxes) {
    if (!b.visible || b.mat === 'clip') continue;
    let bk = buckets.get(b.mat);
    if (!bk) {
      bk = { pos: [], nrm: [], uv: [], col: [], idx: [] };
      buckets.set(b.mat, bk);
    }
    const scale = isBrandMat(b.mat) ? 0 : TEX_SCALE[b.mat] ?? 128;
    const tint = b.tint === undefined ? WHITE : TINT.set(b.tint);
    const h = b.max.y - b.min.y;
    for (const f of FACES) {
      if (f.n[1] === -1 && b.min.y <= 0.01) continue; // never visible
      const base = bk.pos.length / 3;
      const verts = f.v(b);
      verts.forEach((p, ci) => {
        bk.pos.push(p[0], p[1], p[2]);
        bk.nrm.push(f.n[0], f.n[1], f.n[2]);
        const [u, v] = faceUV(f.n, p, scale, b, ci);
        bk.uv.push(u, v);
        // cheap ambient occlusion: darken the bottom of vertical faces
        let ao = 1;
        if (f.n[1] === 0 && b.mat !== 'ground' && b.mat !== 'carpet') ao = p[1] <= b.min.y + 0.01 ? (h > 120 ? 0.62 : 0.72) : 1;
        if (f.n[1] === -1) ao = 0.55;
        bk.col.push(ao * tint.r, ao * tint.g, ao * tint.b);
      });
      bk.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  for (const [mat, bk] of buckets) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(bk.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(bk.nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(bk.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(bk.col, 3));
    geo.setIndex(bk.idx);
    geo.computeBoundingSphere();
    const material = materialFor(mat);
    materials.set(mat, material);
    const mesh = new THREE.Mesh(geo, material);
    const caster = !isBrandMat(mat) && !['glass', 'water', 'lime', 'lamp', 'screen', 'ground', 'carpet', 'eitri', 'logo'].includes(mat);
    mesh.castShadow = caster;
    mesh.receiveShadow = mat !== 'lime' && mat !== 'glass' && mat !== 'water';
    if (mat === 'glass' || mat === 'water') mesh.renderOrder = 5;
    group.add(mesh);
  }

  const props = buildProps(map.props, (mat) => materials.get(mat), profile);
  group.add(props.group);

  const emissives: { mat: THREE.MeshStandardMaterial; base: number }[] = [];
  for (const material of materials.values()) {
    if (material instanceof THREE.MeshStandardMaterial && material.emissiveIntensity > 0 && material.emissive.getHex() !== 0) emissives.push({ mat: material, base: material.emissiveIntensity });
  }

  // glow at map light points
  const halos: THREE.SpriteMaterial[] = [];
  for (const l of map.lights) {
    const halo = glowSprite(l.color);
    halos.push(halo);
    const s = new THREE.Sprite(halo);
    s.position.set(l.x, l.y, l.z);
    s.scale.set(140, 140, 1);
    group.add(s);
  }

  const t = map.theme;
  const dome = skyDome(map);
  const sky = dome.mesh;
  group.add(sky);
  const scenery = horizon(map);
  group.add(scenery);
  const silhouettes: { mat: THREE.MeshBasicMaterial; base: THREE.Color }[] = [];
  scenery.traverse((o) => {
    const mat = (o as THREE.Mesh).material;
    if (mat instanceof THREE.MeshBasicMaterial) silhouettes.push({ mat, base: mat.color.clone() });
  });

  const hemi = new THREE.HemisphereLight(t.hemiSky, t.hemiGround, t.hemiIntensity);
  group.add(hemi);
  const sun = new THREE.DirectionalLight(t.sun, t.sunIntensity);
  const sd = new THREE.Vector3(t.sunDir.x, t.sunDir.y, t.sunDir.z).normalize();
  sun.position.copy(sd).multiplyScalar(2500);
  const cam = sun.shadow.camera;
  cam.left = -1100;
  cam.right = 1100;
  cam.top = 1100;
  cam.bottom = -1100;
  cam.near = 100;
  cam.far = 6000;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 1.2;
  applyShadowQuality(sun, profile);
  group.add(sun);
  group.add(sun.target);

  const fog = new THREE.Fog(t.fog, t.fogNear, t.fogFar);
  scene.fog = fog;
  scene.add(group);

  return {
    group,
    sky,
    sun,
    hemi,
    fog,
    sunDir: sd,
    applyLook(look) {
      const u = dome.uniforms;
      u.top.value.copy(look.skyTop);
      u.horizon.value.copy(look.skyHorizon);
      u.bottom.value.copy(look.skyBottom);
      u.sunColor.value.copy(look.sun);
      u.sunDir.value.copy(look.sunDir);
      u.stars.value = look.stars;
      hemi.color.copy(look.hemiSky);
      hemi.groundColor.copy(look.hemiGround);
      hemi.intensity = look.hemiIntensity;
      sun.color.copy(look.sun);
      sun.intensity = look.sunIntensity;
      sd.copy(look.sunDir);
      fog.color.copy(look.fog);
      fog.near = look.fogNear;
      fog.far = look.fogFar;
      for (const e of emissives) e.mat.emissiveIntensity = e.base * look.glow;
      for (const halo of halos) halo.opacity = Math.min(1, GLOW_OPACITY * look.glow);
      for (const s of silhouettes) s.mat.color.copy(s.base).multiplyScalar(look.scenery);
    },
    update(dt, riders) {
      props.update(dt, riders ?? []);
    },
    setQuality(next) {
      props.setQuality(next);
    },
    dispose() {
      scene.remove(group);
      group.traverse((o) => {
        if (o instanceof THREE.InstancedMesh) o.dispose();
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (mat) {
          for (const mm of Array.isArray(mat) ? mat : [mat]) {
            for (const v of Object.values(mm)) if (v instanceof THREE.Texture) v.dispose();
            mm.dispose();
          }
        }
      });
    },
  };
}

/**
 * Turns the sun's shadows on or off and resizes their map. Safe to call while
 * playing: three recompiles lit materials when the number of shadow casters changes.
 */
export function applyShadowQuality(sun: THREE.DirectionalLight, profile: QualityProfile): void {
  sun.castShadow = profile.shadows;
  if (sun.shadow.mapSize.x === profile.shadowMapPx) return;
  sun.shadow.mapSize.set(profile.shadowMapPx, profile.shadowMapPx);
  sun.shadow.map?.dispose();
  sun.shadow.map = null;
}

/** Keeps a crisp shadow frustum centred on the player, snapped to texels to avoid shimmering. */
export function followShadow(sun: THREE.DirectionalLight, x: number, z: number, dir: THREE.Vector3): void {
  const texel = 2200 / sun.shadow.mapSize.x;
  const sx = Math.round(x / texel) * texel;
  const sz = Math.round(z / texel) * texel;
  sun.target.position.set(sx, 0, sz);
  sun.position.set(sx + dir.x * 2500, dir.y * 2500, sz + dir.z * 2500);
}
