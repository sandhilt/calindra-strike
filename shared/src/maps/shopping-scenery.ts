import type { MapBuilder } from './builder.ts';
import { SALE_EASELS, type SaleBrand } from './sale.ts';
import { FACADE_Z } from './shopping-levels.ts';

export const SALE_EASEL_WIDTH_UNITS = 32;
export const SALE_EASEL_DEPTH_UNITS = 24;
export const RECYCLE_BIN_WIDTH_UNITS = 60;
export const RECYCLE_BIN_DEPTH_UNITS = 34;
export const RECYCLE_BIN_HEIGHT_UNITS = 48;
export const TRAY_COUNTER_HEIGHT_UNITS = 40;

const TRAY_COUNTER_WIDTH_UNITS = 64;
const TRAY_TINTS = [0xffe4b5, 0xff963f, 0xb8372a];

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

export function trayStation(b: MapBuilder, x: number, y: number, z: number, counterSide: -1 | 1): void {
  recycleBin(b, x, y, z);
  const counterX = x + counterSide * (RECYCLE_BIN_WIDTH_UNITS + TRAY_COUNTER_WIDTH_UNITS) / 2;
  b.block(counterX, z, TRAY_COUNTER_WIDTH_UNITS, RECYCLE_BIN_DEPTH_UNITS, TRAY_COUNTER_HEIGHT_UNITS, 'wood', y);

  for (const [i, tint] of TRAY_TINTS.entries()) {
    const trayX = counterX + (i - 1) * 20;
    const top = y + TRAY_COUNTER_HEIGHT_UNITS;
    for (let layer = 0; layer < 3; layer++) {
      const base = top + layer * 2;
      const inset = layer % 2;
      b.deco(trayX - 9 + inset, base, z - 13, trayX + 9 - inset, base + 2, z + 13, 'white', tint);
    }
    for (const side of [-1, 1]) {
      const edge = trayX + side * 8;
      b.deco(edge - 1, top + 6, z - 13, edge + 1, top + 7, z + 13, 'white', tint);
    }
  }
}
