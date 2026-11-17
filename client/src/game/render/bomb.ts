import { BOMB_SITE_RADIUS_UNITS, FUSE_MS, type FlagBase } from '@calindra-strike/shared';
import * as THREE from 'three';
import { defuseProgress, fuseUrgency, secondsLeft, type BombView } from '../bomb.ts';
import { drawIdleScreen, drawLaptopScreen } from '../laptop/draw.ts';

const SCREEN_WIDTH_PX = 512;
const SCREEN_HEIGHT_PX = 320;
const SCREEN_REFRESH_MS = 100;
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

interface ScreenSurface {
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
}

export interface CarrierPose { x: number; y: number; z: number; yaw: number }

/** The bug: an opened laptop whose screen is a canvas texture, plus a ring marking the plant site. */
export class BombRenderer {
  readonly group = new THREE.Group();
  private readonly laptop = new THREE.Group();
  private readonly screen: ScreenSurface;
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
    const keys = new THREE.Mesh(new THREE.BoxGeometry(BASE_WIDTH_UNITS - 6, 0.3, BASE_DEPTH_UNITS - 9), new THREE.MeshStandardMaterial({ color: '#15171b', roughness: 0.9 }));
    keys.position.set(0, BASE_HEIGHT_UNITS + 0.15, -1.5);

    const lid = new THREE.Group();
    lid.position.set(0, BASE_HEIGHT_UNITS, -BASE_DEPTH_UNITS / 2 + 1);
    lid.rotation.x = -LID_TILT_RAD;
    const shell = new THREE.Mesh(new THREE.BoxGeometry(BASE_WIDTH_UNITS, LID_HEIGHT_UNITS, LID_THICKNESS_UNITS), plastic);
    shell.position.y = LID_HEIGHT_UNITS / 2;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(BASE_WIDTH_UNITS - BEZEL_UNITS * 2, LID_HEIGHT_UNITS - BEZEL_UNITS * 2),
      new THREE.MeshBasicMaterial({ map: texture }),
    );
    face.position.set(0, LID_HEIGHT_UNITS / 2, LID_THICKNESS_UNITS / 2 + 0.05);
    lid.add(shell, face);

    this.light = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), new THREE.MeshBasicMaterial({ color: LIGHT_OFF }));
    this.light.position.set(BASE_WIDTH_UNITS / 2 - 3, BASE_HEIGHT_UNITS + 0.8, BASE_DEPTH_UNITS / 2 - 3);

    this.laptop.add(slab, keys, lid, this.light);
    this.laptop.scale.setScalar(LAPTOP_SCALE);

    this.siteRing = new THREE.Mesh(
      new THREE.RingGeometry(BOMB_SITE_RADIUS_UNITS - SITE_RING_WIDTH_UNITS, BOMB_SITE_RADIUS_UNITS, 64),
      new THREE.MeshBasicMaterial({ color: SITE_COLOR, side: THREE.DoubleSide, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    this.siteRing.rotation.x = -Math.PI / 2;
    this.group.add(this.laptop, this.siteRing);
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

  position(): THREE.Vector3 { return this.laptop.position; }

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
      this.laptop.position.set(holder.x + Math.sin(holder.yaw) * CARRY_BACK_OFFSET_UNITS, holder.y + CARRY_LIFT_UNITS, holder.z + Math.cos(holder.yaw) * CARRY_BACK_OFFSET_UNITS);
      this.laptop.rotation.y = holder.yaw;
      return;
    }
    this.laptop.position.set(bomb.x, bomb.y, bomb.z);
    this.laptop.rotation.y = Math.atan2(camera.x - bomb.x, camera.z - bomb.z);
  }

  private blink(bomb: BombView, now: number, seconds: number): void {
    const urgency = fuseUrgency(bomb, now);
    const period = bomb.state === 'planted' ? FUSE_BLINK_SLOW_MS + (FUSE_BLINK_FAST_MS - FUSE_BLINK_SLOW_MS) * urgency : IDLE_BLINK_PERIOD_MS;
    const on = (seconds * 1000) % period < period * BLINK_ON_RATIO;
    (this.light.material as THREE.MeshBasicMaterial).color.set(on ? LIGHT_ON : LIGHT_OFF);
  }

  private refreshScreen(bomb: BombView, now: number): void {
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
    this.group.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (object.material instanceof THREE.Material) object.material.dispose();
      }
    });
  }
}
