/**
 * Parody storefronts for the Shopping Sul Rio map. Each brand is drawn by the client as a sign texture;
 * `food` brands are the food court restaurants, `shop` brands the ground floor stores and `boutique` brands
 * the smaller shops along the back wall of the Mirante, and `floor` brands the level signs at the lift.
 */
export const STORE_BRANDS = {
  kfg: { name: 'KFG', kind: 'food' },
  'burguer-rei': { name: 'Burguer Rei', kind: 'food' },
  'mania-picanha': { name: 'Mania de Picanha', kind: 'food' },
  parrilha: { name: 'Parrilha do Sul', kind: 'food' },
  mequi: { name: 'Batatas Douradas', kind: 'food' },
  outbaque: { name: 'Outbaque', kind: 'food' },
  madeiro: { name: 'Madeiro', kind: 'food' },
  bobis: { name: "Bobo's", kind: 'food' },
  zarra: { name: 'ZORRA', kind: 'shop' },
  cea: { name: 'C&Á', kind: 'shop' },
  rener: { name: 'Rener', kind: 'shop' },
  hew: { name: 'H&W', kind: 'shop' },
  'cacau-chou': { name: 'Cacau Chou', kind: 'shop' },
  amerikanas: { name: 'Amerikanas', kind: 'shop' },
  riachuela: { name: 'Riachuela', kind: 'shop' },
  'droga-raio': { name: 'Droga Raio', kind: 'shop' },
  'pague-pouco': { name: 'Farmácia Pague Pouco', kind: 'shop' },
  travessura: { name: 'Livraria da Travessura', kind: 'shop' },
  samsong: { name: 'Semsunga', kind: 'boutique' },
  'ray-bao': { name: 'Ray-Bão', kind: 'boutique' },
  pandorga: { name: 'Pandorga', kind: 'boutique' },
  sentauro: { name: 'Minotauro', kind: 'boutique' },
  'brinco-center': { name: 'Brinco Center', kind: 'boutique' },
  loccitano: { name: "L'Occitano", kind: 'boutique' },
  'pe-leve': { name: 'Calçados Pé Leve', kind: 'boutique' },
  'linha-fina': { name: 'Linha Fina', kind: 'boutique' },
  'papel-e-cor': { name: 'Papel & Cor', kind: 'boutique' },
  essencia: { name: 'Perfumaria Essência', kind: 'boutique' },
  imaginario: { name: 'Imaginário', kind: 'boutique' },
  'toc-toque': { name: 'Toc & Toque', kind: 'boutique' },
  'piso-terreo': { name: 'Térreo', kind: 'floor' },
  'piso-1': { name: '1º andar', kind: 'floor' },
  'piso-mirante': { name: 'Mirante', kind: 'floor' },
} as const satisfies Record<string, { name: string; kind: 'food' | 'shop' | 'boutique' | 'floor' }>;

export type StoreBrand = keyof typeof STORE_BRANDS;
type BrandsOfKind<K extends 'food' | 'shop' | 'boutique' | 'floor'> = { [B in StoreBrand]: (typeof STORE_BRANDS)[B]['kind'] extends K ? B : never }[StoreBrand];
export type FoodBrand = BrandsOfKind<'food'>;
export type ShopBrand = BrandsOfKind<'shop'>;
export type BoutiqueBrand = BrandsOfKind<'boutique'>;
export type FloorBrand = BrandsOfKind<'floor'>;
export type BrandMat = `brand:${StoreBrand}`;

export function brandMat(brand: StoreBrand): BrandMat {
  return `brand:${brand}`;
}

export function brandOfMat(mat: string): StoreBrand | null {
  if (!mat.startsWith('brand:')) return null;
  const id = mat.slice('brand:'.length);
  return isStoreBrand(id) ? id : null;
}

export function isBrandMat(mat: string): mat is BrandMat {
  return brandOfMat(mat) !== null;
}

function isStoreBrand(id: string): id is StoreBrand {
  return Object.hasOwn(STORE_BRANDS, id);
}

/** Signs are drawn on a 2:1 panel; the map authors them at this width over height. */
export const SIGN_ASPECT = 2;
