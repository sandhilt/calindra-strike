import type { CarrapetaSnapshot } from '@calindra-strike/shared';
import * as THREE from 'three';
import { CARRAPETA_GOLD } from '../carrapeta.ts';

const BEAM_HEIGHT_UNITS = 140;
const AURA_RADIUS_UNITS = 30;

/** One dropped beam and one aura shared by all possible holders. */
export class CarrapetaView {
  private readonly beam = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 21, BEAM_HEIGHT_UNITS, 12, 1, true).translate(0, BEAM_HEIGHT_UNITS / 2, 0),
    new THREE.MeshBasicMaterial({ color: CARRAPETA_GOLD, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  private readonly aura = new THREE.Mesh(
    new THREE.RingGeometry(AURA_RADIUS_UNITS - 7, AURA_RADIUS_UNITS, 24).rotateX(-Math.PI / 2).translate(0, 2, 0),
    new THREE.MeshBasicMaterial({ color: CARRAPETA_GOLD, transparent: true, depthWrite: false }),
  );

  constructor(scene: THREE.Scene) {
    this.beam.visible = false;
    scene.add(this.beam);
  }

  update(state: CarrapetaSnapshot | null, holder: THREE.Object3D | undefined, elapsed: number): void {
    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 5);
    if (state?.kind === 'dropped') {
      this.beam.position.set(state.x, state.y, state.z);
      this.beam.material.opacity = 0.35 + 0.25 * pulse;
      this.beam.visible = true;
    } else this.beam.visible = false;

    if (holder && state?.kind === 'held') {
      if (this.aura.parent !== holder) holder.add(this.aura);
      this.aura.material.opacity = 0.6 + 0.4 * pulse;
      this.aura.scale.set(1 + 0.2 * pulse, 1, 1 + 0.2 * pulse);
    } else this.aura.removeFromParent();
  }

  dispose(): void {
    for (const mesh of [this.beam, this.aura]) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}
