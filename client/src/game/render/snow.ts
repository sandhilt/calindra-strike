import type { SnowTheme, Vec3 } from '@calindra-strike/shared';
import * as THREE from 'three';
import { snowPosition, wrapSnow, type Snowflake } from './snow-motion.ts';

const FIELD_UNITS = 1120;
const FLAKE_SIZE_UNITS = 3;

export class SnowView {
  readonly mesh: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly flakes: Snowflake[];
  private readonly positions: THREE.BufferAttribute;
  private readonly position = { x: 0, y: 0, z: 0 };
  private readonly volume: SnowTheme;
  private seconds = 0;

  constructor(volume: SnowTheme) {
    this.volume = volume;
    let state = 12345;
    const sample = () => {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return state / 0x100000000;
    };
    this.flakes = Array.from({ length: volume.flakes }, () => ({
      x: FIELD_UNITS * sample(),
      y: volume.min.y + (volume.max.y - volume.min.y) * sample(),
      z: FIELD_UNITS * sample(),
      pace: 0.65 + sample() * 0.7,
      phase: 2 * Math.PI * sample(),
    }));
    this.positions = new THREE.BufferAttribute(new Float32Array(volume.flakes * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', this.positions);
    geometry.setDrawRange(0, 0);
    const material = new THREE.PointsMaterial({
      color: '#f5faff', size: FLAKE_SIZE_UNITS, transparent: true, opacity: 0.72, depthWrite: false,
    });
    this.mesh = new THREE.Points(geometry, material);
    this.mesh.frustumCulled = false;
  }

  update(dt: number, camera: Vec3): void {
    this.seconds += dt;
    const { min, max } = this.volume;
    const left = camera.x - FIELD_UNITS / 2;
    const front = camera.z - FIELD_UNITS / 2;
    let count = 0;
    if (left < max.x && left + FIELD_UNITS > min.x && front < max.z && front + FIELD_UNITS > min.z) {
      for (const flake of this.flakes) {
        snowPosition(flake, this.seconds, this.position);
        const x = wrapSnow(this.position.x, left, FIELD_UNITS);
        const z = wrapSnow(this.position.z, front, FIELD_UNITS);
        if (x < min.x || x >= max.x || z < min.z || z >= max.z) continue;
        const y = wrapSnow(this.position.y, min.y, max.y - min.y);
        this.positions.setXYZ(count++, x, y, z);
      }
    }
    this.mesh.geometry.setDrawRange(0, count);
    if (count > 0) this.positions.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
