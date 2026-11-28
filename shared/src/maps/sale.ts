import { SALE_RIBBON_CHANCE, SALE_SLOT_MS } from '../constants.ts';
import { cycleRoll } from '../day-cycle.ts';
import { STORE_BRANDS, type BoutiqueBrand, type ShopBrand, type StoreBrand } from './brands.ts';

export type SaleBrand = ShopBrand | BoutiqueBrand;

export const SALE_EASELS: Readonly<Partial<Record<SaleBrand, number>>> = {
  zarra: 30,
  'cacau-chou': 30,
  brenner: 50,
  riachuela: 50,
  pandorga: 20,
  loccitano: 20,
  imaginario: 40,
  'toc-toque': 40,
  samsong: 70,
  'brinco-center': 70,
};

const brandSeeds = new Map(Object.keys(STORE_BRANDS).map((brand, index) => [brand, Math.imul(index + 1, 0x9e3779b1)]));

export function saleOn(brand: StoreBrand, serverMs: number): boolean {
  const { kind } = STORE_BRANDS[brand];
  if (kind !== 'shop' && kind !== 'boutique') return false;
  return cycleRoll(Math.floor(serverMs / SALE_SLOT_MS) ^ (brandSeeds.get(brand) ?? 0)) < SALE_RIBBON_CHANCE;
}
