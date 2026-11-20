import { WEAPON, type WeaponId } from '@calindra-strike/shared';
import * as THREE from 'three';
import { isTracer, linkPlacement, reachedPath } from './belt-anim.ts';
import type { ReloadPose } from './reload-anim.ts';

const mats = {
  gun: new THREE.MeshStandardMaterial({ color: '#2f3338', roughness: 0.45, metalness: 0.45 }),
  gun2: new THREE.MeshStandardMaterial({ color: '#474d55', roughness: 0.55, metalness: 0.3 }),
  poly: new THREE.MeshStandardMaterial({ color: '#242427', roughness: 0.8 }),
  steel: new THREE.MeshStandardMaterial({ color: '#a2abb3', roughness: 0.3, metalness: 0.6 }),
  wood: new THREE.MeshStandardMaterial({ color: '#7b4a22', roughness: 0.65 }),
  lime: new THREE.MeshStandardMaterial({ color: '#a5fa00', emissive: '#a5fa00', emissiveIntensity: 1.1, roughness: 0.4 }),
  limeDim: new THREE.MeshStandardMaterial({ color: '#7fbf12', roughness: 0.5, metalness: 0.2 }),
  // Coated scope glass: a dark blue-green see-through lens with a faint lime coating glint.
  lens: new THREE.MeshPhysicalMaterial({ color: '#1d3a46', emissive: '#a5fa00', emissiveIntensity: 0.12, roughness: 0.02, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0, transparent: true, opacity: 0.7 }),
  hull: new THREE.MeshStandardMaterial({ color: '#b3261e', roughness: 0.55 }),
  brass: new THREE.MeshStandardMaterial({ color: '#c9a227', roughness: 0.3, metalness: 0.7 }),
};

function curvedMagazineGeometry(): THREE.ExtrudeGeometry {
  const profile = new THREE.Shape();
  profile.moveTo(-1.8, 0);
  profile.lineTo(1.8, 0);
  profile.quadraticCurveTo(1.7, -4.4, 3.5, -7.8);
  profile.lineTo(0.2, -8.9);
  profile.quadraticCurveTo(-1.9, -4.4, -1.8, 0);
  return new THREE.ExtrudeGeometry(profile, { depth: 2.4, bevelEnabled: false, curveSegments: 6 })
    .translate(0, 0, -1.2).rotateY(Math.PI / 2);
}

const rifleMagazineGeo = curvedMagazineGeometry();
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
/** One round of the ammo belt, lying across the gun (axis X), and the glowing base of a tracer, on the end that faces outward. */
const roundGeo = new THREE.CylinderGeometry(0.42, 0.42, 2.6, 8).rotateZ(Math.PI / 2);
const tracerTipGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.7, 8).rotateZ(Math.PI / 2);

function bx(g: THREE.Group, w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(boxGeo, m);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  g.add(mesh);
  return mesh;
}

function cyl(g: THREE.Group, r: number, len: number, m: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), m);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  g.add(mesh);
  return mesh;
}

/** Moving parts of a reload, in the weapon's own units. Null where the weapon has no such part. */
export interface ReloadRig {
  magazine: THREE.Object3D | null;
  /** Unit vector along which the magazine leaves the gun. */
  magDown: THREE.Vector3;
  /** Slide, charging handle, bolt handle or pump: whatever is worked at the end of a reload. */
  bolt: THREE.Object3D | null;
  /** Travel of `bolt` at full pull. */
  boltPull: THREE.Vector3;
  /** Extra upward travel of `bolt` (the bolt handle of the sniper rifle is lifted before it is pulled). */
  boltLift: number;
  /** Where the shooting hand holds the bolt handle at rest, on guns that hand works (bolt action); null otherwise. */
  boltGrip: THREE.Vector3 | null;
  supportBoltGrip: THREE.Vector3 | null;
  /** Shotgun shell, hidden at rest. */
  shell: THREE.Object3D | null;
  /** The sniper's spent cartridge, hidden until the bolt throws it. */
  casing: THREE.Object3D | null;
  /** Where the supporting hand goes to swap the magazine or feed a shell. */
  handTarget: THREE.Vector3;
  /** Where the supporting hand goes instead of the magazine, on a gun whose reload is worked at the cover and the belt. */
  supportHandReach: THREE.Vector3 | null;
  /** Feed cover over the receiver, hinged on its right edge and opened by rotating about Z by `coverOpenRad`, so it swings out of the way of the sights. */
  cover: THREE.Object3D | null;
  coverOpenRad: number;
  /** The ammo belt: its rounds move along the belt path, which bends to follow the box while it is out. Null without a belt. */
  belt: { group: THREE.Group; links: THREE.Object3D[] } | null;
}

export interface WeaponModel {
  group: THREE.Group;
  muzzle: THREE.Object3D;
  rig: ReloadRig;
}

/** An empty group at a pivot, so its children are placed in the part's own frame. */
function part(g: THREE.Group, x: number, y: number, z: number, rx = 0): THREE.Group {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  p.rotation.x = rx;
  g.add(p);
  return p;
}

/** One round and its clip, as a group so it can be moved and scaled as a unit. */
function beltRound(into: THREE.Group): THREE.Group {
  const link = new THREE.Group();
  link.add(new THREE.Mesh(roundGeo, mats.brass));
  const clip = new THREE.Mesh(boxGeo, mats.steel);
  clip.scale.set(0.6, 0.95, 0.95);
  clip.position.x = 0.4;
  link.add(clip);
  const tip = new THREE.Mesh(tracerTipGeo, mats.lime);
  tip.position.x = -1.15;
  link.add(tip);
  into.add(link);
  return link;
}

/**
 * Sets every round of the belt: `feed` counts the rounds fed so far, `laid` is 1 with the belt on the tray and 0 lifted off it,
 * `clear` is 1 with its end swung out to the left of the gun. The tip of every fourth round glows, so the flow reads while firing.
 */
export function placeBelt(links: readonly THREE.Object3D[], feed: number, laid: number, clear: number, fall: THREE.Vector3 = NO_FALL): void {
  const bent = reachedPath(laid, clear, fall);
  links.forEach((link, i) => {
    const { position, scale } = linkPlacement(i, links.length, feed, laid, clear, bent);
    link.position.set(position.x, position.y, position.z);
    link.scale.setScalar(scale);
    link.visible = scale > 0.02;
    link.children[TRACER_TIP].visible = isTracer(i, feed);
  });
}
const TRACER_TIP = 2;
const NO_FALL = new THREE.Vector3();

/**
 * Moves the feed cover and the ammo belt for one moment of a reload. The belt follows the box: its box end falls with the old one
 * and rises with the fresh one while the hand holds the tray end, then that end is laid on the tray.
 */
export function poseFeed(
  rig: ReloadRig,
  pose: Pick<ReloadPose, 'cover' | 'beltLaid' | 'beltClear' | 'magGone' | 'magDrop' | 'spareLift'>,
  feed: number,
  fallUnits: number,
): void {
  if (rig.cover) rig.cover.rotation.z = rig.coverOpenRad * pose.cover;
  if (!rig.belt) return;
  const fall = rig.magDown.clone().multiplyScalar((pose.magGone ? pose.spareLift : pose.magDrop) * fallUnits);
  placeBelt(rig.belt.links, feed, pose.beltLaid, pose.beltClear, fall);
}

/** Direction a magazine hanging below a pivot tilted by `rx` leaves the gun. */
const magDownFor = (rx: number): THREE.Vector3 => new THREE.Vector3(0, -Math.cos(rx), -Math.sin(rx));

/** Original low-poly weapon models. Barrel points toward -Z, origin at the firing hand. */
export function buildWeapon(id: WeaponId, beltLinks = 0): WeaponModel {
  const g = new THREE.Group();
  const muzzle = new THREE.Object3D();
  const rig: ReloadRig = {
    magazine: null,
    magDown: new THREE.Vector3(0, -1, 0),
    bolt: null,
    boltPull: new THREE.Vector3(),
    boltLift: 0,
    boltGrip: null,
    supportBoltGrip: null,
    shell: null,
    casing: null,
    handTarget: new THREE.Vector3(),
    supportHandReach: null,
    cover: null,
    coverOpenRad: 0,
    belt: null,
  };
  switch (id) {
    case WEAPON.PISTOL:
      const slide = part(g, 0, 0, 0);
      bx(slide, 1.6, 1.8, 8, mats.gun, 0, 2, -2.5);
      bx(slide, 0.5, 0.5, 0.5, mats.lime, 0, 3.1, -6.1);
      bx(slide, 1.62, 0.35, 5, mats.lime, 0, 1.4, -3);
      bx(g, 1.5, 1.2, 7, mats.poly, 0, 0.6, -2);
      bx(g, 1.5, 4.6, 2.3, mats.poly, 0, -1.8, 0.8, -0.25);
      bx(g, 0.4, 1.6, 2.4, mats.gun, 0, -0.2, -1.4);
      const clip = part(g, 0, -2.4, 0.9, -0.25);
      bx(clip, 1.1, 4.4, 1.8, mats.gun2, 0, 0, 0);
      bx(clip, 1.6, 0.5, 2.4, mats.lime, 0, -2.3, 0);
      rig.magazine = clip;
      rig.magDown = magDownFor(-0.25);
      rig.bolt = slide;
      rig.boltPull.set(0, 0, 3.4);
      rig.supportBoltGrip = new THREE.Vector3(-1, 2.6, -0.5);
      cyl(g, 0.56, 4, mats.steel, 0, 2, -4.12);
      muzzle.position.set(0, 2, -6.8);
      break;
    case WEAPON.SMG:
      bx(g, 3, 4.5, 12, mats.gun, 0, 1.5, -3);
      bx(g, 1.1, 1.1, 5, mats.steel, 0, 1.6, -11.5);
      const smgMag = part(g, 0, -4, -5.5, 0.08);
      bx(smgMag, 2, 9, 2.6, mats.gun2, 0, 0, 0);
      bx(smgMag, 2.2, 0.6, 2.8, mats.lime, 0, -4.6, 0);
      bx(g, 2.2, 5, 2.6, mats.poly, 0, -2.2, 1, -0.3);
      bx(g, 0.8, 3, 9, mats.steel, 0, 1.2, 7);
      bx(g, 3.1, 0.5, 10, mats.lime, 0, 3.85, -3);
      bx(g, 1, 1.4, 2.4, mats.gun, 0, 4.6, 0);
      const smgHandle = part(g, 0, 0, 0);
      bx(smgHandle, 1.4, 1.2, 2.6, mats.steel, 2.1, 2.6, -2);
      rig.magazine = smgMag;
      rig.magDown = magDownFor(0.08);
      rig.bolt = smgHandle;
      rig.boltPull.set(0, 0, 4.5);
      muzzle.position.set(0, 1.6, -14.5);
      break;
    case WEAPON.SHOTGUN:
      bx(g, 3, 4.5, 12, mats.gun, 0, 1.2, -2);
      bx(g, 1.6, 1.6, 22, mats.steel, 0, 2.1, -18);
      bx(g, 1.4, 1.4, 16, mats.gun2, 0, 0.3, -15);
      const pump = part(g, 0, 0, 0);
      bx(pump, 2.8, 2.8, 7, mats.limeDim, 0, 0.3, -17);
      bx(pump, 2.9, 0.5, 7.2, mats.lime, 0, 1.75, -17);
      bx(g, 2.6, 4.5, 13, mats.wood, 0, -0.2, 10, 0.12);
      bx(g, 2.2, 5, 2.6, mats.wood, 0, -2.4, 3.5, -0.4);
      const shell = part(g, 0, -0.6, -1);
      cyl(shell, 0.95, 3.4, mats.hull, 0, 0, 0);
      cyl(shell, 1.05, 1, mats.brass, 0, 0, 1.9);
      shell.visible = false;
      rig.bolt = pump;
      rig.boltPull.set(0, 0, 5);
      rig.shell = shell;
      rig.handTarget.set(0, -3.4, -4);
      muzzle.position.set(0, 2.1, -29.5);
      break;
    case WEAPON.SNIPER:
      bx(g, 3, 4.5, 16, mats.gun, 0, 1.5, -4);
      bx(g, 1.5, 1.5, 26, mats.steel, 0, 1.8, -25);
      bx(g, 2.6, 2.2, 4.4, mats.gun, 0, 1.8, -39.5);
      bx(g, 0.35, 0.35, 22, mats.lime, 0.85, 2.7, -24);
      bx(g, 0.35, 0.35, 22, mats.lime, -0.85, 2.7, -24);
      cyl(g, 1.5, 15, mats.gun, 0, 5.7, -4);
      cyl(g, 1.9, 2, mats.gun2, 0, 5.7, -11.5);
      cyl(g, 1.7, 2, mats.gun2, 0, 5.7, 3.5);
      cyl(g, 1.6, 0.3, mats.lens, 0, 5.7, -12.6);
      cyl(g, 1.4, 0.3, mats.lens, 0, 5.7, 4.6);
      bx(g, 1.2, 2.2, 1.6, mats.gun, 0, 4, -4);
      bx(g, 3, 5.2, 13, mats.gun2, 0, 0.6, 10);
      bx(g, 3.1, 1.2, 9, mats.lime, 0, 1.6, 10);
      bx(g, 2.2, 5, 2.6, mats.poly, 0, -2.2, 2, -0.3);
      const boltHandle = part(g, 0, 0, 0);
      bx(boltHandle, 2.6, 0.8, 0.8, mats.steel, 2, 2.6, 1.5);
      bx(boltHandle, 1.1, 1.1, 1.1, mats.steel, 3.4, 2.6, 1.5);
      const awpMag = part(g, 0, -1.7, -6);
      bx(awpMag, 2.2, 3.4, 4.6, mats.gun2, 0, 0, 0);
      bx(awpMag, 2.3, 0.5, 4.7, mats.lime, 0, -1.8, 0);
      // A rifle cartridge lies along z like the shotgun's shell: a long brass case with a tapered neck and a bright rim.
      const casing = part(g, 2.2, 2.4, 1);
      cyl(casing, 0.85, 4.4, mats.brass, 0, 0, 0);
      cyl(casing, 0.55, 1.4, mats.brass, 0, 0, -2.7);
      cyl(casing, 0.95, 0.35, mats.steel, 0, 0, 2.3);
      casing.visible = false;
      rig.casing = casing;
      rig.magazine = awpMag;
      rig.bolt = boltHandle;
      rig.boltPull.set(0, 0, 5.5);
      rig.boltLift = 1.8;
      rig.boltGrip = new THREE.Vector3(4.4, 2.2, 1.8);
      muzzle.position.set(0, 1.8, -42);
      break;
    case WEAPON.LMG:
      bx(g, 4.6, 6, 18, mats.gun, 0, 1.5, -3);
      bx(g, 2.8, 2.8, 16, mats.gun2, 0, 2, -20);
      for (let i = 0; i < 4; i++) bx(g, 2.9, 0.5, 1.6, mats.lime, 0, 3.45, -14 - i * 3.6);
      bx(g, 1.3, 1.3, 6, mats.steel, 0, 2, -30.5);
      const box = part(g, -0.6, -3.8, -4);
      bx(box, 4.2, 6.5, 6.5, mats.limeDim, 0, 0, 0);
      bx(box, 4.3, 1, 6.6, mats.lime, 0, 1.8, 0);
      // Carry handle: two short posts and a bridge, open in the middle, so it never walls off the view over the gun.
      bx(g, 1, 1.8, 0.9, mats.gun, 0, 5.4, -1.5);
      bx(g, 1, 1.8, 0.9, mats.gun, 0, 5.4, 2.5);
      bx(g, 1.1, 0.7, 5, mats.gun2, 0, 6.35, 0.5);
      const cover = part(g, 2.3, 4.5, -7.5);
      bx(cover, 4.6, 0.7, 9, mats.gun2, -2.3, 0.35, 0);
      bx(cover, 0.9, 0.18, 9.1, mats.lime, -1, 0.72, 0);
      rig.cover = cover;
      rig.coverOpenRad = -1.75;
      rig.supportHandReach = new THREE.Vector3(-4.5, 4, -6);
      if (beltLinks > 0) {
        const group = part(g, 0, 0, 0);
        const links = Array.from({ length: beltLinks }, () => beltRound(group));
        rig.belt = { group, links };
        placeBelt(links, 0, 1, 0);
      }
      const lmgHandle = part(g, 0, 0, 0);
      bx(lmgHandle, 1.6, 1.4, 3.2, mats.steel, 3.1, 3, -1);
      rig.magazine = box;
      rig.bolt = lmgHandle;
      rig.boltPull.set(0, 0, 5);
      bx(g, 3, 4.6, 10, mats.poly, 0, 1, 10);
      bx(g, 2.2, 5, 2.6, mats.poly, 0, -2.6, 3, -0.3);
      bx(g, 0.5, 8, 0.5, mats.steel, 1.2, -2.5, -24, 0.4, 0, 0.25);
      bx(g, 0.5, 8, 0.5, mats.steel, -1.2, -2.5, -24, 0.4, 0, -0.25);
      muzzle.position.set(0, 2, -34);
      break;
    case WEAPON.HAMMER:
      // Upright shaft: grip at the origin, shared by first- and third-person hands.
      bx(g, 1.8, 19, 1.8, mats.wood, 0, 2.5, 0);
      bx(g, 2.2, 10, 2.2, mats.poly, 0, -1.6, 0);
      for (const y of [-5.5, -3.5, -1.5, 0.5, 2.5]) bx(g, 2.35, 0.45, 2.35, mats.gun2, 0, y, 0);
      bx(g, 3, 1.8, 3, mats.steel, 0, -7, 0);
      bx(g, 3.6, 2, 3.6, mats.gun2, 0, 11.5, 0);
      bx(g, 12, 7, 7, mats.steel, 0, 16, 0);
      bx(g, 2, 7.6, 7.6, mats.gun2, -6, 16, 0);
      bx(g, 2, 7.6, 7.6, mats.gun2, 6, 16, 0);
      for (const x of [-3.8, 3.8]) bx(g, 0.7, 7.25, 7.25, mats.lime, x, 16, 0);
      for (const z of [-3.55, 3.55]) {
        bx(g, 3.4, 0.55, 0.16, mats.lime, 0, 16.7, z);
        bx(g, 0.55, 3, 0.16, mats.lime, 0, 15.9, z);
      }
      muzzle.position.set(0, 16, -3.5);
      break;
    default: // RIFLE
      bx(g, 3, 5, 16, mats.gun, 0, 1.5, -4);
      bx(g, 3.2, 4, 10, mats.poly, 0, 1.5, -17);
      bx(g, 3.3, 0.6, 8, mats.lime, 0, 2.7, -17);
      bx(g, 1.2, 1.2, 10, mats.steel, 0, 1.8, -27);
      bx(g, 1.8, 1.8, 2.6, mats.gun, 0, 1.8, -32.5);
      const rifleMag = part(g, 0, -0.9, -8, 0.16);
      rifleMag.add(new THREE.Mesh(rifleMagazineGeo, mats.gun2));
      bx(rifleMag, 2.5, 0.45, 3.5, mats.lime, 0, -8.35, -1.85, -0.32);
      bx(g, 2.2, 5, 2.6, mats.poly, 0, -2.2, 0, -0.3);
      bx(g, 2.6, 4.4, 11, mats.poly, 0, 0.8, 9);
      bx(g, 2.7, 0.6, 9, mats.lime, 0, 2.3, 9);
      bx(g, 1, 1.6, 3, mats.gun, 0, 4.7, -2);
      const rifleHandle = part(g, 0, 0, 0);
      bx(rifleHandle, 1.3, 1.1, 3, mats.steel, 1.9, 2.6, -5);
      rig.magazine = rifleMag;
      rig.magDown = magDownFor(0.16);
      rig.bolt = rifleHandle;
      rig.supportBoltGrip = new THREE.Vector3(2.4, 2.6, -5);
      rig.boltPull.set(0, 0, 4.5);
      muzzle.position.set(0, 1.8, -34);
      break;
  }
  g.add(muzzle);
  if (rig.magazine) rig.handTarget.copy(rig.magazine.position).add(new THREE.Vector3(0, -3.2, 0));
  if (rig.supportHandReach) rig.handTarget.copy(rig.supportHandReach);
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return { group: g, muzzle, rig };
}
