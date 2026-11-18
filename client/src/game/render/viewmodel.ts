import { TICK_MS, WEAPON, type WeaponId, reloadCursor, weaponDef } from '@calindra-strike/shared';
import * as THREE from 'three';
import { RESTING_RELOAD_POSE, type ReloadPose, boltCyclePose, reloadPose } from './reload-anim.ts';
import { buildWeapon, poseFeed, type WeaponModel } from './weapons3d.ts';
import { QUALITY, type Quality } from './quality.ts';
import { restingJumpPose, stepJumpPose } from './jump-pose.ts';

/** Model units the old magazine falls before it leaves the view, and the spare starts below the well. */
const MAG_FALL_UNITS = 12;
/** Roll and pitch of the gun at full tilt while reloading, in radians. */
const RELOAD_ROLL = 0.5;
const RELOAD_PITCH = 0.12;
/** Viewmodel units the gun lowers at full dip, and kick when a magazine or shell seats. */
const RELOAD_DIP_UNITS = 6;
const SEAT_KICK_UNITS = 1.2;
/** How fast the drawn belt closes on the fed rounds, per second. */
const BELT_GLIDE_PER_S = 25;
/** Where the shooting hand's glove sits on the grip, in weapon units. */
const GRIP_HAND = new THREE.Vector3(0.2, -2, 0.6);
/** How far a bolt-action gun is brought toward the centre while its bolt is worked, so the hand on the handle is in view. */
const BOLT_PRESENT = { leftUnits: 3.5, upUnits: 3 } as const;

export function flashTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.translate(64, 64);
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, 60);
  grd.addColorStop(0, 'rgba(255,255,240,1)');
  grd.addColorStop(0.25, 'rgba(255,220,120,0.9)');
  grd.addColorStop(0.6, 'rgba(255,140,40,0.35)');
  grd.addColorStop(1, 'rgba(255,100,0,0)');
  g.fillStyle = grd;
  for (let i = 0; i < 6; i++) {
    g.rotate(Math.PI / 3);
    g.beginPath();
    g.moveTo(-7, 0);
    g.lineTo(0, -62);
    g.lineTo(7, 0);
    g.fill();
  }
  g.beginPath();
  g.arc(0, 0, 26, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface ViewPose {
  speed: number;
  onGround: boolean;
  dt: number;
  lookDX: number;
  lookDY: number;
  reloadElapsed: number; // ticks since the reload began, -1 when not reloading
  reloadShells: number; // rounds the reload loads (shotgun), ignored by magazine weapons
  deployFrac: number; // 0..1 while deploying, -1 otherwise
  hidden: boolean;
}

/** First-person weapon rendered in its own scene on top of the world. */
export class ViewModel {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(58, 1, 0.5, 400);
  private readonly holder = new THREE.Group();
  private readonly kickGroup = new THREE.Group();
  private model: WeaponModel | null = null;
  private spareMagazine: THREE.Object3D | null = null;
  private leftHand: THREE.Group | null = null;
  private rightHand: THREE.Group | null = null;
  private readonly handRest = new THREE.Vector3();
  private readonly magRest = new THREE.Vector3();
  private readonly shellRest = new THREE.Vector3();
  private weaponId: WeaponId | -1 = -1;
  private readonly flash: THREE.Sprite;
  private flashT = 0;
  private bobPhase = 0;
  private swayX = 0;
  private swayY = 0;
  private kick = 0;
  private readonly jump = restingJumpPose();
  /** Seconds since the last AWP shot while its bolt is being worked, -1 when idle. */
  private boltCycle = -1;
  private swing = 0;
  private swingHeavy = false;
  /** Rounds the machine gun's belt has fed (what the gun has shot) and the eased amount drawn; only the fraction shows. */
  private beltTarget = 0;
  private beltFeed = 0;
  private beltLinks: number;
  private readonly baseRot = new THREE.Euler();
  private readonly basePos = new THREE.Vector3();
  private readonly sleeve: THREE.MeshStandardMaterial;
  private readonly hemi: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;

  constructor(color: string, quality: Quality) {
    this.beltLinks = QUALITY[quality].fx.beltLinks;
    this.sleeve = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.55), roughness: 0.85 });
    this.hemi = new THREE.HemisphereLight('#ffffff', '#444444', 1.4);
    this.sun = new THREE.DirectionalLight('#ffffff', 2.2);
    this.sun.position.set(-0.4, 1, 0.3);
    this.scene.add(this.hemi, this.sun, this.camera);
    this.camera.add(this.holder);
    this.holder.add(this.kickGroup);
    this.flash = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: flashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
    );
    this.flash.visible = false;
  }

  /** Sleeves follow the player's identity colour (team colour in TDM). */
  setSleeveColor(color: string): void {
    this.sleeve.color.set(color).multiplyScalar(0.55);
  }

  /** A tier with another belt length rebuilds the machine gun the next time it is set. */
  setQuality(quality: Quality): void {
    const links = QUALITY[quality].fx.beltLinks;
    if (links === this.beltLinks) return;
    this.beltLinks = links;
    if (this.weaponId === WEAPON.LMG) this.weaponId = -1;
  }

  setLighting(sky: string, ground: string, sun: string, sunIntensity: number): void {
    this.hemi.color.set(sky);
    this.hemi.groundColor.set(ground);
    this.sun.color.set(sun);
    this.sun.intensity = Math.min(2.6, sunIntensity * 0.8);
  }

  /** Adds the hands to the weapon; returns the supporting hand when it can move on its own. */
  private arms(g: THREE.Group, id: WeaponId): THREE.Group | null {
    const glove = new THREE.MeshStandardMaterial({ color: '#1c1c1b', roughness: 0.9 });
    const geo = new THREE.BoxGeometry(1, 1, 1);
    let into: THREE.Group = g;
    const add = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, ry = 0, rx = 0) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.scale.set(w, h, d);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, 0);
      into.add(mesh);
    };
    this.rightHand = null;
    if (id === WEAPON.HAMMER) {
      // Closed fist around the vertical shaft, wrist attached for the entire swing.
      add(4.1, 4.6, 4.2, glove, 0, 0, 0);
      add(4, 4, 14, this.sleeve, 2.2, -4.3, 5, 0.3, 0.62);
      return null;
    }
    // right hand on the grip; forearm leaves the screen toward the bottom-right
    const shooting = new THREE.Group();
    g.add(shooting);
    into = shooting;
    add(4.2, 4.2, 4.2, glove, GRIP_HAND.x, GRIP_HAND.y, GRIP_HAND.z);
    add(4.4, 4.4, 17, this.sleeve, 2.6, -7, 7.5, 0.3, 0.62);
    this.rightHand = shooting;
    into = g;
    if (id === WEAPON.PISTOL) {
      add(4, 4, 4, glove, -2.2, -2.6, 0.4);
      add(4.2, 4.2, 17, this.sleeve, -4.8, -7.4, 7.2, -0.32, 0.6);
      return null;
    }
    // left hand under the handguard; forearm goes down-left and back toward the camera
    const z = id === WEAPON.SMG ? -9 : id === WEAPON.SHOTGUN ? -17 : -16;
    const support = new THREE.Group();
    g.add(support);
    into = support;
    add(4, 3.6, 4.6, glove, -0.4, -1.4, z);
    add(4.2, 4.2, 19, this.sleeve, -3.6, -8.2, z + 6.4, -0.3, 0.84);
    this.handRest.set(-0.4, -1.4, z);
    return support;
  }

  setWeapon(id: WeaponId): void {
    if (id === this.weaponId) return;
    if (this.model) this.kickGroup.remove(this.model.group);
    const m = buildWeapon(id, this.beltLinks);
    m.group.traverse((o) => {
      o.castShadow = false;
    });
    this.leftHand = this.arms(m.group, id);
    this.spareMagazine = null;
    if (m.rig.magazine) {
      this.magRest.copy(m.rig.magazine.position);
      this.spareMagazine = m.rig.magazine.clone();
      this.spareMagazine.visible = false;
      m.group.add(this.spareMagazine);
    }
    if (m.rig.shell) this.shellRest.copy(m.rig.shell.position);
    this.model = m;
    this.weaponId = id;
    this.swing = 0;
    this.boltCycle = -1;
    this.flashT = 0;
    this.flash.visible = false;
    m.group.scale.setScalar(0.62);
    if (id === WEAPON.HAMMER) {
      m.group.scale.setScalar(0.5);
      m.group.position.set(7.5, -5.5, -19.5);
      m.group.rotation.set(0.12, -0.3, 0.25);
    } else if (id === WEAPON.PISTOL) {
      m.group.position.set(5.2, -5.6, -15);
      m.group.rotation.set(0, 0.05, 0);
    } else {
      m.group.position.set(6, -6.4, -13);
      m.group.rotation.set(0, 0.045, 0);
    }
    this.baseRot.copy(m.group.rotation);
    this.basePos.copy(m.group.position);
    m.muzzle.add(this.flash);
    this.kickGroup.add(m.group);
  }

  muzzleWorld(out: THREE.Vector3): THREE.Vector3 {
    if (!this.model) return out.set(0, 0, 0);
    return this.model.muzzle.getWorldPosition(out);
  }

  /** Magazine position in this viewmodel's own scene, or false when the weapon has none. */
  magazineWorld(out: THREE.Vector3): boolean {
    const magazine = this.model?.rig.magazine;
    if (!magazine) return false;
    magazine.getWorldPosition(out);
    return true;
  }

  fire(heavy: boolean): void {
    if (this.weaponId === WEAPON.HAMMER) {
      this.swing = 1;
      this.swingHeavy = heavy;
      return;
    }
    if (this.weaponId === WEAPON.SNIPER) this.boltCycle = 0;
    if (this.weaponId === WEAPON.LMG) this.beltTarget += 1;
    const k = this.weaponId === WEAPON.SNIPER || this.weaponId === WEAPON.SHOTGUN ? 1.6 : this.weaponId === WEAPON.PISTOL ? 1.1 : 0.7;
    this.kick = Math.min(1.8, this.kick + k);
    this.flashT = 0.045;
    this.flash.visible = true;
    this.flash.material.rotation = Math.random() * Math.PI;
    const s = this.weaponId === WEAPON.SMG || this.weaponId === WEAPON.PISTOL ? 9 : 14;
    this.flash.scale.set(s, s, 1);
  }

  update(p: ViewPose): void {
    const dt = p.dt;
    this.holder.visible = !p.hidden;
    // bob
    const moving = p.onGround && p.speed > 30;
    if (moving) this.bobPhase += dt * (p.speed / 30);
    const amp = moving ? Math.min(1, p.speed / 250) : 0;
    const bobX = Math.sin(this.bobPhase) * 0.55 * amp;
    const bobY = -Math.abs(Math.cos(this.bobPhase)) * 0.5 * amp;
    // sway: lags behind mouse motion
    this.swayX += (-p.lookDX * 0.02 - this.swayX) * Math.min(1, dt * 10);
    this.swayY += (p.lookDY * 0.02 - this.swayY) * Math.min(1, dt * 10);
    this.swayX = THREE.MathUtils.clamp(this.swayX, -2.5, 2.5);
    this.swayY = THREE.MathUtils.clamp(this.swayY, -2.5, 2.5);
    // recoil spring
    this.kick = Math.max(0, this.kick - dt * 7);
    this.feedBelt(dt);
    // reload / deploy dips
    const reload = this.currentReloadPose(p);
    let dip = reload.dip * RELOAD_DIP_UNITS;
    if (p.deployFrac >= 0) dip = Math.max(dip, (1 - p.deployFrac) * 14);
    const air = stepJumpPose(this.jump, p.onGround, dt);

    const present = this.model?.rig.boltGrip ? reload.boltHand : 0;
    this.holder.position.set(
      bobX + this.swayX - present * BOLT_PRESENT.leftUnits,
      bobY - dip - this.swayY + air + present * BOLT_PRESENT.upUnits,
      0,
    );
    this.kickGroup.position.set(0, this.kick * 0.4 - reload.seatKick * SEAT_KICK_UNITS * 0.5, this.kick * 2.4 + reload.seatKick * SEAT_KICK_UNITS);
    this.kickGroup.rotation.set(this.kick * 0.09 + reload.tilt * RELOAD_PITCH, 0, -reload.tilt * RELOAD_ROLL);

    if (this.model) {
      // hammer swing pivots around the grip: head comes down across the centre of the view
      const g = this.model.group;
      g.rotation.copy(this.baseRot);
      g.position.copy(this.basePos);
      if (this.swing > 0) {
        this.swing = Math.max(0, this.swing - dt * (this.swingHeavy ? 2.4 : 4));
        const t = 1 - this.swing;
        const s = Math.sin(t * Math.PI);
        const wind = this.swingHeavy ? 1.9 : 1.55;
        g.rotation.x -= s * wind;
        g.rotation.y += s * 0.55;
        g.rotation.z += s * 0.35;
        g.position.x -= s * 3.5;
        g.position.y -= s * 0.5;
        g.position.z -= s * 2;
      }
      this.applyReloadPose(reload);
    }

    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.flash.visible = false;
    }
  }

  /** The belt catches up with the shots in a quick glide, so twelve rounds a second read as a moving belt and not a flicker. */
  private feedBelt(dt: number): void {
    this.beltFeed += (this.beltTarget - this.beltFeed) * Math.min(1, dt * BELT_GLIDE_PER_S);
    const whole = Math.floor(this.beltFeed);
    this.beltFeed -= whole;
    this.beltTarget -= whole;
  }

  private currentReloadPose(p: ViewPose): ReloadPose {
    const timing = this.weaponId === -1 ? null : weaponDef(this.weaponId).reloadTiming;
    if (timing && p.reloadElapsed >= 0) {
      this.boltCycle = -1;
      return reloadPose(reloadCursor(timing, p.reloadElapsed, p.reloadShells));
    }
    return this.boltCyclePose(p.dt);
  }

  /** CS 1.6 AWP: after each shot the bolt is worked on screen for as long as the gun cannot fire again. */
  private boltCyclePose(dt: number): ReloadPose {
    if (this.boltCycle < 0) return RESTING_RELOAD_POSE;
    this.boltCycle += dt;
    const pose = boltCyclePose(this.boltCycle / (weaponDef(WEAPON.SNIPER).fireTicks * TICK_MS / 1000));
    if (!pose) this.boltCycle = -1;
    return pose ?? RESTING_RELOAD_POSE;
  }

  /** Sets every moving part of the weapon each frame, so nothing stays displaced once the reload ends. */
  private applyReloadPose(pose: ReloadPose): void {
    const rig = this.model?.rig;
    if (!rig) return;
    if (rig.magazine) {
      rig.magazine.visible = !pose.magGone;
      rig.magazine.position.copy(this.magRest).addScaledVector(rig.magDown, pose.magDrop * MAG_FALL_UNITS);
      rig.magazine.rotation.z = pose.magDrop * 0.7;
    }
    if (rig.magazine && this.spareMagazine) {
      this.spareMagazine.visible = pose.spareVisible;
      this.spareMagazine.position.copy(this.magRest).addScaledVector(rig.magDown, pose.spareLift * MAG_FALL_UNITS);
    }
    if (rig.bolt) {
      rig.bolt.position.copy(rig.boltPull).multiplyScalar(pose.boltPull);
      rig.bolt.position.y += rig.boltLift * pose.boltLift;
      if (rig.boltGrip) {
        this.rightHand?.position.copy(rig.boltGrip).sub(GRIP_HAND).add(rig.bolt.position).multiplyScalar(pose.boltHand);
      }
    }
    poseFeed(rig, pose, this.beltFeed, MAG_FALL_UNITS);
    if (rig.shell) {
      rig.shell.visible = pose.shellVisible;
      rig.shell.position.copy(this.shellRest);
      rig.shell.position.y -= pose.shellLift * 6;
    }
    this.leftHand?.position.copy(rig.handTarget).sub(this.handRest).multiplyScalar(pose.hand);
    if (rig.shell && rig.bolt) this.leftHand?.position.addScaledVector(rig.boltPull, pose.boltPull);
  }

  render(renderer: THREE.WebGLRenderer): void {
    const auto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = auto;
  }

  /** Soft studio reflections so metal parts don't render black. */
  setEnvironment(env: THREE.Texture): void {
    this.scene.environment = env;
    this.scene.environmentIntensity = 0.55;
  }
}
