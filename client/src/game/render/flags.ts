import { CTF_RETURN_TICKS, TICK_MS, TEAMS, type FlagBase } from '@calindra-strike/shared';
import * as THREE from 'three';
import type { FlagView } from '../flags.ts';
import { Parts, newPropMaterial } from './prop-parts.ts';

const BASE_RADIUS_UNITS = 55;
const BASE_LIFT_UNITS = 1;
// The avatar's back faces local +Z. Clear the vest and keep the bag above the hips.
const BACK_OFFSET_UNITS = 19;
const HIP_CLEARANCE_UNITS = 2;

function buildBackpack(color: string): THREE.Group {
  const shell = new Parts()
    .prism([[-9, 0], [9, 0], [11, 3], [11, 18], [8, 21], [-8, 21], [-11, 18], [-11, 3]], 12,
      0xffffff, { x: 0, y: 0, z: 0 })
    .box(2, 5, 11, 0xffffff, { x: -9, y: 21, z: 0 })
    .box(2, 5, 11, 0xffffff, { x: 9, y: 21, z: 0 });
  const details = new Parts()
    .box(16, 1, 9, 0x161b24, { x: 0, y: 21, z: 0 }) // Recess behind the raised zipper rails.
    .box(17, 9, 2, 0x19212c, { x: 0, y: 8, z: 6 })
    .box(15, 8, 1.6, 0xadbcca, { x: -0.5, y: 24, z: -3, rot: [-0.16, 0, 0] })
    .box(13, 1, 0.2, 0x344353, { x: -0.5, y: 27, z: -2 })
    .box(5, 6, 1.4, 0x101720, { x: 4, y: 22.5, z: 2, rot: [0, 0, -0.17] })
    .box(3.8, 4.4, 0.2, 0x72bbd0, { x: 4, y: 22.5, z: 2.72, rot: [0, 0, -0.17] })
    .box(4.5, 2.4, 3, 0xe1e9ed, { x: -4, y: 22, z: 3 });
  const leds = new Parts()
    .box(1.2, 11, 0.4, 0xffffff, { x: -9.5, y: 12, z: 6 })
    .box(1.2, 11, 0.4, 0xffffff, { x: 9.5, y: 12, z: 6 })
    .box(8, 0.9, 0.4, 0xffffff, { x: 0, y: 5, z: 7 });

  const backpack = new THREE.Group();
  const parts = [
    { geometry: shell.merge(), material: new THREE.MeshStandardMaterial({ color, roughness: 0.58, metalness: 0.2 }) },
    { geometry: details.merge(), material: newPropMaterial() },
    { geometry: leds.merge(), material: new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.4) }) },
  ];
  for (const { geometry, material } of parts) {
    if (geometry) backpack.add(new THREE.Mesh(geometry, material));
    else material.dispose();
  }
  return backpack;
}

export class FlagsView {
  readonly group = new THREE.Group();
  private readonly items;
  private readonly worldPosition = new THREE.Vector3();

  constructor(bases: readonly FlagBase[]) {
    this.items = bases.map((base, team) => {
      const color = TEAMS[team].color;
      const backpack = buildBackpack(color);
      const marker = new THREE.Mesh(new THREE.RingGeometry(BASE_RADIUS_UNITS - 5, BASE_RADIUS_UNITS, 40), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.7, depthWrite: false }));
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(base.x, base.y + BASE_LIFT_UNITS, base.z);
      const countdown = marker.clone();
      countdown.geometry = marker.geometry.clone();
      countdown.material = marker.material.clone();
      this.group.add(backpack, marker, countdown);
      return { backpack, marker, countdown };
    });
    this.group.visible = false;
  }

  update(flags: readonly FlagView[], now: number, carrierBack: (id: number) => THREE.Object3D | undefined): void {
    this.group.visible = flags.length > 0;
    this.items.forEach((item, team) => {
      const view = flags.find(f => f.team === team);
      const back = view?.state === 'carried' ? carrierBack(view.carrier) : undefined;
      const parent = back ?? this.group;
      if (item.backpack.parent !== parent) parent.add(item.backpack);
      item.backpack.visible = !!view && (view.state !== 'carried' || !!back);
      item.marker.visible = !!view;
      item.countdown.visible = view?.state === 'dropped';
      if (!view) return;
      if (back) item.backpack.position.set(0, HIP_CLEARANCE_UNITS, BACK_OFFSET_UNITS);
      else item.backpack.position.set(view.x, view.y, view.z);
      if (view.state === 'dropped') {
        const remaining = THREE.MathUtils.clamp((view.returnAt - now) / (CTF_RETURN_TICKS * TICK_MS), 0, 1);
        item.countdown.position.set(view.x, view.y + BASE_LIFT_UNITS, view.z);
        item.countdown.scale.setScalar(remaining);
        item.countdown.material.opacity = remaining;
      }
    });
  }

  position(team: number): THREE.Vector3 | undefined {
    return this.items[team]?.backpack.getWorldPosition(this.worldPosition);
  }

  dispose(): void {
    for (const { backpack } of this.items) this.group.add(backpack);
    this.group.removeFromParent();
    this.group.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (object.material instanceof THREE.Material) object.material.dispose();
      }
    });
  }
}
