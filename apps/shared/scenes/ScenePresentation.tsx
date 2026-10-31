/** @jsxRuntime classic */
'use client';

import { React, useThree, useFrame, THREE } from '@genesis/runtime';

type Point = [number, number, number];
let reducedMotion = false;
export const motionTime = (clock: { elapsedTime: number }) => reducedMotion ? 0 : clock.elapsedTime;
export const motionDelta = (delta: number) => reducedMotion ? 0 : Math.min(delta, .1);

/** Shared camera, motion and shadow policy for the twelve project canvases. */
export function ScenePresentation({ camera: initial, target }: { camera: { position: Point; fov: number }; target: Point }) {
  const { camera, size, gl, controls, scene } = useThree();
  const audit = React.useRef(false);
  const counters = React.useRef({ frames: 0, start: 0 });
  const invalidVertices = React.useRef(-1);
  React.useLayoutEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const portrait = aspect < 1;
    const factor = portrait ? Math.max(1, .8 / aspect) : 1;
    camera.position.set(...initial.position).sub(new THREE.Vector3(...target)).multiplyScalar(factor).add(new THREE.Vector3(...target));
    if (camera instanceof THREE.PerspectiveCamera) camera.fov = portrait ? Math.max(initial.fov, 60) : initial.fov;
    camera.lookAt(...target); camera.updateProjectionMatrix();
    gl.shadowMap.needsUpdate = true;
  }, [camera, gl, size.width, size.height, initial, target]);

  React.useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reducedMotion = preference.matches; };
    update(); preference.addEventListener('change', update);
    audit.current = new URLSearchParams(window.location.search).get('sceneAudit') === '1';
    if (audit.current) {
      // Inventory of live geometries so the audit can name the layers that leak.
      (window as unknown as Record<string, unknown>).__projectSceneObjects = () => {
        const list: { type: string; uuid: string; vertices: number; object: string }[] = [];
        scene.traverse(object => {
          const geometry = (object as THREE.Mesh).geometry;
          if (!geometry) return;
          list.push({
            type: geometry.type,
            uuid: geometry.uuid,
            vertices: geometry.getAttribute ? (geometry.getAttribute('position')?.count ?? 0) : 0,
            object: object.type,
          });
        });
        return list;
      };
    }
    gl.shadowMap.type = THREE.PCFShadowMap;
    const previous = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      preference.removeEventListener('change', update);
      gl.shadowMap.autoUpdate = previous;
      if (audit.current) {
        const target = window as unknown as Record<string, unknown>;
        delete target.__projectScene;
        delete target.__projectSceneObjects;
      }
    };
  }, [gl, scene]);

  useFrame(({ clock }) => {
    if (controls && 'autoRotate' in controls) (controls as unknown as { autoRotate: boolean }).autoRotate = !reducedMotion;
    const count = counters.current;
    count.frames++;
    // Refresh moving silhouettes gently; static surfaces reuse their shadow map.
    if (count.frames < 4 || count.frames % 24 === 0) {
      gl.shadowMap.needsUpdate = true;
    }
    if (!audit.current) return;
    if (invalidVertices.current < 0 && count.frames >= 3) {
      let invalid = 0;
      scene.traverse(object => {
        const attribute = (object as THREE.Mesh).geometry?.getAttribute('position');
        if (attribute) for (let i = 0; i < attribute.count; i++) {
          if (![attribute.getX(i), attribute.getY(i), attribute.getZ(i)].every(Number.isFinite)) invalid++;
        }
      });
      invalidVertices.current = invalid;
    }
    const now = performance.now();
    if (!count.start) count.start = now;
    (window as unknown as Record<string, unknown>).__projectScene = {
      frames: count.frames, fps: count.frames * 1000 / Math.max(1, now - count.start),
      calls: gl.info.render.calls, triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries, textures: gl.info.memory.textures,
      invalidVertices: invalidVertices.current,
      reducedMotion, autoRotate: controls && 'autoRotate' in controls ? controls.autoRotate : null,
      camera: camera.position.toArray(), fov: camera instanceof THREE.PerspectiveCamera ? camera.fov : null,
    };
  }, -1);
  return null;
}
