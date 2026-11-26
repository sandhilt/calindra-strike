import { STAFF_UNIFORMS, type MapProp } from '@calindra-strike/shared';
import * as THREE from 'three';
import { staffArmSwing } from './prop-motion.ts';
import { newPropMaterial, Parts } from './prop-parts.ts';

type Staff = Extract<MapProp, { kind: 'staff' }>;

const SKIN = 0xe9e4da;
const SHOE = 0x26272a;
const WHITE = 0xffffff;
const CHEF_HAT_BAND = 0xf5f5f5;
/** The shoulder joint of each arm, over the feet. Matches the store mannequin's sleeve top. */
const SHOULDER_UNITS = 56;
const SHOULDER_X_UNITS = 15.5;

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * Store staff are the store mannequin's cut (`addMannequin`) in a uniform: no plinth, no visor band, so nothing
 * marks them as a player or a bot. Trousers, shirt, apron and hat are static; the arms are drawn apart by `StaffArms`.
 */
export function addStaffBody(parts: Parts, s: Staff): void {
  const uniform = STAFF_UNIFORMS[s.uniform];
  parts.at(s.x, s.y, s.z, s.yaw);
  for (const side of [-5.5, 5.5]) {
    parts.box(9, 28, 10, uniform.trousers, { x: side, y: 14, z: 0 });
    parts.box(9.6, 3, 12, SHOE, { x: side, y: 1.5, z: -1 });
  }
  parts.box(24, 6, 14, uniform.trousers, { x: 0, y: 33, z: 0 });
  parts.box(24, 21, 14, uniform.shirt, { x: 0, y: 46, z: 0 });
  if (uniform.apron !== null) parts.box(16, 22, 1.6, uniform.apron, { x: 0, y: 40, z: -7.6 });
  parts.cylinder(3, 3.4, 4, 8, SKIN, { x: 0, y: 60, z: 0 });
  parts.box(14, 12, 14, SKIN, { x: 0, y: 68, z: 0 });
  if (uniform.hat === 'toque') {
    parts.box(15, 3, 15, CHEF_HAT_BAND, { x: 0, y: 75, z: 0 });
    parts.cylinder(7.5, 6.5, 13, 12, uniform.hatTint, { x: 0, y: 81, z: 0 });
  } else if (uniform.hat === 'cap') {
    parts.box(15, 4, 15, uniform.hatTint, { x: 0, y: 75, z: 0 });
    parts.box(15, 1.2, 7, uniform.hatTint, { x: 0, y: 73.5, z: -11 });
  }
}

/**
 * The two pieces of one arm, relative to its shoulder: the sleeve (white, so each figure's shirt colour shows through
 * the instance colour) and the forearm and hand (white too, tinted skin per instance).
 */
function armPiece(w: number, h: number, d: number, y: number): THREE.BufferGeometry {
  return new Parts().box(w, h, d, WHITE, { x: 0, y, z: 0 }).merge() ?? new THREE.BufferGeometry();
}

function seedOf(x: number, z: number): number {
  const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * Both arms of every staff figure, instanced: a sleeve and a forearm mesh with two instances per figure (left, right).
 * The pose comes from `staffArmSwing`; when `moving` is off the arms keep their resting pose.
 */
export class StaffArms {
  readonly object = new THREE.Group();
  private readonly items: readonly Staff[];
  private readonly sleeves: THREE.InstancedMesh;
  private readonly forearms: THREE.InstancedMesh;
  private readonly yaw = new THREE.Quaternion();
  private readonly swing = new THREE.Quaternion();
  private readonly base = new THREE.Vector3();
  private readonly pivot = new THREE.Vector3();
  private readonly matrix = new THREE.Matrix4();
  private readonly unit = new THREE.Vector3(1, 1, 1);
  private readonly skin = new THREE.Color(SKIN);
  private readonly shirt = new THREE.Color();
  private seconds = 0;
  private moving: boolean;

  constructor(items: readonly Staff[], moving: boolean) {
    this.items = items;
    this.moving = moving;
    const count = items.length * 2;
    this.sleeves = new THREE.InstancedMesh(armPiece(6.4, 12, 7.4, -6), newPropMaterial(), count);
    this.forearms = new THREE.InstancedMesh(armPiece(5.2, 12, 6, -17), newPropMaterial(), count);
    this.sleeves.frustumCulled = false;
    this.forearms.frustumCulled = false;
    items.forEach((s, k) => {
      this.shirt.setHex(STAFF_UNIFORMS[s.uniform].shirt);
      for (let side = 0; side < 2; side++) {
        this.sleeves.setColorAt(2 * k + side, this.shirt);
        this.forearms.setColorAt(2 * k + side, this.skin);
      }
    });
    this.object.add(this.sleeves, this.forearms);
    this.pose();
  }

  /** Advances the swing while the tier allows it; otherwise the arms keep their resting pose. */
  update(dt: number): void {
    if (!this.moving) return;
    this.seconds += dt;
    this.pose();
  }

  setMoving(moving: boolean): void {
    if (moving === this.moving) return;
    this.moving = moving;
    if (!moving) {
      this.seconds = 0;
      this.pose();
    }
  }

  private pose(): void {
    for (let k = 0; k < this.items.length; k++) {
      const s = this.items[k];
      this.yaw.setFromAxisAngle(Y_AXIS, s.yaw);
      this.base.set(s.x, s.y, s.z);
      const seed = seedOf(s.x, s.z) * 6;
      for (let side = 0; side < 2; side++) {
        const angle = staffArmSwing(this.seconds, seed, s.role, side === 0 ? 'left' : 'right');
        this.pivot.set((side === 0 ? -1 : 1) * SHOULDER_X_UNITS, SHOULDER_UNITS, 0).applyQuaternion(this.yaw).add(this.base);
        this.swing.setFromAxisAngle(X_AXIS, angle).premultiply(this.yaw);
        this.matrix.compose(this.pivot, this.swing, this.unit);
        this.sleeves.setMatrixAt(2 * k + side, this.matrix);
        this.forearms.setMatrixAt(2 * k + side, this.matrix);
      }
    }
    this.sleeves.instanceMatrix.needsUpdate = true;
    this.forearms.instanceMatrix.needsUpdate = true;
  }
}
