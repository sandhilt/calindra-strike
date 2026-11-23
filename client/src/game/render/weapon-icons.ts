import { WEAPONS, type WeaponId } from '@calindra-strike/shared';
import * as THREE from 'three';
import { buildWeapon } from './weapons3d.ts';

/** Kill feed icon of one weapon: a data URL and the CSS size to draw it at. */
export interface WeaponIcon {
  readonly src: string;
  readonly width: number;
  readonly height: number;
}

/** Height every icon is drawn at in the feed (CSS px), unless it would get wider than the cap below. */
export const ICON_HEIGHT_PX = 20;
export const ICON_MAX_WIDTH_PX = 84;
/** Pixels baked per CSS pixel, so the icon stays crisp on dense screens. */
const BAKE_DENSITY = 3;
/** Longest side of the model in the bake canvas before cropping, and the margin around it (px). */
const BAKE_LONG_SIDE_PX = 480;
const BAKE_MARGIN_PX = 16;
/** Pixels with less alpha than this are empty when cropping. */
const OPAQUE_ALPHA = 8;
/** Grey of a part: dark materials stay this light so the silhouette reads on any map, brighter ones go to white. */
const TONE_FLOOR = 0.74;

export interface PixelBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Tight bounds of the pixels that are not transparent in an RGBA buffer, or null when it is empty. */
export function cropBounds(rgba: Uint8ClampedArray, width: number, height: number): PixelBounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] < OPAQUE_ALPHA) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** CSS size of an icon: the common height, or narrower when a long gun would pass the width cap. */
export function iconDisplaySize(aspect: number): { width: number; height: number } {
  const width = Math.min(ICON_HEIGHT_PX * aspect, ICON_MAX_WIDTH_PX);
  return { width: Math.round(width), height: Math.round(width / aspect) };
}

/** Box of the parts that are drawn (a hidden shell or casing must not widen the frame). */
function visibleBounds(root: THREE.Object3D): THREE.Box3 {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const part = new THREE.Box3();
  root.traverseVisible((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    part.setFromObject(o);
    box.union(part);
  });
  return box;
}

/** Flat light stand-in for a part's material: its own brightness, lifted so even the dark metal reads as a pale shape. */
function toneOf(original: THREE.Material): THREE.MeshBasicMaterial {
  const color = original instanceof THREE.MeshStandardMaterial ? original.color : new THREE.Color('#ffffff');
  const lum = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
  const tone = TONE_FLOOR + (1 - TONE_FLOOR) * Math.sqrt(lum);
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(tone, tone, tone) });
}

/** Side view with the barrel toward the right (the weapon models point to -Z, so the camera looks along -X). */
function bakeOne(renderer: THREE.WebGLRenderer, id: WeaponId, context: CanvasRenderingContext2D): WeaponIcon | null {
  const model = buildWeapon(id);
  const tones = new Map<THREE.Material, THREE.MeshBasicMaterial>();
  model.group.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const original: THREE.Material = Array.isArray(o.material) ? o.material[0] : o.material;
    let tone = tones.get(original);
    if (!tone) {
      tone = toneOf(original);
      tones.set(original, tone);
    }
    o.material = tone;
  });
  const box = visibleBounds(model.group);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const long = Math.max(size.y, size.z);
  const scene = new THREE.Scene();
  scene.add(model.group);
  const side = renderer.domElement.width;
  const half = (side / 2 / (BAKE_LONG_SIDE_PX - 2 * BAKE_MARGIN_PX)) * long;
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 1000);
  camera.position.set(centre.x + 100, centre.y, centre.z);
  // A tall weapon (the hammer) lies on its side, head to the right, like a knife in a Counter-Strike feed.
  camera.up.set(0, size.y > size.z ? 0 : 1, size.y > size.z ? 1 : 0);
  camera.lookAt(centre);
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);

  context.clearRect(0, 0, side, side);
  context.drawImage(renderer.domElement, 0, 0);
  const pixels = context.getImageData(0, 0, side, side);
  const crop = cropBounds(pixels.data, side, side);
  for (const tone of tones.values()) tone.dispose();
  if (!crop) return null;

  const display = iconDisplaySize(crop.width / crop.height);
  const out = document.createElement('canvas');
  out.width = display.width * BAKE_DENSITY;
  out.height = display.height * BAKE_DENSITY;
  const outContext = out.getContext('2d');
  if (!outContext) return null;
  outContext.imageSmoothingQuality = 'high';
  outContext.drawImage(context.canvas, crop.x, crop.y, crop.width, crop.height, 0, 0, out.width, out.height);
  return { src: out.toDataURL('image/png'), width: display.width, height: display.height };
}

/** Renders every weapon's own model into an icon, or null when the browser cannot (no WebGL, no 2D canvas). */
export function bakeWeaponIcons(): ReadonlyMap<WeaponId, WeaponIcon> | null {
  let renderer: THREE.WebGLRenderer | null = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = BAKE_LONG_SIDE_PX;
    canvas.height = BAKE_LONG_SIDE_PX;
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(BAKE_LONG_SIDE_PX, BAKE_LONG_SIDE_PX, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    const scratch = document.createElement('canvas');
    scratch.width = BAKE_LONG_SIDE_PX;
    scratch.height = BAKE_LONG_SIDE_PX;
    const context = scratch.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    const icons = new Map<WeaponId, WeaponIcon>();
    for (const def of WEAPONS) {
      const icon = bakeOne(renderer, def.id, context);
      if (icon) icons.set(def.id, icon);
    }
    return icons;
  } catch {
    return null;
  } finally {
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
}

let baked: ReadonlyMap<WeaponId, WeaponIcon> | null | undefined;

/** The icons, baked on first use and kept for the page's life. Null where baking failed, so the feed falls back to the text tag. */
export function weaponIcon(id: WeaponId): WeaponIcon | null {
  if (baked === undefined) baked = bakeWeaponIcons();
  return baked?.get(id) ?? null;
}
