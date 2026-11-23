import type { SupplyPoint } from '@calindra-strike/shared';
import * as THREE from 'three';

const CRATE_UNITS = 30;
const HOVER_UNITS = 38;
const BOB_UNITS = 4;
const BEAM_UNITS = 140;
const FULL_COLOR = 0x6dff7a;
const EMPTY_COLOR = 0x4a4f57;

function crateTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#f4f6f8';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#e0261b';
  g.fillRect(48, 20, 32, 88);
  g.fillRect(20, 48, 88, 32);
  g.strokeStyle = '#9aa3ad';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 122, 122);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Stand {
  readonly crate: THREE.Mesh;
  readonly ring: THREE.MeshBasicMaterial;
  readonly beam: THREE.Mesh;
}

/**
 * The supply stands of a map: a first-aid crate hovering over each stand while it is full, with a short green beam
 * and a lit ring on the floor, and a dull crate resting on the dais while it refills. A few meshes per stand, so every
 * graphics tier draws them.
 */
export class SuppliesView {
  readonly group = new THREE.Group();
  private readonly stands: Stand[];
  private readonly texture = crateTexture();
  private readonly crateMaterial = new THREE.MeshStandardMaterial({ map: this.texture, emissiveMap: this.texture, emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.6 });
  private readonly beamMaterial = new THREE.MeshBasicMaterial({ color: FULL_COLOR, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

  constructor(private readonly points: readonly SupplyPoint[]) {
    this.stands = points.map((p) => {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(CRATE_UNITS, CRATE_UNITS, CRATE_UNITS), this.crateMaterial);
      crate.castShadow = true;
      const ringMaterial = new THREE.MeshBasicMaterial({ color: FULL_COLOR, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(new THREE.RingGeometry(34, 42, 32), ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(p.x, p.y + 11.5, p.z);
      const beamGeometry = new THREE.CylinderGeometry(12, 20, BEAM_UNITS, 12, 1, true);
      beamGeometry.translate(0, BEAM_UNITS / 2, 0);
      const beam = new THREE.Mesh(beamGeometry, this.beamMaterial);
      beam.position.set(p.x, p.y + 11, p.z);
      this.group.add(crate, ring, beam);
      return { crate, ring: ringMaterial, beam };
    });
  }

  /** `full[i]` says whether the stand `i` can be taken now. */
  update(full: readonly boolean[], elapsed: number): void {
    this.points.forEach((p, i) => {
      const stand = this.stands[i];
      const ready = full[i] ?? true;
      stand.beam.visible = ready;
      stand.ring.color.setHex(ready ? FULL_COLOR : EMPTY_COLOR);
      stand.ring.opacity = ready ? 0.7 : 0.35;
      stand.crate.rotation.y = ready ? elapsed * 1.2 : 0;
      const hover = ready ? HOVER_UNITS + Math.sin(elapsed * 2.2) * BOB_UNITS : CRATE_UNITS / 2 + 11;
      stand.crate.position.set(p.x, p.y + hover, p.z);
      stand.crate.scale.setScalar(ready ? 1 : 0.8);
    });
  }

  dispose(): void {
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
    });
    this.crateMaterial.dispose();
    this.beamMaterial.dispose();
    this.texture.dispose();
    for (const s of this.stands) s.ring.dispose();
  }
}
