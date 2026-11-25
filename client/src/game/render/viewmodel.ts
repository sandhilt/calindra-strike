import { STANCE, type Stance, TICK_MS, WEAPON, type WeaponId, reloadCursor, weaponDef } from '@calindra-strike/shared';
import * as THREE from 'three';
import { smoothBlend, stepBlend } from './movement-pose.ts';
import { aimOffset, bobKeep } from './ads-view.ts';
import { DrumView, type DrumRounds } from './drum-view.ts';
import { RESTING_RELOAD_POSE, type ReloadPose, boltCyclePose, reloadPose } from './reload-anim.ts';
import { buildWeapon, poseFeed, type WeaponModel, type WeaponSkin } from './weapons3d.ts';
import { QUALITY, type Quality } from './quality.ts';
import { type GunPlacement, placementFor } from './weapon-placement.ts';
import { BELT_BURST_S, type BeltFlow, stepBeltFlow } from './belt-anim.ts';
import { restingJumpPose, stepJumpPose } from './jump-pose.ts';
import { SwingPlayer } from './hammer-swing.ts';
import { type KickFeel, type KickState, fireKick, kickFeelFor, kickTotal, pistolShotPose, stepKick } from './kick-anim.ts';

/** Sky light on the gun at full day; the day cycle scales it. */
const VIEWMODEL_HEMI_INTENSITY = 1.4;
/** Strength of the studio reflections on the gun at full day, scaled the same way. */
const VIEWMODEL_ENV_INTENSITY = 0.55;
/** Model units the old magazine falls before it leaves the view, and the spare starts below the well. */
const MAG_FALL_UNITS = 12;
/** Roll and pitch of the gun at full tilt while reloading, in radians. */
const RELOAD_ROLL = 0.5;
const RELOAD_PITCH = 0.12;
/** Viewmodel units the gun lowers at full dip, and kick when a magazine or shell seats. */
const RELOAD_DIP_UNITS = 6;
const SEAT_KICK_UNITS = 1.2;
/** Where the spent AWP cartridge goes in weapon units: out to the right of the port, over a short arc, then down. */
const CASING_THROW = { rightUnits: 7, riseUnits: 6, fallUnits: 11, backUnits: 3, spinRad: 9 } as const;
const PISTOL_KICK = { riseUnits: 0.85, backUnits: 3.6, pitchRad: 0.26 };
/** Guns reloaded at a cover and a belt need less roll and dip than a magazine gun, or the action leaves the frame. */
const RELOAD_FRAMING: Partial<Record<WeaponId, { roll: number; dip: number }>> = { [WEAPON.LMG]: { roll: 0.7, dip: 0.35 } };
const EXCHANGE_FRAMING = {
  [WEAPON.PISTOL]: { left: 2.2, up: 3.5, yaw: 0.95, roll: -0.2 },
  [WEAPON.RIFLE]: { left: 0.5, up: 3, yaw: 0.5, roll: 0.3 },
};
const MAGAZINE_GRIP = {
  [WEAPON.PISTOL]: new THREE.Vector3(1.25, -3.9, 2.2),
  [WEAPON.RIFLE]: new THREE.Vector3(-0.4, -7.2, -0.9),
};
const FULL_RELOAD_FRAMING = { roll: 1, dip: 1 } as const;
/** Where the shooting hand's glove sits on the grip, in weapon units. */
const GRIP_HAND = new THREE.Vector3(0.2, -2, 0.6);
/** How far a bolt-action gun is brought toward the centre while its bolt is worked, so the hand on the handle is in view. */
const BOLT_PRESENT = { leftUnits: 3.5, upUnits: 3 } as const;
/** The right shoulder, in hammer units from the fist, out along the forearm: the hammer arm swings about it. */
const HAMMER_SHOULDER = new THREE.Vector3(2.2, -4.3, 5).setLength(36);

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

const SPRINT_FIRE_RECOVERY_SECONDS = 0.15;
/** Sideways push of the held gun at a full lean (view units), on top of the eye moving: the weapon peeks out first. */
const LEAN_GUN_UNITS = 2.6;

export interface ViewPose {
  speed: number;
  stance: Stance;
  sprinting: boolean;
  sliding: boolean;
  firing: boolean;
  onGround: boolean;
  dt: number;
  lookDX: number;
  lookDY: number;
  reloadElapsed: number; // ticks since the reload began, -1 when not reloading
  reloadShells: number; // rounds the reload loads (shotgun), ignored by magazine weapons
  deployFrac: number; // 0..1 while deploying, -1 otherwise
  /** Linear 0..1 blend of the aim down sights (see `stepBlend`); the gun's own easing is applied here. 0 for a weapon with no aim. */
  aim: number;
  hidden: boolean;
  /** -1 (left) to 1 (right): the gun is pushed out to that side, past where the eye goes. */
  lean?: number;
  /** Rounds left in the equipped magazine and what it holds, for the Azeitadora's drum. */
  rounds?: DrumRounds;
}

/** First-person weapon rendered in its own scene on top of the world. */
export class ViewModel {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(58, 1, 0.5, 400);
  private readonly holder = new THREE.Group();
  /** Flips everything the weapon draws about the vertical axis for a left-handed player; the kick and the reload roll sit inside it, so they flip too. */
  private readonly mirror = new THREE.Group();
  private readonly kickGroup = new THREE.Group();
  private side: 1 | -1 = 1;
  private model: WeaponModel | null = null;
  private spareMagazine: THREE.Object3D | null = null;
  private leftHand: THREE.Group | null = null;
  /** The hammer's left hand: it hangs in the view on its own, so the swing of the right arm never drags it along. */
  private looseHand: THREE.Group | null = null;
  private rightHand: THREE.Group | null = null;
  private readonly handRest = new THREE.Vector3();
  private readonly magRest = new THREE.Vector3();
  private magRestPitch = 0;
  private readonly supportTarget = new THREE.Vector3();
  private readonly shellRest = new THREE.Vector3();
  private readonly casingRest = new THREE.Vector3();
  private weaponId: WeaponId | -1 = -1;
  private weaponSkin: WeaponSkin = 'standard';
  private readonly flash: THREE.Sprite;
  private flashT = 0;
  private bobPhase = 0;
  private sprintT = 0;
  private slideT = 0;
  private proneT = 0;
  private fireRecovery = 0;
  private swayX = 0;
  private swayY = 0;
  private readonly kick: KickState = { thump: 0, push: 0 };
  private kickFeel: KickFeel = kickFeelFor(-1);
  private readonly jump = restingJumpPose();
  /** Seconds since the last AWP shot while its bolt is being worked, -1 when idle. */
  private boltCycle = -1;
  private pistolShotSeconds = Infinity;
  private readonly swing = new SwingPlayer();
  /** Holds the hammer and the fist, so the wrist turns them without the forearm. */
  private hammerWrist: THREE.Group | null = null;
  private readonly shoulder = new THREE.Vector3();
  private readonly armTurn = new THREE.Quaternion();
  private readonly armEuler = new THREE.Euler();
  private readonly belt: BeltFlow = { feed: 0, speed: 0, burst: 0 };
  private placementNow: GunPlacement = placementFor(WEAPON.RIFLE);
  /** Where the gun goes at full aim (view units); recomputed when the weapon, its placement or the handedness changes. */
  private aimShift: readonly [number, number, number] = [0, 0, 0];
  private beltLinks: number;
  private readonly baseRot = new THREE.Euler();
  private readonly drumView = new DrumView();
  private rounds: DrumRounds = { mag: 6, capacity: 6 };
  private frameDt = 0;
  private readonly basePos = new THREE.Vector3();
  private readonly sleeve: THREE.MeshStandardMaterial;
  private readonly hemi: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;

  constructor(color: string, quality: Quality) {
    this.beltLinks = QUALITY[quality].fx.beltLinks;
    this.sleeve = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.55), roughness: 0.85 });
    this.hemi = new THREE.HemisphereLight('#ffffff', '#444444', VIEWMODEL_HEMI_INTENSITY);
    this.sun = new THREE.DirectionalLight('#ffffff', 2.2);
    this.sun.position.set(-0.4, 1, 0.3);
    this.scene.add(this.hemi, this.sun, this.camera);
    this.camera.add(this.holder);
    this.holder.add(this.mirror);
    this.mirror.add(this.kickGroup);
    this.flash = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: flashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
    );
    this.flash.visible = false;
  }

  /** Puts the gun and its hands on the left of the view (true) or the right (false). */
  setLeftHanded(on: boolean): void {
    this.side = on ? -1 : 1;
    this.mirror.scale.x = this.side;
    this.updateAimShift();
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

  /** Lights the gun like the world. `hemiScale` is the world's sky light relative to full day, and Colors are copied, so this can run every frame. */
  setLighting(sky: THREE.ColorRepresentation, ground: THREE.ColorRepresentation, sun: THREE.ColorRepresentation, sunIntensity: number, hemiScale = 1): void {
    this.hemi.color.set(sky);
    this.hemi.groundColor.set(ground);
    this.hemi.intensity = VIEWMODEL_HEMI_INTENSITY * hemiScale;
    this.scene.environmentIntensity = VIEWMODEL_ENV_INTENSITY * hemiScale;
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
    this.hammerWrist = null;
    if (id === WEAPON.HAMMER) {
      const wrist = new THREE.Group();
      wrist.add(...g.children);
      g.add(wrist);
      into = wrist;
      add(4.1, 4.6, 4.2, glove, 0, 0, 0);
      into = g;
      add(4, 4, 14, this.sleeve, 2.2, -4.3, 5, 0.3, 0.62);
      this.hammerWrist = wrist;
      this.looseHand = this.freeHand(glove);
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
      const support = new THREE.Group();
      g.add(support);
      into = support;
      this.handRest.set(-2.2, -2.6, 0.4);
      add(4, 4, 4, glove, this.handRest.x, this.handRest.y, this.handRest.z);
      add(4.2, 4.2, 17, this.sleeve, -4.8, -7.4, 7.2, -0.32, 0.6);
      return support;
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

  /** An idle left hand and forearm, in view units, low on the left of the view where nothing reaches it. */
  private freeHand(glove: THREE.Material): THREE.Group {
    const free = new THREE.Group();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const part = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, ry = 0, rx = 0) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.scale.set(w, h, d);
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, ry, 0);
      free.add(mesh);
    };
    part(2.1, 2.2, 2.2, glove, 0, 0, 0);
    part(2, 2, 7, this.sleeve, -1.1, -2.15, 2.5, -0.3, 0.62);
    free.position.set(-8.5, -7.5, -17);
    free.rotation.set(0.2, 0.25, 0.1);
    this.kickGroup.add(free);
    return free;
  }

  setWeapon(id: WeaponId, skin: WeaponSkin = 'standard'): void {
    if (id === this.weaponId && skin === this.weaponSkin) return;
    if (this.model) this.kickGroup.remove(this.model.group);
    if (this.looseHand) this.kickGroup.remove(this.looseHand);
    this.looseHand = null;
    const m = buildWeapon(id, this.beltLinks, skin);
    m.group.traverse((o) => {
      o.castShadow = false;
    });
    this.leftHand = this.arms(m.group, id);
    this.spareMagazine = null;
    if (m.rig.magazine) {
      this.magRest.copy(m.rig.magazine.position);
      this.magRestPitch = m.rig.magazine.rotation.x;
      this.spareMagazine = m.rig.magazine.clone();
      this.spareMagazine.visible = false;
      m.group.add(this.spareMagazine);
    }
    if (m.rig.shell) this.shellRest.copy(m.rig.shell.position);
    if (m.rig.casing) this.casingRest.copy(m.rig.casing.position);
    this.model = m;
    this.weaponId = id;
    this.weaponSkin = skin;
    this.kickFeel = kickFeelFor(id);
    this.swing.stop();
    this.drumView.reset();
    this.boltCycle = -1;
    this.pistolShotSeconds = Infinity;
    this.flashT = 0;
    this.flash.visible = false;
    this.applyPlacement(m.group, placementFor(id));
    m.muzzle.add(this.flash);
    this.kickGroup.add(m.group);
  }

  /** True when the weapon on show has an aim down sights. */
  private aimedWeapon(): boolean {
    return this.weaponId !== -1 && weaponDef(this.weaponId).ads !== undefined;
  }

  private updateAimShift(): void {
    const ads = this.weaponId === -1 ? undefined : weaponDef(this.weaponId).ads;
    this.aimShift = ads && this.weaponId !== -1 ? aimOffset(this.weaponId, this.placementNow, ads.kind, this.side) : [0, 0, 0];
  }

  private applyPlacement(group: THREE.Group, p: GunPlacement): void {
    this.placementNow = p;
    this.updateAimShift();
    group.scale.setScalar(p.scale);
    group.position.set(...p.position);
    group.rotation.set(...p.rotation);
    this.baseRot.copy(group.rotation);
    this.basePos.copy(group.position);
  }

  /** Where the weapon on show sits in the view. */
  placement(): GunPlacement {
    return this.placementNow;
  }

  /** Moves the weapon on show; the next `setWeapon` puts a weapon back at its own placement. Used by the debug viewer. */
  setPlacement(p: GunPlacement): void {
    if (this.model) this.applyPlacement(this.model.group, p);
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
    this.fireRecovery = SPRINT_FIRE_RECOVERY_SECONDS;
    if (this.weaponId === WEAPON.HAMMER) {
      this.swing.start(heavy);
      return;
    }
    if (this.weaponId === WEAPON.SNIPER) this.boltCycle = 0;
    if (this.weaponId === WEAPON.LMG) this.belt.burst = BELT_BURST_S;
    if (this.weaponId === WEAPON.MGL) this.drumView.eject();
    if (this.weaponId === WEAPON.PISTOL) this.pistolShotSeconds = 0;
    else fireKick(this.kick, this.kickFeel);
    this.flashT = 0.045;
    this.flash.visible = true;
    this.flash.material.rotation = Math.random() * Math.PI;
    const s = this.weaponId === WEAPON.SMG || this.weaponId === WEAPON.PISTOL ? 9 : 14;
    this.flash.scale.set(s, s, 1);
  }

  update(p: ViewPose): void {
    const dt = p.dt;
    this.frameDt = dt;
    if (p.rounds) this.rounds = p.rounds;
    this.holder.visible = !p.hidden;
    this.fireRecovery = Math.max(0, this.fireRecovery - dt);
    const aim = this.aimedWeapon() ? smoothBlend(p.aim) : 0;
    const sprinting = p.sprinting && !p.firing && this.fireRecovery === 0 && aim === 0;
    this.sprintT = p.hidden ? 0 : stepBlend(this.sprintT, sprinting, dt);
    this.slideT = stepBlend(this.slideT, p.sliding, dt);
    this.proneT = stepBlend(this.proneT, p.stance === STANCE.PRONE, dt);
    const sprint = smoothBlend(this.sprintT) * (1 - aim);
    const slide = smoothBlend(this.slideT);
    const prone = smoothBlend(this.proneT);

    // bob
    const moving = p.onGround && p.speed > 30;
    if (moving) this.bobPhase += dt * (p.speed / 30 + 7 * sprint);
    const amp = moving ? Math.min(1, p.speed / 250) : 0;
    const steady = bobKeep(aim);
    const bobX = Math.sin(this.bobPhase) * (0.55 * amp + 0.8 * sprint) * steady;
    const bobY = -Math.abs(Math.cos(this.bobPhase)) * (0.5 * amp + 0.9 * sprint) * steady;
    // sway: lags behind mouse motion
    this.swayX += (-p.lookDX * 0.02 * steady - this.swayX) * Math.min(1, dt * 10);
    this.swayY += (p.lookDY * 0.02 * steady - this.swayY) * Math.min(1, dt * 10);
    this.swayX = THREE.MathUtils.clamp(this.swayX, -2.5, 2.5);
    this.swayY = THREE.MathUtils.clamp(this.swayY, -2.5, 2.5);
    // recoil spring
    stepKick(this.kick, this.kickFeel, dt);
    const kick = this.weaponId === WEAPON.PISTOL ? 0 : kickTotal(this.kick);
    stepBeltFlow(this.belt, dt);
    // reload / deploy dips
    const reload = this.currentReloadPose(p);
    this.pistolShotSeconds += dt;
    const pistolShot = pistolShotPose(this.pistolShotSeconds);
    const framing = (this.weaponId === -1 ? undefined : RELOAD_FRAMING[this.weaponId]) ?? FULL_RELOAD_FRAMING;
    let dip = reload.dip * RELOAD_DIP_UNITS * framing.dip;
    if (p.deployFrac >= 0) dip = Math.max(dip, (1 - p.deployFrac) * 14);
    const air = stepJumpPose(this.jump, p.onGround, dt);

    const present = this.model?.rig.boltGrip ? reload.boltHand : 0;
    const exchange = this.weaponId === WEAPON.PISTOL || this.weaponId === WEAPON.RIFLE
      ? EXCHANGE_FRAMING[this.weaponId]
      : null;
    const toEye = this.aimShift;
    this.holder.position.set(
      bobX + this.swayX + (p.lean ?? 0) * LEAN_GUN_UNITS * (1 - aim) - this.side * (3 * sprint + present * BOLT_PRESENT.leftUnits + reload.tilt * (exchange?.left ?? 0)) + toEye[0] * aim,
      bobY - dip - 2.8 * sprint - 2 * slide - 2.5 * prone * (1 - aim) - this.swayY + air + present * BOLT_PRESENT.upUnits + reload.tilt * (exchange?.up ?? 0) + toEye[1] * aim,
      toEye[2] * aim,
    );
    const seat = reload.seatKick * SEAT_KICK_UNITS;
    this.kickGroup.position.set(0, kick * 0.4 + pistolShot.recoil * PISTOL_KICK.riseUnits - seat * 0.5, kick * 2.4 + pistolShot.recoil * PISTOL_KICK.backUnits + seat);
    this.kickGroup.rotation.set(
      kick * 0.09 + pistolShot.recoil * PISTOL_KICK.pitchRad + reload.tilt * RELOAD_PITCH - 0.14 * sprint,
      0.38 * sprint,
      0.3 * sprint - 0.21 * slide - reload.tilt * (exchange?.roll ?? RELOAD_ROLL * framing.roll),
    );

    if (this.model) {
      const g = this.model.group;
      g.rotation.copy(this.baseRot);
      g.rotation.y += reload.tilt * (exchange?.yaw ?? 0);
      g.position.copy(this.basePos);
      if (this.hammerWrist) this.poseHammerSwing(g, this.hammerWrist, dt);
      this.applyReloadPose(reload, pistolShot.slide);
    }

    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.flash.visible = false;
    }
  }

  private poseHammerSwing(g: THREE.Group, wrist: THREE.Group, dt: number): void {
    const pose = this.swing.step(dt);
    this.shoulder.copy(HAMMER_SHOULDER).multiplyScalar(g.scale.x).applyEuler(this.baseRot).add(this.basePos);
    this.armTurn.setFromEuler(this.armEuler.set(...pose.arm));
    g.position.sub(this.shoulder).applyQuaternion(this.armTurn).add(this.shoulder);
    g.quaternion.premultiply(this.armTurn);
    wrist.rotation.set(...pose.wrist);
  }

  private currentReloadPose(p: ViewPose): ReloadPose {
    const weapon = this.weaponId;
    const timing = weapon === -1 ? null : weaponDef(weapon).reloadTiming;
    if (weapon !== -1 && timing && p.reloadElapsed >= 0) {
      this.boltCycle = -1;
      this.pistolShotSeconds = Infinity;
      return reloadPose(reloadCursor(timing, p.reloadElapsed, p.reloadShells), weapon);
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

  /** The spent cartridge leaves the port, rises a little, and falls away on a spin, so it crosses the view beside the receiver. */
  private poseCasing(casing: THREE.Object3D, flight: number): void {
    casing.visible = flight >= 0;
    if (flight < 0) return;
    const c = CASING_THROW;
    casing.position.set(
      this.casingRest.x + c.rightUnits * flight,
      this.casingRest.y + c.riseUnits * flight - c.fallUnits * flight * flight,
      this.casingRest.z + c.backUnits * flight,
    );
    casing.rotation.set(c.spinRad * flight, 0.4 * flight, c.spinRad * 0.5 * flight);
  }

  /** Sets every moving part of the weapon each frame, so nothing stays displaced once the reload ends. */
  private applyReloadPose(pose: ReloadPose, shotSlide: number): void {
    const rig = this.model?.rig;
    if (!rig) return;
    if (rig.magazine) {
      rig.magazine.visible = !pose.magGone;
      rig.magazine.position.copy(this.magRest).addScaledVector(rig.magDown, pose.magDrop * MAG_FALL_UNITS);
      rig.magazine.rotation.x = this.magRestPitch + pose.magPitch;
      rig.magazine.rotation.z = this.weaponId === WEAPON.RIFLE ? 0 : pose.magDrop * 0.7;
    }
    if (rig.magazine && this.spareMagazine) {
      this.spareMagazine.visible = pose.spareVisible;
      this.spareMagazine.rotation.x = this.magRestPitch + pose.sparePitch;
      this.spareMagazine.position.copy(this.magRest).addScaledVector(rig.magDown, pose.spareLift * MAG_FALL_UNITS);
    }
    if (rig.bolt) {
      rig.bolt.position.copy(rig.boltPull).multiplyScalar(Math.max(pose.boltPull, shotSlide));
      rig.bolt.position.y += rig.boltLift * pose.boltLift;
      if (rig.boltGrip) {
        this.rightHand?.position.copy(rig.boltGrip).sub(GRIP_HAND).add(rig.bolt.position).multiplyScalar(pose.boltHand);
      }
    }
    poseFeed(rig, pose, this.belt.feed, MAG_FALL_UNITS);
    if (rig.drum) this.drumView.update(rig.drum, pose, this.rounds, this.frameDt);
    if (rig.casing) this.poseCasing(rig.casing, pose.casing);
    if (rig.shell) {
      rig.shell.visible = pose.shellVisible;
      rig.shell.position.copy(this.shellRest);
      rig.shell.position.y -= pose.shellLift * 6;
    }
    const magazine = pose.spareVisible ? this.spareMagazine : rig.magazine;
    if (this.leftHand && magazine && rig.supportBoltGrip && rig.bolt &&
        (this.weaponId === WEAPON.PISTOL || this.weaponId === WEAPON.RIFLE)) {
      this.supportTarget.copy(MAGAZINE_GRIP[this.weaponId]).applyQuaternion(magazine.quaternion).add(magazine.position);
      this.leftHand.position.copy(rig.supportBoltGrip).add(rig.bolt.position);
      this.supportTarget.lerp(this.leftHand.position, pose.supportBolt);
      this.leftHand.position.copy(this.supportTarget).sub(this.handRest).multiplyScalar(pose.hand);
    } else {
      this.leftHand?.position.copy(rig.handTarget).sub(this.handRest).multiplyScalar(pose.hand);
    }
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
    this.scene.environmentIntensity = VIEWMODEL_ENV_INTENSITY;
  }
}
