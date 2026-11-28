import { buildEscritorio } from './escritorio.ts';
import { buildForja } from './forja.ts';
import { buildShoppingNatal } from './shopping-natal.ts';
import { buildShopping } from './shopping.ts';
import type { MapDef } from './types.ts';

export * from './types.ts';
export * from './brands.ts';
export * from './stations.ts';
export * from './staff.ts';
export { MapBuilder } from './builder.ts';
export * from './water.ts';
export * from './light-band.ts';
export * from './duct.ts';
export * from './sale.ts';
export { RECYCLE_BIN_WIDTH_UNITS, RECYCLE_BIN_DEPTH_UNITS, RECYCLE_BIN_HEIGHT_UNITS, SALE_EASEL_WIDTH_UNITS, SALE_EASEL_DEPTH_UNITS } from './shopping-scenery.ts';

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
