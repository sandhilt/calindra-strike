import { Mesh, Texture, type Object3D } from 'three';

export function disposeMeshes(roots: readonly (Object3D | null)[], shared: ReadonlySet<{ dispose(): void }>): void {
  const owned = new Set<{ dispose(): void }>();
  for (const root of roots) {
    root?.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      owned.add(object.geometry);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (shared.has(material)) continue;
        owned.add(material);
        for (const value of Object.values(material)) {
          if (value instanceof Texture) owned.add(value);
        }
      }
    });
  }
  for (const resource of owned) {
    if (!shared.has(resource)) resource.dispose();
  }
}
