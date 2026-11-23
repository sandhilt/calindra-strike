/** What the browser reports about the graphics card, read once when the renderer is created. */
export interface GpuFacts {
  webgl2: boolean;
  /** A software rasteriser (SwiftShader, llvmpipe, a basic render driver) stands in for a card. */
  software: boolean;
  /** An integrated GPU (Intel, or an AMD APU) that shares memory with the processor; a laptop's discrete card is the other one. */
  integrated: boolean;
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

const INTEGRATED_RENDERER = /intel(?!.*arc\(tm\) [ab]\d{3})|radeon(?:\(tm\))? (?:graphics|\d{3}m)\b/i;

/** Intel graphics (but not a discrete Arc A or B card) and AMD's `Radeon Graphics` or `780M` style APUs. */
export function isIntegratedRenderer(name: string): boolean {
  return INTEGRATED_RENDERER.test(name);
}

/** What the player can do when the browser runs the game on the integrated card of a laptop that also has a discrete one. */
export const INTEGRATED_GPU_TIP = 'seu navegador está usando a placa de vídeo integrada: no Windows, em Configurações > Sistema > Tela > Gráficos, escolha "Alto desempenho" para o navegador';

/** Whether this card can run the light ray-marched lighting: a real GPU with WebGL 2 and room for the extra passes. */
export function lightRtSupported(f: GpuFacts): boolean {
  return f.webgl2 && !f.software && f.floatTargets && f.maxTextureSize >= RT_MIN_TEXTURE_SIZE && f.textureUnits >= RT_MIN_TEXTURE_UNITS;
}
