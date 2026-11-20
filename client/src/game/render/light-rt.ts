import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { leavesOcclusion } from './occlusion-filter.ts';
import { isSoftwareRenderer, type GpuFacts } from './rt-support.ts';

/** Ray-march radius of the occlusion pass in world units, about half a player's height. */
const OCCLUSION_RADIUS_UNITS = 40;
/** Rays per pixel: few on purpose, the denoise pass smooths them. */
const OCCLUSION_RAYS = 8;
/** How much of the traced occlusion shows in the image (0..1). */
const OCCLUSION_STRENGTH = 0.85;
/** Edge smoothing the composer's targets keep, since the canvas's own antialiasing no longer applies. */
const MSAA_SAMPLES = 4;

/** The occlusion pass without the scene's glows, sky, glass and effects, which it would otherwise draw as solid walls. */
class SolidOcclusionPass extends GTAOPass {
  private readonly world: THREE.Scene;
  private readonly hidden: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene, camera: THREE.Camera, width: number, height: number) {
    super(scene, camera, width, height);
    this.world = scene;
  }

  override render(...args: Parameters<GTAOPass['render']>): void {
    this.world.traverse((o) => {
      if (o.visible && leavesOcclusion(o)) {
        o.visible = false;
        this.hidden.push(o);
      }
    });
    try {
      super.render(...args);
    } finally {
      for (const o of this.hidden) o.visible = true;
      this.hidden.length = 0;
    }
  }
}

export function readGpuFacts(renderer: THREE.WebGLRenderer): GpuFacts {
  const gl = renderer.getContext();
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
  return {
    webgl2: renderer.capabilities.isWebGL2,
    software: isSoftwareRenderer(name),
    floatTargets: gl.getExtension('EXT_color_buffer_float') !== null || gl.getExtension('EXT_color_buffer_half_float') !== null,
    maxTextureSize: renderer.capabilities.maxTextureSize,
    textureUnits: renderer.capabilities.maxTextures,
  };
}

/**
 * A light, screen-space take on ray-traced lighting for the high tier: the scene is drawn through a composer and
 * a ground-truth occlusion pass marches rays through the depth buffer, so corners, desks and cover pick up contact
 * shadow the sun's shadow map cannot give. WebGL has no hardware ray tracing, so this is the closest a browser gets.
 */
export class LightRt {
  private readonly composer: EffectComposer;
  private readonly occlusion: SolidOcclusionPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, width: number, height: number) {
    this.composer = new EffectComposer(renderer);
    this.composer.renderTarget1.samples = MSAA_SAMPLES;
    this.composer.renderTarget2.samples = MSAA_SAMPLES;
    this.occlusion = new SolidOcclusionPass(scene, camera, width, height);
    this.occlusion.updateGtaoMaterial({ radius: OCCLUSION_RADIUS_UNITS, samples: OCCLUSION_RAYS });
    this.occlusion.blendIntensity = OCCLUSION_STRENGTH;
    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(this.occlusion);
    this.composer.addPass(new OutputPass());
    this.setSize(width, height);
  }

  setSize(width: number, height: number): void {
    this.composer.setPixelRatio(this.composer.renderer.getPixelRatio());
    this.composer.setSize(width, height);
  }

  render(): void {
    this.composer.render();
  }

  dispose(): void {
    this.composer.dispose();
    this.occlusion.dispose();
  }
}
