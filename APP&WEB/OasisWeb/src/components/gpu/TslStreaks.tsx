'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { loadTsl } from '../../lib/tsl';

interface TslStreaksProps {
  /** geometry with position(vec3) + per-point aSpeed(float), aOffset(float), aColor(vec3) */
  geometry: THREE.BufferGeometry;
  /** matches the GLSL uSize uniform — pixel diameter at unit view distance ≈ size*300 */
  size?: number;
}

/**
 * WebGPU/TSL replacement for GalaxyCore's GLSL StreakMaterial.
 *
 * WebGPU point primitives are fixed at 1px, so streaks are rendered as
 * screen-aligned instanced quads via InstancedPointsNodeMaterial. The
 * vertex/fragment node flow replicates the material's built-in shaders,
 * with the z-position wrap-around driven by the same attributes.
 */
export default function TslStreaks({ geometry, size = 0.18 }: TslStreaksProps) {
  const holderRef = useRef<THREE.Group>(null);

  useEffect(() => {
    let live = true;
    let mesh: THREE.Mesh | null = null;
    let quadGeo: THREE.InstancedBufferGeometry | null = null;

    loadTsl().then((tsl) => {
      if (!live || !holderRef.current) return;

      const count = (geometry.getAttribute('position') as THREE.BufferAttribute).count;

      quadGeo = new THREE.InstancedBufferGeometry();
      // unit quad — positionGeometry.xy is the screen-space offset corner
      quadGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
      ]), 3));
      quadGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
        0, 0, 1, 0, 1, 1, 0, 1,
      ]), 2));
      quadGeo.setIndex([0, 1, 2, 0, 2, 3]);
      quadGeo.instanceCount = count;

      const instanced = (name: string, src: THREE.BufferAttribute) => {
        quadGeo!.setAttribute(name, new THREE.InstancedBufferAttribute(
          (src.array as Float32Array).slice(), src.itemSize));
      };
      instanced('instancePosition', geometry.getAttribute('position') as THREE.BufferAttribute);
      instanced('aSpeed', geometry.getAttribute('aSpeed') as THREE.BufferAttribute);
      instanced('aOffset', geometry.getAttribute('aOffset') as THREE.BufferAttribute);
      instanced('aColor', geometry.getAttribute('aColor') as THREE.BufferAttribute);

      const mat = new tsl.InstancedPointsNodeMaterial();
      mat.transparent = true;
      mat.depthWrite = false;
      mat.blending = THREE.AdditiveBlending;
      mat.toneMapped = false;

      // pointWidthNode is interpreted as 2× the on-screen pixel diameter
      // (quad half-extents ±0.5 → screen width = pointWidth/2 px), so the
      // GLSL `uSize * 300 / -z` formula is doubled to keep visual parity.
      const diameterPx = size * 300;

      mat.setupShaders = () => {
        const aSpeed = tsl.attribute('aSpeed');
        const aOffset = tsl.attribute('aOffset');
        const aColor = tsl.attribute('aColor');
        const base = tsl.attribute('instancePosition').xyz;

        // z = mod(pos.z + t*speed*10 + offset, 10) - 5 — written as an
        // explicit floor-mod so negative speeds wrap correctly in WGSL
        // (WGSL `%` is truncated remainder, not GLSL floor-mod).
        const travel = base.z.add(tsl.timerLocal().mul(aSpeed).mul(10)).add(aOffset);
        const z = travel.sub(travel.div(10).floor().mul(10)).sub(5);
        const instPos = tsl.vec3(base.x, base.y, z);

        const mvPos = tsl.modelViewMatrix.mul(tsl.vec4(instPos, 1));
        const clipPos = tsl.cameraProjectionMatrix.mul(mvPos).toVar();
        const widthPx = tsl.float(diameterPx).mul(2).div(mvPos.z.negate());
        const aspect = tsl.viewport.z.div(tsl.viewport.w);
        const offset = tsl.positionGeometry.xy.toVar();
        offset.mulAssign(widthPx);
        offset.assign(offset.div(tsl.viewport.z));
        offset.y.assign(offset.y.mul(aspect));
        offset.assign(offset.mul(clipPos.w));
        clipPos.addAssign(tsl.vec4(offset, 0, 0));
        mat.vertexNode = clipPos;

        // radial alpha matching smoothstep(0.5,0,length(gl_PointCoord-0.5))*0.85
        const len = tsl.length(tsl.uv().mul(2).sub(1));
        const alpha = tsl.smoothstep(1, 0, len).mul(0.85);
        mat.fragmentNode = tsl.vec4(aColor, alpha);
      };

      mesh = new THREE.Mesh(quadGeo, mat);
      mesh.frustumCulled = false;
      holderRef.current.add(mesh);
    });

    return () => {
      live = false;
      if (mesh && holderRef.current) {
        holderRef.current.remove(mesh);
        (mesh.material as THREE.Material).dispose();
      }
      quadGeo?.dispose();
    };
  }, [geometry, size]);

  return <group ref={holderRef} />;
}
