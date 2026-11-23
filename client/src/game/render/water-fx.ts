import * as THREE from 'three';

/** Rings of one splash, spread over time so the surface looks disturbed for a moment. */
const RINGS_PER_RIPPLE = 2;
const RING_POOL = 8;
const RING_STAGGER_SECONDS = 0.14;
const RING_LIFE_SECONDS = 0.7;
const RING_START_RADIUS_UNITS = 6;
const RING_END_RADIUS_UNITS = 46;
const RING_OPACITY = 0.55;
const DROPLETS_PER_RIPPLE = 5;
const DROPLET_POOL = 24;
const DROPLET_RADIUS_UNITS = 1.4;
const DROPLET_UP_SPEED_UNITS = 150;
const DROPLET_SIDE_SPEED_UNITS = 45;
const DROPLET_GRAVITY_UNITS = 700;
const SURFACE_LIFT_UNITS = 0.4;

interface Ring {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  delay: number;
  age: number;
  reach: number;
  active: boolean;
}

interface Droplet {
  p: THREE.Vector3;
  v: THREE.Vector3;
  surfaceY: number;
  active: boolean;
}

/**
 * Ripple where feet meet water: a few thin rings that widen and fade, and tiny droplets that fall back.
 * Only built when the quality tier asks for it (`QualityProfile.waterRipples`), so a tier without it pays nothing.
 */
export class WaterFx {
  private rings: Ring[] = [];
  private droplets: Droplet[] = [];
  private dropletMesh: THREE.InstancedMesh | null = null;
  private enabled = false;
  private ringIdx = 0;
  private dropletIdx = 0;
  private readonly tmpM = new THREE.Matrix4();

  constructor(private readonly scene: THREE.Scene) {}

  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    if (on) this.build();
    else this.dispose();
  }

  /** `strength` 1 is a splash, about 0.5 a wet footstep. */
  ripple(x: number, surfaceY: number, z: number, strength: number): void {
    if (!this.enabled) return;
    for (let i = 0; i < RINGS_PER_RIPPLE; i++) {
      const ring = this.rings[this.ringIdx++ % RING_POOL];
      ring.mesh.position.set(x, surfaceY + SURFACE_LIFT_UNITS, z);
      ring.delay = i * RING_STAGGER_SECONDS;
      ring.age = 0;
      ring.reach = RING_END_RADIUS_UNITS * strength;
      ring.active = true;
    }
    const count = Math.max(1, Math.round(DROPLETS_PER_RIPPLE * strength));
    for (let i = 0; i < count; i++) {
      const drop = this.droplets[this.dropletIdx++ % DROPLET_POOL];
      const angle = Math.random() * Math.PI * 2;
      const side = Math.random() * DROPLET_SIDE_SPEED_UNITS * strength;
      drop.p.set(x, surfaceY, z);
      drop.v.set(Math.cos(angle) * side, DROPLET_UP_SPEED_UNITS * (0.6 + Math.random() * 0.4) * strength, Math.sin(angle) * side);
      drop.surfaceY = surfaceY;
      drop.active = true;
    }
  }

  update(dt: number): void {
    if (!this.enabled) return;
    for (const ring of this.rings) {
      if (!ring.active) continue;
      if (ring.delay > 0) {
        ring.delay -= dt;
        ring.mesh.visible = false;
        continue;
      }
      ring.age += dt;
      const t = ring.age / RING_LIFE_SECONDS;
      if (t >= 1) {
        ring.active = false;
        ring.mesh.visible = false;
        continue;
      }
      const radius = RING_START_RADIUS_UNITS + (ring.reach - RING_START_RADIUS_UNITS) * t;
      ring.mesh.scale.setScalar(radius);
      ring.mesh.material.opacity = RING_OPACITY * (1 - t);
      ring.mesh.visible = true;
    }
    const mesh = this.dropletMesh;
    if (!mesh) return;
    for (let i = 0; i < DROPLET_POOL; i++) {
      const drop = this.droplets[i];
      if (drop.active) {
        drop.v.y -= DROPLET_GRAVITY_UNITS * dt;
        drop.p.addScaledVector(drop.v, dt);
        if (drop.p.y < drop.surfaceY && drop.v.y < 0) drop.active = false;
      }
      this.tmpM.makeScale(drop.active ? 1 : 0, drop.active ? 1 : 0, drop.active ? 1 : 0).setPosition(drop.p);
      mesh.setMatrixAt(i, this.tmpM);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    for (const ring of this.rings) {
      ring.active = false;
      ring.mesh.visible = false;
    }
    for (const drop of this.droplets) drop.active = false;
  }

  private build(): void {
    const geometry = new THREE.RingGeometry(0.88, 1, 28);
    geometry.rotateX(-Math.PI / 2);
    for (let i = 0; i < RING_POOL; i++) {
      const material = new THREE.MeshBasicMaterial({ color: 0xcdeeff, transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      mesh.renderOrder = 6;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.rings.push({ mesh, delay: 0, age: 0, reach: RING_END_RADIUS_UNITS, active: false });
    }
    const dropletMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(DROPLET_RADIUS_UNITS, 5, 4),
      new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.85, fog: false }),
      DROPLET_POOL,
    );
    dropletMesh.frustumCulled = false;
    dropletMesh.renderOrder = 6;
    this.scene.add(dropletMesh);
    this.dropletMesh = dropletMesh;
    this.droplets = Array.from({ length: DROPLET_POOL }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), surfaceY: 0, active: false }));
    this.tmpM.makeScale(0, 0, 0);
    for (let i = 0; i < DROPLET_POOL; i++) dropletMesh.setMatrixAt(i, this.tmpM);
  }

  private dispose(): void {
    for (const ring of this.rings) this.scene.remove(ring.mesh);
    this.rings[0]?.mesh.geometry.dispose();
    for (const ring of this.rings) ring.mesh.material.dispose();
    this.rings = [];
    if (this.dropletMesh) {
      this.scene.remove(this.dropletMesh);
      this.dropletMesh.geometry.dispose();
      this.dropletMesh.dispose();
    }
    this.dropletMesh = null;
    this.droplets = [];
    this.ringIdx = 0;
    this.dropletIdx = 0;
  }
}
