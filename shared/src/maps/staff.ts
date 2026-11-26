import type { FoodBrand } from './brands.ts';
import { outfit } from './room.ts';
import type { GalleryShopBrand } from './shopping-boutiques.ts';
import type { Outfit } from './types.ts';

/** What a store employee does at their post: works the till, cooks at a station or passes orders over the counter. */
export type StaffRole = 'cashier' | 'cook' | 'server';

/** The brands of the small atrium kiosks, each with an attendant behind its serving window. */
export type KioskBrand = 'bobis' | 'travessura' | 'mequi' | 'kfg';

/** Each uniform is named for the brand whose staff wear it, so every counter has its own look. */
export type StaffUniform = FoodBrand | GalleryShopBrand | KioskBrand;

const WHITE = 0xf5f5f5;
const BLACK = 0x1b1b1b;
const CHARCOAL = 0x222222;

/**
 * The store mannequin's outfit (`Outfit`, the same one a clothing store dresses its mannequins in) for each brand's
 * staff: shirt, trousers and the brand's accent as trim (belt, collar, cuffs). A brand without a row fails the
 * typecheck. Colours are 0xRRGGBB.
 */
export const STAFF_UNIFORMS: Readonly<Record<StaffUniform, Outfit>> = {
  kfg: outfit(0xc8102e, BLACK, WHITE),
  'burguer-rei': outfit(0x4a2a1a, CHARCOAL, 0xf28c28),
  mequi: outfit(0x8ec5e8, BLACK, 0x1d2f5a),
  bobis: outfit(0xe30613, BLACK, 0x1f5fbf),
  'mania-picanha': outfit(WHITE, CHARCOAL, 0xe0261b),
  parrilha: outfit(WHITE, CHARCOAL, 0x5a3a22),
  outbaque: outfit(WHITE, CHARCOAL, 0x7a2a1a),
  madeiro: outfit(WHITE, CHARCOAL, BLACK),
  pandorga: outfit(0xe77aa6, BLACK, WHITE),
  loccitano: outfit(0x1c3a6b, BLACK, 0xf6e9bd),
  'pe-leve': outfit(0x1f3d2b, BLACK, WHITE),
  essencia: outfit(0x7a2f5a, BLACK, WHITE),
  samsong: outfit(0x1428a0, BLACK, WHITE),
  'ray-bao': outfit(0xd71f26, BLACK, WHITE),
  'linha-fina': outfit(0x30544e, BLACK, 0xf2eee4),
  'papel-e-cor': outfit(0x7b3d54, BLACK, 0xf6efe4),
  sentauro: outfit(0xe4002b, BLACK, WHITE),
  'brinco-center': outfit(0x1f6fd1, BLACK, 0xf2c200),
  'cacau-chou': outfit(0xe9c27a, 0x5a2f1b, 0x5a2f1b),
  travessura: outfit(0x2f6f4e, BLACK, 0xf2e6c8),
};

/** Kitchen cooks wear a white chef jacket over dark trousers, trimmed in their brand's shirt colour. */
const CHEF_JACKET = WHITE;

/**
 * What a staff member wears: a cook in a chef jacket with the brand's colour as trim, everyone else the brand's
 * polo from `STAFF_UNIFORMS`. Uniforms of real chains (light blue stripes at Mequi, chocolate brown and orange at
 * Burguer Rei) follow what those counters wear; the rest use their sign colours.
 */
export function staffOutfit(uniform: StaffUniform, role: StaffRole): Outfit {
  const polo = STAFF_UNIFORMS[uniform];
  if (role !== 'cook') return polo;
  return outfit(CHEF_JACKET, CHARCOAL, polo.top === CHEF_JACKET ? polo.trim : polo.top);
}
