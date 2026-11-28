import type { MapBuilder } from './builder.ts';
import { SALE_EASELS, type SaleBrand } from './sale.ts';
import { FACADE_Z } from './shopping-levels.ts';

export const SALE_EASEL_WIDTH_UNITS = 32;
export const SALE_EASEL_DEPTH_UNITS = 24;
export const RECYCLE_BIN_WIDTH_UNITS = 60;
export const RECYCLE_BIN_DEPTH_UNITS = 34;
export const RECYCLE_BIN_HEIGHT_UNITS = 48;

export function saleEasel(b: MapBuilder, brand: SaleBrand, x: number, y: number): void {
  const percent = SALE_EASELS[brand];
  if (percent === undefined) return;
  b.prop({ kind: 'saleEasel', x, y, z: FACADE_Z + 90, yaw: Math.PI, percent });
}

export function saleRibbon(b: MapBuilder, brand: SaleBrand, x: number, y: number, z: number, width: number): void {
  b.prop({ kind: 'saleRibbon', brand, x, y, z, yaw: Math.PI, width, height: width / 8 });
}

export function recycleBin(b: MapBuilder, x: number, y: number, z: number, yaw = Math.PI): void {
  b.block(x, z, RECYCLE_BIN_WIDTH_UNITS, RECYCLE_BIN_DEPTH_UNITS, RECYCLE_BIN_HEIGHT_UNITS, 'wood', y, { visible: false });
  b.prop({ kind: 'recycleBin', x, y, z, yaw });
}
