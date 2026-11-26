import type { FoodBrand } from './brands.ts';
import type { GalleryShopBrand } from './shopping-boutiques.ts';

/** What a store employee does at their post: works the till, cooks at a station or passes orders over the counter. */
export type StaffRole = 'cashier' | 'cook' | 'server';

/** Each uniform is named for the brand whose staff wear it, so every counter has its own look. */
export type StaffUniform = FoodBrand | GalleryShopBrand;

export type StaffHat = 'toque' | 'cap' | 'none';

export interface StaffUniformSpec {
  readonly shirt: number;
  readonly trousers: number;
  /** An apron over the front of the trousers, or null for none. */
  readonly apron: number | null;
  readonly hat: StaffHat;
  readonly hatTint: number;
}

const WHITE = 0xf5f5f5;
const BLACK = 0x1b1b1b;

/** One row per brand: a brand without a uniform fails the typecheck. Colours are 0xRRGGBB. */
export const STAFF_UNIFORMS: Readonly<Record<StaffUniform, StaffUniformSpec>> = {
  kfg: { shirt: 0xc8102e, trousers: BLACK, apron: WHITE, hat: 'cap', hatTint: 0xc8102e },
  'burguer-rei': { shirt: 0xe8a317, trousers: 0x222222, apron: 0x222222, hat: 'cap', hatTint: 0xe8a317 },
  mequi: { shirt: 0x2c7a3e, trousers: BLACK, apron: WHITE, hat: 'cap', hatTint: 0x2c7a3e },
  bobis: { shirt: 0xe30613, trousers: BLACK, apron: WHITE, hat: 'cap', hatTint: 0x1f5fbf },
  'mania-picanha': { shirt: WHITE, trousers: 0x222222, apron: 0xe0261b, hat: 'toque', hatTint: WHITE },
  parrilha: { shirt: WHITE, trousers: 0x222222, apron: 0x5a3a22, hat: 'toque', hatTint: WHITE },
  outbaque: { shirt: WHITE, trousers: 0x222222, apron: 0x7a2a1a, hat: 'toque', hatTint: WHITE },
  madeiro: { shirt: WHITE, trousers: 0x222222, apron: BLACK, hat: 'toque', hatTint: WHITE },
  pandorga: { shirt: 0xe77aa6, trousers: BLACK, apron: null, hat: 'none', hatTint: 0 },
  loccitano: { shirt: 0x1c3a6b, trousers: BLACK, apron: null, hat: 'none', hatTint: 0 },
  'pe-leve': { shirt: 0x1f3d2b, trousers: BLACK, apron: null, hat: 'none', hatTint: 0 },
  essencia: { shirt: 0x7a2f5a, trousers: BLACK, apron: null, hat: 'none', hatTint: 0 },
  samsong: { shirt: 0x1428a0, trousers: BLACK, apron: null, hat: 'none', hatTint: 0 },
  'ray-bao': { shirt: 0xd71f26, trousers: BLACK, apron: null, hat: 'none', hatTint: 0 },
  'linha-fina': { shirt: 0x30544e, trousers: BLACK, apron: null, hat: 'none', hatTint: 0 },
  'papel-e-cor': { shirt: 0x7b3d54, trousers: BLACK, apron: null, hat: 'none', hatTint: 0 },
  sentauro: { shirt: 0xe4002b, trousers: BLACK, apron: null, hat: 'none', hatTint: 0 },
  'brinco-center': { shirt: 0x1f6fd1, trousers: BLACK, apron: null, hat: 'none', hatTint: 0 },
  'cacau-chou': { shirt: 0xe9c27a, trousers: 0x5a2f1b, apron: 0x5a2f1b, hat: 'none', hatTint: 0 },
};
