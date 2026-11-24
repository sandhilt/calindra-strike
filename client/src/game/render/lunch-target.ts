import { LUNCH_SEAT_RADIUS_UNITS } from '@calindra-strike/shared';
import * as THREE from 'three';

const BEAM_UNITS = 170;
const GOLD = 0xffc933;
const RUSH_RED = 0xff5a36;
const BLOCK_BLUE = 0x4fc3f7;
const RING_BAND_UNITS = 10;
const LABEL_W_PX = 512;
const LABEL_H_PX = 128;
const LABEL_UNITS = { w: 200, h: 50 };
const LABEL_HEIGHT_UNITS = 150;
const PULSE_PER_S = 2.4;
const RUSH_PULSE_PER_S = 5;

export interface LunchTarget {
  x: number;
  y: number;
  z: number;
  name: string;
  rush: boolean;
  /** 'defend' when the viewer must stop the lunch: a blue double ring, so the side reads without the chip. */
  side: 'attack' | 'defend';
}

const GO_CAPTION = 'ALMOÇO AQUI';
const BLOCK_CAPTION = 'IMPEÇA O ALMOÇO';

function labelTexture(name: string, caption: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = LABEL_W_PX;
  c.height = LABEL_H_PX;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.font = 'bold 30px Arial, sans-serif';
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(0,0,0,0.85)';
  g.fillStyle = caption === BLOCK_CAPTION ? '#bfe9ff' : '#ffe9a8';
  g.strokeText(caption, LABEL_W_PX / 2, 30);
  g.fillText(caption, LABEL_W_PX / 2, 30);
  let size = 64;
  do {
    g.font = `bold ${size}px Arial Black, Arial, sans-serif`;
    size -= 2;
  } while (g.measureText(name).width > LABEL_W_PX - 40 && size > 20);
  g.lineWidth = 8;
  g.strokeText(name, LABEL_W_PX / 2, 84);
  g.fillStyle = '#ffffff';
  g.fillText(name, LABEL_W_PX / 2, 84);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Marks the restaurant of the round, so nobody has to remember its name: a tall gold beam, a pulsing ring on the floor
 * as wide as the zone where a colleague sits down, and its name floating over it, readable through walls. A rush hour
 * turns it red and makes it pulse faster, and whoever must stop the lunch sees it blue with a second outer ring and the caption "impeça". Four meshes and a sprite, so every graphics tier draws it.
 */
export class LunchTargetView {
  readonly group = new THREE.Group();
  private readonly beamMaterial = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  private readonly ringMaterial = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
  private readonly beam: THREE.Mesh;
  private readonly ring: THREE.Mesh;
  private readonly guardRing: THREE.Mesh;
  private readonly label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false }));
  private name = '';

  constructor() {
    const beamGeometry = new THREE.CylinderGeometry(14, 26, BEAM_UNITS, 14, 1, true);
    beamGeometry.translate(0, BEAM_UNITS / 2, 0);
    this.beam = new THREE.Mesh(beamGeometry, this.beamMaterial);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(LUNCH_SEAT_RADIUS_UNITS - RING_BAND_UNITS, LUNCH_SEAT_RADIUS_UNITS, 48), this.ringMaterial);
    this.ring.rotation.x = -Math.PI / 2;
    this.guardRing = new THREE.Mesh(new THREE.RingGeometry(LUNCH_SEAT_RADIUS_UNITS + RING_BAND_UNITS, LUNCH_SEAT_RADIUS_UNITS + 2 * RING_BAND_UNITS, 48), this.ringMaterial);
    this.guardRing.rotation.x = -Math.PI / 2;
    this.label.scale.set(LABEL_UNITS.w, LABEL_UNITS.h, 1);
    this.label.renderOrder = 10;
    this.group.add(this.beam, this.ring, this.guardRing, this.label);
    this.group.visible = false;
  }

  /** `target` is null outside the mode; `elapsed` is seconds, for the pulse. */
  update(target: LunchTarget | null, elapsed: number): void {
    this.group.visible = target !== null;
    if (!target) return;
    this.group.position.set(target.x, target.y + 1, target.z);
    this.label.position.set(0, LABEL_HEIGHT_UNITS, 0);
    const defend = target.side === 'defend';
    const key = `${target.name}|${target.side}`;
    if (key !== this.name) {
      this.name = key;
      const material = this.label.material;
      material.map?.dispose();
      material.map = labelTexture(target.name, defend ? BLOCK_CAPTION : GO_CAPTION);
      material.needsUpdate = true;
    }
    const color = defend ? BLOCK_BLUE : target.rush ? RUSH_RED : GOLD;
    this.guardRing.visible = defend;
    this.beamMaterial.color.setHex(color);
    this.ringMaterial.color.setHex(color);
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * Math.PI * 2 * (target.rush ? RUSH_PULSE_PER_S : PULSE_PER_S) / 2);
    this.ringMaterial.opacity = 0.35 + 0.5 * pulse;
    this.beamMaterial.opacity = 0.14 + 0.14 * pulse;
    this.ring.scale.setScalar(0.96 + 0.06 * pulse);
  }

  dispose(): void {
    this.beam.geometry.dispose();
    this.ring.geometry.dispose();
    this.guardRing.geometry.dispose();
    this.beamMaterial.dispose();
    this.ringMaterial.dispose();
    this.label.material.map?.dispose();
    this.label.material.dispose();
  }
}
