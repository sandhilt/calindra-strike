import { isBrandMat } from './maps/brands.ts';
import type { BaseMat, Mat } from './maps/types.ts';

/** What a bullet hits, grouped by how it sounds and sparks. The client plays it and the MCP reports it to agents. */
export type Surface = 'ground' | 'concrete' | 'plaster' | 'brick' | 'tile' | 'metal' | 'container' | 'wood' | 'crate' | 'glass' | 'water' | 'screen' | 'cloth' | 'plant';

export const SURFACE_OF: Readonly<Record<BaseMat, Surface>> = {
  ground: 'ground',
  concrete: 'concrete',
  charcoal: 'concrete',
  clip: 'concrete',
  white: 'plaster',
  eitri: 'plaster',
  logo: 'plaster',
  brick: 'brick',
  tile: 'tile',
  metal: 'metal',
  lime: 'metal',
  lamp: 'plaster',
  container: 'container',
  wood: 'wood',
  desk: 'wood',
  crate: 'crate',
  glass: 'glass',
  screen: 'screen',
  carpet: 'cloth',
  sofa: 'cloth',
  plant: 'plant',
  water: 'water',
};

export function surfaceOf(mat: Mat): Surface {
  return isBrandMat(mat) ? 'plaster' : SURFACE_OF[mat];
}

/** Surfaces a round flies through while still ringing where it crosses them. */
export function isPane(surface: Surface): boolean {
  return surface === 'glass' || surface === 'water';
}
