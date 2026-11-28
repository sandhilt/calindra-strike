import type { LightBand } from '@calindra-strike/shared';
import * as THREE from 'three';

/**
 * Cuts a halo sprite at the floor and ceiling of its own level. A sprite faces the camera, so its square reaches
 * through the slab next to the lamp and would glow on the level above or below.
 */
/** Stands in for an open side, since a shader uniform should not carry infinity. */
const UNBOUNDED = 1e6;

export function clipHaloToBand(material: THREE.SpriteMaterial, band: LightBand): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uHaloBand = { value: new THREE.Vector2(Math.max(band.floor, -UNBOUNDED), Math.min(band.ceiling, UNBOUNDED)) };
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying float vHaloY;\nvoid main() {')
      .replace('gl_Position = projectionMatrix * mvPosition;', 'vHaloY = ( inverse( viewMatrix ) * mvPosition ).y;\n\tgl_Position = projectionMatrix * mvPosition;');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec2 uHaloBand;\nvarying float vHaloY;\nvoid main() {\n\tif ( vHaloY < uHaloBand.x || vHaloY > uHaloBand.y ) discard;');
  };
}
