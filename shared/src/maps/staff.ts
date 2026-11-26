import type { BoutiqueBrand, FoodBrand, ShopBrand } from './brands.ts';
import { outfit } from './room.ts';
import type { Outfit } from './types.ts';

/**
 * What a store employee does at their post: works the till, cooks at a station, passes orders over the counter,
 * sells, restocks, dispenses at a pharmacy or cleans for the mall.
 */
export type StaffRole = 'cashier' | 'cook' | 'server' | 'seller' | 'stocker' | 'pharmacist' | 'cleaner';

/** Each uniform is named for the brand whose staff wear it, so every counter has its own look. */
export type StaffUniform = FoodBrand | BoutiqueBrand | ShopBrand;

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
  // Ground floor stores: Zara's floor staff dress all in black, the rest wear a polo in their sign colour.
  zarra: outfit(BLACK, BLACK, 0x3a3a3a),
  cea: outfit(0x0050a0, BLACK, WHITE),
  rener: outfit(0x1b1b1b, 0x2a2a2a, 0xc8102e),
  hew: outfit(0xe50010, BLACK, WHITE),
  amerikanas: outfit(0xe60014, BLACK, WHITE),
  riachuela: outfit(0x1c2a5a, BLACK, 0xe9dcc0),
  travessura: outfit(0x2e5a3f, CHARCOAL, 0xe9dcc0),
  'droga-raio': outfit(0xd8202a, CHARCOAL, WHITE),
  'pague-pouco': outfit(0x1f4fa8, CHARCOAL, 0xf2c200),
  imaginario: outfit(0x0f6e78, BLACK, 0xffc93c),
  'toc-toque': outfit(0x3a3a3a, 0xcfb894, 0xd9773a),
};

/** The colour that says which brand a uniform is: the polo, or its trim when the polo is white. */
function brandColour(polo: Outfit): number {
  return polo.top === WHITE ? polo.trim : polo.top;
}

const LAB_COAT = 0xfafafa;
const WORK_DENIM = 0x2a3f66;
/** The mall's own cleaning crew, the same in every store: a grey-blue tunic, navy trousers and safety yellow trim. */
export const MALL_JANITOR: Outfit = outfit(0x5d7488, 0x1f2a44, 0xf2c200);

/**
 * How each role wears its brand; a new role needs a row. Front-of-house roles wear the brand polo, cooks a white
 * chef jacket and pharmacists a white lab coat trimmed in the brand colour, stockers the polo over work denim, and
 * cleaners the mall's uniform whichever store they clean. Uniforms of real chains (light blue at Mequi, chocolate
 * brown and orange at Burguer Rei, all black at Zarra) follow what those stores wear; the rest use sign colours.
 */
const ROLE_DRESS: Readonly<Record<StaffRole, (polo: Outfit) => Outfit>> = {
  cashier: (polo) => polo,
  server: (polo) => polo,
  seller: (polo) => polo,
  cook: (polo) => outfit(WHITE, CHARCOAL, brandColour(polo)),
  pharmacist: (polo) => outfit(LAB_COAT, CHARCOAL, brandColour(polo)),
  stocker: (polo) => outfit(polo.top, WORK_DENIM, polo.trim),
  cleaner: () => MALL_JANITOR,
};

/** What a staff member wears: the brand's polo from `STAFF_UNIFORMS`, dressed for the role by `ROLE_DRESS`. */
export function staffOutfit(uniform: StaffUniform, role: StaffRole): Outfit {
  return ROLE_DRESS[role](STAFF_UNIFORMS[uniform]);
}
