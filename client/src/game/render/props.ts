import { LIFT_DOOR_CLOSE_TICKS, LIFT_DOOR_HEIGHT_UNITS, liftCab, type Lift, type MapProp, type Mat, type PropKind, type StationId, type StoreBrand, staffOutfit } from '@calindra-strike/shared';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  adScroll,
  ARM_REST,
  staffArmPose,
  type ArmPose,
  CASCADE_DROP,
  CEILING_FAN_RAD_PER_S,
  JET_DROP,
  VENT_FAN_RAD_PER_S,
  WISPS_PER_VENT,
  dropPose,
  doorOpening,
  escalatorPhase,
  fanAngle,
  fillStepSlot,
  flamePose,
  lifeFraction,
  nearestStop,
  newStepSlot,
  RISER_THICKNESS_UNITS,
  stepGeometry,
  TREAD_THICKNESS_UNITS,
  wispPose,
  type DropPose,
  type FlamePose,
  type StepSlot,
  type WispPose,
} from './prop-motion.ts';
import { addClothesRack, addEscalatorBody, addEscalatorGlass, addFanMount, addMannequin, addMannequinBody, addMannequinHand, addMannequinSleeve, addVentFrame, armMatrix } from './prop-models.ts';
import { newPropMaterial, Parts } from './prop-parts.ts';
import { addSanta } from './santa.ts';
import type { QualityProfile } from './quality.ts';
import { signCanvas } from './store-signs.ts';
import { canvasTexture } from './textures.ts';

type PropOf<K extends PropKind> = Extract<MapProp, { kind: K }>;

/** What a prop kind hands back to the world: something to put in the scene, and how it moves. */
export interface PropGroup {
  readonly object: THREE.Object3D;
  /** `serverTick` is the server clock, for the props that run on it (the lift cab). */
  update(dt: number, serverTick: number): void;
  /** Takes a graphics tier mid-match: starts or stops motion and builds or drops the optional parts. */
  setQuality(profile: QualityProfile): void;
}

export interface PropContext {
  /** Models that never move are added here and drawn together as one mesh. */
  readonly statics: Parts;
  readonly materialOf: (mat: Mat) => THREE.Material | undefined;
  readonly profile: QualityProfile;
}

type Builder<K extends PropKind> = (props: readonly PropOf<K>[], ctx: PropContext) => PropGroup;

const still = (): PropGroup => ({ object: new THREE.Group(), update() {}, setQuality() {} });

/** Shared by the builders below: a clock that only runs while the tier allows ambient motion. */
class MotionClock {
  seconds = 0;
  running: boolean;
  constructor(profile: QualityProfile) {
    this.running = profile.ambientMotion;
  }
  tick(dt: number): boolean {
    if (!this.running) return false;
    this.seconds += dt;
    return true;
  }
}

/** A spin of instanced parts around the prop's own axis, with a start angle of its own for each. */
interface SpinSlot {
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  /** The fan's own axis: vertical for ceiling fans, the wall normal for vent fans. */
  axis: THREE.Vector3;
  seed: number;
}

class Spinners {
  readonly mesh: THREE.InstancedMesh;
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly quat = new THREE.Quaternion();
  private readonly spin = new THREE.Quaternion();
  private readonly yawAxis = new THREE.Vector3(0, 1, 0);
  private readonly matrix = new THREE.Matrix4();
  private readonly slots: readonly SpinSlot[];
  private readonly radPerSecond: number;

  constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    slots: readonly SpinSlot[],
    radPerSecond: number,
  ) {
    this.slots = slots;
    this.radPerSecond = radPerSecond;
    this.mesh = new THREE.InstancedMesh(geometry, material, slots.length);
    this.mesh.frustumCulled = false;
    this.pose(0);
  }

  pose(seconds: number): void {
    this.slots.forEach((s, i) => {
      this.quat.setFromAxisAngle(this.yawAxis, s.yaw);
      this.spin.setFromAxisAngle(s.axis, fanAngle(seconds, this.radPerSecond, s.seed));
      this.quat.multiply(this.spin);
      this.matrix.compose(this.position.set(s.x, s.y, s.z), this.quat, this.scale.setScalar(s.scale));
      this.mesh.setMatrixAt(i, this.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

function seedOf(x: number, z: number): number {
  const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function groupOf(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  g.add(...children);
  return g;
}

function buildCeilingFans(fans: readonly PropOf<'ceilingFan'>[], ctx: PropContext): PropGroup {
  if (fans.length === 0) return still();
  const BLADE_RADIUS = 40;
  const blades = new Parts();
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    blades.box(BLADE_RADIUS - 7, 0.9, 8.5, 0xdcc9a0, { x: Math.cos(a) * (BLADE_RADIUS / 2 + 3), y: 0, z: -Math.sin(a) * (BLADE_RADIUS / 2 + 3), rot: [0.12, a, 0] });
  }
  blades.cylinder(5.2, 5.2, 2.4, 12, 0x3a3128, { x: 0, y: 0, z: 0 });
  for (const f of fans) addFanMount(ctx.statics, f);
  const slots = fans.map((f): SpinSlot => ({ x: f.x, y: f.y, z: f.z, yaw: 0, scale: f.radius / BLADE_RADIUS, axis: AXIS_Y, seed: seedOf(f.x, f.z) * 6 }));
  const geometry = blades.merge();
  if (!geometry) return still();
  const spinners = new Spinners(geometry, newPropMaterial(), slots, CEILING_FAN_RAD_PER_S);
  // Fans turn on every tier: posing a few instances is free, and a still fan reads as broken.
  const clock = new MotionClock(ctx.profile);
  clock.running = true;
  return {
    object: spinners.mesh,
    update(dt) {
      clock.tick(dt);
      spinners.pose(clock.seconds);
    },
    setQuality() {},
  };
}

function buildMannequins(items: readonly PropOf<'mannequin'>[], ctx: PropContext): PropGroup {
  for (const m of items) addMannequin(ctx.statics, m);
  return still();
}

/**
 * Staff are the store mannequin model dressed in their brand's uniform (`staffOutfit`): the body joins the static
 * mesh, and the arms are the mannequin's own arm parts drawn as two instanced meshes (sleeves tinted per figure, bare
 * forearms), two instances per figure, posed by `staffArmPose` while `QualityProfile.staffMotion` is on.
 */
function buildStaff(items: readonly PropOf<'staff'>[], ctx: PropContext): PropGroup {
  if (items.length === 0) return still();
  const outfits = items.map((s) => staffOutfit(s.uniform, s.role));
  items.forEach((s, i) => addMannequinBody(ctx.statics, { x: s.x, y: s.y, z: s.z, yaw: s.yaw, outfit: outfits[i] }));
  const sleeveParts = new Parts();
  addMannequinSleeve(sleeveParts, 0xffffff);
  const handParts = new Parts();
  addMannequinHand(handParts);
  const sleeveGeometry = sleeveParts.merge();
  const handGeometry = handParts.merge();
  if (!sleeveGeometry || !handGeometry) return still();
  const count = items.length * 2;
  const sleeves = new THREE.InstancedMesh(sleeveGeometry, newPropMaterial(), count);
  const hands = new THREE.InstancedMesh(handGeometry, newPropMaterial(), count);
  for (const mesh of [sleeves, hands]) {
    mesh.castShadow = true;
    mesh.frustumCulled = false;
  }
  const color = new THREE.Color();
  for (let i = 0; i < items.length; i++) {
    color.setHex(outfits[i].top);
    sleeves.setColorAt(i * 2, color);
    sleeves.setColorAt(i * 2 + 1, color);
  }
  const seeds = items.map((s) => seedOf(s.x, s.z));
  const matrix = new THREE.Matrix4();
  const pose: ArmPose = { ...ARM_REST };
  const placeArm = (index: number, s: PropOf<'staff'>, side: 1 | -1, at: Readonly<ArmPose>): void => {
    armMatrix(matrix, s, side, at);
    sleeves.setMatrixAt(index, matrix);
    hands.setMatrixAt(index, matrix);
  };
  // Runs every frame: plain loops over the scratch matrix and pose above, nothing allocated.
  const place = (seconds: number | null): void => {
    for (let i = 0; i < items.length; i++) {
      const s = items[i];
      placeArm(i * 2, s, 1, seconds === null ? ARM_REST : staffArmPose(pose, s.role, 1, seconds, seeds[i]));
      placeArm(i * 2 + 1, s, -1, seconds === null ? ARM_REST : staffArmPose(pose, s.role, -1, seconds, seeds[i]));
    }
    sleeves.instanceMatrix.needsUpdate = true;
    hands.instanceMatrix.needsUpdate = true;
  };
  place(null);
  const clock = new MotionClock(ctx.profile);
  clock.running = ctx.profile.staffMotion;
  return {
    object: groupOf(sleeves, hands),
    update(dt) {
      if (clock.tick(dt)) place(clock.seconds);
    },
    setQuality(profile) {
      clock.running = profile.staffMotion;
      if (!clock.running) place(null);
    },
  };
}

function buildClothesRacks(items: readonly PropOf<'clothesRack'>[], ctx: PropContext): PropGroup {
  for (const r of items) addClothesRack(ctx.statics, r);
  return still();
}

const ESCALATOR_STEP_COLOR = 0xaeb4bb;
const ESCALATOR_RISER_COLOR = 0x4a4e55;
const ESCALATOR_NOSING_COLOR = 0xf2c200;

function instancedBoxes(count: number, color: number, material: THREE.MeshStandardMaterialParameters): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color, ...material }), count);
  mesh.frustumCulled = false;
  return mesh;
}

/** Steps travel on every tier: the escalator is gameplay scenery, not an ambient extra. */
function buildEscalators(items: readonly PropOf<'escalator'>[], ctx: PropContext): PropGroup {
  if (items.length === 0) return still();
  const per = stepGeometry(items[0]).count + 1;
  const total = per * items.length;
  const treads = instancedBoxes(total, ESCALATOR_STEP_COLOR, { roughness: 0.5, metalness: 0.2 });
  const nosings = instancedBoxes(total, ESCALATOR_NOSING_COLOR, { roughness: 0.6, emissive: ESCALATOR_NOSING_COLOR, emissiveIntensity: 0.25 });
  const risers = instancedBoxes(total, ESCALATOR_RISER_COLOR, { roughness: 0.7 });
  const panes = new Parts();
  for (const e of items) {
    addEscalatorBody(ctx.statics, e, stepGeometry(e).rise);
    addEscalatorGlass(panes, e, stepGeometry(e).rise);
  }
  const glass = new THREE.Mesh(panes.merge() ?? new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.35, depthWrite: false }));
  const slot: StepSlot = newStepSlot();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();
  const yaws = items.map((e) => Math.atan2(-e.dirZ, e.dirX));
  const meshes = [treads, nosings, risers];
  let seconds = 0;

  const place = (mesh: THREE.InstancedMesh, index: number, e: PropOf<'escalator'>, yaw: number, along: number, y: number, sx: number, sy: number, sz: number): void => {
    quat.setFromAxisAngle(AXIS_Y, yaw);
    position.set(e.x + e.dirX * along, e.y + y, e.z + e.dirZ * along);
    matrix.compose(position, quat, scale.set(sx, sy, sz));
    mesh.setMatrixAt(index, matrix);
  };

  const pose = (): void => {
    for (let n = 0; n < items.length; n++) {
      const e = items[n];
      const phase = escalatorPhase(seconds, e, e.travel);
      const width = e.width - 1;
      for (let i = 0; i < per; i++) {
        const index = n * per + i;
        fillStepSlot(slot, i - 1 + phase, e);
        const length = slot.treadTo - slot.treadFrom;
        if (slot.treadOn && length > 0.01) {
          const thick = Math.min(TREAD_THICKNESS_UNITS, slot.treadTop);
          place(treads, index, e, yaws[n], (slot.treadFrom + slot.treadTo) / 2, slot.treadTop - thick / 2, length, thick, width);
        } else {
          place(treads, index, e, yaws[n], 0, 0, 0, 0, 0);
        }
        if (slot.treadOn && length > 3) place(nosings, index, e, yaws[n], slot.treadFrom + 1.2, slot.treadTop + 0.3, 2.4, 0.6, width);
        else place(nosings, index, e, yaws[n], 0, 0, 0, 0, 0);
        if (slot.riserOn) {
          place(risers, index, e, yaws[n], slot.riserAt - RISER_THICKNESS_UNITS / 2, (slot.riserBottom + slot.riserTop) / 2, RISER_THICKNESS_UNITS, slot.riserTop - slot.riserBottom, width);
        } else {
          place(risers, index, e, yaws[n], 0, 0, 0, 0, 0);
        }
      }
    }
    for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;
  };
  pose();
  return {
    object: groupOf(treads, nosings, risers, glass),
    update(dt) {
      seconds += dt;
      pose();
    },
    setQuality() {},
  };
}

const JET_ARCS = 6;
const JET_DROPS_PER_ARC = 8;
const CASCADE_ARCS = 14;
const CASCADE_DROPS_PER_ARC = 3;
const JET_HEIGHT_UNITS = 88;
/** Pose the water stands in when ambient motion is off. */
const STILL_WATER_SECONDS = 0.37;

function buildFountains(items: readonly PropOf<'fountain'>[], ctx: PropContext): PropGroup {
  if (items.length === 0) return still();
  const water = new THREE.MeshStandardMaterial({ color: 0xd8f3ff, emissive: 0x4aa8c8, emissiveIntensity: 0.4, transparent: true, opacity: 0.8, roughness: 0.1, depthWrite: false });
  const perFountain = JET_ARCS * JET_DROPS_PER_ARC + CASCADE_ARCS * CASCADE_DROPS_PER_ARC;
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(2, 5, 4), water, perFountain * items.length);
  drops.frustumCulled = false;
  drops.renderOrder = 6;
  const columnGeometry = new THREE.CylinderGeometry(1.8, 4.5, JET_HEIGHT_UNITS, 8, 1, true);
  columnGeometry.translate(0, JET_HEIGHT_UNITS / 2, 0);
  const columns = items.map((f) => {
    const column = new THREE.Mesh(columnGeometry, water);
    column.position.set(f.x, f.y, f.z);
    column.renderOrder = 6;
    return column;
  });
  const flow = ctx.materialOf('water');
  const surface = flow instanceof THREE.MeshStandardMaterial ? flow : null;
  const pose: DropPose = { r: 0, y: 0 };
  const position = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const matrix = new THREE.Matrix4();
  const clock = new MotionClock(ctx.profile);

  const apply = (seconds: number): void => {
    items.forEach((f, n) => {
      let index = n * perFountain;
      const launch = (spec: typeof JET_DROP, arcs: number, perArc: number, spin: number): void => {
        for (let k = 0; k < arcs; k++) {
          const angle = (k * Math.PI * 2) / arcs + spin;
          for (let i = 0; i < perArc; i++) {
            dropPose(pose, spec, lifeFraction(seconds, spec.lifeSeconds, i / perArc + k * 0.071));
            matrix.compose(position.set(f.x + Math.cos(angle) * pose.r, f.y + pose.y, f.z + Math.sin(angle) * pose.r), quat, scale);
            drops.setMatrixAt(index++, matrix);
          }
        }
      };
      launch(JET_DROP, JET_ARCS, JET_DROPS_PER_ARC, 0.3);
      launch(CASCADE_DROP, CASCADE_ARCS, CASCADE_DROPS_PER_ARC, 0.1);
      columns[n].scale.y = 1 + 0.07 * Math.sin(seconds * 3.1);
    });
    drops.instanceMatrix.needsUpdate = true;
    if (surface?.map) surface.map.offset.set(seconds * 0.03, seconds * 0.012 + 0.015 * Math.sin(seconds * 1.3));
  };
  apply(clock.running ? 0 : STILL_WATER_SECONDS);
  return {
    object: groupOf(drops, ...columns),
    update(dt) {
      if (clock.tick(dt)) apply(clock.seconds);
    },
    setQuality(profile) {
      clock.running = profile.ambientMotion;
    },
  };
}

const SMOKE_SIZE_UNITS = 15;
const VENT_FAN_REFERENCE_RADIUS = 10;

function softBlob(): THREE.CanvasTexture {
  return canvasTexture(64, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  }, false);
}

/** Batched vapour wisps with shared motion and opposite rise directions for vents and pots. */
class Vapour {
  readonly points: THREE.Points;
  private readonly material: THREE.PointsMaterial;
  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly wisp: WispPose = { out: 0, down: 0, side: 0, alpha: 0 };
  private seconds = 0;

  private readonly sources: readonly (PropOf<'vent'> | PropOf<'steam'>)[];

  constructor(sources: readonly (PropOf<'vent'> | PropOf<'steam'>)[]) {
    this.sources = sources;
    const count = sources.length * WISPS_PER_VENT;
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) this.colors.set([0.86, 0.9, 0.93, 0], i * 4);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4));
    this.material = new THREE.PointsMaterial({ size: SMOKE_SIZE_UNITS, map: softBlob(), vertexColors: true, transparent: true, depthWrite: false });
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 7;
    this.pose();
  }

  update(dt: number): void {
    this.seconds += dt;
    this.pose();
  }

  private pose(): void {
    this.sources.forEach((v, n) => {
      const steam = v.kind === 'steam';
      const outX = steam ? 0 : -Math.sin(v.yaw);
      const outZ = steam ? 0 : -Math.cos(v.yaw);
      const seed = seedOf(v.x, v.z);
      for (let i = 0; i < WISPS_PER_VENT; i++) {
        wispPose(this.wisp, i, this.seconds, seed);
        const k = n * WISPS_PER_VENT + i;
        this.positions[k * 3] = v.x + (steam ? this.wisp.side : outX * (this.wisp.out + 2) - outZ * this.wisp.side);
        this.positions[k * 3 + 1] = v.y + (steam ? this.wisp.out * 0.6 : -this.wisp.down);
        this.positions[k * 3 + 2] = v.z + (steam ? 0 : outZ * (this.wisp.out + 2) + outX * this.wisp.side);
        this.colors[k * 4 + 3] = this.wisp.alpha;
      }
    });
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  dispose(): void {
    this.points.removeFromParent();
    this.points.geometry.dispose();
    this.material.map?.dispose();
    this.material.dispose();
  }
}

function buildVents(items: readonly PropOf<'vent'>[], ctx: PropContext): PropGroup {
  if (items.length === 0) return still();
  const blades = new Parts();
  const R = VENT_FAN_REFERENCE_RADIUS;
  for (let k = 0; k < 5; k++) {
    const a = (k * Math.PI * 2) / 5;
    blades.box(R - 1.5, 3, 0.5, 0x4a4d53, { x: Math.cos(a) * (R / 2 + 0.7), y: Math.sin(a) * (R / 2 + 0.7), z: 0, rot: [0.5, 0, a] });
  }
  blades.cylinder(1.8, 1.8, 1.4, 8, 0x9a9fa6, { x: 0, y: 0, z: 0, rot: [Math.PI / 2, 0, 0] });
  for (const v of items) addVentFrame(ctx.statics, v);
  const slots = items.map((v): SpinSlot => ({
    x: v.x - Math.sin(v.yaw) * 1,
    y: v.y,
    z: v.z - Math.cos(v.yaw) * 1,
    yaw: v.yaw,
    scale: (Math.min(v.width, v.height) / 2 - 3) / R,
    axis: AXIS_Z,
    seed: seedOf(v.x, v.z) * 6,
  }));
  const geometry = blades.merge();
  if (!geometry) return still();
  const spinners = new Spinners(geometry, newPropMaterial(), slots, VENT_FAN_RAD_PER_S);
  const clock = new MotionClock(ctx.profile);
  const root = groupOf(spinners.mesh);
  let smoke: Vapour | null = null;
  const setSmoke = (wanted: boolean): void => {
    if (wanted && !smoke) {
      smoke = new Vapour(items);
      root.add(smoke.points);
    } else if (!wanted && smoke) {
      smoke.dispose();
      smoke = null;
    }
  };
  setSmoke(ctx.profile.ventSmoke);
  return {
    object: root,
    update(dt) {
      if (clock.tick(dt)) spinners.pose(clock.seconds);
      smoke?.update(dt);
    },
    setQuality(profile) {
      clock.running = profile.ambientMotion;
      setSmoke(profile.ventSmoke);
    },
  };
}

function buildSteam(items: readonly PropOf<'steam'>[], ctx: PropContext): PropGroup {
  const root = still();
  if (items.length === 0) return root;
  let steam: Vapour | null = null;
  function setQuality(profile: QualityProfile): void {
    if (profile.ventSmoke && !steam) {
      steam = new Vapour(items);
      root.object.add(steam.points);
    } else if (!profile.ventSmoke && steam) {
      steam.dispose();
      steam = null;
    }
  }
  setQuality(ctx.profile);
  return { object: root.object, update: (dt) => steam?.update(dt), setQuality };
}

const FLAME_RADIAL_SEGMENTS = 5;
const FLAME_RADIUS_RATIO = 0.5;
const FLAME_CORE_RADIUS_RATIO = 0.55;
const FLAME_CORE_HEIGHT_RATIO = 0.62;

function flameLayer(geometry: THREE.BufferGeometry, count: number, opacity: number) {
  const material = new THREE.MeshBasicMaterial({
    opacity, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  return mesh;
}

function createFlames(items: readonly PropOf<'flame'>[]) {
  const geometry = new THREE.ConeGeometry(FLAME_RADIUS_RATIO, 1, FLAME_RADIAL_SEGMENTS, 1, true);
  geometry.translate(0, 0.5, 0);
  const outer = flameLayer(geometry, items.length, 0.72);
  const core = flameLayer(geometry, items.length, 0.9);
  const color = new THREE.Color();
  items.forEach(({ burner }, i) => {
    outer.setColorAt(i, color.setHex(burner ? 0x326aff : 0xff640e));
    core.setColorAt(i, color.setHex(burner ? 0xff9a3a : 0xffdc46));
  });
  const object = groupOf(outer, core);
  const transform = new THREE.Object3D();
  const pose: FlamePose = { height: 1, width: 1, swayRadians: 0 };
  let seconds = 0;

  function update(dt: number): void {
    seconds += dt;
    for (let i = 0; i < items.length; i++) {
      const flame = items[i];
      flamePose(pose, seconds, i);
      const width = flame.size * pose.width;
      const height = flame.size * pose.height;
      transform.position.set(flame.x, flame.y, flame.z);
      transform.rotation.z = pose.swayRadians;
      transform.scale.set(width, height, width);
      transform.updateMatrix();
      outer.setMatrixAt(i, transform.matrix);
      const coreWidth = width * FLAME_CORE_RADIUS_RATIO;
      transform.scale.set(coreWidth, height * FLAME_CORE_HEIGHT_RATIO, coreWidth);
      transform.updateMatrix();
      core.setMatrixAt(i, transform.matrix);
    }
    outer.instanceMatrix.needsUpdate = true;
    core.instanceMatrix.needsUpdate = true;
  }

  update(0);
  return {
    object,
    update,
    dispose() {
      object.removeFromParent();
      outer.dispose();
      core.dispose();
      outer.material.dispose();
      core.material.dispose();
      geometry.dispose();
    },
  };
}

function buildFlames(items: readonly PropOf<'flame'>[], ctx: PropContext): PropGroup {
  const idle = still();
  if (items.length === 0) return idle;
  let flames: ReturnType<typeof createFlames> | null = null;

  function setQuality(profile: QualityProfile): void {
    if (profile.kitchenFire && !flames) {
      flames = createFlames(items);
      idle.object.add(flames.object);
    } else if (!profile.kitchenFire && flames) {
      flames.dispose();
      flames = null;
    }
  }

  setQuality(ctx.profile);
  return {
    object: idle.object,
    update(dt) {
      flames?.update(dt);
    },
    setQuality,
  };
}

const LIFT_FRAME_COLOR = 0x2b2e33;
const LIFT_CAB_COLOR = 0xaab1ba;
/** Side of one tile of the mall floor texture (`tile` in textures.ts). */
const LIFT_TILE_UNITS = 96;
const LIFT_LAMP_ON = 0x6dff7a;
const LIFT_LAMP_OFF = 0x3a3f46;
const LIFT_LAMP_WAIT = 0xff5a4e;
/** Thickness of the shaft's glass walls, where the doorway panes stand (the same as `LIFT_WALL` in the map). */
const LIFT_WALL_UNITS = 6;
/** A fully open pane keeps a sliver, so its scale never reaches zero. */
const MIN_PANE_SCALE = 0.02;

interface Cab {
  readonly group: THREE.Group;
  readonly doors: Record<'front' | 'back', THREE.Mesh[]>;
  readonly lamps: THREE.MeshBasicMaterial[];
}

/**
 * The one cab of every lift shaft, drawn where the server clock puts it (see `liftCab` in `lift.ts`), doors open
 * while it waits at a stop and shut between them. A lamp over each doorway shows whether the cab is standing there.
 * Cheap on every tier: a handful of meshes.
 */
function buildLifts(items: readonly PropOf<'lift'>[], ctx: PropContext): PropGroup {
  if (items.length === 0) return still();
  const root = new THREE.Group();
  const tile = ctx.materialOf('tile');
  const tileMap = tile instanceof THREE.MeshStandardMaterial ? tile.map : null;
  /** The cab floor wears the mall's tile, so riding in does not turn the floor plain grey. One texture copy per shaft sets how often it repeats. */
  const cabFloor = (width: number, depth: number): THREE.Material => {
    if (!tileMap) return new THREE.MeshStandardMaterial({ color: LIFT_CAB_COLOR, roughness: 0.4, metalness: 0.5 });
    const map = tileMap.clone();
    map.repeat.set(width / LIFT_TILE_UNITS, depth / LIFT_TILE_UNITS);
    map.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, roughness: 0.35, metalness: 0 });
  };
  const frameMat = new THREE.MeshStandardMaterial({ color: LIFT_FRAME_COLOR, roughness: 0.6, metalness: 0.3 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0xbfd6e0, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.45, depthWrite: false });
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6df });
  const box = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    return mesh;
  };
  const shafts = items.map((lift) => {
    const place = new THREE.Group();
    place.position.set(lift.x, 0, lift.z);
    place.rotation.y = lift.yaw;
    root.add(place);
    const half = { x: lift.width / 2, z: lift.depth / 2 };
    const floorMat = cabFloor(lift.width, lift.depth);
    ctx.statics.at(lift.x, 0, lift.z, lift.yaw);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) ctx.statics.box(6, lift.height, 6, LIFT_FRAME_COLOR, { x: sx * half.x, y: lift.height / 2, z: sz * half.z });
    }
    const lintels = lift.stops.map((stop) => {
      const lamp = new THREE.MeshBasicMaterial({ color: LIFT_LAMP_OFF });
      const z = (stop.side === 'front' ? -1 : 1) * (half.z + 7);
      const y = stop.y + LIFT_DOOR_HEIGHT_UNITS + 8;
      place.add(box(20, 6, 3, frameMat, 0, y, z));
      place.add(box(14, 3, 3.2, lamp, 0, y, z));
      return lamp;
    });
    /** The doorway of each stop is shut with glass panes that slide apart while the cab waits there, as the doors of the collision do. */
    const stopDoors = lift.stops.map((stop) => {
      const z = (stop.side === 'front' ? -1 : 1) * (half.z + LIFT_WALL_UNITS / 2);
      return [-1, 1].map((side) => {
        const pane = box(half.x + LIFT_WALL_UNITS, LIFT_DOOR_HEIGHT_UNITS, 1.5, doorMat, 0, stop.y + LIFT_DOOR_HEIGHT_UNITS / 2, z);
        place.add(pane);
        return { pane, side };
      });
    });
    const schedule: Lift = { minX: 0, maxX: 0, minZ: 0, maxZ: 0, stops: lift.stops.map((stop) => stop.y), doors: [] };
    const cabs: Cab[] = Array.from({ length: 1 }, () => {
      const group = new THREE.Group();
      group.add(box(lift.width - 4, 3, lift.depth - 4, floorMat, 0, -1, 0));
      for (const [w, d, x, z] of [[lift.width - 4, 3, 0, -half.z + 2], [lift.width - 4, 3, 0, half.z - 2], [3, lift.depth - 4, -half.x + 2, 0], [3, lift.depth - 4, half.x - 2, 0]] as const) {
        group.add(box(w, 3, d, frameMat, x, LIFT_DOOR_HEIGHT_UNITS, z));
      }
      group.add(box(lift.width - 24, 1.5, lift.depth - 24, lightMat, 0, LIFT_DOOR_HEIGHT_UNITS - 0.5, 0));
      const doors: Cab['doors'] = { front: [], back: [] };
      for (const side of ['front', 'back'] as const) {
        for (const sx of [-1, 1]) {
          const door = box(half.x, LIFT_DOOR_HEIGHT_UNITS, 1.5, doorMat, sx * half.x / 2, LIFT_DOOR_HEIGHT_UNITS / 2, (side === 'front' ? -1 : 1) * (half.z - 3));
          group.add(door);
          doors[side].push(door);
        }
      }
      const lamps = lift.stops.map((_, i) => {
        const lamp = new THREE.MeshBasicMaterial({ color: LIFT_LAMP_OFF });
        group.add(box(6, 6, 1.2, lamp, (i - (lift.stops.length - 1) / 2) * 10, LIFT_DOOR_HEIGHT_UNITS - 10, half.z - 4));
        return lamp;
      });
      group.visible = false;
      place.add(group);
      group.position.set(0, 0, 0);
      return { group, doors, lamps };
    });
    return { lift, schedule, cabs, lintels, stopDoors };
  });
  const pose = (serverTick: number): void => {
    for (const { lift, schedule, cabs, lintels, stopDoors } of shafts) {
      const { y } = liftCab(schedule, serverTick);
      /** The collision shuts the doors before the cab leaves, so the drawn doors are open only while the cab is at the stop now and still will be then. */
      const departing = liftCab(schedule, serverTick + LIFT_DOOR_CLOSE_TICKS).y;
      const opening = (stopY: number): number => Math.min(doorOpening(Math.abs(y - stopY)), doorOpening(Math.abs(departing - stopY)));
      stopDoors.forEach((panes, k) => {
        const shut = Math.max(1 - opening(lift.stops[k].y), MIN_PANE_SCALE);
        const paneWidth = lift.width / 2 + LIFT_WALL_UNITS;
        for (const { pane, side } of panes) {
          pane.scale.x = shut;
          pane.position.x = side * (paneWidth - (paneWidth * shut) / 2);
        }
      });
      const standing = new Set<number>();
      cabs.forEach((cab) => {
        cab.group.visible = true;
        cab.group.position.y = y;
        const near = nearestStop(lift.stops, y);
        const open = opening(lift.stops[near.index].y);
        if (open > 0.5) standing.add(near.index);
        for (const side of ['front', 'back'] as const) {
          const mine = lift.stops[near.index].side === side ? open : 0;
          for (const door of cab.doors[side]) door.scale.x = 1 - 0.8 * mine;
        }
        cab.lamps.forEach((lamp, k) => lamp.color.setHex(k === near.index ? LIFT_LAMP_ON : LIFT_LAMP_OFF));
      });
      lintels.forEach((lamp, k) => lamp.color.setHex(standing.has(k) ? LIFT_LAMP_ON : LIFT_LAMP_WAIT));
    }
  };
  pose(0);
  return {
    object: root,
    update(_dt, serverTick) {
      pose(serverTick);
    },
    setQuality() {},
  };
}

function buildSpeakers(speakers: readonly PropOf<'speaker'>[], { statics }: PropContext): PropGroup {
  const cases: Record<StationId, number> = { forja: 0x61503a, escritorio: 0xddd6c8, shopping: 0xe8e9e5, 'shopping-natal': 0xe8e9e5 };
  for (const { x, y, z, yaw, station } of speakers) {
    statics.at(x, y, z, yaw)
      .box(22, 16, 12, cases[station], { x: 0, y: 0, z: 0 })
      .cylinder(6, 6, 1.5, 12, 0x303236, { x: -3, y: 0, z: 6.5, rot: [Math.PI / 2, 0, 0] })
      .cylinder(3, 5, 1, 12, 0x50545a, { x: -3, y: 0, z: 7.5, rot: [Math.PI / 2, 0, 0] });
    if (station !== 'escritorio') statics.box(14, 10, 4, 0x44464a, { x: 0, y: 0, z: -8 });
    if (station === 'forja') statics.box(5, 2, 1, 0xcba564, { x: 6, y: 3, z: 6 });
  }
  return still();
}

/** The ads every screen loops through, in order. Each screen starts at its own place in the loop. */
const SCREEN_ADS: readonly StoreBrand[] = ['mequi', 'zarra', 'kfg', 'cacau-chou', 'amerikanas', 'bobis', 'rener', 'travessura'];
const AD_PIXELS_WIDE = 256;
const AD_PIXELS_HIGH = 128;

/** All the ads stacked in one tall texture, top to bottom, so every screen shares one texture and one draw call. */
function adStrip(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = AD_PIXELS_WIDE;
  canvas.height = AD_PIXELS_HIGH * SCREEN_ADS.length;
  const g = canvas.getContext('2d');
  SCREEN_ADS.forEach((brand, i) => g?.drawImage(signCanvas(brand), 0, i * AD_PIXELS_HIGH, AD_PIXELS_WIDE, AD_PIXELS_HIGH));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Ad screens: one merged mesh over the shared ad strip. Each screen's UVs frame one ad of the strip, a different one per
 * screen, and the strip slides under all of them at once by moving the texture offset, so a slide costs nothing per
 * screen. The slide runs with ambient motion (`QualityProfile.ambientMotion`); without it each screen holds its first ad.
 */
function buildAdScreens(items: readonly PropOf<'adScreen'>[], ctx: PropContext): PropGroup {
  if (items.length === 0) return still();
  const count = SCREEN_ADS.length;
  const planes = items.map((item, i) => {
    const plane = new THREE.PlaneGeometry(item.width, item.height);
    plane.rotateY(Math.PI + item.yaw);
    plane.translate(item.x, item.y, item.z);
    const uv = plane.getAttribute('uv');
    const first = i % count;
    for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (first + 1 - uv.getY(k)) / count);
    return plane;
  });
  const geometry = mergeGeometries(planes);
  for (const plane of planes) plane.dispose();
  if (!geometry) return still();
  const texture = adStrip();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
  const clock = new MotionClock(ctx.profile);
  return {
    object: mesh,
    update(dt) {
      if (clock.tick(dt)) texture.offset.y = -adScroll(clock.seconds) / count;
    },
    setQuality(profile) {
      clock.running = profile.ambientMotion;
    },
  };
}

/** One builder per prop kind: a kind added to `MapProp` without one here fails the typecheck. */
const PROP_BUILDERS: { [K in PropKind]: Builder<K> } = {
  ceilingFan: buildCeilingFans,
  mannequin: buildMannequins,
  staff: buildStaff,
  santa(items, { statics }) {
    for (const item of items) addSanta(statics, item);
    return still();
  },
  clothesRack: buildClothesRacks,
  escalator: buildEscalators,
  fountain: buildFountains,
  vent: buildVents,
  lift: buildLifts,
  flame: buildFlames,
  steam: buildSteam,
  cook: still,
  speaker: buildSpeakers,
  adScreen: buildAdScreens,
};

function isPropKind(kind: string): kind is PropKind {
  return Object.hasOwn(PROP_BUILDERS, kind);
}

function buildKind<K extends PropKind>(kind: K, props: readonly MapProp[], ctx: PropContext): PropGroup {
  const own = props.filter((p): p is PropOf<K> => p.kind === kind);
  return PROP_BUILDERS[kind](own, ctx);
}

export interface PropsView {
  readonly group: THREE.Group;
  update(dt: number, serverTick: number): void;
  setQuality(profile: QualityProfile): void;
}

export function buildProps(props: readonly MapProp[], materialOf: PropContext['materialOf'], profile: QualityProfile): PropsView {
  const statics = new Parts();
  const ctx: PropContext = { statics, materialOf, profile };
  const groups = Object.keys(PROP_BUILDERS).filter(isPropKind).map((kind) => buildKind(kind, props, ctx));
  const group = new THREE.Group();
  const geometry = statics.merge();
  if (geometry) {
    const mesh = new THREE.Mesh(geometry, newPropMaterial());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  for (const g of groups) group.add(g.object);
  return {
    group,
    update(dt, serverTick) {
      for (const g of groups) g.update(dt, serverTick);
    },
    setQuality(next) {
      for (const g of groups) g.setQuality(next);
    },
  };
}
