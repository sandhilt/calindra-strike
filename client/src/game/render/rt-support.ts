/** What the browser reports about the graphics card, read once when the renderer is created. */
export interface GpuFacts {
  webgl2: boolean;
  /** A software rasteriser (SwiftShader, llvmpipe, a basic render driver) stands in for a card. */
  software: boolean;
  /** Can render to half-float targets, which the lighting passes need to keep their range. */
  floatTargets: boolean;
  maxTextureSize: number;
  /** Fragment texture units available to one shader. */
  textureUnits: number;
}

/** Below these the light ray-marching pass costs more than the card can spare, so the effect stays off. */
export const RT_MIN_TEXTURE_SIZE = 8192;
export const RT_MIN_TEXTURE_UNITS = 16;

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i;

export function isSoftwareRenderer(name: string): boolean {
  return SOFTWARE_RENDERER.test(name);
}

/** Whether this card can run the light ray-marched lighting: a real GPU with WebGL 2 and room for the extra passes. */
export function lightRtSupported(f: GpuFacts): boolean {
  return f.webgl2 && !f.software && f.floatTargets && f.maxTextureSize >= RT_MIN_TEXTURE_SIZE && f.textureUnits >= RT_MIN_TEXTURE_UNITS;
}
