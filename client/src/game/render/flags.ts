import { CTF_RETURN_TICKS, TICK_MS, TEAMS, type FlagBase } from '@calindra-strike/shared';
import * as THREE from 'three';
import type { FlagView } from '../flags.ts';

const POLE_HEIGHT_UNITS = 95;
const CLOTH_WIDTH_UNITS = 48;
const CLOTH_HEIGHT_UNITS = 30;
const BACK_OFFSET_UNITS = 22;
const WAVE_AMPLITUDE_UNITS = 5;
const WAVE_SPEED = 5;
const BASE_RADIUS_UNITS = 55;
const BASE_LIFT_UNITS = 1;

export class FlagsView {
  readonly group = new THREE.Group();
  private readonly items;

  constructor(bases: readonly FlagBase[]) {
    this.items = bases.map((base, team) => {
      const color = TEAMS[team].color;
      const flag = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, POLE_HEIGHT_UNITS, 8), new THREE.MeshStandardMaterial({ color: '#dddddd' }));
      pole.position.y = POLE_HEIGHT_UNITS / 2;
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(CLOTH_WIDTH_UNITS, CLOTH_HEIGHT_UNITS, 12, 4), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      cloth.position.set(CLOTH_WIDTH_UNITS / 2, POLE_HEIGHT_UNITS - CLOTH_HEIGHT_UNITS / 2, 0);
      flag.add(pole, cloth);
      const marker = new THREE.Mesh(new THREE.RingGeometry(BASE_RADIUS_UNITS - 5, BASE_RADIUS_UNITS, 40), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.7, depthWrite: false }));
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(base.x, base.y + BASE_LIFT_UNITS, base.z);
      const countdown = marker.clone();
      countdown.geometry = marker.geometry.clone();
      countdown.material = marker.material.clone();
      this.group.add(flag, marker, countdown);
      return { flag, cloth, marker, countdown };
    });
    this.group.visible = false;
  }

  update(flags: readonly FlagView[], now: number, seconds: number, carrier: (id: number) => { x: number; y: number; z: number; yaw: number } | undefined): void {
    this.group.visible = flags.length > 0;
    this.items.forEach((item, team) => {
      const view = flags.find(f => f.team === team);
      item.flag.visible = !!view;
      item.marker.visible = !!view;
      item.countdown.visible = view?.state === 'dropped';
      if (!view) return;
      item.flag.position.set(view.x, view.y, view.z);
      item.flag.rotation.y = 0;
      if (view.state === 'carried') {
        const at = carrier(view.carrier);
        if (at) {
          item.flag.position.set(at.x + Math.sin(at.yaw) * BACK_OFFSET_UNITS, at.y, at.z + Math.cos(at.yaw) * BACK_OFFSET_UNITS);
          item.flag.rotation.y = at.yaw;
        }
      }
      if (view.state === 'dropped') {
        const remaining = THREE.MathUtils.clamp((view.returnAt - now) / (CTF_RETURN_TICKS * TICK_MS), 0, 1);
        item.countdown.position.set(view.x, view.y + BASE_LIFT_UNITS, view.z);
        item.countdown.scale.setScalar(remaining);
        item.countdown.material.opacity = remaining;
      }
      const positions = item.cloth.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const along = (positions.getX(i) + CLOTH_WIDTH_UNITS / 2) / CLOTH_WIDTH_UNITS;
        positions.setZ(i, Math.sin(along * Math.PI * 2 - seconds * WAVE_SPEED) * WAVE_AMPLITUDE_UNITS * along);
      }
      positions.needsUpdate = true;
    });
  }

  position(team: number): THREE.Vector3 | undefined { return this.items[team]?.flag.position; }

  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (object.material instanceof THREE.Material) object.material.dispose();
      }
    });
  }
}
