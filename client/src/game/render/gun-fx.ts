import type { WeaponId } from '@calindra-strike/shared';
import * as THREE from 'three';
import { DebrisPool, debrisFade, type GroundAt } from './debris-sim.ts';
import {
  CASING_BRASS,
  CASING_BY_WEAPON,
  CASING_EJECT,
  CASING_SHELL,
  CASING_SIZE_UNITS,
  CASING_SPEC,
  MAGAZINE_COLOR,
  MAGAZINE_DROP,
  MAGAZINE_SIZE_UNITS,
  MAGAZINE_SPEC,
  SMOKE_STYLES,
  SMOKE_BY_WEAPON,
} from './fx-tuning.ts';
import { HeatTracker, SmokePool, puffsForHeat, smokeAlpha, smokeSize } from './smoke-sim.ts';
import { QUALITY, type FxProfile, type Quality } from './quality.ts';
import { TracerPolicy } from './tracer-policy.ts';

const HIGH = QUALITY.high.fx;
const CASING_COLORS: readonly THREE.Color[] = [new THREE.Color(CASING_BRASS.color), new THREE.Color(CASING_SHELL.color)];

/** Soft blobs piled off-centre make a wisp with a ragged edge, not a perfect disc. */
const SMOKE_TEXTURE_BLOBS = 14;

function smokeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < SMOKE_TEXTURE_BLOBS; i++) {
    const angle = rand() * Math.PI * 2;
    const reach = rand() * 12;
    const x = 32 + Math.cos(angle) * reach;
    const y = 32 + Math.sin(angle) * reach;
    const r = 9 + rand() * 11;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.32)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(c);
}

/**
 * Physical gun leftovers in the world: spent magazines, ejected casings and
 * barrel smoke. The simulation lives in plain pools; this class only owns the
 * meshes that draw them, so everything is pooled and nothing allocates per frame.
 */
export class GunFx {
  private fx: FxProfile = HIGH;
  private readonly magazines: DebrisPool;
  private readonly casings: DebrisPool;
  private readonly smoke: SmokePool;
  private readonly heat = new HeatTracker();
  private quality: Quality = 'high';
  private readonly tracers = new TracerPolicy();
  private readonly magazineMesh: THREE.InstancedMesh;
  private readonly casingMesh: THREE.InstancedMesh;
  private readonly smokeGeo: THREE.BufferGeometry;
  private readonly smokePoints: THREE.Points;
  private readonly smokeMaterial: THREE.PointsMaterial;
  private readonly random: () => number;
  private readonly now: () => number;
  private readonly tmpM = new THREE.Matrix4();
  private readonly tmpQ = new THREE.Quaternion();
  private readonly tmpE = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly tmpP = new THREE.Vector3();
  private readonly tmpS = new THREE.Vector3();

  constructor(scene: THREE.Scene, random: () => number = Math.random, now: () => number = () => performance.now() / 1000) {
    this.random = random;
    this.now = now;
    this.magazines = new DebrisPool(MAGAZINE_SPEC, HIGH.magazines, random);
    this.casings = new DebrisPool(CASING_SPEC, HIGH.casings, random);
    this.smoke = new SmokePool(HIGH.smokePuffs, random, SMOKE_STYLES.high);

    this.magazineMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(MAGAZINE_SIZE_UNITS.w, MAGAZINE_SIZE_UNITS.l, MAGAZINE_SIZE_UNITS.d),
      new THREE.MeshStandardMaterial({ color: MAGAZINE_COLOR, roughness: 0.5, metalness: 0.3 }),
      HIGH.magazines,
    );
    this.casingMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(CASING_SIZE_UNITS.radius, CASING_SIZE_UNITS.radius, CASING_SIZE_UNITS.length, 8),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, metalness: 0.6 }),
      HIGH.casings,
    );
    this.casingMesh.setColorAt(0, CASING_COLORS[0]);
    for (const mesh of [this.magazineMesh, this.casingMesh]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      scene.add(mesh);
    }

    this.smokeGeo = new THREE.BufferGeometry();
    this.smokeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(HIGH.smokePuffs * 3), 3));
    this.smokeGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(HIGH.smokePuffs * 4), 4));
    this.smokeGeo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(HIGH.smokePuffs), 1));
    this.smokeGeo.setDrawRange(0, 0);
    this.smokeMaterial = new THREE.PointsMaterial({
      map: smokeTexture(),
      size: 1,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    // Per-puff diameter: the stock points shader has one size for the whole cloud.
    this.smokeMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aSize;')
        .replace('gl_PointSize = size;', 'gl_PointSize = size * aSize;');
    };
    this.smokePoints = new THREE.Points(this.smokeGeo, this.smokeMaterial);
    this.smokePoints.frustumCulled = false;
    scene.add(this.smokePoints);
  }

  setQuality(quality: Quality): void {
    this.quality = quality;
    const fx = QUALITY[quality].fx;
    this.fx = fx;
    this.smoke.style = SMOKE_STYLES[quality];
    this.magazines.setCapacity(fx.magazines);
    this.casings.setCapacity(fx.casings);
    this.smoke.setCapacity(fx.smokePuffs);
  }

  projectile(shooter: number, weapon: WeaponId) {
    return this.tracers.projectile(shooter, weapon, this.quality);
  }

  /** Barrel smoke and an ejected casing for one shot. `dir` is the unit firing direction. */
  fire(shooter: number, weapon: WeaponId, muzzle: THREE.Vector3, dir: THREE.Vector3, vx: number, vz: number): void {
    const smoke = SMOKE_BY_WEAPON[weapon];
    if (smoke) {
      const style = this.smoke.style;
      const heat = this.heat.shot(shooter, this.now(), smoke.heatPerShot, style.heatDecayPerS);
      const puffs = puffsForHeat(heat, style);
      for (let i = 0; i < puffs; i++) this.smoke.emit(muzzle.x, muzzle.y, muzzle.z, dir.x, dir.y, dir.z, heat, smoke.sizeScale);
    }
    const casing = CASING_BY_WEAPON[weapon];
    if (!casing || this.random() >= this.fx.casingChance) return;
    const r = this.random;
    const flat = Math.hypot(dir.x, dir.z);
    const rightX = flat > 1e-3 ? -dir.z / flat : 1;
    const rightZ = flat > 1e-3 ? dir.x / flat : 0;
    const side = CASING_EJECT.sideSpeedUnitsPerS + (r() * 2 - 1) * CASING_EJECT.sideJitterUnitsPerS;
    const up = CASING_EJECT.upSpeedUnitsPerS + (r() * 2 - 1) * CASING_EJECT.upJitterUnitsPerS;
    const back = CASING_EJECT.backFromMuzzleUnits;
    this.casings.spawn(
      muzzle.x - dir.x * back,
      muzzle.y - dir.y * back,
      muzzle.z - dir.z * back,
      rightX * side - dir.x * CASING_EJECT.backSpeedUnitsPerS + vx,
      up - dir.y * CASING_EJECT.backSpeedUnitsPerS,
      rightZ * side - dir.z * CASING_EJECT.backSpeedUnitsPerS + vz,
      casing.variant,
      casing.scale,
    );
  }

  /** Grey dust where a bullet hit, blown off along the surface normal. */
  dust(at: THREE.Vector3, normal: THREE.Vector3): void {
    for (let i = 0; i < this.smoke.style.impactDustPuffs; i++) this.smoke.emitDust(at.x, at.y, at.z, normal.x, normal.y, normal.z);
  }

  /** A spent magazine leaving the gun at `at`; `vx`, `vz` carry the shooter's own movement. */
  dropMagazine(at: THREE.Vector3, vx: number, vz: number): void {
    const drift = MAGAZINE_DROP.driftUnitsPerS;
    this.magazines.spawn(at.x, at.y, at.z, vx + (this.random() * 2 - 1) * drift, -MAGAZINE_DROP.downSpeedUnitsPerS, vz + (this.random() * 2 - 1) * drift);
  }

  update(dt: number, groundAt: GroundAt): void {
    this.magazines.step(dt, groundAt);
    this.casings.step(dt, groundAt);
    this.smoke.step(dt);
    this.drawDebris(this.magazineMesh, this.magazines, false);
    this.drawDebris(this.casingMesh, this.casings, true);
    this.drawSmoke();
  }

  clear(): void {
    this.magazines.clear();
    this.casings.clear();
    this.smoke.clear();
    this.heat.clear();
    this.tracers.clear();
    this.magazineMesh.count = 0;
    this.casingMesh.count = 0;
    this.smokeGeo.setDrawRange(0, 0);
  }

  private drawDebris(mesh: THREE.InstancedMesh, pool: DebrisPool, tinted: boolean): void {
    const n = pool.count;
    if (n === 0 && mesh.count === 0) return;
    for (let i = 0; i < n; i++) {
      const b = pool.bodies[i];
      this.tmpE.set(b.rx, b.ry, b.rz);
      this.tmpQ.setFromEuler(this.tmpE);
      this.tmpS.setScalar(b.scale * debrisFade(pool.spec, b.landedFor));
      this.tmpM.compose(this.tmpP.set(b.x, b.y, b.z), this.tmpQ, this.tmpS);
      mesh.setMatrixAt(i, this.tmpM);
      if (tinted) mesh.setColorAt(i, CASING_COLORS[b.variant] ?? CASING_COLORS[0]);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (tinted && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  private drawSmoke(): void {
    const n = this.smoke.count;
    const style = this.smoke.style;
    if (n === 0 && this.smokeGeo.drawRange.count === 0) return;
    const pos = this.smokeGeo.attributes.position.array as Float32Array;
    const col = this.smokeGeo.attributes.color.array as Float32Array;
    const size = this.smokeGeo.attributes.aSize.array as Float32Array;
    for (let i = 0; i < n; i++) {
      const p = this.smoke.puffs[i];
      pos[i * 3] = p.x;
      pos[i * 3 + 1] = p.y;
      pos[i * 3 + 2] = p.z;
      col[i * 4] = col[i * 4 + 1] = col[i * 4 + 2] = style.color;
      col[i * 4 + 3] = smokeAlpha(p.age / p.life, p.alphaPeak, style.attackShare);
      size[i] = smokeSize(p);
    }
    this.smokeGeo.setDrawRange(0, n);
    this.smokeGeo.attributes.position.needsUpdate = true;
    this.smokeGeo.attributes.color.needsUpdate = true;
    this.smokeGeo.attributes.aSize.needsUpdate = true;
  }
}
