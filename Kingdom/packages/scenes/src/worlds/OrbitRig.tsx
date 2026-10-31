'use client';

/**
 * Orbit rig pro světy.
 *
 * Scény z `apps/shared/scenes` byly psané proti `<OrbitControls>` z drei:
 * čtou `controls.autoRotate`, `controls.enabled` a `controls.target`.
 * Tady je stejné rozhraní, ale bez drei — ušetří ~100 KB v lazy chunku.
 *
 * Nepanuje (`enablePan` je ve všech světech `false`), nezoomuje kurzorem
 * přes trackpad momentum — jen tažení a kolečko.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

export interface WorldControls {
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  minDistance?: number;
  maxDistance?: number;
  maxPolarAngle?: number;
  target?: [number, number, number];
  enablePan?: boolean;
}

const MIN_POLAR = 0.08;
const DRAG_SPEED = 0.0045;
const ZOOM_SPEED = 0.0012;

const scratch = new THREE.Vector3();
const spherical = new THREE.Spherical();

export function OrbitRig(props: WorldControls) {
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);
  const setState = useThree((state) => state.set);

  const target = useMemo(
    () => new THREE.Vector3(...(props.target ?? [0, 0, 0])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.target?.[0], props.target?.[1], props.target?.[2]],
  );

  /* Rozhraní, které scény očekávají od OrbitControls. */
  const controls = useMemo(
    () => ({
      target,
      enabled: true,
      autoRotate: props.autoRotate ?? false,
      autoRotateSpeed: props.autoRotateSpeed ?? 0.15,
      update: () => {},
      dispose: () => {},
    }),
    [target, props.autoRotate, props.autoRotateSpeed],
  );

  useEffect(() => {
    setState({ controls: controls as never });
    return () => setState({ controls: null as never });
  }, [controls, setState]);

  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  const clampRadius = (radius: number) =>
    Math.min(props.maxDistance ?? 200, Math.max(props.minDistance ?? 6, radius));

  const applyRotation = (deltaTheta: number, deltaPhi: number) => {
    scratch.copy(camera.position).sub(target);
    spherical.setFromVector3(scratch);
    spherical.theta -= deltaTheta;
    spherical.phi = Math.min(
      props.maxPolarAngle ?? Math.PI / 2,
      Math.max(MIN_POLAR, spherical.phi - deltaPhi),
    );
    spherical.radius = clampRadius(spherical.radius);
    scratch.setFromSpherical(spherical);
    camera.position.copy(target).add(scratch);
    camera.lookAt(target);
  };

  useEffect(() => {
    const element = domElement;

    const onPointerDown = (event: PointerEvent) => {
      dragging.current = true;
      last.current = { x: event.clientX, y: event.clientY };
      element.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging.current) return;
      const dx = event.clientX - last.current.x;
      const dy = event.clientY - last.current.y;
      last.current = { x: event.clientX, y: event.clientY };
      applyRotation(dx * DRAG_SPEED, dy * DRAG_SPEED);
    };

    const onPointerUp = (event: PointerEvent) => {
      dragging.current = false;
      element.releasePointerCapture?.(event.pointerId);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      scratch.copy(camera.position).sub(target);
      spherical.setFromVector3(scratch);
      spherical.radius = clampRadius(spherical.radius * (1 + event.deltaY * ZOOM_SPEED));
      scratch.setFromSpherical(spherical);
      camera.position.copy(target).add(scratch);
      camera.lookAt(target);
    };

    element.style.touchAction = 'none';
    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerUp);
    element.addEventListener('pointercancel', onPointerUp);
    element.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', onPointerUp);
      element.removeEventListener('wheel', onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domElement, camera, target]);

  useFrame((_, delta) => {
    if (!controls.enabled || !controls.autoRotate || dragging.current) return;
    const step = Math.min(delta, 0.1) * controls.autoRotateSpeed * 0.35;

    scratch.copy(camera.position).sub(target);
    spherical.setFromVector3(scratch);
    spherical.theta -= step;
    scratch.setFromSpherical(spherical);
    camera.position.copy(target).add(scratch);
    camera.lookAt(target);
  });

  return null;
}
