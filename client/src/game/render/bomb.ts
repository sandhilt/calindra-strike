import { BOMB_SITE_RADIUS_UNITS, FUSE_MS, type FlagBase } from '@calindra-strike/shared';
import * as THREE from 'three';
import { defuseProgress, fuseUrgency, secondsLeft, type BombView } from '../bomb.ts';
import { TEX } from './textures.ts';
import { drawLidBadge } from '../laptop/badge.ts';
import { LAPTOP_MODELS, chassisColor, drawIdleScreen, drawLaptopScreen, laptopModelOf } from '../laptop/draw.ts';
import type { LaptopModel } from '../laptop/scenarios.ts';

const SCREEN_WIDTH_PX = 512;
const SCREEN_HEIGHT_PX = 320;
const SCREEN_REFRESH_MS = 100;
const BADGE_WIDTH_PX = 256;
const BADGE_HEIGHT_PX = 96;
const BADGE_WIDTH_UNITS = 14;
const BADGE_HEIGHT_UNITS = BADGE_WIDTH_UNITS * (BADGE_HEIGHT_PX / BADGE_WIDTH_PX);
const BADGE_LIFT_UNITS = 0.05;
const BASE_WIDTH_UNITS = 34;
const BASE_DEPTH_UNITS = 24;
const BASE_HEIGHT_UNITS = 2.4;
const LID_HEIGHT_UNITS = BASE_WIDTH_UNITS * (SCREEN_HEIGHT_PX / SCREEN_WIDTH_PX) + 3;
const LID_THICKNESS_UNITS = 1.6;
const LID_TILT_RAD = 0.28;
const BEZEL_UNITS = 1.5;
const LAPTOP_SCALE = 1.5;
const CARRY_BACK_OFFSET_UNITS = 16;
const CARRY_LIFT_UNITS = 36;
const SITE_RING_WIDTH_UNITS = 6;
const SITE_RING_LIFT_UNITS = 1;
const IDLE_BLINK_PERIOD_MS = 1200;
const FUSE_BLINK_SLOW_MS = 900;
const FUSE_BLINK_FAST_MS = 110;
const BLINK_ON_RATIO = 0.35;
const LIGHT_ON = '#ff2a2a';
const LIGHT_OFF = '#3a0707';
const SITE_COLOR = '#ff5a4e';
const KEY_COLUMNS = 14;
const KEY_ROWS = 5;
const KEY_GAP_UNITS = 0.35;
const KEY_HEIGHT_UNITS = 0.5;
const KEYBOARD_WIDTH_UNITS = BASE_WIDTH_UNITS - 5;
const KEYBOARD_DEPTH_UNITS = 11;
const KEYBOARD_BACK_UNITS = BASE_DEPTH_UNITS / 2 - 2.5; // gap between the hinge and the first key row
const SPACEBAR_COLUMNS = 6;
const TOUCHPAD_WIDTH_UNITS = 11;
const TOUCHPAD_DEPTH_UNITS = 6;
// A desk around 0.43 of the player's height, like a 75 cm desk next to a 175 cm person.
const DESK_TOP_UNITS = 30;
const DESK_WIDTH_UNITS = 84;
const DESK_DEPTH_UNITS = 44;
const DESK_TOP_THICKNESS_UNITS = 2.5;
const DESK_LEG_UNITS = 2.5;
const LAPTOP_DESK_OFFSET_UNITS = -10; // laptop left of centre, leaving room for the mouse
const MOUSEPAD_WIDTH_UNITS = 20;
const MOUSEPAD_DEPTH_UNITS = 16;
const MOUSEPAD_X_UNITS = 28;
const MUG_X_UNITS = 31;
const MUG_Z_UNITS = -13;
const CRATE_SIZE_UNITS = 56;
const CRATE_HEIGHT_UNITS = 28;

/** What the bug rests on: a dev desk once planted, a supply crate at the attackers' base, nothing when held or dropped. */
type Stand = 'desk' | 'crate' | 'none';
const STAND_BY_STATE: Record<BombView['state'], Stand> = {
  planted: 'desk',
  home: 'crate',
  dropped: 'none',
  carried: 'none',
  planting: 'none',
};
const STAND_TOP_UNITS: Record<Stand, number> = { desk: DESK_TOP_UNITS, crate: CRATE_HEIGHT_UNITS, none: 0 };

function keyboard(material: THREE.Material): THREE.InstancedMesh {
  const keyWidth = (KEYBOARD_WIDTH_UNITS - KEY_GAP_UNITS * (KEY_COLUMNS - 1)) / KEY_COLUMNS;
  const keyDepth = (KEYBOARD_DEPTH_UNITS - KEY_GAP_UNITS * (KEY_ROWS - 1)) / KEY_ROWS;
  const regularKeys = (KEY_ROWS - 1) * KEY_COLUMNS + (KEY_COLUMNS - SPACEBAR_COLUMNS + 1);
  const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(1, KEY_HEIGHT_UNITS, 1), material, regularKeys);
  const place = new THREE.Object3D();
  const spaceStart = (KEY_COLUMNS - SPACEBAR_COLUMNS) / 2;
  let index = 0;
  for (let row = 0; row < KEY_ROWS; row++) {
    const z = -KEYBOARD_BACK_UNITS + keyDepth / 2 + row * (keyDepth + KEY_GAP_UNITS);
    for (let column = 0; column < KEY_COLUMNS; column++) {
      const isSpacebar = row === KEY_ROWS - 1 && column >= spaceStart && column < spaceStart + SPACEBAR_COLUMNS;
      if (isSpacebar && column !== spaceStart) continue;
      const span = isSpacebar ? SPACEBAR_COLUMNS : 1;
      const width = keyWidth * span + KEY_GAP_UNITS * (span - 1);
      const left = -KEYBOARD_WIDTH_UNITS / 2 + column * (keyWidth + KEY_GAP_UNITS);
      place.position.set(left + width / 2, BASE_HEIGHT_UNITS + KEY_HEIGHT_UNITS / 2, z);
      place.scale.set(width, 1, keyDepth);
      place.updateMatrix();
      keys.setMatrixAt(index++, place.matrix);
    }
  }
  return keys;
}

function woodTexture(make: () => THREE.CanvasTexture): THREE.CanvasTexture {
  const texture = make();
  texture.repeat.set(1, 1);
  return texture;
}

function desk(): THREE.Group {
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(TEX.desk), roughness: 0.7 });
  const steel = new THREE.MeshStandardMaterial({ color: '#30343b', metalness: 0.6, roughness: 0.4 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(DESK_WIDTH_UNITS, DESK_TOP_THICKNESS_UNITS, DESK_DEPTH_UNITS), wood);
  top.position.y = DESK_TOP_UNITS - DESK_TOP_THICKNESS_UNITS / 2;
  const group = new THREE.Group();
  group.add(top);
  const legHeight = DESK_TOP_UNITS - DESK_TOP_THICKNESS_UNITS;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(DESK_LEG_UNITS, legHeight, DESK_LEG_UNITS), steel);
    leg.position.set(sx * (DESK_WIDTH_UNITS / 2 - DESK_LEG_UNITS), legHeight / 2, sz * (DESK_DEPTH_UNITS / 2 - DESK_LEG_UNITS));
    group.add(leg);
  }
  const pad = new THREE.Mesh(new THREE.BoxGeometry(MOUSEPAD_WIDTH_UNITS, 0.3, MOUSEPAD_DEPTH_UNITS), new THREE.MeshStandardMaterial({ color: '#141821', roughness: 1 }));
  pad.position.set(MOUSEPAD_X_UNITS, DESK_TOP_UNITS + 0.15, 4);
  const mouse = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), new THREE.MeshStandardMaterial({ color: '#d9dde3', roughness: 0.35 }));
  mouse.scale.set(2.2, 1.1, 3.4);
  mouse.position.set(MOUSEPAD_X_UNITS + 2, DESK_TOP_UNITS + 0.9, 5);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.1, 6, 16), new THREE.MeshStandardMaterial({ color: '#9de82b', roughness: 0.5 }));
  mug.position.set(MUG_X_UNITS, DESK_TOP_UNITS + 3, MUG_Z_UNITS);
  group.add(pad, mouse, mug);
  return group;
}

function crate(): THREE.Mesh {
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(CRATE_SIZE_UNITS, CRATE_HEIGHT_UNITS, CRATE_SIZE_UNITS),
    new THREE.MeshStandardMaterial({ map: woodTexture(TEX.crate), roughness: 0.85 }),
  );
  box.position.y = CRATE_HEIGHT_UNITS / 2;
  return box;
}

function badgeTexture(model: LaptopModel): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = BADGE_WIDTH_PX;
  canvas.height = BADGE_HEIGHT_PX;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  drawLidBadge(ctx, BADGE_WIDTH_PX, BADGE_HEIGHT_PX, model);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface ScreenSurface {
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
}

export interface CarrierPose { x: number; y: number; z: number; yaw: number }

/** The bug: an opened laptop whose screen is a canvas texture, the desk or crate it rests on, plus a ring marking the plant site. */
export class BombRenderer {
  readonly group = new THREE.Group();
  private readonly station = new THREE.Group();
  private readonly laptop = new THREE.Group();
  private readonly stands: Record<Exclude<Stand, 'none'>, THREE.Object3D>;
  private placedAt = '';
  private readonly screen: ScreenSurface;
  private readonly lidMaterial: THREE.MeshStandardMaterial;
  private readonly badgeMaterial: THREE.MeshBasicMaterial;
  private readonly badgeTextures: ReadonlyMap<LaptopModel, THREE.CanvasTexture>;
  private modelShown: LaptopModel | undefined;
  private readonly light: THREE.Mesh;
  private readonly siteRing: THREE.Mesh;
  private readonly bases: readonly FlagBase[];
  private nextScreenAt = 0;
  private siteOf = -1;

  constructor(bases: readonly FlagBase[]) {
    this.bases = bases;
    const canvas = document.createElement('canvas');
    canvas.width = SCREEN_WIDTH_PX;
    canvas.height = SCREEN_HEIGHT_PX;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.screen = { ctx, texture };

    const plastic = new THREE.MeshStandardMaterial({ color: '#2b2f36', metalness: 0.5, roughness: 0.45 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(BASE_WIDTH_UNITS, BASE_HEIGHT_UNITS, BASE_DEPTH_UNITS), plastic);
    slab.position.y = BASE_HEIGHT_UNITS / 2;
    const keys = keyboard(new THREE.MeshStandardMaterial({ color: '#15171b', roughness: 0.9 }));
    const touchpad = new THREE.Mesh(new THREE.BoxGeometry(TOUCHPAD_WIDTH_UNITS, 0.1, TOUCHPAD_DEPTH_UNITS), new THREE.MeshStandardMaterial({ color: '#3a3f47', metalness: 0.3, roughness: 0.6 }));
    touchpad.position.set(0, BASE_HEIGHT_UNITS + 0.05, BASE_DEPTH_UNITS / 2 - TOUCHPAD_DEPTH_UNITS / 2 - 1);

    const lid = new THREE.Group();
    lid.position.set(0, BASE_HEIGHT_UNITS, -BASE_DEPTH_UNITS / 2 + 1);
    lid.rotation.x = -LID_TILT_RAD;
    this.lidMaterial = plastic.clone();
    const shell = new THREE.Mesh(new THREE.BoxGeometry(BASE_WIDTH_UNITS, LID_HEIGHT_UNITS, LID_THICKNESS_UNITS), this.lidMaterial);
    shell.position.y = LID_HEIGHT_UNITS / 2;
    this.badgeTextures = new Map(LAPTOP_MODELS.map((model) => [model, badgeTexture(model)]));
    this.badgeMaterial = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    const badge = new THREE.Mesh(new THREE.PlaneGeometry(BADGE_WIDTH_UNITS, BADGE_HEIGHT_UNITS), this.badgeMaterial);
    badge.rotation.y = Math.PI;
    badge.position.set(0, LID_HEIGHT_UNITS / 2, -(LID_THICKNESS_UNITS / 2 + BADGE_LIFT_UNITS));
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(BASE_WIDTH_UNITS - BEZEL_UNITS * 2, LID_HEIGHT_UNITS - BEZEL_UNITS * 2),
      new THREE.MeshBasicMaterial({ map: texture }),
    );
    face.position.set(0, LID_HEIGHT_UNITS / 2, LID_THICKNESS_UNITS / 2 + 0.05);
    lid.add(shell, face, badge);

    this.light = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), new THREE.MeshBasicMaterial({ color: LIGHT_OFF }));
    this.light.position.set(BASE_WIDTH_UNITS / 2 - 3, BASE_HEIGHT_UNITS + 0.8, BASE_DEPTH_UNITS / 2 - 3);

    this.laptop.add(slab, keys, touchpad, lid, this.light);
    this.laptop.scale.setScalar(LAPTOP_SCALE);
    this.stands = { desk: desk(), crate: crate() };
    this.station.add(this.laptop, this.stands.desk, this.stands.crate);

    this.siteRing = new THREE.Mesh(
      new THREE.RingGeometry(BOMB_SITE_RADIUS_UNITS - SITE_RING_WIDTH_UNITS, BOMB_SITE_RADIUS_UNITS, 64),
      new THREE.MeshBasicMaterial({ color: SITE_COLOR, side: THREE.DoubleSide, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    this.siteRing.rotation.x = -Math.PI / 2;
    this.group.add(this.station, this.siteRing);
    this.group.visible = false;
  }

  update(bomb: BombView | null, now: number, seconds: number, camera: THREE.Vector3, carrier: (id: number) => CarrierPose | undefined): void {
    this.group.visible = bomb !== null;
    if (!bomb) return;
    this.placeSite(bomb);
    this.placeLaptop(bomb, camera, carrier);
    this.blink(bomb, now, seconds);
    this.refreshScreen(bomb, now);
  }

  position(): THREE.Vector3 { return this.station.position; }

  private placeSite(bomb: BombView): void {
    const site = this.bases[1 - bomb.attackers];
    if (!site) return;
    if (this.siteOf !== bomb.attackers) {
      this.siteOf = bomb.attackers;
      this.siteRing.position.set(site.x, site.y + SITE_RING_LIFT_UNITS, site.z);
    }
  }

  private placeLaptop(bomb: BombView, camera: THREE.Vector3, carrier: (id: number) => CarrierPose | undefined): void {
    const holder = bomb.state === 'carried' || bomb.state === 'planting' ? carrier(bomb.carrier) : undefined;
    if (holder) {
      this.showStand('none');
      this.placedAt = '';
      this.station.position.set(holder.x + Math.sin(holder.yaw) * CARRY_BACK_OFFSET_UNITS, holder.y + CARRY_LIFT_UNITS, holder.z + Math.cos(holder.yaw) * CARRY_BACK_OFFSET_UNITS);
      this.station.rotation.y = holder.yaw;
      return;
    }
    const stand = STAND_BY_STATE[bomb.state];
    this.showStand(stand);
    this.station.position.set(bomb.x, bomb.y, bomb.z);
    // Face whoever is looking when the bug lands, then stay put so the desk does not spin as players walk around it.
    const placement = `${bomb.state}:${bomb.x}:${bomb.z}`;
    if (placement === this.placedAt) return;
    this.placedAt = placement;
    this.station.rotation.y = Math.atan2(camera.x - bomb.x, camera.z - bomb.z);
  }

  private showStand(stand: Stand): void {
    this.stands.desk.visible = stand === 'desk';
    this.stands.crate.visible = stand === 'crate';
    this.laptop.position.set(stand === 'desk' ? LAPTOP_DESK_OFFSET_UNITS : 0, STAND_TOP_UNITS[stand], 0);
  }

  private blink(bomb: BombView, now: number, seconds: number): void {
    const urgency = fuseUrgency(bomb, now);
    const period = bomb.state === 'planted' ? FUSE_BLINK_SLOW_MS + (FUSE_BLINK_FAST_MS - FUSE_BLINK_SLOW_MS) * urgency : IDLE_BLINK_PERIOD_MS;
    const on = (seconds * 1000) % period < period * BLINK_ON_RATIO;
    (this.light.material as THREE.MeshBasicMaterial).color.set(on ? LIGHT_ON : LIGHT_OFF);
  }

  private showModel(variant: number): void {
    const model = laptopModelOf(variant);
    if (model === this.modelShown) return;
    this.modelShown = model;
    this.lidMaterial.color.set(chassisColor(model));
    this.badgeMaterial.map = this.badgeTextures.get(model) ?? null;
    this.badgeMaterial.needsUpdate = true;
  }

  private refreshScreen(bomb: BombView, now: number): void {
    this.showModel(bomb.variant);
    if (now < this.nextScreenAt) return;
    this.nextScreenAt = now + SCREEN_REFRESH_MS;
    const { ctx, texture } = this.screen;
    if (bomb.state === 'planted' && bomb.defuser >= 0) drawLaptopScreen(ctx, SCREEN_WIDTH_PX, SCREEN_HEIGHT_PX, bomb.variant, defuseProgress(bomb, now), now);
    else drawIdleScreen(ctx, SCREEN_WIDTH_PX, SCREEN_HEIGHT_PX, bomb.variant, bomb.state === 'planted' ? secondsLeft(bomb, now) : FUSE_MS / 1000, now);
    texture.needsUpdate = true;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.screen.texture.dispose();
    for (const texture of this.badgeTextures.values()) texture.dispose();
    this.group.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (object.material instanceof THREE.Material) object.material.dispose();
      }
    });
  }
}
