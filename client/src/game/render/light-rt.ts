import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { leavesOcclusion } from './occlusion-filter.ts';
import type { RtProfile } from './rt-levels.ts';
import { isSoftwareRenderer, type GpuFacts } from './rt-support.ts';

/** The occlusion pass without the scene's glows, sky, glass and effects, which it would otherwise draw as solid walls. */
class SolidOcclusionPass extends GTAOPass {
  private readonly world: THREE.Scene;
  private readonly hidden: THREE.Object3D[] = [];
  private readonly resolution: number;

  constructor(scene: THREE.Scene, camera: THREE.Camera, width: number, height: number, resolution: number) {
    super(scene, camera, width, height);
    this.world = scene;
    this.resolution = resolution;
  }

  /** The composer hands every pass the canvas size; the occlusion targets, and the scene redraw into them, take a share of it. */
  override setSize(width: number, height: number): void {
    super.setSize(Math.max(1, Math.round(width * this.resolution)), Math.max(1, Math.round(height * this.resolution)));
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
  private readonly output = new OutputPass();

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, width: number, height: number, profile: RtProfile) {
    this.composer = new EffectComposer(renderer);
    this.composer.renderTarget1.samples = profile.msaa;
    this.composer.renderTarget2.samples = profile.msaa;
    this.occlusion = new SolidOcclusionPass(scene, camera, width, height, profile.resolution);
    this.occlusion.updateGtaoMaterial({ radius: profile.radiusUnits, samples: profile.rays });
    this.occlusion.updatePdMaterial({ samples: profile.denoiseSamples });
    this.occlusion.blendIntensity = profile.strength;
    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(this.occlusion);
    this.composer.addPass(this.output);
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
    this.output.dispose();
  }
}
