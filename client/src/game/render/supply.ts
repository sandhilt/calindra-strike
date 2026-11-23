import type { SupplyPoint } from '@calindra-strike/shared';
import * as THREE from 'three';

const CRATE_UNITS = 30;
const HOVER_UNITS = 38;
const BOB_UNITS = 4;
const BEAM_UNITS = 140;
const FULL_COLOR = 0x6dff7a;
const EMPTY_COLOR = 0x4a4f57;
const RIBBON_COLOR = 0xffc933;
const RIBBON_UNITS = 7;

function crateTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#d7255d';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(255,255,255,0.28)';
  for (let y = 12; y < 128; y += 24) for (let x = (y / 24) % 2 ? 12 : 0; x < 128; x += 24) g.fillRect(x + 6, y, 6, 6);
  g.fillStyle = '#ffc933';
  g.fillRect(54, 0, 20, 128);
  g.fillRect(0, 54, 128, 20);
  g.fillStyle = '#e0a800';
  g.fillRect(54, 54, 20, 20);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Stand {
  readonly crate: THREE.Group;
  readonly ring: THREE.MeshBasicMaterial;
  readonly beam: THREE.Mesh;
}

/**
 * The supply stands of a map: a gift box hovering over each stand while it is full, with a short green beam and a lit
 * ring on the floor. The box is gone once taken and the dull ring marks the refill. A few meshes per stand, so every
 * graphics tier draws them.
 */
export class SuppliesView {
  readonly group = new THREE.Group();
  private readonly stands: Stand[];
  private readonly texture = crateTexture();
  private readonly crateMaterial = new THREE.MeshStandardMaterial({ map: this.texture, emissiveMap: this.texture, emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 0.6 });
  private readonly ribbonMaterial = new THREE.MeshStandardMaterial({ color: RIBBON_COLOR, emissive: RIBBON_COLOR, emissiveIntensity: 0.3, roughness: 0.4 });
  private readonly beamMaterial = new THREE.MeshBasicMaterial({ color: FULL_COLOR, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

  constructor(private readonly points: readonly SupplyPoint[]) {
    this.stands = points.map((p) => {
      const crate = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(CRATE_UNITS, CRATE_UNITS, CRATE_UNITS), this.crateMaterial);
      body.castShadow = true;
      crate.add(body, ...this.bow());
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

  /** Two loops and a knot on the lid, each a ribbon-coloured piece. */
  private bow(): THREE.Mesh[] {
    const top = CRATE_UNITS / 2;
    const loops = [-1, 1].map((side) => {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(6, RIBBON_UNITS / 3, 6, 14), this.ribbonMaterial);
      loop.position.set(side * 6, top + 5, 0);
      loop.rotation.set(0, 0, side * 0.6);
      return loop;
    });
    const knot = new THREE.Mesh(new THREE.BoxGeometry(RIBBON_UNITS, RIBBON_UNITS, RIBBON_UNITS), this.ribbonMaterial);
    knot.position.y = top + 3;
    return [...loops, knot];
  }

  /** `full[i]` says whether the stand `i` can be taken now. */
  update(full: readonly boolean[], elapsed: number): void {
    this.points.forEach((p, i) => {
      const stand = this.stands[i];
      const ready = full[i] ?? true;
      stand.beam.visible = ready;
      stand.ring.color.setHex(ready ? FULL_COLOR : EMPTY_COLOR);
      stand.ring.opacity = ready ? 0.7 : 0.35;
      stand.crate.visible = ready;
      stand.crate.rotation.y = elapsed * 1.2;
      stand.crate.position.set(p.x, p.y + HOVER_UNITS + Math.sin(elapsed * 2.2) * BOB_UNITS, p.z);
    });
  }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
    });
    this.crateMaterial.dispose();
    this.ribbonMaterial.dispose();
    this.beamMaterial.dispose();
    this.texture.dispose();
    for (const s of this.stands) s.ring.dispose();
  }
}
