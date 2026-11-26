import { buildEscritorio } from './escritorio.ts';
import { buildForja } from './forja.ts';
import { buildShoppingNatal } from './shopping-natal.ts';
import { buildShopping } from './shopping.ts';
import type { MapDef } from './types.ts';

export * from './types.ts';
export * from './brands.ts';
export * from './stations.ts';
export { MapBuilder } from './builder.ts';
export * from './water.ts';
export * from './duct.ts';

let cache: MapDef[] | null = null;

/** Map rotation order. Built lazily and cached (both client and server need identical data). */
export function getMaps(): MapDef[] {
  if (!cache) cache = [buildForja(), buildEscritorio(), buildShopping(), buildShoppingNatal()];
  return cache;
}

export function getMap(index: number): MapDef {
  const maps = getMaps();
  return maps[((index % maps.length) + maps.length) % maps.length];
}
