'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { loadTsl } from '../../lib/tsl';

interface TslAtmosphereProps {
  color: string;
  size: number;
  intensity?: number;
  power?: number;
}

/**
 * Fresnel atmosphere glow on a MeshBasicNodeMaterial — the WebGPU
 * counterpart of the GLSL `atmosphereMaterial` used on WebGL2.
 * Rim brightens with viewing angle: f = (1 - |N·V|)^power.
 */
export default function TslAtmosphere({ color, size, intensity = 0.75, power = 2.4 }: TslAtmosphereProps) {
  const holderRef = useRef<THREE.Group>(null);

  useEffect(() => {
    let live = true;
    let mesh: THREE.Mesh | null = null;
    loadTsl().then((tsl) => {
      if (!live || !holderRef.current) return;
      const c = new THREE.Color(color);
      const mat = new tsl.MeshBasicNodeMaterial();
      const fresnel = tsl.normalView
        .dot(tsl.positionViewDirection)
        .abs()
        .oneMinus()
        .pow(power)
        .mul(intensity);
      mat.colorNode = tsl.vec3(c.r, c.g, c.b).mul(fresnel);
      mat.opacityNode = fresnel;
      mat.transparent = true;
      mat.blending = THREE.AdditiveBlending;
      mat.depthWrite = false;
      mat.toneMapped = false;
      mat.side = THREE.FrontSide;

      mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 48, 48), mat);
      mesh.scale.setScalar(1.12);
      holderRef.current.add(mesh);
    });

    return () => {
      live = false;
      if (mesh && holderRef.current) {
        holderRef.current.remove(mesh);
        (mesh.material as THREE.Material).dispose();
        mesh.geometry.dispose();
      }
    };
  }, [color, size, intensity, power]);

  return <group ref={holderRef} />;
}
