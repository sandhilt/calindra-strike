import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Where a part sits inside its prop and how it is turned, all in the prop's own frame (units, radians). */
interface Placement {
  x: number;
  y: number;
  z: number;
  rot?: readonly [number, number, number];
}

const scratchEuler = new THREE.Euler();
const scratchQuat = new THREE.Quaternion();

/**
 * Collects coloured primitives, each moved into world position by the current base transform, and merges them
 * into one vertex-coloured geometry, so a whole shop of props costs a single draw call.
 */
export class Parts {
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly base = new THREE.Matrix4();

  /** Everything added next is placed relative to this spot, turned by `yaw` around the vertical. */
  at(x: number, y: number, z: number, yaw = 0): this {
    this.base.makeRotationY(yaw).setPosition(x, y, z);
    return this;
  }

  box(w: number, h: number, d: number, color: number, p: Placement): this {
    return this.add(new THREE.BoxGeometry(w, h, d), color, p);
  }

  cylinder(radiusTop: number, radiusBottom: number, h: number, segments: number, color: number, p: Placement): this {
    return this.add(new THREE.CylinderGeometry(radiusTop, radiusBottom, h, segments), color, p);
  }

  sphere(radius: number, color: number, p: Placement): this {
    return this.add(new THREE.SphereGeometry(radius, 12, 8), color, p);
  }

  /** A polygon in the (u, v) plane, v up, extruded `depth` along the third axis from -depth / 2. */
  prism(points: readonly (readonly [number, number])[], depth: number, color: number, p: Placement): this {
    const shape = new THREE.Shape(points.map(([u, v]) => new THREE.Vector2(u, v)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    geometry.translate(0, 0, -depth / 2);
    return this.add(geometry, color, p);
  }

  private add(source: THREE.BufferGeometry, color: number, p: Placement): this {
    const geometry = source.index ? source.toNonIndexed() : source;
    if (geometry !== source) source.dispose();
    if (p.rot) {
      scratchEuler.set(p.rot[0], p.rot[1], p.rot[2]);
      geometry.applyQuaternion(scratchQuat.setFromEuler(scratchEuler));
    }
    geometry.translate(p.x, p.y, p.z);
    geometry.applyMatrix4(this.base);
    const rgb = new THREE.Color(color);
    const count = geometry.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) rgb.toArray(colors, i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.deleteAttribute('uv');
    this.geometries.push(geometry);
    return this;
  }

  /** The merged geometry, or null when nothing was added. Frees the collected pieces. */
  merge(): THREE.BufferGeometry | null {
    if (this.geometries.length === 0) return null;
    const merged = mergeGeometries(this.geometries, false);
    for (const g of this.geometries) g.dispose();
    this.geometries.length = 0;
    merged?.computeBoundingSphere();
    return merged;
  }
}

/** A flat vertex-coloured material for a prop model. Each world builds its own so disposing one never touches another. */
export function newPropMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 });
}
