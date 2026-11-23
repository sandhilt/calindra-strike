import type { Vec3 } from '../math.ts';
import type { BrandMat } from './brands.ts';

export type BaseMat =
  | 'ground'
  | 'concrete'
  | 'charcoal'
  | 'metal'
  | 'crate'
  | 'container'
  | 'lime'
  | 'glass'
  | 'wood'
  | 'clip'
  | 'carpet'
  | 'desk'
  | 'white'
  | 'brick'
  | 'tile'
  | 'plant'
  | 'screen'
  | 'sofa'
  | 'eitri' // official Eitri icon banner
  | 'logo' // Calindra Strike logo banner
  | 'water';

/** A brand mat is a store sign, drawn whole on each face like the banners. */
export type Mat = BaseMat | BrandMat;

export type MapFeature =
  | { kind: 'landmark'; name: string; x: number; z: number }
  | { kind: 'door' | 'window'; x: number; z: number; width: number }
  | { kind: 'stairs'; x: number; z: number; width: number; height: number };

export interface Box {
  stair?: true;
  /** Multiplies the material's colours (0xRRGGBB), so one material paints many colours at no extra draw call. */
  tint?: number;
  min: Vec3;
  max: Vec3;
  mat: Mat;
  solid: boolean; // blocks movement
  shootThrough: boolean; // bullets pass (glass, foliage)
  visible: boolean;
}

/** Colours of a mannequin's clothes (0xRRGGBB). */
export interface Outfit {
  top: number;
  legs: number;
  /** Belt, collar and cuffs. */
  trim: number;
  /** A dress hangs a skirt of the `legs` colour from the waist instead of showing trousers. */
  dress: boolean;
}

export type EscalatorTravel = 'up' | 'down';

/**
 * Scenery the client draws from a model and may animate. Never solid: whatever must block movement or
 * bullets is a Box. Angles follow three.js `rotation.y`, and a prop faces local -z at yaw 0.
 * The client keeps one builder per kind (`PROP_BUILDERS`), so a new kind fails the typecheck until it is drawn.
 */
export type MapProp =
  | { kind: 'ceilingFan'; x: number; y: number; z: number; radius: number }
  | { kind: 'mannequin'; x: number; y: number; z: number; yaw: number; outfit: Outfit }
  | { kind: 'clothesRack'; x: number; y: number; z: number; yaw: number; length: number; palette: readonly number[] }
  /** A moving staircase over the foot-to-top `stairs` boxes: foot centre and the unit direction that goes uphill. */
  | { kind: 'escalator'; travel: EscalatorTravel; x: number; z: number; dirX: number; dirZ: number; width: number; length: number; height: number }
  /** Water jet and falling drops standing on a basin whose surface is at `y`. */
  | { kind: 'fountain'; x: number; y: number; z: number; radius: number }
  /** A wall grille with a fan behind it, a hum nearby and a faint wisp of vapour. It faces local -z. */
  | { kind: 'vent'; x: number; y: number; z: number; yaw: number; width: number; height: number };

export type PropKind = MapProp['kind'];

export interface MapTheme {
  skyTop: string;
  skyHorizon: string;
  skyBottom: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  sun: string;
  sunIntensity: number;
  sunDir: Vec3; // direction the light travels FROM (normalized-ish)
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  /** Replaces what the day cycle would derive from this day theme for the afternoon or the night. */
  phases?: Partial<Record<'afternoon' | 'night', Partial<Omit<MapTheme, 'phases'>>>>;
}

export interface MapLight {
  x: number;
  y: number;
  z: number;
  color: string;
}

export interface MapDef {
  id: string;
  name: string;
  subtitle: string;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  dropArea: { minX: number; maxX: number; minZ: number; maxZ: number };
  flagBases: readonly [{ x: number; z: number }, { x: number; z: number }];
  dropHeight: number;
  airdropPoints: { x: number; z: number }[];
  /** Food court counters where Hora de almoçar seats colleagues; empty on maps that cannot play it. */
  restaurants: { x: number; y: number; z: number }[];
  boxes: Box[];
  features: MapFeature[];
  lights: MapLight[];
  props: MapProp[];
  theme: MapTheme;
}
