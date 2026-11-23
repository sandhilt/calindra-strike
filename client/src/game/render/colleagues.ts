import * as THREE from 'three';
import type { ColleagueView } from '../lunch.ts';
import { Avatar, COLLEAGUE_LOOK } from './avatar.ts';

const COLLEAGUE_COLOR = '#f4f4f0';
/** How fast the drawn colleague catches up with the snapshot position (1/s). */
const FOLLOW_RATE = 12;
/** A jump this big is a new round placing the colleagues at the other base: snap there instead of gliding through walls. */
const TELEPORT_UNITS = 160;

export class ColleaguesView {
  readonly group = new THREE.Group();
  private readonly avatars: Avatar[] = [];

  update(colleagues: readonly ColleagueView[], dt: number): void {
    while (this.avatars.length > colleagues.length) {
      const gone = this.avatars.pop();
      if (!gone) break;
      this.group.remove(gone.root);
      gone.dispose();
    }
    colleagues.forEach((c, i) => {
      let avatar = this.avatars[i];
      if (!avatar || avatar.name !== c.name) {
        if (avatar) {
          this.group.remove(avatar.root);
          avatar.dispose();
        }
        avatar = new Avatar(c.name, COLLEAGUE_COLOR, COLLEAGUE_LOOK);
        avatar.root.position.set(c.x, c.y, c.z);
        avatar.showTag(true);
        this.avatars[i] = avatar;
        this.group.add(avatar.root);
      }
      const root = avatar.root;
      const before = root.position.clone();
      const target = new THREE.Vector3(c.x, c.y, c.z);
      if (before.distanceTo(target) > TELEPORT_UNITS) root.position.copy(target);
      else root.position.lerp(target, Math.min(1, dt * FOLLOW_RATE));
      root.rotation.y = c.yaw;
      const speed = dt > 0 ? before.distanceTo(root.position) / dt : 0;
      avatar.update(dt, { speed, ducked: c.kind === 'seated', dropping: false, onGround: true, pitch: 0, protect: false, reloading: false });
    });
  }

  dispose(): void {
    for (const avatar of this.avatars) avatar.dispose();
    this.avatars.length = 0;
    this.group.clear();
  }
}
