interface MaterialLike {
  transparent?: boolean;
  depthWrite?: boolean;
}

/** The parts of a three.js object the filter reads, so it can be tested without a renderer. */
export interface OcclusionCandidate {
  visible: boolean;
  isSprite?: boolean;
  isMesh?: boolean;
  material?: MaterialLike | readonly MaterialLike[];
}

/**
 * Whether an object stays out of the occlusion pass. That pass redraws the scene with one opaque normal material, so a
 * sprite glow, the sky dome, glass, decals and tracers would all turn into solid blockers and darken what is behind them.
 */
export function leavesOcclusion(o: OcclusionCandidate): boolean {
  if (o.isSprite) return true;
  if (!o.isMesh || !o.material) return false;
  const materials = Array.isArray(o.material) ? o.material : [o.material];
  return materials.some((m) => m.transparent === true || m.depthWrite === false);
}
