import { WEAPON, type GameMode, type WeaponId } from '@calindra-strike/shared';
import * as THREE from 'three';
import { isTracer, linkPlacement, reachedPath } from './belt-anim.ts';
import { DRUM_CHAMBERS } from './drum-anim.ts';
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
  // Red dot optic: the dot is unlit so it stays bright in shade.
  dot: new THREE.MeshBasicMaterial({ color: '#ff2a1a' }),
  hull: new THREE.MeshStandardMaterial({ color: '#b3261e', roughness: 0.55 }),
  brass: new THREE.MeshStandardMaterial({ color: '#c9a227', roughness: 0.3, metalness: 0.7 }),
  // Gold and walnut are reserved for the Carrapeta Dourada skin.
  gold: new THREE.MeshStandardMaterial({ color: '#d9a520', emissive: '#6b4a00', emissiveIntensity: 0.3, roughness: 0.28, metalness: 0.85 }),
  goldDark: new THREE.MeshStandardMaterial({ color: '#8a6a1a', roughness: 0.4, metalness: 0.75 }),
  walnut: new THREE.MeshStandardMaterial({ color: '#4a2a14', roughness: 0.7 }),
  // Glossy toy plastic of the squeaky hammer the Carrapeta Dourada skin swings.
  toyRed: new THREE.MeshStandardMaterial({ color: '#e0261b', roughness: 0.35 }),
  toyYellow: new THREE.MeshStandardMaterial({ color: '#ffd21f', roughness: 0.35 }),
  pipOff: new THREE.MeshStandardMaterial({ color: '#17191c', roughness: 0.6 }),
};

export type WeaponSkin = 'standard' | 'carrapeta';

export function weaponSkin(mode: GameMode): WeaponSkin {
  return mode === 'carrapeta' ? 'carrapeta' : 'standard';
}

/** In Carrapeta Dourada every gun is gilded: dark metal turns to gold, polymer to walnut, the lime accents to bright gold. */
const GILDED = new Map<THREE.Material, THREE.Material>([
  [mats.gun, mats.gold], [mats.gun2, mats.goldDark], [mats.steel, mats.gold], [mats.poly, mats.walnut],
  [mats.lime, mats.gold], [mats.limeDim, mats.goldDark],
]);

function gild(g: THREE.Object3D): void {
  g.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const gold = GILDED.get(mesh.material as THREE.Material);
    if (gold) mesh.material = gold;
  });
}

/** A squeaky toy hammer: a red bellows head with yellow faces on a yellow handle, grip at the origin like the steel one. */
function toyHammer(g: THREE.Group): void {
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 22, 12), mats.toyYellow);
  handle.position.set(0, 3, 0);
  g.add(handle);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 11, 16), mats.toyRed);
  head.rotation.z = Math.PI / 2;
  head.position.set(0, 16, 0);
  g.add(head);
  for (const x of [-6.2, 6.2]) {
    const face = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 1.6, 16), mats.toyYellow);
    face.rotation.z = Math.PI / 2;
    face.position.set(x, 16, 0);
    g.add(face);
  }
  for (const x of [-2.6, 0, 2.6]) {
    const pleat = new THREE.Mesh(new THREE.CylinderGeometry(4.85, 4.85, 0.6, 16), mats.toyYellow);
    pleat.rotation.z = Math.PI / 2;
    pleat.position.set(x, 16, 0);
    g.add(pleat);
  }
}

const LAUNCHER_SKINS: Record<WeaponSkin, {
  furniture: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  rings: THREE.MeshStandardMaterial;
  darkTrim: THREE.MeshStandardMaterial;
  shells: THREE.MeshStandardMaterial;
  emblem: boolean;
}> = {
  standard: { furniture: mats.poly, trim: mats.lime, rings: mats.limeDim, darkTrim: mats.gun2, shells: mats.limeDim, emblem: false },
  carrapeta: { furniture: mats.walnut, trim: mats.gold, rings: mats.gold, darkTrim: mats.goldDark, shells: mats.brass, emblem: true },
};

/** Height of the red dot of the rifle's optic above the model origin (model units); `ads-view.ts` lifts the aimed gun to put it on the centre of the view. */
export const RIFLE_DOT_HEIGHT_UNITS = 6.2;
const RIFLE_DOT_Z = -2;

/** A reflex optic on the rifle's rail: an open frame, the tinted glass at its front and the lit red dot at the rear, so the eye sees the dot clear of the tint. */
function redDotSight(g: THREE.Group): void {
  const y = RIFLE_DOT_HEIGHT_UNITS;
  bx(g, 1.4, 0.5, 4.4, mats.gun, 0, 4.25, RIFLE_DOT_Z);
  bx(g, 2.4, 0.5, 3.6, mats.gun2, 0, 4.75, RIFLE_DOT_Z);
  for (const x of [-1.1, 1.1]) bx(g, 0.4, 2.4, 3.6, mats.gun2, x, y, RIFLE_DOT_Z);
  bx(g, 2.4, 0.5, 3.6, mats.gun2, 0, y + 1.45, RIFLE_DOT_Z);
  bx(g, 1.8, 2.4, 0.12, mats.lens, 0, y, RIFLE_DOT_Z - 1.4);
  bx(g, 0.5, 0.5, 0.1, mats.dot, 0, y, RIFLE_DOT_Z + 1.2);
}

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

export const SHARED_WEAPON_RESOURCES: ReadonlySet<THREE.BufferGeometry | THREE.Material | THREE.Texture> = new Set([
  ...Object.values(mats), rifleMagazineGeo, boxGeo, roundGeo, tracerTipGeo,
]);

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

/** One cartridge: a case with a steel primer, its head toward +Z. */
function shellCase(into: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number): THREE.Group {
  const shell = new THREE.Group();
  shell.position.set(x, y, z);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 0.96, 0.55, 10), material);
  head.rotation.x = Math.PI / 2;
  const primer = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.6, 8), mats.steel);
  primer.rotation.x = Math.PI / 2;
  shell.add(head, primer);
  into.add(shell);
  return shell;
}

/** The Carrapeta Dourada drawn in relief on one side of the receiver: a stem, a dome and a pointed body, in gold. `side` is -1 or 1, the way the plate faces. */
function emblem(g: THREE.Group, x: number, y: number, z: number, side: number): void {
  const plate = new THREE.Group();
  plate.position.set(x, y, z);
  plate.rotation.y = side * Math.PI / 2;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mats.gold);
  dome.position.y = 0.6;
  dome.scale.z = 0.3;
  const body = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.6, 10), mats.gold);
  body.rotation.z = Math.PI;
  body.position.y = -0.7;
  body.scale.z = 0.3;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1, 6), mats.gold);
  stem.position.y = 2.4;
  const band = new THREE.Mesh(boxGeo, mats.walnut);
  band.scale.set(3.1, 0.22, 0.5);
  band.position.set(0, 0.55, 0.05);
  plate.add(dome, body, stem, band);
  g.add(plate);
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
  /** Hinged feed cover or launcher drum, opened by rotating about Z by `coverOpenRad`. */
  cover: THREE.Object3D | null;
  coverOpenRad: number;
  /** The Azeitadora's chamber drum: the part that turns, one round per chamber, the rounds thrown out when fired or dropped on a reload, and where each chamber sits. */
  drum: { group: THREE.Group; rounds: THREE.Object3D[]; loose: THREE.Object3D[]; chambers: THREE.Vector3[]; pips: { meshes: THREE.Mesh[]; on: THREE.Material; off: THREE.Material } } | null;
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
export function buildWeapon(id: WeaponId, beltLinks = 0, skin: WeaponSkin = 'standard'): WeaponModel {
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
    drum: null,
    belt: null,
  };
  switch (id) {
    case WEAPON.MGL: {
      const finish = LAUNCHER_SKINS[skin];
      // Frame: a lower frame with the grip, and a thin top strap, with the sides between them open so the drum's rear face shows from behind.
      bx(g, 3.4, 3.2, 9, mats.gun, 0, -2, 0.5);
      bx(g, 3.6, 0.6, 9.2, finish.darkTrim, 0, -3.7, 0.5);
      bx(g, 2.8, 1.6, 9.5, mats.gun, 0, 5.6, 0.2);
      bx(g, 3.1, 0.5, 9.7, finish.trim, 0, 6.55, 0.2);
      bx(g, 2.7, 5.4, 3, finish.furniture, 0, -4.4, 3.4, -0.28);
      bx(g, 3.1, 1, 3.4, finish.trim, 0, -7.4, 4.4, -0.28);
      bx(g, 0.8, 1.6, 3.2, mats.gun2, 0, -4.6, -1.4);
      bx(g, 0.7, 1.6, 0.7, finish.trim, 0, 7.2, 4.6, -0.45);
      bx(g, 3.2, 2.4, 1.8, mats.gun2, 0, 2.4, 5.2);
      bx(g, 3.5, 3.5, 1.8, finish.furniture, 0, -1.6, 9.8);
      if (finish.emblem) {
        for (const side of [-1, 1]) emblem(g, side * 1.75, -2, 0.5, side);
      }
      // Barrel with its shroud, rings and an open sight rail.
      bx(g, 3.6, 1.4, 16, mats.gun2, 0, 7, -9.5);
      cyl(g, 2, 12, mats.gun, 0, 4.6, -19);
      cyl(g, 2.45, 2, finish.rings, 0, 4.6, -24);
      cyl(g, 2.3, 0.8, finish.darkTrim, 0, 4.6, -14);
      cyl(g, 2.3, 0.8, finish.darkTrim, 0, 4.6, -20);
      cyl(g, 1.45, 0.05, mats.poly, 0, 4.6, -25.01);
      bx(g, 4, 2.4, 6, finish.furniture, 0, 1.4, -17);
      // Iron sights: a notch at the rear, a lit post at the front. The aimed gun is lifted to put them on the centre of the view.
      bx(g, 3.2, 1.2, 1.2, mats.gun, 0, 7.2, 0.8);
      for (const x of [-1.3, 1.3]) bx(g, 0.8, 1.6, 0.8, mats.gun, x, 8.5, 0.8);
      bx(g, 0.5, 1.9, 0.6, mats.lime, 0, 8.65, -16.5);

      // Drum: swings out on its hinge, and turns inside it one chamber per round.
      const hinge = part(g, -4.5, 0.4, -8.5);
      const drum = part(hinge, 4.5, 0.4, 0);
      cyl(drum, 5.4, 9, mats.gun2, 0, 0, 0);
      cyl(drum, 5.5, 1.1, finish.rings, 0, 0, -4.4);
      cyl(drum, 5.5, 1.1, mats.gun, 0, 0, 4.4);
      // The drum's rim carries a window over every chamber and a groove between them, so the turn and the rounds left read from the side and from above,
      // where the receiver does not hide them. The case heads at the rear are the same rounds.
      const rounds: THREE.Object3D[] = [];
      const chambers: THREE.Vector3[] = [];
      const RIM = 5.45;
      for (let chamber = 0; chamber < DRUM_CHAMBERS; chamber++) {
        const angle = chamber * Math.PI / 3;
        const x = 3.65 * Math.sin(angle);
        const y = 3.65 * Math.cos(angle);
        cyl(drum, 1.38, 9.5, mats.poly, x, y, 0);
        const round = new THREE.Group();
        round.add(shellCase(round, finish.shells, x, y, 4.85));
        bx(round, 2.5, 0.5, 8.2, finish.shells, RIM * Math.sin(angle), RIM * Math.cos(angle), 0, 0, 0, -angle);
        drum.add(round);
        rounds.push(round);
        chambers.push(new THREE.Vector3(RIM * Math.sin(angle), RIM * Math.cos(angle), 0));
        const groove = angle + Math.PI / 6;
        bx(drum, 0.7, 0.45, 8.6, mats.poly, RIM * Math.sin(groove), RIM * Math.cos(groove), 0, 0, 0, -groove);
      }
      const loose = Array.from({ length: DRUM_CHAMBERS }, () => {
        const shell = shellCase(g, finish.shells, 0, 0, 0);
        shell.visible = false;
        return shell;
      });
      // One lit pip per round left, along the top of the barrel where the shooter looks, since the frame hides most of the drum from behind.
      const pips = Array.from({ length: DRUM_CHAMBERS }, (_, i) => bx(g, 0.9, 0.5, 1.2, mats.pipOff, -1.1, 7.95, -5 - i * 1.9));
      rig.drum = { group: drum, rounds, loose, chambers, pips: { meshes: pips, on: mats.lime, off: mats.pipOff } };
      rig.cover = hinge;
      rig.coverOpenRad = -1.65;
      rig.supportHandReach = new THREE.Vector3(-6, -4, -8.5);
      muzzle.position.set(0, 4.6, -25);
      break;
    }
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
      if (skin === 'carrapeta') {
        toyHammer(g);
        muzzle.position.set(0, 16, -3.5);
        break;
      }
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
      redDotSight(g);
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
  if (skin === 'carrapeta' && id !== WEAPON.HAMMER && id !== WEAPON.MGL) gild(g);
  if (rig.magazine) rig.handTarget.copy(rig.magazine.position).add(new THREE.Vector3(0, -3.2, 0));
  if (rig.supportHandReach) rig.handTarget.copy(rig.supportHandReach);
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return { group: g, muzzle, rig };
}
