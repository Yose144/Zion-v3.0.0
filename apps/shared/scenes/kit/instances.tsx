/** @jsxRuntime classic */
'use client';

/**
 * Instanced repeated props.
 *
 * A stone circle, a row of lamp posts or a scatter of rocks is one draw call here, not one
 * per object. Scenes should use this before they reach for a `map()` that returns meshes —
 * draw calls, not triangles, are what usually limits a scene on mobile.
 */

import { React, THREE } from '@genesis/runtime';

export interface InstanceItem {
  position: [number, number, number];
  rotation?: [number, number, number];
  /** Uniform scale or per-axis triple. */
  scale?: number | [number, number, number];
  /** Per-instance tint (multiplies the material colour and its map). */
  color?: string;
}

export interface SceneInstancesProps {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: InstanceItem[];
  castShadow?: boolean;
  receiveShadow?: boolean;
  /** Disable culling for scattered instances whose geometry bounds do not cover them. */
  frustumCulled?: boolean;
}

export function SceneInstances({
  geometry,
  material,
  items,
  castShadow = true,
  receiveShadow = true,
  frustumCulled = false,
}: SceneInstancesProps) {
  const mesh = React.useRef<THREE.InstancedMesh>(null);

  React.useLayoutEffect(() => {
    const node = mesh.current;
    if (!node) return;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const size = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const color = new THREE.Color();
    items.forEach((item, index) => {
      const [rx, ry, rz] = item.rotation ?? [0, 0, 0];
      rotation.set(rx, ry, rz);
      quaternion.setFromEuler(rotation);
      position.set(...item.position);
      const scale = item.scale ?? 1;
      if (typeof scale === 'number') size.setScalar(scale);
      else size.set(...scale);
      matrix.compose(position, quaternion, size);
      node.setMatrixAt(index, matrix);
      if (item.color) {
        color.set(item.color);
        node.setColorAt(index, color);
      }
    });
    node.instanceMatrix.needsUpdate = true;
    if (node.instanceColor) node.instanceColor.needsUpdate = true;
  }, [items]);

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, items.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      frustumCulled={frustumCulled}
    />
  );
}
