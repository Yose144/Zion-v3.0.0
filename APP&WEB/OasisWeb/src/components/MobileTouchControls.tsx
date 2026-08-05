'use client';

import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Lightweight touch camera controls for mobile.
 * - One finger drag: orbit around target
 * - Two finger pinch: zoom in/out
 * - Two finger drag: pan
 *
 * No external deps (no drei OrbitControls which crashes on mobile).
 * Uses spherical coordinates for smooth orbit.
 */
export default function MobileTouchControls({
  target = new THREE.Vector3(0, 0.5, 0),
  minDistance = 6,
  maxDistance = 60,
  rotateSpeed = 0.005,
  zoomSpeed = 0.08,
}: {
  target?: THREE.Vector3;
  minDistance?: number;
  maxDistance?: number;
  rotateSpeed?: number;
  zoomSpeed?: number;
}) {
  const { camera, gl } = useThree();
  const cam = camera as THREE.PerspectiveCamera;

  // Spherical coordinates: theta (azimuth), phi (polar), distance
  const spherical = useRef(new THREE.Spherical());
  const targetRef = useRef(target.clone());

  // Touch state
  const touchState = useRef({
    mode: 'none' as 'none' | 'rotate' | 'pan' | 'zoom',
    lastX: 0,
    lastY: 0,
    lastDist: 0,
    lastMidX: 0,
    lastMidY: 0,
  });

  // Damping for smooth movement
  const targetSpherical = useRef(new THREE.Spherical());
  const targetTarget = useRef(target.clone());
  const dampingFactor = 0.12;

  useEffect(() => {
    const canvas = gl.domElement;

    // Initialize spherical from camera position relative to target
    const offset = new THREE.Vector3().subVectors(cam.position, targetRef.current);
    spherical.current.setFromVector3(offset);
    targetSpherical.current.copy(spherical.current);
    targetTarget.current.copy(targetRef.current);

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1) {
        touchState.current.mode = 'rotate';
        touchState.current.lastX = e.touches[0].clientX;
        touchState.current.lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchState.current.lastDist = Math.sqrt(dx * dx + dy * dy);
        touchState.current.lastMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        touchState.current.lastMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        // If fingers are close → zoom, if far apart → pan
        touchState.current.mode = 'zoom';
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const ts = touchState.current;

      if (e.touches.length === 1 && ts.mode === 'rotate') {
        const dx = e.touches[0].clientX - ts.lastX;
        const dy = e.touches[0].clientY - ts.lastY;

        targetSpherical.current.theta -= dx * rotateSpeed;
        targetSpherical.current.phi -= dy * rotateSpeed;

        // Clamp phi to avoid flipping
        targetSpherical.current.phi = Math.max(0.15, Math.min(Math.PI - 0.15, targetSpherical.current.phi));

        ts.lastX = e.touches[0].clientX;
        ts.lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Pinch zoom
        const deltaDist = ts.lastDist - dist;
        targetSpherical.current.radius += deltaDist * zoomSpeed;
        targetSpherical.current.radius = Math.max(minDistance, Math.min(maxDistance, targetSpherical.current.radius));

        // Two-finger pan
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const panX = (midX - ts.lastMidX) * 0.01;
        const panY = (midY - ts.lastMidY) * 0.01;

        // Pan in camera's local space
        const panOffset = new THREE.Vector3();
        const v = new THREE.Vector3();
        v.setFromMatrixColumn(cam.matrix, 0); // right vector
        panOffset.addScaledVector(v, -panX);
        v.setFromMatrixColumn(cam.matrix, 1); // up vector
        panOffset.addScaledVector(v, panY);
        targetTarget.current.add(panOffset);

        ts.lastDist = dist;
        ts.lastMidX = midX;
        ts.lastMidY = midY;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        touchState.current.mode = 'none';
      } else if (e.touches.length === 1) {
        touchState.current.mode = 'rotate';
        touchState.current.lastX = e.touches[0].clientX;
        touchState.current.lastY = e.touches[0].clientY;
      }
    };

    // Use passive: false to allow preventDefault
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [cam, gl, minDistance, maxDistance, rotateSpeed, zoomSpeed]);

  // Smooth damping toward target spherical each frame
  useFrame(() => {
    // Lerp spherical
    spherical.current.theta += (targetSpherical.current.theta - spherical.current.theta) * dampingFactor;
    spherical.current.phi += (targetSpherical.current.phi - spherical.current.phi) * dampingFactor;
    spherical.current.radius += (targetSpherical.current.radius - spherical.current.radius) * dampingFactor;

    // Lerp target
    targetRef.current.lerp(targetTarget.current, dampingFactor);

    // Apply to camera
    const offset = new THREE.Vector3().setFromSpherical(spherical.current);
    cam.position.copy(targetRef.current).add(offset);
    cam.lookAt(targetRef.current);
  });

  return null;
}
