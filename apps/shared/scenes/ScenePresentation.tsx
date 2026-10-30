/** @jsxRuntime classic */
'use client';

import { React, useThree, useFrame, THREE } from '@genesis/runtime';

type Point = [number, number, number];
let reducedMotion = false;
export const motionTime = (clock: { elapsedTime: number }) => reducedMotion ? 0 : clock.elapsedTime;
export const motionDelta = (delta: number) => reducedMotion ? 0 : Math.min(delta, .1);

/** Shared camera, motion and shadow policy for the twelve project canvases. */
export function ScenePresentation({ camera: initial, target }: { camera: { position: Point; fov: number }; target: Point }) {
  const { camera, size, gl, controls } = useThree();
  const audit = React.useRef(false);
  const counters = React.useRef({ frames: 0, start: 0, shadowAt: -1 });
  React.useLayoutEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const portrait = aspect < 1;
    const factor = portrait ? Math.max(1, .72 / aspect) : 1;
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
    gl.shadowMap.type = THREE.PCFShadowMap;
    const previous = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      preference.removeEventListener('change', update);
      gl.shadowMap.autoUpdate = previous;
      if (audit.current) delete (window as unknown as Record<string, unknown>).__projectScene;
    };
  }, [gl]);

  useFrame(({ clock }) => {
    if (controls && 'autoRotate' in controls) (controls as unknown as { autoRotate: boolean }).autoRotate = !reducedMotion;
    const count = counters.current;
    // Refresh moving silhouettes gently; static surfaces reuse their shadow map.
    if (clock.elapsedTime - count.shadowAt > .5) {
      gl.shadowMap.needsUpdate = true;
      count.shadowAt = clock.elapsedTime;
    }
    if (!audit.current) return;
    const now = performance.now();
    if (!count.start) count.start = now;
    count.frames++;
    (window as unknown as Record<string, unknown>).__projectScene = {
      frames: count.frames, fps: count.frames * 1000 / Math.max(1, now - count.start),
      calls: gl.info.render.calls, triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries, textures: gl.info.memory.textures,
      reducedMotion, autoRotate: controls && 'autoRotate' in controls ? controls.autoRotate : null,
      camera: camera.position.toArray(), fov: camera instanceof THREE.PerspectiveCamera ? camera.fov : null,
    };
  }, -1);
  return null;
}
